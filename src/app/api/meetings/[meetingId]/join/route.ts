import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { AccessToken } from "livekit-server-sdk";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHost } from "@/lib/auth";
import { getPlanConfig } from "@/lib/plans";

export const runtime = "nodejs";

function isEmailAllowed(email: string, allowlist: string[]): boolean {
  const normalized = email.trim().toLowerCase();
  const domain = normalized.includes("@") ? `@${normalized.split("@")[1]}` : "";
  return allowlist.some((entry) => {
    const clean = entry.trim().toLowerCase();
    if (!clean) return false;
    if (clean.startsWith("@")) {
      return domain === clean;
    }
    return normalized === clean;
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: params.meetingId },
    include: {
      host: {
        select: { plan: true }
      },
      uploads: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          uploaderName: true,
          fileCount: true,
          totalBytes: true,
          createdAt: true
        }
      }
    }
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  let displayName = (body.displayName || "Guest").trim().slice(0, 60) || "Guest";
  const providedPasscode = typeof body.passcode === "string" ? body.passcode.trim() : "";
  const inviteToken = typeof body.inviteToken === "string" ? body.inviteToken.trim() : "";

  const authUser = await getAuthenticatedHost(req);
  const hostCookie = req.cookies.get(`livesite_host_${meeting.id}`)?.value;
  const isHost =
    (authUser && authUser.id === meeting.hostId) ||
    hostCookie === meeting.hostId;

  const existingSessionId = req.cookies.get(`livesite_session_${meeting.id}`)?.value;

  // Anti-raid check 1: Banned user or session
  if (!isHost) {
    if (authUser && meeting.bannedUserIds.includes(authUser.id)) {
      return NextResponse.json(
        { error: "You have been removed from this meeting by the host." },
        { status: 403 }
      );
    }
    if (existingSessionId) {
      const prevSession = await prisma.attendeeSession.findFirst({
        where: { id: existingSessionId, meetingId: meeting.id }
      });
      if (prevSession?.isBanned) {
        return NextResponse.json(
          { error: "You have been removed from this meeting by the host." },
          { status: 403 }
        );
      }
    }
  }

  // Anti-raid check 2: Meeting locked by host
  if (!isHost && meeting.isLocked) {
    return NextResponse.json(
      { error: "This meeting has been locked by the host." },
      { status: 403 }
    );
  }

  // Anti-raid check 3: Personal single-device invite link
  let isVerified = Boolean(authUser?.email);
  let verifiedEmail: string | null = authUser?.email ?? null;
  let claimedInviteId: string | null = null;

  if (!isHost && inviteToken) {
    const invite = await prisma.meetingInvite.findUnique({
      where: { token: inviteToken }
    });
    if (!invite || invite.meetingId !== meeting.id) {
      return NextResponse.json(
        { error: "Invalid personal invite link." },
        { status: 403 }
      );
    }
    if (
      invite.claimedSessionId &&
      invite.claimedSessionId !== existingSessionId
    ) {
      const activeClaimed = await prisma.attendeeSession.findFirst({
        where: {
          id: invite.claimedSessionId,
          meetingId: meeting.id,
          isBanned: false,
          leftAt: null
        }
      });
      if (activeClaimed) {
        return NextResponse.json(
          {
            error:
              "This personal invite link is already active on another device."
          },
          { status: 403 }
        );
      }
    }
    displayName = invite.label;
    isVerified = true;
    verifiedEmail = invite.email || verifiedEmail;
    claimedInviteId = invite.id;
  }

  // Anti-raid check 4: Email / domain allowlist (unless joining via valid personal invite)
  if (!isHost && meeting.allowedEmails.length > 0 && !claimedInviteId) {
    if (!authUser?.email) {
      return NextResponse.json(
        {
          error: "This meeting requires signing in with an approved email address.",
          requiresAuth: true
        },
        { status: 401 }
      );
    }
    if (!isEmailAllowed(authUser.email, meeting.allowedEmails)) {
      return NextResponse.json(
        {
          error: `Your email (${authUser.email}) is not on this meeting's approved list.`
        },
        { status: 403 }
      );
    }
    isVerified = true;
    verifiedEmail = authUser.email;
  }

  // Anti-raid check 5: Passcode gate (unless host or personal invite)
  if (!isHost && meeting.passcode && !claimedInviteId) {
    if (!providedPasscode || providedPasscode !== meeting.passcode) {
      return NextResponse.json(
        {
          error: providedPasscode
            ? "Incorrect meeting passcode."
            : "This meeting requires a passcode.",
          requiresPasscode: true
        },
        { status: 401 }
      );
    }
  }

  // Plan participant cap check
  const planConfig = getPlanConfig(meeting.host.plan);
  if (!isHost) {
    const activeCount = await prisma.attendeeSession.count({
      where: {
        meetingId: meeting.id,
        isBanned: false,
        leftAt: null
      }
    });
    if (activeCount >= planConfig.maxParticipants) {
      return NextResponse.json(
        {
          error: `This meeting has reached its ${planConfig.name} plan limit of ${planConfig.maxParticipants} participants.`
        },
        { status: 403 }
      );
    }
  }

  const randomSlug = crypto.randomBytes(6).toString("hex");
  const sessionSubdomain = `s-${randomSlug}`;
  const rawToken = crypto.randomBytes(24).toString("hex");
  const sessionTokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const attendeeSession = await prisma.attendeeSession.create({
    data: {
      meetingId: meeting.id,
      userId: authUser?.id ?? null,
      displayName,
      verifiedEmail,
      isVerified: Boolean(isHost || isVerified),
      isHost: Boolean(isHost),
      inviteToken: inviteToken || null,
      sessionSubdomain,
      sessionTokenHash
    }
  });

  if (claimedInviteId) {
    await prisma.meetingInvite.update({
      where: { id: claimedInviteId },
      data: { claimedSessionId: attendeeSession.id }
    });
  }

  let livekitToken = "local-dev-token";
  if (process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET) {
    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET,
      {
        identity: attendeeSession.id,
        name: displayName
      }
    );
    at.addGrant({
      roomJoin: true,
      room: meeting.id,
      canPublish: true,
      canSubscribe: true
    });
    livekitToken = await at.toJwt();
  }

  const sitesBaseDomain =
    process.env.NEXT_PUBLIC_SITES_BASE_DOMAIN || "sites.localhost:3000";
  const protocol = sitesBaseDomain.includes("localhost") ? "http" : "https";
  const singleHostMode = process.env.NEXT_PUBLIC_SITES_SINGLE_HOST === "true";
  const iframeBaseUrl = singleHostMode
    ? `${protocol}://${sitesBaseDomain}/s/${sessionSubdomain}`
    : `${protocol}://${sessionSubdomain}.${sitesBaseDomain}`;

  const response = NextResponse.json({
    sessionId: attendeeSession.id,
    sessionSubdomain,
    iframeUrl: `${iframeBaseUrl}/index.html`,
    iframeBaseUrl,
    isHost: Boolean(isHost),
    isVerified: Boolean(isHost || isVerified),
    verifiedEmail,
    displayName,
    livekitToken,
    livekitUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL || "wss://placeholder.livekit.cloud",
    hasActiveSite: Boolean(meeting.activeUploadId),
    activeUploadId: meeting.activeUploadId,
    uploads: meeting.uploads,
    meetingStatus: meeting.status,
    isLocked: meeting.isLocked,
    safeMode: meeting.safeMode,
    stageMode: meeting.stageMode,
    hasActivePdf: Boolean(meeting.activePdfPath),
    activePdfName: meeting.activePdfName,
    activePdfPage: meeting.activePdfPage,
    hostPlan: meeting.host.plan,
    planConfig
  });

  response.cookies.set(`livesite_session_${meeting.id}`, attendeeSession.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });

  return response;
}
