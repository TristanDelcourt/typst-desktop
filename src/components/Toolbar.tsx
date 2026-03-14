type Status = "idle" | "compiling" | "ready" | "error";

interface Props {
  filename: string | null;
  status: Status;
  errorMsg: string | null;
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

export default function Toolbar({
  filename,
  status,
  errorMsg,
  onOpen,
  onSave,
  onSaveAs,
}: Props) {
  return (
    <div className="toolbar">
      <div className="toolbar-brand">
        <span className="toolbar-logo">𝒯</span>
        <span className="toolbar-title">Typst Desktop</span>
      </div>

      {filename && <span className="toolbar-file">{filename}</span>}

      <div className="toolbar-sep" />

      {status !== "idle" && (
        <div className="toolbar-status-wrap">
          <span className={`toolbar-status ${status}`}>
            {STATUS_LABEL[status]}
          </span>
          {status === "error" && errorMsg && (
            <div className="error-tooltip">{errorMsg}</div>
          )}
        </div>
      )}

      <div className="toolbar-actions">
        <button className="btn" onClick={onOpen}>
          Open
        </button>
        <button className="btn" onClick={onSave}>
          Save
        </button>
        <button className="btn" onClick={onSaveAs}>
          Save As…
        </button>
      </div>
    </div>
  );
}
