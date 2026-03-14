import { useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";

// Point pdf.js at its worker. Vite processes this URL at build time.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface Props {
  pdf: string | null;   // base64-encoded PDF string
  error: string | null;
}

export default function Preview({ pdf, error }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Keep a cancel token so fast successive updates don't stack canvases
  const renderGen = useRef(0);

  useEffect(() => {
    if (!pdf || !scrollRef.current) return;

    const container = scrollRef.current;
    const gen = ++renderGen.current;

    // Decode base64 → Uint8Array
    const raw = atob(pdf);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    pdfjsLib.getDocument({ data: bytes }).promise.then(async (doc) => {
      if (gen !== renderGen.current) return; // stale render, bail out

      // Clear old pages
      container.innerHTML = "";

      for (let p = 1; p <= doc.numPages; p++) {
        if (gen !== renderGen.current) return;

        const page = await doc.getPage(p);
        const containerWidth = container.clientWidth - 40; // 20px padding each side
        const naturalWidth = page.getViewport({ scale: 1 }).width;
        const scale = Math.max(0.5, containerWidth / naturalWidth);
        const vp = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = vp.width;
        canvas.height = vp.height;
        canvas.className = "preview-canvas";
        container.appendChild(canvas);

        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
      }
    });
  }, [pdf]);

  // ── Error state ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="error-pane">
        <div className="error-header">
          <span>⚠</span>
          <span>Compile error</span>
        </div>
        <pre className="error-body">{error}</pre>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!pdf) {
    return (
      <div className="preview-empty">
        <div className="preview-empty-icon">📄</div>
        <div className="preview-empty-label">Compiling…</div>
      </div>
    );
  }

  // ── Preview ──────────────────────────────────────────────────────────────
  return <div ref={scrollRef} className="preview-scroll" />;
}
