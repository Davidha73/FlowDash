use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Deserialize)]
struct WindowSettings {
    width: Option<u32>,
    height: Option<u32>,
    x: Option<i32>,
    y: Option<i32>,
    maximized: Option<bool>,
}

#[derive(Deserialize)]
struct AppSettings {
    window: Option<WindowSettings>,
}

#[derive(Serialize)]
struct RunningFlowApps {
    wordflow: bool,
    boardflow: bool,
    noteflow: bool,
}

fn install_settings_dir() -> Option<PathBuf> {
    if cfg!(debug_assertions) {
        if let Some(project_root) = Path::new(env!("CARGO_MANIFEST_DIR")).parent() {
            return Some(project_root.to_path_buf());
        }
    }
    let exe = std::env::current_exe().ok()?;
    let exe_dir = exe.parent()?;
    #[cfg(target_os = "macos")]
    {
        if exe_dir.ends_with("Contents/MacOS") {
            if let Some(bundle_dir) = exe_dir.parent().and_then(|p| p.parent()) {
                if let Some(parent_dir) = bundle_dir.parent() {
                    return Some(parent_dir.to_path_buf());
                }
            }
        }
    }
    Some(exe_dir.to_path_buf())
}

fn resolve_settings_read_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    if let Some(install_dir) = install_settings_dir() {
        let candidate = install_dir.join("settings.json");
        if candidate.exists() {
            return Some(candidate);
        }
    }
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("settings.json"))
}

fn restore_window_from_settings(app: &tauri::App, window: &tauri::WebviewWindow) -> bool {
    let Some(settings_path) = resolve_settings_read_path(app.handle()) else {
        return false;
    };
    let Ok(raw) = fs::read_to_string(settings_path) else {
        return false;
    };
    let Ok(settings) = serde_json::from_str::<AppSettings>(&raw) else {
        return false;
    };
    let Some(win) = settings.window else {
        return false;
    };

    if let (Some(w), Some(h)) = (win.width, win.height) {
        if w >= 400 && h >= 300 {
            let _ = window.set_size(tauri::PhysicalSize::new(w, h));
        }
    }
    let mut positioned = false;
    if let (Some(x), Some(y)) = (win.x, win.y) {
        if x > -10000 && y > -10000 {
            let on_screen = window
                .available_monitors()
                .map(|monitors| {
                    monitors.into_iter().any(|m| {
                        let pos = m.position();
                        let size = m.size();
                        x >= pos.x - 100
                            && y >= pos.y - 100
                            && x < pos.x + size.width as i32
                            && y < pos.y + size.height as i32
                    })
                })
                .unwrap_or(true);
            if on_screen {
                let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
                positioned = true;
            }
        }
    }
    if !positioned {
        let _ = window.center();
    }
    win.maximized.unwrap_or(false)
}

fn flow_suite_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Failed to resolve app data dir: {err}"))?;
    let suite_dir = data_dir.parent().unwrap_or(&data_dir).join("FlowSuite");
    fs::create_dir_all(&suite_dir)
        .map_err(|err| format!("Failed to create FlowSuite dir: {err}"))?;
    Ok(suite_dir)
}

fn app_names(target: &str) -> Result<(&'static str, &'static str, &'static str), String> {
    match target {
        "wordflow" => Ok(("WordFlow", "wordflow", "com.wordflow.app")),
        "boardflow" => Ok(("BoardFlow", "boardflow", "com.boardflow.app")),
        "noteflow" => Ok(("NoteFlow", "noteflow", "com.noteflow.app")),
        _ => Err("Unsupported Flow Suite target app.".to_string()),
    }
}

#[cfg(target_os = "macos")]
fn is_process_running(name: &str) -> bool {
    Command::new("pgrep")
        .args(["-xi", name])
        .output()
        .map(|out| out.status.success())
        .unwrap_or(false)
}

#[cfg(not(target_os = "macos"))]
fn is_process_running(_name: &str) -> bool {
    false
}

#[tauri::command]
fn get_running_flow_apps() -> RunningFlowApps {
    RunningFlowApps {
        wordflow: is_process_running("wordflow") || is_process_running("WordFlow"),
        boardflow: is_process_running("boardflow") || is_process_running("BoardFlow"),
        noteflow: is_process_running("noteflow") || is_process_running("NoteFlow"),
    }
}

