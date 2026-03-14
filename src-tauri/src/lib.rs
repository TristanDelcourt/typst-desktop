use base64::{engine::general_purpose, Engine as _};
use rfd::AsyncFileDialog;
use std::{fs, process::Command};

// ── Helpers ────────────────────────────────────────────────────────────────

fn temp_typ() -> std::path::PathBuf {
    std::env::temp_dir().join("typst-desktop-current.typ")
}

fn temp_pdf() -> std::path::PathBuf {
    std::env::temp_dir().join("typst-desktop-preview.pdf")
}

// ── Commands ───────────────────────────────────────────────────────────────

/// Return the path of the temp .typ file we always compile from.
#[tauri::command]
fn get_temp_typ_path() -> String {
    temp_typ().to_string_lossy().into_owned()
}

/// Write arbitrary text content to a file path.
#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| e.to_string())
}

/// Show a native Open File dialog and return (path, content) for the chosen file.
/// Returns `null` in JS if the user cancels.
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

/// Show a native Save File dialog and return the chosen path.
/// Returns `null` in JS if the user cancels.
#[tauri::command]
async fn save_file_dialog() -> Option<String> {
    let handle = AsyncFileDialog::new()
        .add_filter("Typst documents", &["typ"])
        .save_file()
        .await?;

    Some(handle.path().to_string_lossy().into_owned())
}

/// Compile `file_path` with the `typst` CLI.
///
/// On success: returns the resulting PDF as a base64 string.
/// On failure: returns an Err whose string is the compiler's stderr output.
#[tauri::command]
fn compile_typst(file_path: String) -> Result<String, String> {
    let pdf_path = temp_pdf();

    let output = Command::new("typst")
        .args([
            "compile",
            &file_path,
            pdf_path.to_str().unwrap_or_default(),
        ])
        .output()
        .map_err(|e| {
            format!(
                "Could not launch the `typst` CLI.\n\
                 Is Typst installed and on your PATH?\n\n\
                 System error: {e}"
            )
        })?;

    if output.status.success() {
        let bytes = fs::read(&pdf_path)
            .map_err(|e| format!("Compilation succeeded but the PDF could not be read: {e}"))?;
        Ok(general_purpose::STANDARD.encode(&bytes))
    } else {
        // Prefer stderr; fall back to stdout if empty.
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let msg = if stderr.trim().is_empty() {
            stdout.into_owned()
        } else {
            stderr.into_owned()
        };
        Err(msg)
    }
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running Typst Desktop");
}
