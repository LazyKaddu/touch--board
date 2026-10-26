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

fn get_home_dir() -> Option<std::path::PathBuf> {
    std::env::var("HOME").ok().map(std::path::PathBuf::from)
}

fn find_config_path() -> std::path::PathBuf {
    if let Some(home) = get_home_dir() {
        let perm = home.join(".config").join("touchboard").join("config.json");
        if perm.exists() {
            return perm;
        }
    }

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
    std::fs::write(&p, &config_str).map_err(|e| format!("Failed to write {}: {}", p.display(), e))?;

    // Keep workspace file in sync if permanent config was saved
    if let Some(home) = get_home_dir() {
        let perm = home.join(".config").join("touchboard").join("config.json");
        if p == perm {
            let local = std::path::PathBuf::from("../touch-board-script/src/config.json");
            if local.exists() {
                let _ = std::fs::write(&local, &config_str);
            }
        } else if perm.exists() {
            let _ = std::fs::write(&perm, &config_str);
        }
    }
    Ok(())
}

fn find_install_script_path() -> Option<std::path::PathBuf> {
    let candidates = [
        "../touch-board-script/scripts/install_service.sh",
        "touch-board-script/scripts/install_service.sh",
        "../../touch-board-script/scripts/install_service.sh",
    ];
    for rel in candidates {
        let p = std::path::PathBuf::from(rel);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

#[tauri::command]
fn setup_touchboard_service() -> Result<String, String> {
    let home = get_home_dir().ok_or_else(|| "Could not determine user HOME directory".to_string())?;
    let marker = home.join(".config").join("touchboard").join(".setup_complete");

    if marker.exists() {
        return Ok(serde_json::json!({
            "installed": true,
            "is_first_run": false,
            "message": "TouchBoard service is already installed."
        }).to_string());
    }

    let script_path = find_install_script_path()
        .ok_or_else(|| "Installer script install_service.sh not found.".to_string())?;

    let output = std::process::Command::new("bash")
        .arg(&script_path)
        .output()
        .map_err(|e| format!("Failed to execute installer: {}", e))?;

    if output.status.success() {
        Ok(serde_json::json!({
            "installed": true,
            "is_first_run": true,
            "message": "TouchBoard background engine installed and started successfully.",
            "output": String::from_utf8_lossy(&output.stdout).trim()
        }).to_string())
    } else {
        let err = String::from_utf8_lossy(&output.stderr);
        Err(format!("Installation failed: {}", err))
    }
}

#[tauri::command]
fn get_service_status() -> Result<String, String> {
    let output = std::process::Command::new("systemctl")
        .args(["--user", "is-active", "touchboard.service"])
        .output();

    match output {
        Ok(out) => {
            let status = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if status.is_empty() {
                Ok("not_installed".to_string())
            } else {
                Ok(status)
            }
        }
        Err(_) => Ok("unknown".to_string()),
    }
}

#[tauri::command]
fn restart_service() -> Result<String, String> {
    let output = std::process::Command::new("systemctl")
        .args(["--user", "restart", "touchboard.service"])
        .output()
        .map_err(|e| format!("Failed to execute restart: {}", e))?;

    if output.status.success() {
        Ok("restarted".to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[tauri::command]
fn stop_service() -> Result<String, String> {
    let output = std::process::Command::new("systemctl")
        .args(["--user", "stop", "touchboard.service"])
        .output()
        .map_err(|e| format!("Failed to execute stop: {}", e))?;

    if output.status.success() {
        Ok("stopped".to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            pick_file,
            load_config,
            save_config,
            setup_touchboard_service,
            get_service_status,
            restart_service,
            stop_service
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


