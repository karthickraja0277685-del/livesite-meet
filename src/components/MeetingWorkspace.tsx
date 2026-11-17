"use client";

import React, { useEffect, useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  useParticipants,
  useLocalParticipant,
  RoomAudioRenderer
} from "@livekit/components-react";
import "@livekit/components-styles";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/primitives";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Upload,
  LogOut,
  XCircle,
  Users,
  Globe
} from "lucide-react";

interface MeetingWorkspaceProps {
  meetingId: string;
  meetingTitle: string;
}

interface JoinResponse {
  sessionId: string;
  sessionSubdomain: string;
  iframeUrl: string;
  isHost: boolean;
  displayName: string;
  livekitToken: string;
  livekitUrl: string;
  hasActiveSite: boolean;
  meetingStatus: "ACTIVE" | "ENDED";
}

function LiveKitSidebarControls({
  onLeave,
  isHost,
  onEndMeeting
}: {
  onLeave: () => void;
  isHost: boolean;
  onEndMeeting: () => void;
}) {
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } =
    useLocalParticipant();

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-white/10 bg-neutral-900 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
          <Users className="h-3.5 w-3.5" />
          <span>Participants ({participants.length})</span>
        </div>
        <ul className="space-y-1.5 max-h-36 overflow-y-auto text-sm">
          {participants.map((p) => (
            <li
              key={p.identity}
              className="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5 text-neutral-200"
            >
              <span className="truncate">{p.name || p.identity}</span>
              <span className="text-[11px] text-emerald-400">Live</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="glass"
          onClick={() =>
            localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
          }
          data-testid="toggle-mic-btn"
        >
          {isMicrophoneEnabled ? (
            <>
              <Mic className="mr-1.5 h-4 w-4 text-emerald-400" /> Mute
            </>
          ) : (
            <>
              <MicOff className="mr-1.5 h-4 w-4 text-red-400" /> Unmute
            </>
          )}
        </Button>

        <Button
          variant="glass"
          onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
          data-testid="toggle-cam-btn"
        >
          {isCameraEnabled ? (
            <>
              <Video className="mr-1.5 h-4 w-4 text-emerald-400" /> Stop Cam
            </>
          ) : (
            <>
              <VideoOff className="mr-1.5 h-4 w-4 text-red-400" /> Start Cam
            </>
          )}
        </Button>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onLeave}
          data-testid="leave-meeting-btn"
        >
          <LogOut className="mr-1.5 h-4 w-4" /> Leave
        </Button>
        {isHost && (
          <Button
            variant="danger"
            className="flex-1"
            onClick={onEndMeeting}
            data-testid="end-meeting-btn"
          >
            <XCircle className="mr-1.5 h-4 w-4" /> End Meeting
          </Button>
        )}
      </div>
    </div>
  );
}

