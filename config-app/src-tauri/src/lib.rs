// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn pick_file() -> String {
    #[cfg(target_os = "linux")]
    {
        if let Ok(output) = std::process::Command::new("zenity")
            .arg("--file-selection")
            .arg("--title=Select Application")
            .output()
        {
            if output.status.success() {
                return String::from_utf8_lossy(&output.stdout).trim().to_string();
            }
        }
        if let Ok(output) = std::process::Command::new("kdialog")
            .arg("--getopenfilename")
            .output()
        {
            if output.status.success() {
                return String::from_utf8_lossy(&output.stdout).trim().to_string();
            }
        }
    }
    #[cfg(target_os = "windows")]
    {
        let ps_cmd = "Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.OpenFileDialog; $d.Title = 'Select Application'; [void]$d.ShowDialog(); Write-Output $d.FileName";
        if let Ok(output) = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", ps_cmd])
            .output()
        {
            return String::from_utf8_lossy(&output.stdout).trim().to_string();
        }
    }
    #[cfg(target_os = "macos")]
    {
        let script = "POSIX path of (choose file with prompt \"Select Application\")";
        if let Ok(output) = std::process::Command::new("osascript")
            .args(["-e", script])
            .output()
        {
            return String::from_utf8_lossy(&output.stdout).trim().to_string();
        }
    }
    String::new()
}

fn find_config_path() -> std::path::PathBuf {
    let candidates = [
        "../touch-board-script/src/config.json",
        "touch-board-script/src/config.json",
        "../../touch-board-script/src/config.json",
    ];
    for rel in candidates {
        let p = std::path::PathBuf::from(rel);
        if p.exists() {
            return p;
        }
    }
    std::path::PathBuf::from("../touch-board-script/src/config.json")
}

#[tauri::command]
fn load_config() -> Result<String, String> {
    let p = find_config_path();
    std::fs::read_to_string(&p).map_err(|e| format!("Failed to read {}: {}", p.display(), e))
}

#[tauri::command]
fn save_config(config_str: String) -> Result<(), String> {
    let p = find_config_path();
    if let Some(parent) = p.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&p, config_str).map_err(|e| format!("Failed to write {}: {}", p.display(), e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, pick_file, load_config, save_config])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

