import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedHost } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { getLocalTestSiteStore } from "@/lib/cleanup";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { meetingId: string; uploadId: string } }
) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: params.meetingId }
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  const authUser = await getAuthenticatedHost(req);
  const hostCookie = req.cookies.get(`livesite_host_${meeting.id}`)?.value;
  const isAuthorizedHost =
    (authUser && authUser.id === meeting.hostId) ||
    hostCookie === meeting.hostId;

  if (!isAuthorizedHost) {
    return NextResponse.json(
      { error: "Forbidden: Only the host can delete uploaded sites." },
      { status: 403 }
    );
  }

  const upload = await prisma.siteUpload.findFirst({
    where: { id: params.uploadId, meetingId: meeting.id }
  });

  if (!upload) {
    return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  }

  getLocalTestSiteStore().delete(`${meeting.id}:${upload.id}`);

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    const supabaseAdmin = createSupabaseServiceClient();
    const manifest = (upload.fileManifest as string[]) || [];
    const pathsToRemove = [
      `${upload.storagePrefix}/source.zip`,
      ...manifest.map((relPath) => `${upload.storagePrefix}/extracted/${relPath}`)
    ];
    if (pathsToRemove.length > 0) {
      await supabaseAdmin.storage.from("meeting-sites").remove(pathsToRemove);
    }

    await supabaseAdmin.channel(`meeting:${meeting.id}`).send({
      type: "broadcast",
      event: "site-deleted",
      payload: { uploadId: upload.id }
    });
  }

  await prisma.siteUpload.delete({ where: { id: upload.id } });

  if (meeting.activeUploadId === upload.id) {
    const nextUpload = await prisma.siteUpload.findFirst({
      where: { meetingId: meeting.id },
      orderBy: { createdAt: "desc" }
    });
    await prisma.meeting.update({
      where: { id: meeting.id },
      data: { activeUploadId: nextUpload?.id ?? null }
    });
  }

  return NextResponse.json({ ok: true, deletedUploadId: upload.id });
}
