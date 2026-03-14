import { useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface Props {
  pdf: string | null;
  error: string | null;
}

export default function Preview({ pdf, error }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const renderGen = useRef(0);

  useEffect(() => {
    if (!pdf || !scrollRef.current) return;

    const container = scrollRef.current;
    const gen = ++renderGen.current;

    const raw = atob(pdf);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    pdfjsLib.getDocument({ data: bytes }).promise.then(async (doc) => {
      if (gen !== renderGen.current) return;
      container.innerHTML = "";

      for (let p = 1; p <= doc.numPages; p++) {
        if (gen !== renderGen.current) return;
        const page = await doc.getPage(p);
        const containerWidth = container.clientWidth - 40;
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

  if (!pdf && !error) {
    return (
      <div className="preview-empty">
        <div className="preview-empty-icon">📄</div>
        <div className="preview-empty-label">Compiling…</div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
      }}
    >
      {/* ── Error banner on top ── */}
      {error && (
        <div
          style={{
            background: "#0d1117",
            borderBottom: "1px solid #2a2a2e",
            padding: "10px 16px",
            flexShrink: 0,
            maxHeight: "50%",
            overflowY: "auto",
          }}
        >
          <div className="error-header" style={{ marginBottom: "6px" }}>
            <span>Compile error</span>
          </div>
          <pre className="error-body" style={{ margin: 0 }}>
            {error}
          </pre>
        </div>
      )}

      {/* ── PDF below ── */}
      {pdf ? (
        <div ref={scrollRef} className="preview-scroll" />
      ) : (
        <div className="preview-empty">
          <div className="preview-empty-icon">📄</div>
          <div className="preview-empty-label">
            Fix the error to see a preview
          </div>
        </div>
      )}
    </div>
  );
}
