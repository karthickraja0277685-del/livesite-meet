"use client";

import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
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
import PdfSlideViewer from "@/components/PdfSlideViewer";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Upload,
  LogOut,
  XCircle,
  Users,
  Globe,
  Copy,
  Check,
  QrCode,
  Trash2,
  Compass,
  Lock,
  Unlock,
  ShieldAlert,
  ShieldCheck,
  Hand,
  MessageSquare,
  StickyNote,
  Download,
  Monitor,
  Tablet,
  Smartphone,
  Timer,
  FileText,
  UserPlus,
  Ban,
  Sparkles
} from "lucide-react";

interface MeetingWorkspaceProps {
  meetingId: string;
  meetingTitle: string;
}

interface SiteUploadSummary {
  id: string;
  uploaderName: string;
  fileCount: number;
  totalBytes: number;
  createdAt: string;
}

interface PlanConfig {
  tier: "FREE" | "PLUS" | "PRO";
  name: string;
  maxParticipants: number;
  maxZipMb: number;
  allowFeedbackExport: boolean;
  allowPersonalInvites: boolean;
  allowSafeMode: boolean;
}

interface JoinResponse {
  sessionId: string;
  sessionSubdomain: string;
  iframeUrl: string;
  iframeBaseUrl: string;
  isHost: boolean;
  isVerified: boolean;
  verifiedEmail: string | null;
  displayName: string;
  livekitToken: string;
  livekitUrl: string;
  hasActiveSite: boolean;
  activeUploadId: string | null;
  uploads: SiteUploadSummary[];
  meetingStatus: "ACTIVE" | "ENDED";
  isLocked: boolean;
  safeMode: boolean;
  stageMode: "SITE" | "SLIDES";
  hasActivePdf: boolean;
  activePdfName: string | null;
  activePdfPage: number;
  planConfig: PlanConfig;
}

interface ParticipantRow {
  id: string;
  displayName: string;
  isHost: boolean;
  isVerified: boolean;
  verifiedEmail: string | null;
  handRaised: boolean;
  handRaisedAt: string | null;
}

interface ChatRow {
  id: string;
  senderName: string;
  isHost: boolean;
  message: string;
  createdAt: string;
}

interface NoteRow {
  id: string;
  authorName: string;
  pagePath: string;
  viewport: string;
  content: string;
  createdAt: string;
}

interface PersonalInviteRow {
  id: string;
  label: string;
  email: string | null;
  token: string;
  claimedSessionId: string | null;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  sender: string;
}

