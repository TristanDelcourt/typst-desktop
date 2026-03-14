interface Diagnostic {
  from: number;
  to: number;
  severity: string;
  message: string;
  line: number;
}

interface Props {
  diagnostics: Diagnostic[];
}

const ICON: Record<string, string> = {
  error: "✕",
  warning: "⚠",
  info: "ℹ",
  hint: "·",
};

const COLOR: Record<string, string> = {
  error: "#f85149",
  warning: "#e3b341",
  info: "#58a6ff",
  hint: "#8b949e",
};

export default function DiagnosticsPanel({ diagnostics }: Props) {
  if (diagnostics.length === 0) return null;

  return (
    <div style={{
      borderTop: "1px solid #2a2a2e",
      background: "#0d1117",
      maxHeight: "140px",
      overflowY: "auto",
      flexShrink: 0,
    }}>
      {diagnostics.map((d, i) => (
        <div key={i} style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          padding: "5px 12px",
          borderBottom: "1px solid #161b22",
          fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
          fontSize: "11px",
          lineHeight: "1.5",
        }}>
          <span style={{ color: COLOR[d.severity] ?? "#8b949e", flexShrink: 0, marginTop: "1px" }}>
            {ICON[d.severity] ?? "·"}
          </span>
          <span style={{ color: "#8b949e", flexShrink: 0 }}>
            Ln {d.line}
          </span>
          <span style={{ color: "#e6edf3" }}>
            {d.message}
          </span>
        </div>
      ))}
    </div>
  );
}