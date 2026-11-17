import { prisma } from "./prisma";
import { createSupabaseServiceClient } from "@/lib/supabase";

type LocalSiteStore = Map<string, Map<string, { data: Buffer; contentType: string }>>;

const globalForCleanup = globalThis as unknown as {
  localTestSiteMemory: LocalSiteStore | undefined;
};

// Local fallback memory cache shared across all routes via globalThis
const localTestSiteMemory: LocalSiteStore =
  globalForCleanup.localTestSiteMemory ?? new Map();

if (!globalForCleanup.localTestSiteMemory) {
  globalForCleanup.localTestSiteMemory = localTestSiteMemory;
}

export function getLocalTestSiteStore() {
  return localTestSiteMemory;
}

// Deletes all stored files in Supabase Storage (and local test memory) for a specific meeting.
export async function deleteMeetingFiles(meetingId: string): Promise<void> {
  const uploads = await prisma.siteUpload.findMany({
    where: { meetingId }
  });

  localTestSiteMemory.delete(meetingId);

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder") &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    const supabaseAdmin = createSupabaseServiceClient();
    for (const upload of uploads) {
      const manifest = (upload.fileManifest as string[]) || [];
      const pathsToRemove = [
        `${upload.storagePrefix}/source.zip`,
        ...manifest.map((relPath) => `${upload.storagePrefix}/extracted/${relPath}`)
      ];
      if (pathsToRemove.length > 0) {
        await supabaseAdmin.storage.from("meeting-sites").remove(pathsToRemove);
      }
    }
  }

  await prisma.siteUpload.deleteMany({ where: { meetingId } });
}

// Automatically cleans up any meetings that passed their 24-hour expiration timestamp.
export async function purgeExpiredMeetings(): Promise<number> {
  const now = new Date();
  const expiredMeetings = await prisma.meeting.findMany({
    where: {
      OR: [
        { status: "ACTIVE", expiresAt: { lte: now } },
        { status: "ENDED", uploads: { some: {} } }
      ]
    },
    select: { id: true }
  });

  for (const m of expiredMeetings) {
    await deleteMeetingFiles(m.id);
    await prisma.meeting.update({
      where: { id: m.id },
      data: { status: "ENDED", endedAt: now, activeUploadId: null }
    });
  }

  return expiredMeetings.length;
}