#[tauri::command]
fn launch_flow_app(
    app: tauri::AppHandle,
    target: String,
    payload: Option<String>,
) -> Result<(), String> {
    let (app_name, bin_name, _) = app_names(&target)?;
    let suite_dir = flow_suite_dir(&app)?;
    if let Some(body) = payload {
        if !body.trim().is_empty() {
            let handoff_path = suite_dir.join(format!("handoff-{bin_name}.json"));
            fs::write(&handoff_path, body)
                .map_err(|err| format!("Failed to write handoff: {err}"))?;
        }
    }

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "tell application \"System Events\"\n\
             set procs to (every process whose name is \"{app_name}\" or name is \"{bin_name}\")\n\
             if (count of procs) > 0 then\n\
               set frontmost of item 1 of procs to true\n\
             else\n\
               do shell script \"open -a \\\"{app_name}\\\"\"\n\
             end if\n\
             end tell"
        );
        Command::new("osascript")
            .args(["-e", &script])
            .spawn()
            .map_err(|err| format!("Failed to launch {app_name}: {err}"))?;
    }

    Ok(())
}

#[tauri::command]
fn quit_flow_app(target: String) -> Result<(), String> {
    let (app_name, bin_name, _) = app_names(&target)?;

    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "tell application \"System Events\"\n\
             set procs to (every process whose name is \"{app_name}\" or name is \"{bin_name}\")\n\
             if (count of procs) > 0 then\n\
               set procName to name of item 1 of procs\n\
               tell application procName to quit\n\
             end if\n\
             end tell"
        );
        Command::new("osascript")
            .args(["-e", &script])
            .spawn()
            .map_err(|err| format!("Failed to quit {app_name}: {err}"))?;
    }

    Ok(())
}

fn read_json_value(path: &Path) -> Option<serde_json::Value> {
    if !path.exists() {
        return None;
    }
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn find_sibling_settings(app: &tauri::AppHandle, app_name: &str, bundle_id: &str) -> Option<PathBuf> {
    if let Some(install_dir) = install_settings_dir() {
        if let Some(parent) = install_dir.parent() {
            let dev_candidate = parent.join(app_name).join("settings.json");
            if dev_candidate.exists() {
                return Some(dev_candidate);
            }
        }
    }
    if let Ok(config_dir) = app.path().app_config_dir() {
        if let Some(parent) = config_dir.parent() {
            let bundle_candidate = parent.join(bundle_id).join("settings.json");
            if bundle_candidate.exists() {
                return Some(bundle_candidate);
            }
        }
    }
    None
}

#[tauri::command]
fn read_flow_suite_index(app: tauri::AppHandle) -> Result<String, String> {
    let suite_dir = flow_suite_dir(&app)?;
    let mut recents_map: HashMap<&str, serde_json::Value> = HashMap::new();
    let mut templates_map: HashMap<&str, serde_json::Value> = HashMap::new();

    for key in ["wordflow", "boardflow", "noteflow"] {
        let (app_name, _, bundle_id) = app_names(key)?;
        let suite_recents = suite_dir.join(format!("recents-{key}.json"));
        let suite_templates = suite_dir.join(format!("templates-{key}.json"));

        let mut recents = read_json_value(&suite_recents);
        let mut templates = read_json_value(&suite_templates);

        if recents.is_none() || templates.is_none() {
            if let Some(settings_path) = find_sibling_settings(&app, app_name, bundle_id) {
                if let Some(settings) = read_json_value(&settings_path) {
                    if recents.is_none() {
                        recents = settings.get("recentDocuments").cloned();
                    }
                    if templates.is_none() {
                        templates = settings.get("customTemplates").cloned();
                    }
                }
            }
        }

        recents_map.insert(key, recents.unwrap_or_else(|| serde_json::json!([])));
        templates_map.insert(key, templates.unwrap_or_else(|| serde_json::json!([])));
    }

    let out = serde_json::json!({
        "recents": recents_map,
        "templates": templates_map,
    });
    Ok(out.to_string())
}

#[tauri::command]
fn show_in_explorer(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.exists() {
        return Err("File no longer exists on disk.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|err| format!("Failed to open Explorer: {err}"))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|err| format!("Failed to open Finder: {err}"))?;
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let parent = target.parent().unwrap_or(target);
        Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|err| format!("Failed to open file manager: {err}"))?;
    }

    Ok(())
}

#[tauri::command]
fn read_settings_file(app: tauri::AppHandle) -> Result<String, String> {
    let Some(path) = resolve_settings_read_path(&app) else {
        return Ok(String::new());
    };
    if !path.exists() {
        return Ok(String::new());
    }
    fs::read_to_string(path).map_err(|err| format!("Failed to read settings.json: {err}"))
}

fn resolve_noteflow_notes_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Some(settings_path) = find_sibling_settings(app, "NoteFlow", "com.noteflow.app") {
        if let Some(settings) = read_json_value(&settings_path) {
            if let Some(custom) = settings.get("notesDir").and_then(|v| v.as_str()) {
                let trimmed = custom.trim();
                if !trimmed.is_empty() {
                    return Ok(PathBuf::from(trimmed));
                }
            }
        }
    }
    Ok(flow_suite_dir(app)?.join("NoteFlow").join("notes"))
}

