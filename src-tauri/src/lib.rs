use base64::{engine::general_purpose, Engine as _};
use futures_util::{SinkExt, StreamExt};
use rfd::AsyncFileDialog;
use std::{fs, process::Stdio};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;
use tokio_tungstenite::{accept_async, tungstenite::Message};

// ── Helpers ────────────────────────────────────────────────────────────────

fn temp_typ() -> std::path::PathBuf {
    std::env::temp_dir().join("typst-desktop-current.typ")
}

fn temp_pdf() -> std::path::PathBuf {
    std::env::temp_dir().join("typst-desktop-preview.pdf")
}

// ── Commands ───────────────────────────────────────────────────────────────

#[tauri::command]
fn get_temp_typ_path() -> String {
    temp_typ().to_string_lossy().into_owned()
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn open_file_dialog() -> Option<(String, String)> {
    let handle = AsyncFileDialog::new()
        .add_filter("Typst documents", &["typ"])
        .add_filter("All files", &["*"])
        .pick_file()
        .await?;

    let path = handle.path().to_string_lossy().into_owned();
    let content = fs::read_to_string(&path).ok()?;
    Some((path, content))
}

#[tauri::command]
async fn save_file_dialog() -> Option<String> {
    let handle = AsyncFileDialog::new()
        .add_filter("Typst documents", &["typ"])
        .save_file()
        .await?;

    Some(handle.path().to_string_lossy().into_owned())
}

#[tauri::command]
fn compile_typst(file_path: String) -> Result<String, String> {
    let pdf_path = temp_pdf();

    let output = std::process::Command::new("typst")
        .args(["compile", &file_path, pdf_path.to_str().unwrap_or_default()])
        .output()
        .map_err(|e| {
            format!(
                "Could not launch the `typst` CLI.\n\
                 Is Typst installed and on your PATH?\n\nSystem error: {e}"
            )
        })?;

    if output.status.success() {
        let bytes = fs::read(&pdf_path)
            .map_err(|e| format!("Compilation succeeded but the PDF could not be read: {e}"))?;
        Ok(general_purpose::STANDARD.encode(&bytes))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        Err(if stderr.trim().is_empty() {
            stdout.into_owned()
        } else {
            stderr.into_owned()
        })
    }
}

/// Spawn `tinymist lsp` and bridge its stdio over a local WebSocket.
/// Returns the port the WebSocket server is listening on.
#[tauri::command]
async fn start_lsp_bridge() -> Result<u16, String> {
    // Bind on a random free port
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    // Spawn tinymist in LSP mode with piped stdio
    let mut child = tokio::process::Command::new("tinymist")
        .arg("lsp")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| {
            format!(
                "Could not launch tinymist.\n\
                 Is tinymist installed and on your PATH?\n\nSystem error: {e}"
            )
        })?;

    let mut child_stdin = child.stdin.take().unwrap();
    let child_stdout = child.stdout.take().unwrap();

    tokio::spawn(async move {
        // Accept exactly one WebSocket connection (our editor)
        let Ok((tcp_stream, _)) = listener.accept().await else {
            return;
        };
        let Ok(ws) = accept_async(tcp_stream).await else {
            return;
        };

        let (mut ws_tx, mut ws_rx) = ws.split();
        let mut lsp_reader = BufReader::new(child_stdout);

        // ── tinymist stdout → WebSocket ──────────────────────────────────
        // LSP frames: "Content-Length: N\r\n\r\n<N bytes of JSON>"
        // We strip the header and forward raw JSON.
        let stdout_to_ws = async {
            loop {
                let mut content_length: usize = 0;

                // Read header lines until blank line
                loop {
                    let mut line = String::new();
                    if lsp_reader.read_line(&mut line).await.unwrap_or(0) == 0 {
                        return; // EOF
                    }
                    let trimmed = line.trim_end_matches(['\r', '\n']);
                    if trimmed.is_empty() {
                        break;
                    }
                    if let Some(val) = trimmed.strip_prefix("Content-Length: ") {
                        content_length = val.parse().unwrap_or(0);
                    }
                }

                if content_length == 0 {
                    continue;
                }

                let mut body = vec![0u8; content_length];
                if lsp_reader.read_exact(&mut body).await.is_err() {
                    return;
                }

                let json = String::from_utf8_lossy(&body).into_owned();
                if ws_tx.send(Message::Text(json)).await.is_err() {
                    return;
                }
            }
        };

        // ── WebSocket → tinymist stdin ───────────────────────────────────
        // Receive raw JSON from the editor, add LSP framing, write to stdin.
        let ws_to_stdin = async {
            while let Some(Ok(msg)) = ws_rx.next().await {
                if let Message::Text(text) = msg {
                    // Content-Length must be the UTF-8 byte count
                    let byte_len = text.len();
                    let framed = format!("Content-Length: {byte_len}\r\n\r\n{text}");
                    if child_stdin.write_all(framed.as_bytes()).await.is_err() {
                        return;
                    }
                }
            }
        };

        // Run both directions concurrently; stop both when either ends
        tokio::select! {
            _ = stdout_to_ws => {}
            _ = ws_to_stdin => {}
        }

        let _ = child.kill().await;
    });

    Ok(port)
}

// ── App entry point ────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_temp_typ_path,
            write_file,
            open_file_dialog,
            save_file_dialog,
            compile_typst,
            start_lsp_bridge,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Typst Desktop");
}
