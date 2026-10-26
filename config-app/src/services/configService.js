// Configuration & Profile Persistence Service for TouchBoard
// Supports LocalStorage (instant client persistence) and file persistence via Tauri / Vite API

export const STORAGE_KEY = "touchboard_profiles_data_v1";

export const DEFAULT_PROFILES = {
  coding: {
    id: "coding",
    name: "Coding",
    icon: "code",
    triggers: {
      "100000": {
        name: "Dev Websites",
        type: "open_url",
        icon: "open_url",
        payload: { urls: ["https://github.com"] },
      },
      "010000": {
        name: "Open Antigravity IDE",
        type: "run_command",
        icon: "run_command",
        payload: { command: "~/Downloads/'Antigravity IDE'/antigravity-ide &" },
      },
      "001000": {
        name: "Insert Text",
        type: "type_text",
        icon: "type_text",
        payload: { text: "MySecretPassword123!", press_enter: true },
      },
      "000100": {
        name: "Run Vite Dev",
        type: "run_command",
        icon: "run_command",
        payload: { command: "brave-browser 'web.whatsapp.com'" },
      },
      "110000": {
        name: "Secret Combo: Open Spotify",
        type: "launch_app",
        icon: "launch_app",
        payload: { command: "spotify.exe" },
      },
    },
  },
  chilling: {
    id: "chilling",
    name: "Chilling",
    icon: "coffee",
    triggers: {
      "100000": {
        name: "Lofi & Relax Beats",
        type: "open_url",
        icon: "open_url",
        payload: { urls: ["https://music.youtube.com"] },
      },
      "100001": {
        name: "Open Youtube",
        type: "run_command",
        icon: "run_command",
        payload: { command: "brave-browser 'https://www.youtube.com'" },
      },
      "101000": {
        name: "Open Instagram",
        type: "run_command",
        icon: "run_command",
        payload: { command: "brave-browser 'https://www.instagram.com'" },
      },
      "010000": {
        name: "Chill Movies / Netflix",
        type: "open_url",
        icon: "open_url",
        payload: { urls: ["https://www.netflix.com"] },
      },
      "110000": {
        name: "Secret Combo: Open Spotify",
        type: "launch_app",
        icon: "launch_app",
        payload: { command: "spotify.exe" },
      },
    },
  },
};

/**
 * Loads stored profiles and activeProfileId from localStorage,
 * falling back to DEFAULT_PROFILES.
 */
export function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.profiles && Object.keys(parsed.profiles).length > 0) {
        return {
          profiles: parsed.profiles,
          activeProfileId: parsed.activeProfileId || Object.keys(parsed.profiles)[0],
        };
      }
    }
  } catch (err) {
    console.warn("Failed to load profiles from localStorage:", err);
  }
  return {
    profiles: DEFAULT_PROFILES,
    activeProfileId: "coding",
  };
}

/**
 * Saves profiles and activeProfileId to localStorage.
 */
export function saveToLocalStorage(profiles, activeProfileId) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activeProfileId,
        profiles,
        savedAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.warn("Failed to save profiles to localStorage:", err);
  }
}

/**
 * Fetches config from Tauri invoke or Vite server /api/config.
 */
export async function fetchRemoteConfig() {
  // 1. Try Tauri invoke if in desktop mode
  if (typeof window !== "undefined" && (window.__TAURI_INTERNALS__ || window.__TAURI__)) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const raw = await invoke("load_config");
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn("Tauri load_config failed, trying web API:", e);
    }
  }

  // 2. Try Vite dev server API
  try {
    const res = await fetch("/api/config");
    if (res.ok) {
      const data = await res.json();
      if (data && (data.profiles || data.triggers)) {
        return data;
      }
    }
  } catch (e) {
    // Expected in standalone browser without server
  }

  return null;
}

/**
 * Persists full config (profiles, active profile, and current active triggers)
 * to localStorage and disk (Tauri / Vite server).
 */
