import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function Editor({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Track whether a change is coming from outside (avoid echo loop)
  const externalRef = useRef(false);

  // Mount editor once
  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          oneDark,
          keymap.of([indentWithTab]),
          EditorView.theme({
            // Make the editor fill its container
            "&": { height: "100%", background: "transparent" },
            ".cm-scroller": { overflow: "auto" },
            // Slightly wider line gutter
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
    // intentionally run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g. file open)
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

  return <div ref={containerRef} style={{ height: "100%" }} />;
}
