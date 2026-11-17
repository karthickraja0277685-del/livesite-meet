import React from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MeetingWorkspace } from "@/components/MeetingWorkspace";

export default async function MeetingRoomPage({
  params
}: {
  params: { meetingId: string };
}) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: params.meetingId },
    select: { id: true, title: true }
  });

  if (!meeting) {
    notFound();
  }

  return <MeetingWorkspace meetingId={meeting.id} meetingTitle={meeting.title} />;
}