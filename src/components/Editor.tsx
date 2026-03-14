import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState, Compartment } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { typst } from "codemirror-lang-typst";
import {
  Transport,
  LSPClient,
  languageServerExtensions,
} from "@codemirror/lsp-client";

interface Props {
  value: string;
  onChange: (value: string) => void;
  lspPort: number | null;
  fileUri: string | null;
}

// ── WebSocket transport for @codemirror/lsp-client ────────────────────────
function makeTransport(port: number): Promise<Transport> {
  const handlers: ((value: string) => void)[] = [];
  const sock = new WebSocket(`ws://127.0.0.1:${port}`);
  sock.onmessage = (e) => handlers.forEach((h) => h(e.data.toString()));
  return new Promise((resolve, reject) => {
    sock.onopen = () =>
      resolve({
        send(msg: string) {
          sock.send(msg);
        },
        subscribe(h: (v: string) => void) {
          handlers.push(h);
        },
        unsubscribe(h: (v: string) => void) {
          const i = handlers.indexOf(h);
          if (i >= 0) handlers.splice(i, 1);
        },
      });
    sock.onerror = reject;
  });
}

// ── Component ─────────────────────────────────────────────────────────────
export default function Editor({ value, onChange, lspPort, fileUri }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const externalRef = useRef(false);
  // Compartment lets us swap the LSP extension in after the async connect
  const lspCompartment = useRef(new Compartment());

  // ── Mount editor once ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          oneDark,
          typst(),
          keymap.of([indentWithTab]),
          lspCompartment.current.of([]), // placeholder — filled when LSP connects
          EditorView.theme({
            "&": { height: "100%", background: "transparent" },
            ".cm-scroller": { overflow: "auto" },
            ".cm-gutters": { minWidth: "48px" },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !externalRef.current) {
              onChange(update.state.doc.toString());
            }
          }),
        ],
      }),
      parent: containerRef.current,
    });

    viewRef.current = view;
    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync external value (file open) ─────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      externalRef.current = true;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
      externalRef.current = false;
    }
  }, [value]);

  // ── Connect LSP when port + fileUri are ready ────────────────────────────
  useEffect(() => {
    if (!lspPort || !fileUri || !viewRef.current) return;

    let cancelled = false;
    (async () => {
      try {
        const transport = await makeTransport(lspPort);
        if (cancelled) return;

        const client = new LSPClient({
          extensions: languageServerExtensions(),
        }).connect(transport);

        viewRef.current!.dispatch({
          effects: lspCompartment.current.reconfigure(client.plugin(fileUri)),
        });
      } catch (e) {
        console.warn("LSP connect failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [lspPort, fileUri]);

  return <div ref={containerRef} style={{ height: "100%" }} />;
}
