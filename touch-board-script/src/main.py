import json
import os
import subprocess
import sys
import time
import webbrowser
import pyautogui
import serial

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")

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

def action_type_text(payload):
    if pyautogui is None:
        print("Warning: pyautogui is not installed. Run 'uv pip install pyautogui' to enable type_text.")
        return
    text = payload.get("text", "")
    interval = payload.get("interval", 0.02)
    pyautogui.write(text, interval=interval)
    if payload.get("press_enter", False):
        pyautogui.press("enter")

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
    "type_text": action_type_text,
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
    Returns the 6-character string if valid, otherwise None.
    """
    clean = raw_line.strip().replace(" ", "")
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

# --- 4. Serial Execution Loop ---

def main():
    config = load_config()
    port = config.get("serial_port", "COM3")
    baud = config.get("baud_rate", 9600)
    triggers = config.get("triggers", {})

    try:
        ser = serial.Serial(port, baud, timeout=1)
        print(f"Engine running. Connected to {port}...")
        time.sleep(2)
    except Exception as e:
        print(f"Error opening serial port: {e}")
        return

    last_active_key = None

    try:
        while True:
            if ser.in_waiting > 0:
                raw_line = ser.readline().decode("utf-8", errors="ignore")
                binary_str = parse_binary_packet(raw_line)
                if binary_str:
                    last_active_key = handle_binary_state(binary_str, triggers, last_active_key)

    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        ser.close()

if __name__ == "__main__":
    main()