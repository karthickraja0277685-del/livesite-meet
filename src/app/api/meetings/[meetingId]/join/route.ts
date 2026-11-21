import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { AccessToken } from "livekit-server-sdk";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHost } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: params.meetingId },
    include: {
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
  const displayName = (body.displayName || "Guest").trim().slice(0, 60);

  const authUser = await getAuthenticatedHost(req);
  const hostCookie = req.cookies.get(`livesite_host_${meeting.id}`)?.value;
  const isHost =
    (authUser && authUser.id === meeting.hostId) ||
    hostCookie === meeting.hostId;

  // Generate a cryptographically random subdomain label so this attendee gets
  // their own unique browser origin: `http://{sessionSubdomain}.sites.localhost:3000`
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
      isHost: Boolean(isHost),
      sessionSubdomain,
      sessionTokenHash
    }
  });

  // Create a LiveKit WebRTC token for video/audio participation
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
    displayName,
    livekitToken,
    livekitUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL || "wss://placeholder.livekit.cloud",
    hasActiveSite: Boolean(meeting.activeUploadId),
    activeUploadId: meeting.activeUploadId,
    uploads: meeting.uploads,
    meetingStatus: meeting.status
  });

  // Store HttpOnly session cookie so joined participants can upload their own sites
  response.cookies.set(`livesite_session_${meeting.id}`, attendeeSession.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });

  return response;
}
