interface Props {
  filename: string | null;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
}

export default function Toolbar({ filename, onOpen, onSave, onSaveAs }: Props) {
  return (
    <div className="toolbar">
      <div className="toolbar-brand">
        <span className="toolbar-logo">𝒯</span>
        <span className="toolbar-title">Typst Desktop</span>
      </div>

      {filename && <span className="toolbar-file">{filename}</span>}

      <div className="toolbar-sep" />

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