fn sanitize_note_id(id: &str) -> Result<String, String> {
    let clean: String = id
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    if clean.is_empty() {
        return Err("Invalid note id".to_string());
    }
    Ok(clean)
}

#[tauri::command]
fn list_noteflow_notes(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let dir = resolve_noteflow_notes_dir(&app)?;
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut notes = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Ok(raw) = fs::read_to_string(&path) {
                notes.push(raw);
            }
        }
    }
    Ok(notes)
}

#[tauri::command]
fn update_noteflow_reminder(
    app: tauri::AppHandle,
    id: String,
    reminder_at: Option<String>,
    reminder_fired_for: Option<String>,
) -> Result<(), String> {
    let clean_id = sanitize_note_id(&id)?;
    let dir = resolve_noteflow_notes_dir(&app)?;
    let path = dir.join(format!("{clean_id}.json"));
    if !path.exists() {
        return Ok(());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut val: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    if let Some(obj) = val.as_object_mut() {
        obj.insert(
            "reminderAt".to_string(),
            reminder_at
                .map(serde_json::Value::String)
                .unwrap_or(serde_json::Value::Null),
        );
        obj.insert(
            "reminderFiredFor".to_string(),
            reminder_fired_for
                .map(serde_json::Value::String)
                .unwrap_or(serde_json::Value::Null),
        );
    }
    let serialized = serde_json::to_string_pretty(&val).map_err(|e| e.to_string())?;
    fs::write(path, serialized).map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn escape_applescript_string(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\r', " ")
        .replace('\n', " ")
}

#[cfg(target_os = "windows")]
fn escape_xml_text(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
        .replace('\r', " ")
        .replace('\n', " ")
}

#[tauri::command]
fn send_system_notification(title: String, body: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let clean_title = escape_applescript_string(title.trim());
        let clean_body = escape_applescript_string(body.trim());
        let script = format!(
            "display notification \"{clean_body}\" with title \"{clean_title}\" sound name \"default\""
        );
        let out = Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| e.to_string())?;
        if !out.status.success() {
            let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
            return Err(if err.is_empty() {
                "Failed to send macOS notification".to_string()
            } else {
                err
            });
        }
    }
    #[cfg(target_os = "windows")]
    {
        let clean_title = escape_xml_text(title.trim());
        let clean_body = escape_xml_text(body.trim());
        let ps_script = format!(
            "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; \
             [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null; \
             $xml = New-Object Windows.Data.Xml.Dom.XmlDocument; \
             $xml.LoadXml('<toast><visual><binding template=\"ToastText02\"><text id=\"1\">{clean_title}</text><text id=\"2\">{clean_body}</text></binding></visual></toast>'); \
             $toast = [Windows.UI.Notifications.ToastNotification]::new($xml); \
             [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}}\\WindowsPowerShell\\v1.0\\powershell.exe').Show($toast)"
        );
        let out = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", &ps_script])
            .output()
            .map_err(|e| e.to_string())?;
        if !out.status.success() {
            let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
            return Err(if err.is_empty() {
                "Failed to send Windows notification".to_string()
            } else {
                err
            });
        }
    }
    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        let _ = (title, body);
    }
    Ok(())
}

#[tauri::command]
fn write_settings_file(app: tauri::AppHandle, contents: String) -> Result<(), String> {
    if let Some(install_dir) = install_settings_dir() {
        let target = install_dir.join("settings.json");
        if fs::write(&target, &contents).is_ok() {
            return Ok(());
        }
    }
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|err| format!("Failed to resolve settings directory: {err}"))?;
    fs::create_dir_all(&config_dir)
        .map_err(|err| format!("Failed to create settings directory: {err}"))?;
    fs::write(config_dir.join("settings.json"), contents)
        .map_err(|err| format!("Failed to write settings.json: {err}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let blank_icon = tauri::image::Image::new_owned(vec![0, 0, 0, 0], 1, 1);
                let _ = window.set_icon(blank_icon);
                if window.is_minimized().unwrap_or(false) {
                    let _ = window.unminimize();
                }
                let should_maximize = restore_window_from_settings(app, &window);
                let _ = window.show();
                if should_maximize {
                    let _ = window.maximize();
                }
                let _ = window.set_focus();
            }
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            show_in_explorer,
            read_settings_file,
            write_settings_file,
            get_running_flow_apps,
            launch_flow_app,
            quit_flow_app,
            read_flow_suite_index,
            list_noteflow_notes,
            update_noteflow_reminder,
            send_system_notification
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