export function MeetingWorkspace({
  meetingId,
  meetingTitle
}: MeetingWorkspaceProps) {
  const [guestName, setGuestName] = useState("");
  const [session, setSession] = useState<JoinResponse | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [iframeVersion, setIframeVersion] = useState(1);
  const [meetingEnded, setMeetingEnded] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);
    setJoinError(null);

    try {
      const res = await fetch(`/api/meetings/${meetingId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: guestName || "Guest Attendee" })
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || "Could not join meeting.");
      } else {
        setSession(data);
        if (data.meetingStatus === "ENDED") {
          setMeetingEnded(true);
        }
      }
    } catch {
      setJoinError("Network error while joining meeting.");
    } finally {
      setJoining(false);
    }
  };

  // Subscribe to Supabase Realtime channel for instant site-upload and meeting-end updates
  useEffect(() => {
    if (!session) return;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl.includes("placeholder")) return;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`meeting:${meetingId}`)
      .on("broadcast", { event: "site-uploaded" }, () => {
        setSession((prev) => (prev ? { ...prev, hasActiveSite: true } : prev));
        setIframeVersion((v) => v + 1);
      })
      .on("broadcast", { event: "meeting-ended" }, () => {
        setMeetingEnded(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, meetingId]);

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    setUploadStatus("Validating & extracting ZIP...");
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/meetings/${meetingId}/upload`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Upload failed.");
        setUploadStatus(null);
      } else {
        setUploadStatus(`Uploaded ${data.fileCount} files (${Math.round(data.totalBytes / 1024)} KB)`);
        setSession((prev) => (prev ? { ...prev, hasActiveSite: true } : prev));
        setIframeVersion((v) => v + 1);
      }
    } catch {
      setUploadError("Network error during upload.");
      setUploadStatus(null);
    }
  };

  const handleEndMeeting = async () => {
    const res = await fetch(`/api/meetings/${meetingId}/end`, {
      method: "POST"
    });
    if (res.ok) {
      setMeetingEnded(true);
    }
  };

  if (meetingEnded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050508] p-6 text-white">
        <div className="max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Meeting Ended</h2>
          <p className="text-neutral-400 text-sm mb-6">
            The host has ended this session and all uploaded static website files have been permanently deleted.
          </p>
          <Button onClick={() => (window.location.href = "/")}>
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050508] p-6 text-white">
        <form
          onSubmit={handleJoin}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-8 space-y-4"
        >
          <h1 className="text-2xl font-bold">{meetingTitle}</h1>
          <p className="text-sm text-neutral-400">
            Enter your display name to join the live meeting and get your own isolated website session.
          </p>
          <input
            type="text"
            required
            placeholder="Your display name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            data-testid="join-name-input"
            className="flex h-11 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
          />
          {joinError && <p className="text-sm text-red-400">{joinError}</p>}
          <Button
            type="submit"
            disabled={joining}
            className="w-full"
            data-testid="join-submit-btn"
          >
            {joining ? "Launching Isolated Session..." : "Join Meeting"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden bg-[#050508] text-white">
      {/* MAIN AREA: Independent Sandboxed Website Session */}
      <main className="relative flex-1 flex flex-col h-full overflow-hidden border-b lg:border-b-0 lg:border-r border-white/10">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-neutral-950 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <Globe className="h-4 w-4 text-cyan-400" />
            <span className="font-semibold text-sm">{meetingTitle}</span>
            <span
              className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-neutral-300"
              data-testid="session-origin-badge"
            >
              Isolated Origin: {session.sessionSubdomain}
            </span>
          </div>

          {session.isHost && (
            <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Site ZIP</span>
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleZipUpload}
                  className="hidden"
                  data-testid="host-zip-input"
                />
              </label>
              {uploadStatus && (
                <span
                  className="text-xs text-emerald-400"
                  data-testid="upload-status-msg"
                >
                  {uploadStatus}
                </span>
              )}
              {uploadError && (
                <span
                  className="text-xs text-red-400"
                  data-testid="upload-error-msg"
                >
                  {uploadError}
                </span>
              )}
            </div>
          )}
        </header>

        <div className="flex-1 bg-neutral-900 relative">
          {session.hasActiveSite ? (
            <iframe
              key={iframeVersion}
              src={`${session.iframeUrl}?v=${iframeVersion}`}
              title="Isolated Live Website Session"
              data-testid="isolated-site-iframe"
              // Security: `allow-scripts allow-forms allow-same-origin allow-modals` lets the static site
              // use its own localStorage/cookies on its unique `{sessionSubdomain}.sites.*` origin
              // while blocking popups, top-window redirects, and pointer lock.
              sandbox="allow-scripts allow-forms allow-same-origin allow-modals"
              className="h-full w-full border-0 bg-white"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-neutral-400">
              <p className="text-base font-medium text-neutral-200 mb-1">
                No website uploaded yet
              </p>
              <p className="text-xs max-w-sm">
                {session.isHost
                  ? "Click 'Upload Site ZIP' above to upload a static website containing an index.html file."
                  : "Waiting for the host to upload and present the live website."}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* SIDEBAR: LiveKit Video, Participant Roster, and Audio/Video/Meeting Controls */}
      <aside className="w-full lg:w-80 xl:w-96 flex flex-col justify-between bg-neutral-950 p-4 gap-4 overflow-y-auto">
        {session.livekitUrl && !session.livekitUrl.includes("placeholder") ? (
          <LiveKitRoom
            serverUrl={session.livekitUrl}
            token={session.livekitToken}
            connect={true}
            video={true}
            audio={true}
            className="flex flex-col flex-1 justify-between gap-4"
          >
            <div className="rounded-xl overflow-hidden border border-white/10 bg-black flex-1 min-h-[220px]">
              <VideoConference />
              <RoomAudioRenderer />
            </div>
            <LiveKitSidebarControls
              onLeave={() => (window.location.href = "/")}
              isHost={session.isHost}
              onEndMeeting={handleEndMeeting}
            />
          </LiveKitRoom>
        ) : (
          // Local / E2E Test fallback when LiveKit Cloud URL is not configured
          <div className="flex flex-col flex-1 justify-between gap-4">
            <div className="rounded-xl border border-white/10 bg-neutral-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2">
                Host & Attendee Video Stage
              </p>
              <div className="aspect-video rounded-lg bg-neutral-800 flex items-center justify-center text-xs text-neutral-300">
                {session.displayName} ({session.isHost ? "Host" : "Attendee"})
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => (window.location.href = "/")}
                data-testid="leave-meeting-btn"
              >
                <LogOut className="mr-1.5 h-4 w-4" /> Leave
              </Button>
              {session.isHost && (
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={handleEndMeeting}
                  data-testid="end-meeting-btn"
                >
                  <XCircle className="mr-1.5 h-4 w-4" /> End Meeting
                </Button>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}