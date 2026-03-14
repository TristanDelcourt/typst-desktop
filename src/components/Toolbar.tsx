type Status = "idle" | "compiling" | "ready" | "error";

interface Props {
  filename: string | null;
  status: Status;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
}

const STATUS_LABEL: Record<Status, string> = {
  idle: "",
  compiling: "⟳ Compiling…",
  ready: "✓ Ready",
  error: "✕ Error",
};

export default function Toolbar({ filename, status, onOpen, onSave, onSaveAs }: Props) {
  return (
    <div className="toolbar">
      {/* Brand */}
      <div className="toolbar-brand">
        <span className="toolbar-logo">𝒯</span>
        <span className="toolbar-title">Typst Desktop</span>
      </div>

      {/* Current filename */}
      {filename && <span className="toolbar-file">{filename}</span>}

      <div className="toolbar-sep" />

      {/* Compile status badge */}
      {status !== "idle" && (
        <span className={`toolbar-status ${status}`}>
          {STATUS_LABEL[status]}
        </span>
      )}

      {/* File actions */}
      <div className="toolbar-actions">
        <button className="btn" onClick={onOpen}>Open</button>
        <button className="btn" onClick={onSave}>Save</button>
        <button className="btn" onClick={onSaveAs}>Save As…</button>
      </div>
    </div>
  );
}