function LiveKitSidebarControls({
  onLeave,
  isHost,
  safeMode,
  onEndMeeting
}: {
  onLeave: () => void;
  isHost: boolean;
  safeMode: boolean;
  onEndMeeting: () => void;
}) {
  const participants = useParticipants();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } =
    useLocalParticipant();
  const safeMutedRef = useRef(false);

  useEffect(() => {
    if (safeMode && !isHost && !safeMutedRef.current && localParticipant) {
      safeMutedRef.current = true;
      localParticipant.setMicrophoneEnabled(false).catch(() => {});
      localParticipant.setCameraEnabled(false).catch(() => {});
    }
  }, [safeMode, isHost, localParticipant]);

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-white/10 bg-neutral-900 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
          <Users className="h-3.5 w-3.5" />
          <span>LiveKit Audio/Video ({participants.length})</span>
        </div>
        <ul className="space-y-1.5 max-h-28 overflow-y-auto text-sm">
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
  const [websiteTrap, setWebsiteTrap] = useState("");
  const [passcodeInput, setPasscodeInput] = useState("");
  const [requiresPasscode, setRequiresPasscode] = useState(false);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [inviteToken, setInviteToken] = useState("");

  const [session, setSession] = useState<JoinResponse | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const [uploads, setUploads] = useState<SiteUploadSummary[]>([]);
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const [iframePagePath, setIframePagePath] = useState("index.html");
  const [syncInputPath, setSyncInputPath] = useState("index.html");
  const [viewport, setViewport] = useState<"DESKTOP" | "TABLET" | "MOBILE">("DESKTOP");

  const [stageMode, setStageMode] = useState<"SITE" | "SLIDES">("SITE");
  const [hasActivePdf, setHasActivePdf] = useState(false);
  const [activePdfName, setActivePdfName] = useState<string | null>(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfVersion, setPdfVersion] = useState(1);

  const [isLocked, setIsLocked] = useState(false);
  const [safeMode, setSafeMode] = useState(false);

  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [iframeVersion, setIframeVersion] = useState(1);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [kickedOut, setKickedOut] = useState(false);

  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [personalInvites, setPersonalInvites] = useState<PersonalInviteRow[]>([]);
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [mobileTab, setMobileTab] = useState<"site" | "call">("site");
  const [sidebarTab, setSidebarTab] = useState<"video" | "people" | "chat" | "notes" | "ai">("video");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiReply, setAiReply] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuota, setAiQuota] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; uploadId?: string } | null>(null);

  const [participantsList, setParticipantsList] = useState<ParticipantRow[]>([]);
  const [handRaised, setHandRaised] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatRow[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [notesList, setNotesList] = useState<NoteRow[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const realtimeChannelRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const tok = sp.get("invite") || "";
      if (tok) setInviteToken(tok);
    }
  }, []);

  const meetingShareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/meet/${meetingId}`
      : `/meet/${meetingId}`;

  const fetchCollaborationData = async (isHostUser: boolean) => {
    const [pRes, cRes, nRes] = await Promise.all([
      fetch(`/api/meetings/${meetingId}/participants`),
      fetch(`/api/meetings/${meetingId}/chat`),
      fetch(`/api/meetings/${meetingId}/notes`)
    ]);
    if (pRes.ok) {
      const pData = await pRes.json();
      setParticipantsList(pData.participants || []);
    }
    if (cRes.ok) {
      const cData = await cRes.json();
      setChatMessages(cData.messages || []);
    }
    if (nRes.ok) {
      const nData = await nRes.json();
      setNotesList(nData.notes || []);
    }
    if (isHostUser) {
      const iRes = await fetch(`/api/meetings/${meetingId}/invites`);
      if (iRes.ok) {
        const iData = await iRes.json();
        setPersonalInvites(iData.invites || []);
      }
    }
  };

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(meetingShareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard blocked in non-HTTPS test context
    }
  };

  const handleOpenQr = async () => {
    setShowQrModal(true);
    try {
      const dataUrl = await QRCode.toDataURL(meetingShareUrl, {
        width: 240,
        margin: 2,
        color: { dark: "#050508", light: "#ffffff" }
      });
      setQrDataUrl(dataUrl);
    } catch {
      setQrDataUrl(null);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);
    setJoinError(null);

    try {
      const res = await fetch(`/api/meetings/${meetingId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: guestName || "Guest Attendee",
          passcode: passcodeInput || undefined,
          inviteToken: inviteToken || undefined,
          website: websiteTrap
        })
      });
      const data: JoinResponse & {
        error?: string;
        requiresPasscode?: boolean;
        requiresAuth?: boolean;
      } = await res.json();

      if (!res.ok) {
        if (data.requiresPasscode) setRequiresPasscode(true);
        if (data.requiresAuth) setRequiresAuth(true);
        setJoinError(data.error || "Could not join meeting.");
      } else {
        setSession(data);
        setUploads(data.uploads || []);
        setSelectedUploadId(data.activeUploadId || data.uploads?.[0]?.id || null);
        setIsLocked(Boolean(data.isLocked));
        setSafeMode(Boolean(data.safeMode));
        setStageMode(data.stageMode === "SLIDES" ? "SLIDES" : "SITE");
        setHasActivePdf(Boolean(data.hasActivePdf));
        setActivePdfName(data.activePdfName || null);
        setPdfPage(data.activePdfPage || 1);
        if (data.meetingStatus === "ENDED") {
          setMeetingEnded(true);
        } else {
          fetchCollaborationData(data.isHost);
        }
      }
    } catch {
      setJoinError("Network error while joining meeting.");
    } finally {
      setJoining(false);
    }
  };

  // Countdown timer tick
  useEffect(() => {
    if (!timerRunning || timerSeconds <= 0) return;
    const id = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning, timerSeconds]);

  // Subscribe to Supabase Realtime channel
  useEffect(() => {
    if (!session) return;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl.includes("placeholder")) return;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`meeting:${meetingId}`)
      .on("broadcast", { event: "site-uploaded" }, ({ payload }) => {
        if (payload?.uploadId) {
          setUploads((prev) => {
            if (prev.some((u) => u.id === payload.uploadId)) return prev;
            return [
              {
                id: payload.uploadId,
                uploaderName: payload.uploaderName || "Participant",
                fileCount: payload.fileCount || 0,
                totalBytes: payload.totalBytes || 0,
                createdAt: payload.createdAt || new Date().toISOString()
              },
              ...prev
            ];
          });
          setSelectedUploadId((current) => current || payload.uploadId);
          if (payload.uploaderName !== session.displayName) {
            setToast({
              text: `${payload.uploaderName || "Someone"} shared a new site`,
              uploadId: payload.uploadId
            });
          }
        }
        setSession((prev) => (prev ? { ...prev, hasActiveSite: true } : prev));
        setIframeVersion((v) => v + 1);
      })
      .on("broadcast", { event: "site-deleted" }, ({ payload }) => {
        if (payload?.uploadId) {
          setUploads((prev) => {
            const remaining = prev.filter((u) => u.id !== payload.uploadId);
            setSelectedUploadId((curr) =>
              curr === payload.uploadId ? remaining[0]?.id ?? null : curr
            );
            return remaining;
          });
        }
      })
      .on("broadcast", { event: "slides-updated" }, ({ payload }) => {
        setHasActivePdf(true);
        if (payload?.activePdfName) setActivePdfName(payload.activePdfName);
        setPdfPage(payload?.activePdfPage || 1);
        setStageMode("SLIDES");
        setPdfVersion((v) => v + 1);
        if (payload?.uploaderName !== session.displayName) {
          setToast({ text: `${payload?.uploaderName || "Presenter"} uploaded slides` });
        }
      })
      .on("broadcast", { event: "follow-me" }, ({ payload }) => {
        if (payload?.stageMode === "SLIDES") {
          setStageMode("SLIDES");
          if (payload?.pdfPage) setPdfPage(Number(payload.pdfPage));
          setToast({ text: `Host synced everyone to Slide ${payload?.pdfPage || 1}` });
        } else {
          setStageMode("SITE");
          if (payload?.uploadId) setSelectedUploadId(payload.uploadId);
          const p = payload?.pagePath || payload?.path;
          if (p) {
            setIframePagePath(p);
            setIframeVersion((v) => v + 1);
            setToast({ text: `Host synced everyone to /${p}` });
          }
        }
      })
      .on("broadcast", { event: "security-update" }, ({ payload }) => {
        if (typeof payload?.isLocked === "boolean") setIsLocked(payload.isLocked);
        if (typeof payload?.safeMode === "boolean") {
          setSafeMode(payload.safeMode);
          setToast({
            text: payload.safeMode
              ? "Host enabled Class Safe Mode (Host-only uploads)"
              : "Host disabled Class Safe Mode"
          });
        }
      })
      .on("broadcast", { event: "session-banned" }, ({ payload }) => {
        if (payload?.sessionId === session.sessionId) {
          setKickedOut(true);
        } else {
          setParticipantsList((prev) => prev.filter((p) => p.id !== payload?.sessionId));
        }
      })
      .on("broadcast", { event: "hand-update" }, ({ payload }) => {
        if (payload?.id === session.sessionId) {
          setHandRaised(Boolean(payload.handRaised));
        }
        fetchCollaborationData(session.isHost);
      })
      .on("broadcast", { event: "chat-message" }, ({ payload }) => {
        if (payload?.id) {
          setChatMessages((prev) =>
            prev.some((m) => m.id === payload.id) ? prev : [...prev, payload]
          );
        }
      })
      .on("broadcast", { event: "note-added" }, ({ payload }) => {
        if (payload?.id) {
          setNotesList((prev) =>
            prev.some((n) => n.id === payload.id) ? prev : [payload, ...prev]
          );
        }
      })
      .on("broadcast", { event: "reaction" }, ({ payload }) => {
        if (payload?.emoji) {
          const rid = `${Date.now()}-${Math.random()}`;
          setReactions((prev) => [
            ...prev.slice(-12),
            { id: rid, emoji: payload.emoji, sender: payload.sender || "" }
          ]);
          setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== rid));
          }, 2600);
        }
      })
      .on("broadcast", { event: "timer-update" }, ({ payload }) => {
        if (typeof payload?.seconds === "number") setTimerSeconds(payload.seconds);
        if (typeof payload?.running === "boolean") setTimerRunning(payload.running);
      })
      .on("broadcast", { event: "meeting-ended" }, () => {
        setMeetingEnded(true);
      })
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      realtimeChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [session, meetingId]);

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    setUploadStatus("Preparing upload...");
    setUploadError(null);

    try {
      const urlRes = await fetch(`/api/meetings/${meetingId}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileSize: file.size, fileType: "zip" })
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) {
        setUploadError(urlData.error || "Could not initiate upload.");
        setUploadStatus(null);
        return;
      }

      let res: Response;
      if (urlData.mode === "signed" && urlData.signedUrl) {
        setUploadStatus("Uploading ZIP to storage...");
        const putRes = await fetch(urlData.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/zip" },
          body: file
        });
        if (!putRes.ok) {
          setUploadError("Direct storage upload failed.");
          setUploadStatus(null);
          return;
        }
        setUploadStatus("Validating & extracting ZIP...");
        res = await fetch(`/api/meetings/${meetingId}/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tempZipPath: urlData.tempZipPath,
            uploadId: urlData.uploadId
          })
        });
      } else {
        setUploadStatus("Validating & extracting ZIP...");
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch(`/api/meetings/${meetingId}/upload`, {
          method: "POST",
          body: formData
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Upload failed.");
        setUploadStatus(null);
      } else {
        const newUpload: SiteUploadSummary = {
          id: data.uploadId,
          uploaderName: data.uploaderName || session.displayName,
          fileCount: data.fileCount,
          totalBytes: data.totalBytes,
          createdAt: data.createdAt || new Date().toISOString()
        };
        setUploads((prev) => [newUpload, ...prev]);
        setSelectedUploadId(newUpload.id);
        setIframePagePath("index.html");
        setStageMode("SITE");
        setUploadStatus(
          `Uploaded ${data.fileCount} files (${Math.round(data.totalBytes / 1024)} KB)`
        );
        setSession((prev) => (prev ? { ...prev, hasActiveSite: true } : prev));
        setIframeVersion((v) => v + 1);
      }
    } catch {
      setUploadError("Network error during upload.");
      setUploadStatus(null);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    setUploadStatus("Uploading PDF slides...");
    setUploadError(null);

    try {
      const urlRes = await fetch(`/api/meetings/${meetingId}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileSize: file.size, fileType: "pdf" })
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) {
        setUploadError(urlData.error || "Could not initiate PDF upload.");
        setUploadStatus(null);
        return;
      }

      let res: Response;
      if (urlData.mode === "signed" && urlData.signedUrl) {
        const putRes = await fetch(urlData.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/pdf" },
          body: file
        });
        if (!putRes.ok) {
          setUploadError("Direct PDF storage upload failed.");
          setUploadStatus(null);
          return;
        }
        res = await fetch(`/api/meetings/${meetingId}/slides`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storagePath: urlData.tempPath,
            fileName: file.name
          })
        });
      } else {
        const formData = new FormData();
        formData.append("file", file);
        res = await fetch(`/api/meetings/${meetingId}/slides`, {
          method: "POST",
          body: formData
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "PDF upload failed.");
        setUploadStatus(null);
      } else {
        setHasActivePdf(true);
        setActivePdfName(data.activePdfName);
        setPdfPage(1);
        setStageMode("SLIDES");
        setPdfVersion((v) => v + 1);
        setUploadStatus(`Loaded slides: ${data.activePdfName}`);
      }
    } catch {
      setUploadError("Network error during PDF upload.");
      setUploadStatus(null);
    }
  };

  const handleDeleteSelectedUpload = async () => {
    if (!selectedUploadId || !session?.isHost) return;
    const res = await fetch(
      `/api/meetings/${meetingId}/uploads/${selectedUploadId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      const remaining = uploads.filter((u) => u.id !== selectedUploadId);
      setUploads(remaining);
      setSelectedUploadId(remaining[0]?.id ?? null);
      setIframeVersion((v) => v + 1);
    }
  };

  const handleFollowMeSync = async (override?: {
    stageMode?: "SITE" | "SLIDES";
    pdfPage?: number;
  }) => {
    if (!session?.isHost) return;
    const targetMode = override?.stageMode ?? stageMode;
    const targetPdfPage = override?.pdfPage ?? pdfPage;

    await fetch(`/api/meetings/${meetingId}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stageMode: targetMode,
        pdfPage: targetPdfPage,
        uploadId: selectedUploadId,
        pagePath: syncInputPath || "index.html"
      })
    });
    if (targetMode === "SITE") {
      setIframePagePath(syncInputPath || "index.html");
      setIframeVersion((v) => v + 1);
    }
  };

  const handleToggleSecurity = async (action: "toggle_lock" | "toggle_safe_mode") => {
    if (!session?.isHost) return;
    const res = await fetch(`/api/meetings/${meetingId}/security`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "toggle_lock" ? { action, isLocked: !isLocked } : { action, safeMode: !safeMode }
      )
    });
    const data = await res.json();
    if (!res.ok) {
      setToast({ text: data.error || "Could not update security setting." });
    } else {
      setIsLocked(Boolean(data.isLocked));
      setSafeMode(Boolean(data.safeMode));
    }
  };

  const handleBanParticipant = async (targetSessionId: string) => {
    if (!session?.isHost) return;
    const res = await fetch(`/api/meetings/${meetingId}/security`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ban_session", targetSessionId })
    });
    if (res.ok) {
      setParticipantsList((prev) => prev.filter((p) => p.id !== targetSessionId));
      setToast({ text: "Participant removed and banned from this meeting." });
    }
  };

  const handleToggleHand = async (targetSessionId?: string, nextRaised?: boolean) => {
    const res = await fetch(`/api/meetings/${meetingId}/hand`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetSessionId,
        raised: nextRaised !== undefined ? nextRaised : !handRaised
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (!targetSessionId) setHandRaised(Boolean(data.session?.handRaised));
      fetchCollaborationData(Boolean(session?.isHost));
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const res = await fetch(`/api/meetings/${meetingId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: chatInput })
    });
    if (res.ok) {
      const data = await res.json();
      setChatInput("");
      if (data.message) {
        setChatMessages((prev) =>
          prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
        );
      }
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    const res = await fetch(`/api/meetings/${meetingId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: noteInput,
        pagePath: stageMode === "SLIDES" ? `Slide ${pdfPage}` : iframePagePath,
        viewport,
        uploadId: selectedUploadId
      })
    });
    if (res.ok) {
      const data = await res.json();
      setNoteInput("");
      if (data.note) {
        setNotesList((prev) =>
          prev.some((n) => n.id === data.note.id) ? prev : [data.note, ...prev]
        );
      }
    }
  };

  const handleSendReaction = async (emoji: string) => {
    const rid = `${Date.now()}-${Math.random()}`;
    setReactions((prev) => [
      ...prev.slice(-12),
      { id: rid, emoji, sender: session?.displayName || "You" }
    ]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== rid));
    }, 2600);

    if (realtimeChannelRef.current) {
      await realtimeChannelRef.current.send({
        type: "broadcast",
        event: "reaction",
        payload: { emoji, sender: session?.displayName || "Guest" }
      });
    }
  };

  const handleSetTimer = async (seconds: number, running: boolean) => {
    setTimerSeconds(seconds);
    setTimerRunning(running);
    if (realtimeChannelRef.current) {
      await realtimeChannelRef.current.send({
        type: "broadcast",
        event: "timer-update",
        payload: { seconds, running }
      });
    }
  };

  const handleCreatePersonalInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    const res = await fetch(`/api/meetings/${meetingId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: inviteLabel, email: inviteEmail || undefined })
    });
    const data = await res.json();
    if (!res.ok) {
      setInviteError(data.error || "Could not create personal invite.");
    } else {
      setPersonalInvites((prev) => [data.invite, ...prev]);
      setInviteLabel("");
      setInviteEmail("");
    }
  };

  const handleAskMeetingAi = async (mode: "summarize_notes" | "summarize_qa" | "custom", e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (mode === "custom" && !aiQuestion.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, question: aiQuestion })
      });
      const data = await res.json();
      if (!res.ok) {
        setAiReply(data.error || "AI request failed.");
      } else {
        setAiReply(data.reply);
        if (typeof data.remaining === "number" && typeof data.limit === "number") {
          setAiQuota(`${data.remaining}/${data.limit} left this hour`);
        }
        if (mode === "custom") setAiQuestion("");
      }
    } catch {
      setAiReply("Network error contacting meeting AI.");
    } finally {
      setAiLoading(false);
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

  if (kickedOut) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050508] p-6 text-white">
        <div className="max-w-md rounded-2xl border border-red-500/30 bg-neutral-900 p-8 text-center">
          <h2 className="text-2xl font-bold mb-2 text-red-400">Removed from Meeting</h2>
          <p className="text-neutral-400 text-sm mb-6">
            The host has removed and blocked your session from this meeting.
          </p>
          <Button onClick={() => (window.location.href = "/")}>Return Home</Button>
        </div>
      </div>
    );
  }

  if (meetingEnded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050508] p-6 text-white">
        <div className="max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">Meeting Ended</h2>
          <p className="text-neutral-400 text-sm mb-6">
            The host has ended this session and all uploaded static website files have been permanently deleted.
          </p>
          <Button onClick={() => (window.location.href = "/")}>Return Home</Button>
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

          {inviteToken && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              Personal invite link detected â€” single-device verified entry.
            </div>
          )}

          <input
            type="text"
            required={!inviteToken}
            placeholder="Your Name (e.g., Arjun)"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            data-testid="guest-name-input"
          />
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={websiteTrap}
            onChange={(e) => setWebsiteTrap(e.target.value)}
            className="sr-only"
            className="w-full rounded-lg border border-white/15 bg-black/50 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {requiresPasscode && (
            <input
              type="password"
              required
              placeholder="Enter Meeting Passcode"
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              className="w-full rounded-lg border border-amber-500/40 bg-black/50 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          )}

          {joinError && <p className="text-xs text-red-400">{joinError}</p>}

          {requiresAuth && (
            <a
              href="/login"
              className="block w-full rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-4 py-2.5 text-center text-xs font-semibold text-indigo-200 hover:bg-indigo-500/30"
            >
              Sign In with Approved Email â†’
            </a>
          )}

          <Button
            type="submit"
            disabled={joining}
            className="w-full"
            data-testid="join-meeting-btn"
          >
            {joining ? "Joining..." : "Join Meeting"}
          </Button>
        </form>
      </div>
    );
  }

  const singleHostMode = process.env.NEXT_PUBLIC_SITES_SINGLE_HOST === "true";
  const currentIframeSrc = selectedUploadId
    ? `${session.iframeBaseUrl}/${iframePagePath}?uploadId=${selectedUploadId}&v=${iframeVersion}`
    : `${session.iframeBaseUrl}/${iframePagePath}?v=${iframeVersion}`;

  const raisedHands = participantsList.filter((p) => p.handRaised);
  const canUpload = session.isHost || !safeMode;

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex h-screen flex-col bg-[#050508] text-white overflow-hidden">
      {/* Live Upload / Sync Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-indigo-400/30 bg-neutral-900/95 px-4 py-3 text-sm shadow-2xl backdrop-blur">
          <span className="text-neutral-100">{toast.text}</span>
          {toast.uploadId && (
            <Button
              variant="default"
              className="h-7 px-2.5 text-xs"
              onClick={() => {
                setStageMode("SITE");
                setSelectedUploadId(toast.uploadId!);
                setIframePagePath("index.html");
                setIframeVersion((v) => v + 1);
                setToast(null);
              }}
            >
              View Site
            </Button>
          )}
          <button
            onClick={() => setToast(null)}
            className="text-xs text-neutral-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* QR Code & Personal Invites Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-neutral-900 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold">Invite Participants</h3>
              <p className="text-xs text-neutral-400">
                Scan QR code or share a personal single-device link.
              </p>
              {qrDataUrl && (
                <div className="mx-auto w-fit rounded-xl bg-white p-3">
                  <img src={qrDataUrl} alt="Meeting Invite QR Code" className="h-44 w-44" />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="default" className="flex-1" onClick={handleCopyInvite}>
                  {copiedLink ? "Copied Link!" : "Copy Public Link"}
                </Button>
                <Button variant="outline" onClick={() => setShowQrModal(false)}>
                  Close
                </Button>
              </div>
            </div>

            {session.isHost && (
              <div className="border-t border-white/10 pt-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" />
                  Personal Single-Device Links (Pro Anti-Leak)
                </h4>
                <form onSubmit={handleCreatePersonalInvite} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Student Name"
                    value={inviteLabel}
                    onChange={(e) => setInviteLabel(e.target.value)}
                    className="flex-1 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white"
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white"
                  />
                  <Button type="submit" className="h-8 px-3 text-xs">
                    Add
                  </Button>
                </form>
                {inviteError && <p className="text-xs text-red-400">{inviteError}</p>}
                <ul className="space-y-1.5 max-h-36 overflow-y-auto">
                  {personalInvites.map((inv) => {
                    const url = `${meetingShareUrl}?invite=${inv.token}`;
                    return (
                      <li
                        key={inv.id}
                        className="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5 text-xs"
                      >
                        <div className="truncate">
                          <span className="font-medium text-white">{inv.label}</span>
                          {inv.claimedSessionId && (
                            <span className="ml-2 text-[10px] text-emerald-400">Active</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(url)}
                          className="text-indigo-300 hover:text-indigo-200 shrink-0 ml-2"
                        >
                          Copy Link
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-neutral-950 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <Globe className="h-5 w-5 text-indigo-400" />
          <span className="font-semibold text-sm">{meetingTitle}</span>

          {/* Stage Switcher: Live Website vs Slides */}
          <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs">
            <button
              onClick={() => setStageMode("SITE")}
              className={`rounded-md px-2.5 py-1 font-medium ${
                stageMode === "SITE" ? "bg-white text-black" : "text-neutral-300"
              }`}
            >
              Live Website
            </button>
            <button
              onClick={() => setStageMode("SLIDES")}
              className={`rounded-md px-2.5 py-1 font-medium flex items-center gap-1 ${
                stageMode === "SLIDES" ? "bg-white text-black" : "text-neutral-300"
              }`}
            >
              <FileText className="h-3 w-3" /> Slides
            </button>
          </div>

          {stageMode === "SITE" && uploads.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={selectedUploadId || ""}
                onChange={(e) => {
                  setSelectedUploadId(e.target.value);
                  setIframePagePath("index.html");
                  setIframeVersion((v) => v + 1);
                }}
                aria-label="Select shared website"
                className="rounded-lg border border-white/15 bg-neutral-900 px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {uploads.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.uploaderName}&apos;s Site ({u.fileCount} files)
                  </option>
                ))}
              </select>
              {session.isHost && selectedUploadId && (
                <button
                  onClick={handleDeleteSelectedUpload}
                  title="Delete selected upload"
                  className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-neutral-400 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Demo Countdown Timer */}
          {timerSeconds > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/15 px-2.5 py-0.5 text-xs font-mono text-amber-200">
              <Timer className="h-3 w-3" />
              {formatTimer(timerSeconds)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Host Timer Presets */}
          {session.isHost && (
            <div className="hidden xl:flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px]">
              <Timer className="h-3 w-3 text-neutral-400 mr-1" />
              <button onClick={() => handleSetTimer(180, true)} className="hover:text-white text-neutral-300 px-1">
                3m
              </button>
              <button onClick={() => handleSetTimer(300, true)} className="hover:text-white text-neutral-300 px-1">
                5m
              </button>
              {timerSeconds > 0 && (
                <button onClick={() => handleSetTimer(0, false)} className="text-red-300 px-1">
                  Stop
                </button>
              )}
            </div>
          )}

          {/* Host Follow Me Sync */}
          {session.isHost && (
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
              {stageMode === "SITE" && (
                <input
                  type="text"
                  value={syncInputPath}
                  onChange={(e) => setSyncInputPath(e.target.value)}
                  placeholder="index.html"
                  className="w-24 bg-transparent text-xs text-white focus:outline-none"
                />
              )}
              <Button
                variant="outline"
                onClick={() => handleFollowMeSync()}
                className="h-7 px-2 text-xs"
              >
                <Compass className="mr-1 h-3.5 w-3.5 text-indigo-400" />
                Follow Me
              </Button>
            </div>
          )}

          {/* Host Anti-Raid Controls */}
          {session.isHost && (
            <>
              <Button
                variant={isLocked ? "danger" : "outline"}
                onClick={() => handleToggleSecurity("toggle_lock")}
                className="h-8 px-2.5 text-xs"
                title="Lock room to block new joiners"
              >
                {isLocked ? (
                  <>
                    <Lock className="mr-1 h-3.5 w-3.5" /> Locked
                  </>
                ) : (
                  <>
                    <Unlock className="mr-1 h-3.5 w-3.5" /> Lock
                  </>
                )}
              </Button>
              <Button
                variant={safeMode ? "default" : "outline"}
                onClick={() => handleToggleSecurity("toggle_safe_mode")}
                className="h-8 px-2.5 text-xs"
                title="Class Safe Mode: Host-only uploads & muted on join"
              >
                <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                {safeMode ? "Safe On" : "Safe Mode"}
              </Button>
            </>
          )}

          <Button
            variant="outline"
            onClick={handleCopyInvite}
            className="h-8 px-2.5 text-xs"
          >
            {copiedLink ? (
              <>
                <Check className="mr-1 h-3.5 w-3.5 text-emerald-400" /> Copied
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy Invite
              </>
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenQr}
            className="h-8 px-2.5 text-xs"
          >
            <QrCode className="mr-1 h-3.5 w-3.5" /> QR / Links
          </Button>

          {canUpload ? (
            <div className="flex items-center gap-1.5">
              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200">
                <Upload className="h-3.5 w-3.5" />
                <span>Site ZIP</span>
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleZipUpload}
                  className="hidden"
                  data-testid="zip-upload-input"
                />
              </label>
              <label
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-2.5 py-1.5 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/30"
                title="Tip: Save PowerPoint / Canva / Google Slides as PDF for 100% exact layout"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>PDF Slides</span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300">
              Host-Only Uploads (Safe Mode)
            </span>
          )}
        </div>
      </header>

      {/* Mobile View Switcher */}
      <div className="flex lg:hidden border-b border-white/10 bg-neutral-950">
        <button
          onClick={() => setMobileTab("site")}
          className={`flex-1 py-2 text-xs font-semibold ${
            mobileTab === "site"
              ? "border-b-2 border-white text-white"
              : "text-neutral-400"
          }`}
        >
          {stageMode === "SLIDES" ? "Slide Deck" : "Live Website"}
        </button>
        <button
          onClick={() => setMobileTab("call")}
          className={`flex-1 py-2 text-xs font-semibold ${
            mobileTab === "call"
              ? "border-b-2 border-white text-white"
              : "text-neutral-400"
          }`}
        >
          Video, Chat & People
        </button>
      </div>

      {/* Main Split Workspace */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Left/Center Main Stage */}
        <main
          className={`relative flex-1 bg-neutral-950 flex flex-col min-h-0 ${
            mobileTab === "site" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Floating Emoji Reactions */}
          <div className="pointer-events-none absolute bottom-16 left-6 z-30 flex gap-2">
            {reactions.map((r) => (
              <div
                key={r.id}
                className="animate-bounce rounded-full border border-white/15 bg-black/70 px-2.5 py-1 text-sm shadow-lg"
              >
                {r.emoji} <span className="text-[10px] text-neutral-300">{r.sender}</span>
              </div>
            ))}
          </div>

          {/* Stage Sub-Toolbar: Viewport Switcher + Status */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-neutral-900/60 px-3 py-1.5 text-xs">
            <div className="flex items-center gap-2">
              {stageMode === "SITE" && (
                <div className="flex items-center gap-1 rounded-md border border-white/10 bg-black/40 p-0.5">
                  <button
                    onClick={() => setViewport("DESKTOP")}
                    className={`rounded px-2 py-0.5 flex items-center gap-1 ${
                      viewport === "DESKTOP" ? "bg-white text-black" : "text-neutral-400"
                    }`}
                  >
                    <Monitor className="h-3 w-3" /> Desktop
                  </button>
                  <button
                    onClick={() => setViewport("TABLET")}
                    className={`rounded px-2 py-0.5 flex items-center gap-1 ${
                      viewport === "TABLET" ? "bg-white text-black" : "text-neutral-400"
                    }`}
                  >
                    <Tablet className="h-3 w-3" /> Tablet
                  </button>
                  <button
                    onClick={() => setViewport("MOBILE")}
                    className={`rounded px-2 py-0.5 flex items-center gap-1 ${
                      viewport === "MOBILE" ? "bg-white text-black" : "text-neutral-400"
                    }`}
                  >
                    <Smartphone className="h-3 w-3" /> Mobile
                  </button>
                </div>
              )}
              {uploadStatus && <span className="text-emerald-400">{uploadStatus}</span>}
              {uploadError && <span className="text-red-400">{uploadError}</span>}
            </div>

            {/* Quick Reactions & Raise Hand */}
            <div className="flex items-center gap-1.5">
              {["ðŸ‘", "ðŸ‘", "ðŸ”¥", "â¤ï¸", "â“"].map((em) => (
                <button
                  key={em}
                  onClick={() => handleSendReaction(em)}
                  className="rounded-md bg-white/5 px-1.5 py-0.5 text-sm hover:bg-white/15"
                >
                  {em}
                </button>
              ))}
              <Button
                variant={handRaised ? "default" : "outline"}
                onClick={() => handleToggleHand()}
                className="h-7 px-2.5 text-xs ml-1"
              >
                <Hand className="mr-1 h-3.5 w-3.5" />
                {handRaised ? "Lower Hand" : "Raise Hand"}
              </Button>
            </div>
          </div>

          {stageMode === "SLIDES" ? (
            hasActivePdf ? (
              <PdfSlideViewer
                pdfUrl={`/api/slides-proxy/${meetingId}?v=${pdfVersion}`}
                pdfName={activePdfName || "Presentation.pdf"}
                page={pdfPage}
                hasActiveSite={Boolean(session.hasActiveSite || uploads.length > 0)}
                onPageChange={(next) => {
                  setPdfPage(next);
                  if (session.isHost) {
                    handleFollowMeSync({ stageMode: "SLIDES", pdfPage: next });
                  }
                }}
                onSwitchToSite={() => {
                  setStageMode("SITE");
                  if (session.isHost) {
                    handleFollowMeSync({ stageMode: "SITE" });
                  }
                }}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <FileText className="h-12 w-12 text-indigo-400 mb-3" />
                <h3 className="text-lg font-semibold mb-2">No Slide Deck Uploaded Yet</h3>
                <p className="max-w-md text-xs text-neutral-400 mb-3">
                  Upload a <strong>.pdf</strong> slide deck using <strong>PDF Slides</strong> in the header to present slides first and switch to your live website in one click.
                </p>
                <p className="text-[11px] text-neutral-500">
                  Tip: In PowerPoint, Canva, or Google Slides, click <strong>File â†’ Save as PDF</strong> so fonts and layouts stay 100% exact.
                </p>
              </div>
            )
          ) : session.hasActiveSite || uploads.length > 0 ? (
            <div className="flex-1 flex items-center justify-center bg-neutral-900/40 overflow-auto p-2">
              <iframe
                key={`${selectedUploadId}-${iframeVersion}`}
                src={currentIframeSrc}
                title="Presented Interactive Static Website"
                data-testid="site-iframe"
                sandbox={
                  singleHostMode
                    ? "allow-scripts allow-forms allow-modals"
                    : "allow-scripts allow-same-origin allow-forms allow-modals"
                }
                style={{
                  width:
                    viewport === "MOBILE"
                      ? "390px"
                      : viewport === "TABLET"
                      ? "768px"
                      : "100%",
                  height: "100%"
                }}
                className="border border-white/10 bg-white rounded-lg shadow-2xl transition-all"
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <Globe className="h-12 w-12 text-neutral-600 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Waiting for a Website or Slide Upload
              </h3>
              <p className="max-w-md text-sm text-neutral-400">
                Use <strong>Site ZIP</strong> or <strong>PDF Slides</strong> above to share a live site or presentation. Every attendee gets their own isolated browser session.
              </p>
            </div>
          )}
        </main>

        {/* Right Sidebar */}
        <aside
          className={`w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-white/10 bg-neutral-950 flex-col min-h-0 flex-1 lg:flex-none ${
            mobileTab === "call" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Sidebar Tabs */}
          <div className="grid grid-cols-5 border-b border-white/10 text-xs">
            <button
              onClick={() => setSidebarTab("video")}
              className={`py-2.5 font-medium flex items-center justify-center gap-1 ${
                sidebarTab === "video" ? "border-b-2 border-indigo-400 text-white" : "text-neutral-400"
              }`}
            >
              <Video className="h-3.5 w-3.5" /> Video
            </button>
            <button
              onClick={() => {
                setSidebarTab("people");
                fetchCollaborationData(session.isHost);
              }}
              className={`py-2.5 font-medium flex items-center justify-center gap-1 ${
                sidebarTab === "people" ? "border-b-2 border-indigo-400 text-white" : "text-neutral-400"
              }`}
            >
              <Users className="h-3.5 w-3.5" /> People
              {raisedHands.length > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 text-[10px] text-black font-bold">
                  {raisedHands.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setSidebarTab("chat")}
              className={`py-2.5 font-medium flex items-center justify-center gap-1 ${
                sidebarTab === "chat" ? "border-b-2 border-indigo-400 text-white" : "text-neutral-400"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" /> Chat
            </button>
            <button
              onClick={() => setSidebarTab("notes")}
              className={`py-2.5 font-medium flex items-center justify-center gap-1 ${
                sidebarTab === "notes" ? "border-b-2 border-indigo-400 text-white" : "text-neutral-400"
              }`}
            >
              <StickyNote className="h-3.5 w-3.5" /> Notes
            </button>
            <button
              onClick={() => setSidebarTab("ai")}
              className={`py-2.5 font-medium flex items-center justify-center gap-1 ${
                sidebarTab === "ai" ? "border-b-2 border-indigo-400 text-white" : "text-neutral-400"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> AI
            </button>
          </div>

          {sidebarTab === "video" && (
            <div className="flex-1 flex flex-col p-3 gap-3 overflow-y-auto">
              <LiveKitRoom
                token={session.livekitToken}
                serverUrl={session.livekitUrl}
                connect={Boolean(
                  session.livekitUrl && !session.livekitUrl.includes("placeholder")
                )}
                video={false}
                audio={false}
                className="flex flex-1 flex-col gap-3"
              >
                <div className="flex-1 min-h-[220px] rounded-xl overflow-hidden border border-white/10 bg-neutral-900">
                  <VideoConference />
                </div>
                <RoomAudioRenderer />
                <LiveKitSidebarControls
                  isHost={session.isHost}
                  safeMode={safeMode}
                  onLeave={() => (window.location.href = "/")}
                  onEndMeeting={handleEndMeeting}
                />
              </LiveKitRoom>
            </div>
          )}

          {sidebarTab === "people" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {raisedHands.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                  <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <Hand className="h-3.5 w-3.5" /> Raised Hands Queue ({raisedHands.length})
                  </div>
                  <ul className="space-y-1.5">
                    {raisedHands.map((p, idx) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between text-xs bg-black/30 rounded-lg px-2.5 py-1.5"
                      >
                        <span>
                          {idx + 1}. {p.displayName}
                        </span>
                        {session.isHost && (
                          <button
                            onClick={() => handleToggleHand(p.id, false)}
                            className="text-amber-300 hover:text-white"
                          >
                            Lower
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="font-semibold uppercase tracking-wider">
                    Session Roster ({participantsList.length})
                  </span>
                  {session.isHost && session.planConfig?.allowFeedbackExport && (
                    <a
                      href={`/api/meetings/${meetingId}/export?type=attendance`}
                      className="inline-flex items-center gap-1 text-indigo-300 hover:text-indigo-200"
                    >
                      <Download className="h-3 w-3" /> Attendance CSV
                    </a>
                  )}
                </div>
                <ul className="space-y-2">
                  {participantsList.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-white truncate">
                            {p.displayName}
                          </span>
                          {p.isHost && (
                            <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-300">
                              Host
                            </span>
                          )}
                          {p.isVerified ? (
                            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">
                              <ShieldCheck className="h-2.5 w-2.5" /> Verified
                            </span>
                          ) : (
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                              Guest
                            </span>
                          )}
                        </div>
                        {p.verifiedEmail && (
                          <p className="text-[10px] text-neutral-500 truncate">
                            {p.verifiedEmail}
                          </p>
                        )}
                      </div>

                      {session.isHost && !p.isHost && (
                        <button
                          onClick={() => handleBanParticipant(p.id)}
                          title="Kick & Ban participant"
                          className="ml-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300 hover:bg-red-500/20 flex items-center gap-1 shrink-0"
                        >
                          <Ban className="h-3 w-3" /> Ban
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {sidebarTab === "chat" && (
            <div className="flex-1 flex flex-col min-h-0 p-3">
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {chatMessages.length === 0 ? (
                  <p className="text-xs text-neutral-500 text-center mt-8">
                    No messages yet. Say hello!
                  </p>
                ) : (
                  chatMessages.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-semibold text-indigo-300">
                          {m.senderName}
                          {m.isHost ? " (Host)" : ""}
                        </span>
                      </div>
                      <p className="text-neutral-200 break-words">{m.message}</p>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleSendChat} className="mt-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Button type="submit" className="h-8 px-3 text-xs">
                  Send
                </Button>
              </form>
            </div>
          )}

          {sidebarTab === "notes" && (
            <div className="flex-1 flex flex-col min-h-0 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-neutral-400">
                  Tagged to:{" "}
                  <strong className="text-neutral-200">
                    {stageMode === "SLIDES" ? `Slide ${pdfPage}` : `/${iframePagePath}`}
                  </strong>{" "}
                  ({viewport})
                </span>
                {session.isHost && session.planConfig?.allowFeedbackExport && (
                  <a
                    href={`/api/meetings/${meetingId}/export?type=notes`}
                    className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200"
                  >
                    <Download className="h-3 w-3" /> Export CSV
                  </a>
                )}
              </div>

              <form onSubmit={handleAddNote} className="mb-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Leave page feedback..."
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value)}
                  className="flex-1 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Button type="submit" className="h-8 px-3 text-xs">
                  Pin
                </Button>
              </form>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {notesList.length === 0 ? (
                  <p className="text-xs text-neutral-500 text-center mt-8">
                    No page feedback notes yet.
                  </p>
                ) : (
                  notesList.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-neutral-400">
                        <span className="font-semibold text-emerald-300">{n.authorName}</span>
                        <span>
                          {n.pagePath} Â· {n.viewport}
                        </span>
                      </div>
                      <p className="text-neutral-200 break-words">{n.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {sidebarTab === "ai" && (
            <div className="flex-1 flex flex-col min-h-0 p-3 space-y-3 overflow-y-auto">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span className="font-semibold text-indigo-300 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Meeting AI Assistant
                </span>
                {aiQuota && <span className="text-[10px] text-neutral-400">{aiQuota}</span>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  disabled={aiLoading}
                  onClick={() => handleAskMeetingAi("summarize_notes")}
                  className="h-8 text-[11px] px-2"
                >
                  Summarize Notes
                </Button>
                <Button
                  variant="outline"
                  disabled={aiLoading}
                  onClick={() => handleAskMeetingAi("summarize_qa")}
                  className="h-8 text-[11px] px-2"
                >
                  Summarize Q&amp;A
                </Button>
              </div>

              <form onSubmit={(e) => handleAskMeetingAi("custom", e)} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask AI about this meeting..."
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  className="flex-1 rounded-lg border border-white/15 bg-black/50 px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Button type="submit" disabled={aiLoading} className="h-8 px-3 text-xs">
                  Ask
                </Button>
              </form>

              <div className="flex-1 rounded-xl border border-white/10 bg-neutral-900 p-3 text-xs text-neutral-200 whitespace-pre-line overflow-y-auto">
                {aiLoading
                  ? "Analyzing meeting notes & chat..."
                  : aiReply || "Use the buttons above to summarize pinned page feedback or chat Q&A (rate-limited per plan)."}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