export async function persistConfig(profiles, activeProfileId, serialPort = "/dev/ttyUSB0", baudRate = 9600) {
  // 1. Instant synchronous local storage persistence
  saveToLocalStorage(profiles, activeProfileId);

  const activeProfile = profiles[activeProfileId] || Object.values(profiles)[0];
  const activeTriggers = activeProfile ? activeProfile.triggers : {};

  const fullData = {
    serial_port: serialPort,
    baud_rate: baudRate,
    active_profile: activeProfile?.name || activeProfileId,
    profiles,
    triggers: activeTriggers,
  };

  const jsonStr = JSON.stringify(fullData, null, 4);

  // 2. Write to Tauri backend if available
  if (typeof window !== "undefined" && (window.__TAURI_INTERNALS__ || window.__TAURI__)) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_config", { configStr: jsonStr });
    } catch (e) {
      console.warn("Tauri save_config failed:", e);
    }
  }

  // 3. Write to Vite server endpoint if available
  try {
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: jsonStr,
    });
  } catch (e) {
    // Ignored in offline / static context
  }

  return fullData;
}

/**
 * Generates and triggers browser download of config.json.
 */
export function downloadConfigFile(profiles, activeProfileId, serialPort = "/dev/ttyUSB0", baudRate = 9600) {
  const activeProfile = profiles[activeProfileId] || Object.values(profiles)[0];
  const activeTriggers = activeProfile ? activeProfile.triggers : {};

  const fullData = {
    serial_port: serialPort,
    baud_rate: baudRate,
    active_profile: activeProfile?.name || activeProfileId,
    profiles,
    triggers: activeTriggers,
  };

  const jsonStr = JSON.stringify(fullData, null, 4);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "config.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Invokes setup_touchboard_service in Tauri backend to install background service on first launch.
 */
export async function setupTouchboardService(force = false) {
  if (typeof window !== "undefined" && (window.__TAURI_INTERNALS__ || window.__TAURI__)) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const res = await invoke("setup_touchboard_service", { force });
      return typeof res === "string" ? JSON.parse(res) : res;
    } catch (err) {
      console.warn("setup_touchboard_service failed:", err);
      return { installed: false, error: String(err) };
    }
  }
  return { installed: false, skipped: true, reason: "not_tauri" };
}

/**
 * Manually executes the install script to configure and start the background service.
 */
export async function installTouchboardService() {
  if (typeof window !== "undefined" && (window.__TAURI_INTERNALS__ || window.__TAURI__)) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const res = await invoke("install_touchboard_service");
      return typeof res === "string" ? JSON.parse(res) : res;
    } catch (err) {
      console.warn("install_touchboard_service failed:", err);
      return { installed: false, error: String(err) };
    }
  }
  return { installed: false, skipped: true, reason: "not_tauri" };
}

/**
 * Retrieves the current status of the touchboard background systemd service.
 */
export async function getServiceStatus() {
  if (typeof window !== "undefined" && (window.__TAURI_INTERNALS__ || window.__TAURI__)) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("get_service_status");
    } catch (err) {
      console.warn("get_service_status failed:", err);
      return "unknown";
    }
  }
  return "web";
}

/**
 * Restarts the touchboard background service.
 */
export async function restartService() {
  if (typeof window !== "undefined" && (window.__TAURI_INTERNALS__ || window.__TAURI__)) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("restart_service");
    } catch (err) {
      console.warn("restart_service failed:", err);
      return "failed";
    }
  }
  return "web";
}

/**
 * Stops the touchboard background service.
 */
export async function stopService() {
  if (typeof window !== "undefined" && (window.__TAURI_INTERNALS__ || window.__TAURI__)) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke("stop_service");
    } catch (err) {
      console.warn("stop_service failed:", err);
      return "failed";
    }
  }
  return "web";
}

/**
 * Uninstalls the touchboard background service, stops and disables systemd unit,
 * and optionally purges configuration directory.
 */
export async function uninstallTouchboardService(purge = false) {
  if (typeof window !== "undefined" && (window.__TAURI_INTERNALS__ || window.__TAURI__)) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const res = await invoke("uninstall_touchboard_service", { purge });
      return typeof res === "string" ? JSON.parse(res) : res;
    } catch (err) {
      console.warn("uninstall_touchboard_service failed:", err);
      return { uninstalled: false, error: String(err) };
    }
  }
  return { uninstalled: false, skipped: true, reason: "not_tauri" };
}

