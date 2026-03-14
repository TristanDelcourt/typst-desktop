# Typst Desktop

A lightweight native desktop editor for [Typst](https://typst.app) with a side-by-side live PDF preview — built with Tauri v2, React, CodeMirror 6 and pdf.js.

---

## Prerequisites

| Tool | Install |
|------|---------|
| **Rust** (stable) | https://rustup.rs |
| **Node.js** ≥ 18 | https://nodejs.org |
| **Tauri CLI** v2 | `cargo install tauri-cli --version "^2"` |
| **typst** CLI | https://github.com/typst/typst/releases |

Make sure `typst` is on your `PATH`:
```sh
typst --version   # should print e.g. typst 0.11.0
```

On **Linux** you'll also need the standard Tauri system dependencies (WebKit, GTK …).  
See: https://v2.tauri.app/start/prerequisites/#linux

---

## Running in development

```sh
npm install
npm run tauri dev
```

The app window opens with a sample document already compiled and displayed.

---

## Building for production

```sh
npm run tauri build
```

The installer / app bundle lands in `src-tauri/target/release/bundle/`.

---

## How it works (v1)

```
User types in CodeMirror
  → debounce 600 ms
  → Rust: write content to $TEMP/typst-desktop-current.typ
  → Rust: spawn  typst compile <tmp.typ> <tmp.pdf>
  → on success: read PDF bytes → base64 → send to frontend
  → pdf.js renders each page onto <canvas> elements
  → on error: stderr shown in the preview pane
```

---

## Roadmap — v2 (tinymist live preview)

The v2 upgrade swaps the preview pane for a `tinymist` WebSocket renderer,
giving sub-50 ms incremental updates identical to typst.app — without touching
the editor pane at all.

Steps:
1. Install [tinymist](https://github.com/Myriad-Dreamin/tinymist)
2. In `lib.rs`, on file-open spawn:
   ```
   tinymist preview --no-open --port <random> <file.typ>
   ```
3. Capture the port from tinymist's stdout.
4. In `Preview.tsx`, replace the `<canvas>` renderer with:
   ```tsx
   <iframe src={`http://localhost:${port}`} style={{flex:1, border:'none'}} />
   ```
5. Kill the tinymist process when the window closes (`tauri::WindowEvent::CloseRequested`).

That's the entire migration — the editor, toolbar, file logic and CSS are untouched.

---

## Project structure

```
typst-desktop/
├── src/                    # React + TypeScript frontend
│   ├── App.tsx             # State, compile loop, split pane
│   ├── index.css           # Dark theme
│   └── components/
│       ├── Editor.tsx      # CodeMirror 6
│       ├── Preview.tsx     # pdf.js renderer
│       └── Toolbar.tsx     # Open / Save / status
├── src-tauri/
│   ├── src/
│   │   ├── main.rs         # Binary entry point
│   │   └── lib.rs          # Tauri commands (file I/O + typst CLI)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── index.html
├── package.json
└── vite.config.ts
```
