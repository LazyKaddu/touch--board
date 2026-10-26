import json
import os
import subprocess
import sys
import time
import webbrowser
# import pyautogui
import serial

def resolve_config_path() -> str:
    """Finds the active config.json path.
    1. Checks environment variable TOUCHBOARD_CONFIG if set.
    2. Checks local script directory.
    3. Checks ~/.config/touchboard/config.json.
    """
    env_config = os.environ.get("TOUCHBOARD_CONFIG")
    if env_config and os.path.exists(env_config):
        return env_config

    script_dir = os.path.dirname(os.path.abspath(__file__))
    local_config = os.path.join(script_dir, "config.json")
    if os.path.exists(local_config):
        return local_config

    user_config = os.path.expanduser("~/.config/touchboard/config.json")
    if os.path.exists(user_config):
        return user_config

    return local_config

CONFIG_FILE = resolve_config_path()



# --- 1. Modular Helper Functions ---

def action_open_url(payload):
    urls = payload.get("urls", [])
    if isinstance(urls, str):
        urls = [urls]
    for url in urls:
        webbrowser.open(url)

def action_launch_app(payload):
    cmd = payload.get("command")
    if cmd:
        subprocess.Popen(cmd, shell=True)

# def action_type_text(payload):
#     if pyautogui is None:
#         print("Warning: pyautogui is not installed. Run 'uv pip install pyautogui' to enable type_text.")
#         return
#     text = payload.get("text", "")
#     interval = payload.get("interval", 0.02)
#     pyautogui.write(text, interval=interval)
#     if payload.get("press_enter", False):
#         pyautogui.press("enter")

def action_run_command(payload):
    cmd = payload.get("command", "")
    cwd = payload.get("working_dir", ".")
    
    if sys.platform == "win32":
        # Windows: Spawns a dedicated visible CMD terminal
        creationflags = getattr(subprocess, "CREATE_NEW_CONSOLE", 0)
        subprocess.Popen(
            f'cmd.exe /k "{cmd}"',
            cwd=cwd,
            creationflags=creationflags
        )
    else:
        # Non-Windows fallback (Linux/macOS)
        subprocess.Popen(cmd, shell=True, cwd=cwd)

# Action Registry
ACTION_HANDLERS = {
    "open_url": action_open_url,
    "launch_app": action_launch_app,
    # "type_text": action_type_text,
    "run_command": action_run_command,
}

# --- 2. Config Loader ---

def load_config():
    if not os.path.exists(CONFIG_FILE):
        raise FileNotFoundError(f"Missing {CONFIG_FILE}")
    with open(CONFIG_FILE, "r") as f:
        return json.load(f)

# --- 3. Packet Parser & State Handler ---

def parse_binary_packet(raw_line: str) -> str | None:
    """Cleans and validates a 6-character binary encoded string ('0' and '1').
    Handles space, tab, and newline separated binary streams.
    Returns the 6-character string if valid, otherwise None.
    """
    clean = "".join(raw_line.split())
    if len(clean) == 6 and all(c in ("0", "1") for c in clean):
        return clean
    return None

def handle_binary_state(binary_str: str, triggers: dict, last_active_key: str | None) -> str | None:
    """Handles debouncing and action triggering for a 6-character binary state.
    Returns the updated last_active_key.
    """
    if binary_str == "000000":
        # All released -> reset debounce state
        return None

    if binary_str != last_active_key:
        trigger = triggers.get(binary_str)
        if trigger:
            print(f"Triggered: {trigger.get('name', binary_str)}")
            action_fn = ACTION_HANDLERS.get(trigger.get("type"))
            if action_fn:
                action_fn(trigger.get("payload", {}))
        return binary_str

    return last_active_key

def get_active_triggers(config: dict) -> tuple[dict, str]:
    """Retrieves triggers for the active profile, falling back to top-level triggers."""
    profiles = config.get("profiles", {})
    active_profile_key = config.get("active_profile")
    if profiles and active_profile_key:
        if active_profile_key in profiles:
            p = profiles[active_profile_key]
            return p.get("triggers", {}), p.get("name", active_profile_key)
        for key, p in profiles.items():
            if p.get("name") == active_profile_key:
                return p.get("triggers", {}), p.get("name", key)
    return config.get("triggers", {}), active_profile_key or "Default"

# --- 4. Serial Execution Loop ---

def main():
    config = load_config()
    port = config.get("serial_port", "/dev/ttyUSB0")
    baud = config.get("baud_rate", 9600)
    triggers, profile_name = get_active_triggers(config)

    try:
        ser = serial.Serial(port, baud, timeout=1)
        print(f"Engine running. Connected to {port}...")
        print(f"Active Profile: '{profile_name}' ({len(triggers)} triggers configured)")
        time.sleep(2)
    except Exception as e:
        print(f"Error opening serial port: {e}")
        return

    last_active_key = None
    last_mtime = os.path.getmtime(CONFIG_FILE) if os.path.exists(CONFIG_FILE) else 0

    try:
        print("Waiting for touch input... (Press Ctrl+C to stop)")
        while True:
            # Check for live config file modifications (e.g. profile switched in UI)
            try:
                current_mtime = os.path.getmtime(CONFIG_FILE)
                if current_mtime > last_mtime:
                    last_mtime = current_mtime
                    new_config = load_config()
                    triggers, profile_name = get_active_triggers(new_config)
                    print(f"\n[TouchBoard] Profile updated! Active: '{profile_name}' ({len(triggers)} triggers)")
            except Exception:
                pass

            raw_line = ser.readline().decode("utf-8", errors="ignore")
            if not raw_line:
                continue
            binary_str = parse_binary_packet(raw_line)
            if binary_str:
                last_active_key = handle_binary_state(binary_str, triggers, last_active_key)
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        ser.close()

if __name__ == "__main__":
    main()