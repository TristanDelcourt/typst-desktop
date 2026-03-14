import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import Editor from "./components/Editor";
import Preview from "./components/Preview";
import Toolbar from "./components/Toolbar";
import DiagnosticsPanel from "./components/DiagnosticsPanel";

interface CompileState {
  pdf: string | null;
  error: string | null;
}

const DEFAULT_DOC = `#set page(paper: "a4", margin: 2.5cm)
#set text(font: "New Computer Modern", size: 11pt)
#set heading(numbering: "1.")

= Hello, Typst! 🎉

Welcome to *Typst Desktop* — a lightweight native editor with live preview.

== Getting Started

Open any #emph[.typ] file with the *Open* button, or start editing here.
The document compiles automatically every time you save (Ctrl+S / ⌘S).

== Features

- Side-by-side editor and PDF preview
- Syntax highlighting via CodeMirror 6
- Debounced auto-compile on save
- Open / Save / Save As

== Math

Typst makes math a pleasure:

$ sum_(k=1)^n k = (n(n+1))/2 $

#v(1em)
_Edit this document to see changes in the preview →_
`;

export default function App() {
  const [content, setContent] = useState(DEFAULT_DOC);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [tempTypPath, setTempTypPath] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [lspPort, setLspPort] = useState<number | null>(null);
  const [compile, setCompile] = useState<CompileState>({
    pdf: null,
    error: null,
  });
  const [leftPct, setLeftPct] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  useEffect(() => {
    (async () => {
      const path = await invoke<string>("get_temp_typ_path");
      setTempTypPath(path);
      await doCompile(path, DEFAULT_DOC);

      try {
        const port = await invoke<number>("start_lsp_bridge");
        setLspPort(port);
      } catch (e) {
        console.warn("LSP unavailable:", e);
      }
    })();
  }, []);

  const doCompile = useCallback(async (typPath: string, text: string) => {
    try {
      await invoke("write_file", { path: typPath, content: text });
      const pdf = await invoke<string>("compile_typst", { filePath: typPath });
      setCompile({ pdf, error: null });
    } catch (err) {
      setCompile({ pdf: null, error: String(err) });
    }
  }, []);

  const scheduleCompile = useCallback(
    (text: string) => {
      if (!tempTypPath) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        doCompile(tempTypPath, text);
      }, 600);
    },
    [tempTypPath, doCompile],
  );

  const handleChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      scheduleCompile(newContent);
    },
    [scheduleCompile],
  );

  const handleOpen = async () => {
    const result = await invoke<[string, string] | null>("open_file_dialog");
    if (!result) return;
    const [path, text] = result;
    setSavedPath(path);
    setContent(text);
    if (tempTypPath) doCompile(tempTypPath, text);
  };

  const handleSave = useCallback(async () => {
    const text = contentRef.current;
    if (!savedPath) {
      const path = await invoke<string | null>("save_file_dialog");
      if (!path) return;
      setSavedPath(path);
      await invoke("write_file", { path, content: text });
      if (tempTypPath) doCompile(tempTypPath, text);
    } else {
      await invoke("write_file", { path: savedPath, content: text });
      if (tempTypPath) doCompile(tempTypPath, text);
    }
  }, [savedPath, tempTypPath, doCompile]);

  const handleSaveAs = async () => {
    const path = await invoke<string | null>("save_file_dialog");
    if (!path) return;
    setSavedPath(path);
    await invoke("write_file", { path, content: contentRef.current });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave]);

  const handleDividerDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const onMove = (ev: MouseEvent) => {
      const pct = (ev.clientX / window.innerWidth) * 100;
      setLeftPct(Math.min(80, Math.max(20, pct)));
    };
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const filename = savedPath
    ? (savedPath.replace(/\\/g, "/").split("/").pop() ?? null)
    : null;

  return (
    <div className="app">
      <Toolbar
        filename={filename}
        onOpen={handleOpen}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
      />

      <div className="workspace">
        <div className="editor-pane" style={{ width: `${leftPct}%` }}>
          <div className="editor-wrap">
            <Editor
              value={content}
              onChange={handleChange}
              lspPort={lspPort}
              fileUri={
                savedPath
                  ? `file://${savedPath}`
                  : tempTypPath
                    ? `file://${tempTypPath}`
                    : null
              }
              onDiagnostics={setDiagnostics}
            />
          </div>
          <DiagnosticsPanel diagnostics={diagnostics} />
        </div>

        <div
          className={`divider${isDragging ? " dragging" : ""}`}
          onMouseDown={handleDividerDown}
        />

        <div className="preview-pane">
          <Preview pdf={compile.pdf} error={compile.error} />
        </div>
      </div>
    </div>
  );
}
