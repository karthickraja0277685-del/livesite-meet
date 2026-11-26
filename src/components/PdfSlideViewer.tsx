"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/primitives";

interface PdfSlideViewerProps {
  pdfUrl: string;
  pdfName: string;
  page: number;
  onPageChange: (nextPage: number) => void;
  onSwitchToSite?: () => void;
  hasActiveSite: boolean;
}

export default function PdfSlideViewer({
  pdfUrl,
  pdfName,
  page,
  onPageChange,
  onSwitchToSite,
  hasActiveSite
}: PdfSlideViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

        const loadingTask = pdfjsLib.getDocument({ url: pdfUrl, withCredentials: true });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load PDF slides.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  useEffect(() => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || loading) return;

    let cancelled = false;
    const safePage = Math.min(Math.max(1, page), doc.numPages);

    (async () => {
      try {
        const pdfPage = await doc.getPage(safePage);
        if (cancelled) return;

        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const containerWidth = canvas.parentElement?.clientWidth || 960;
        const targetWidth = Math.min(containerWidth - 32, 1100);
        const cssScale = Math.max(0.5, targetWidth / baseViewport.width);
        const dpr = window.devicePixelRatio || 1;
        const renderViewport = pdfPage.getViewport({ scale: cssScale * dpr });

        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        canvas.style.width = `${Math.floor(baseViewport.width * cssScale)}px`;
        canvas.style.height = `${Math.floor(baseViewport.height * cssScale)}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        await pdfPage.render({
          canvasContext: ctx,
          viewport: renderViewport
        }).promise;
      } catch {
        // Ignore cancelled render errors on rapid page changes
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, loading, numPages]);

  return (
    <div className="flex h-full w-full flex-col bg-neutral-950">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-neutral-900/80 px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-neutral-300">
          <FileText className="h-4 w-4 text-indigo-400" />
          <span className="font-medium truncate max-w-[200px]">{pdfName}</span>
          <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-neutral-200">
            Slide {Math.min(page, numPages)} / {numPages}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            className="h-8 px-2.5 text-xs"
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
          </Button>
          <Button
            variant="outline"
            disabled={page >= numPages}
            onClick={() => onPageChange(Math.min(numPages, page + 1))}
            className="h-8 px-2.5 text-xs"
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          {hasActiveSite && onSwitchToSite && (
            <Button
              variant="primary"
              onClick={onSwitchToSite}
              className="h-8 px-3 text-xs"
            >
              Switch to Live Website →
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {loading && (
          <p className="text-sm text-neutral-400">Rendering crisp PDF slides...</p>
        )}
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        {!loading && !error && (
          <canvas
            ref={canvasRef}
            className="rounded-lg shadow-2xl border border-white/10 bg-white"
          />
        )}
      </div>
    </div>
  );
}
