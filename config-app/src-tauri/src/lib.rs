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

// Embedded script assets compiled directly into the binary
const SCRIPT_MAIN_PY: &str = include_str!("../scripts/main.py");
const SCRIPT_INSTALL_SH: &str = include_str!("../scripts/install_service.sh");
const SCRIPT_UNINSTALL_SH: &str = include_str!("../scripts/uninstall_service.sh");
const DEFAULT_CONFIG_JSON: &str = include_str!("../scripts/config.json");

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
        "scripts/config.json",
    ];
    for rel in candidates {
        let p = std::path::PathBuf::from(rel);
        if p.exists() {
            return p;
        }
    }

    if let Some(home) = get_home_dir() {
        return home.join(".config").join("touchboard").join("config.json");
    }

    std::path::PathBuf::from("config.json")
}

#[tauri::command]
fn load_config() -> Result<String, String> {
    let p = find_config_path();
    if p.exists() {
        std::fs::read_to_string(&p).map_err(|e| format!("Failed to read {}: {}", p.display(), e))
    } else {
        // Return embedded default config if none exists yet
        Ok(DEFAULT_CONFIG_JSON.to_string())
    }
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

#[tauri::command]
fn setup_touchboard_service(force: Option<bool>) -> Result<String, String> {
    let home = get_home_dir().ok_or_else(|| "Could not determine user HOME directory".to_string())?;
    let config_dir = home.join(".config").join("touchboard");
    let scripts_dir = config_dir.join("scripts");
    let marker = config_dir.join(".setup_complete");

    // 1. Ensure permanent directory exists
    std::fs::create_dir_all(&scripts_dir)
        .map_err(|e| format!("Failed to create scripts directory: {}", e))?;

    // 2. Extract embedded scripts into permanent config directory
    let main_py_path = scripts_dir.join("main.py");
    let install_sh_path = scripts_dir.join("install_service.sh");
    let uninstall_sh_path = scripts_dir.join("uninstall_service.sh");
    let config_json_path = config_dir.join("config.json");

    std::fs::write(&main_py_path, SCRIPT_MAIN_PY)
        .map_err(|e| format!("Failed to write main.py: {}", e))?;

    std::fs::write(&install_sh_path, SCRIPT_INSTALL_SH)
        .map_err(|e| format!("Failed to write install_service.sh: {}", e))?;

    std::fs::write(&uninstall_sh_path, SCRIPT_UNINSTALL_SH)
        .map_err(|e| format!("Failed to write uninstall_service.sh: {}", e))?;

    // Write default config only if none exists yet, preserving any existing user settings
    if !config_json_path.exists() {
        let _ = std::fs::write(&config_json_path, DEFAULT_CONFIG_JSON);
    }

    // Set execute permissions on scripts on Unix systems
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        for script_file in [&install_sh_path, &uninstall_sh_path] {
            if let Ok(metadata) = std::fs::metadata(script_file) {
                let mut perms = metadata.permissions();
                perms.set_mode(0o755);
                let _ = std::fs::set_permissions(script_file, perms);
            }
        }
    }

    let is_force = force.unwrap_or(false);

    // 3. If setup was already completed and force is not set, return early
    if marker.exists() && !is_force {
        return Ok(serde_json::json!({
            "installed": true,
            "is_first_run": false,
            "message": "TouchBoard service is already installed."
        }).to_string());
    }

    // 4. Run the installer script
    let output = std::process::Command::new("bash")
        .arg(&install_sh_path)
        .output()
        .map_err(|e| format!("Failed to execute installer: {}", e))?;

    if output.status.success() {
        Ok(serde_json::json!({
            "installed": true,
            "is_first_run": !is_force,
            "message": "TouchBoard background engine installed and started successfully.",
            "output": String::from_utf8_lossy(&output.stdout).trim()
        }).to_string())
    } else {
        let err = String::from_utf8_lossy(&output.stderr);
        Err(format!("Installation failed: {}", err))
    }
}

#[tauri::command]
fn install_touchboard_service() -> Result<String, String> {
    setup_touchboard_service(Some(true))
}

#[tauri::command]
fn uninstall_touchboard_service(purge: Option<bool>) -> Result<String, String> {
    let home = get_home_dir().ok_or_else(|| "Could not determine user HOME directory".to_string())?;
    let config_dir = home.join(".config").join("touchboard");
    let scripts_dir = config_dir.join("scripts");
    let uninstall_sh_path = scripts_dir.join("uninstall_service.sh");

    // Ensure the uninstall script exists on disk
    let _ = std::fs::create_dir_all(&scripts_dir);
    if let Err(e) = std::fs::write(&uninstall_sh_path, SCRIPT_UNINSTALL_SH) {
        return Err(format!("Failed to write uninstaller script: {}", e));
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = std::fs::metadata(&uninstall_sh_path) {
            let mut perms = metadata.permissions();
            perms.set_mode(0o755);
            let _ = std::fs::set_permissions(&uninstall_sh_path, perms);
        }
    }

    let mut cmd = std::process::Command::new("bash");
    cmd.arg(&uninstall_sh_path);
    if purge.unwrap_or(false) {
        cmd.arg("--purge");
    }

    let output = cmd.output().map_err(|e| format!("Failed to execute uninstaller: {}", e))?;

    if output.status.success() {
        Ok(serde_json::json!({
            "uninstalled": true,
            "message": "TouchBoard background service successfully uninstalled.",
            "output": String::from_utf8_lossy(&output.stdout).trim()
        }).to_string())
    } else {
        let err = String::from_utf8_lossy(&output.stderr);
        Err(format!("Uninstallation failed: {}", err))
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
            install_touchboard_service,
            uninstall_touchboard_service,
            get_service_status,
            restart_service,
            stop_service
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


