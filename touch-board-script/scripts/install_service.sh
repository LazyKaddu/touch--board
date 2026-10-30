#!/usr/bin/env bash
# TouchBoard Background Service Installer
# Sets up a systemd user service that automatically starts TouchBoard on desktop login

set -e

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/touchboard"
TARGET_SCRIPTS_DIR="${CONFIG_DIR}/scripts"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SERVICE_FILE="${SYSTEMD_USER_DIR}/touchboard.service"
MARKER_FILE="${CONFIG_DIR}/.setup_complete"

# 1. Determine source directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=== TouchBoard Background Service Setup ==="
echo "Source: ${WORKSPACE_ROOT}"
echo "Target: ${CONFIG_DIR}"

mkdir -p "${TARGET_SCRIPTS_DIR}"
mkdir -p "${SYSTEMD_USER_DIR}"

# 2. Deploy script files
cp -f "${WORKSPACE_ROOT}/src/main.py" "${TARGET_SCRIPTS_DIR}/main.py"
if [ -f "${SCRIPT_DIR}/launch.sh" ]; then
    cp -f "${SCRIPT_DIR}/launch.sh" "${TARGET_SCRIPTS_DIR}/launch.sh"
    chmod +x "${TARGET_SCRIPTS_DIR}/launch.sh"
fi
if [ -f "${SCRIPT_DIR}/uninstall_service.sh" ]; then
    cp -f "${SCRIPT_DIR}/uninstall_service.sh" "${TARGET_SCRIPTS_DIR}/uninstall_service.sh"
    chmod +x "${TARGET_SCRIPTS_DIR}/uninstall_service.sh"
fi

# Only copy initial config if not already present, preserving user settings
if [ ! -f "${CONFIG_DIR}/config.json" ]; then
    if [ -f "${WORKSPACE_ROOT}/src/config.json" ]; then
        cp "${WORKSPACE_ROOT}/src/config.json" "${CONFIG_DIR}/config.json"
    else
        echo '{"serial_port":"/dev/ttyUSB0","baud_rate":9600,"triggers":{}}' > "${CONFIG_DIR}/config.json"
    fi
    echo "Created initial configuration at ${CONFIG_DIR}/config.json"
fi

# Ensure scripts directory links or has config.json
if [ ! -f "${TARGET_SCRIPTS_DIR}/config.json" ]; then
    ln -sf "${CONFIG_DIR}/config.json" "${TARGET_SCRIPTS_DIR}/config.json"
fi

# 3. Resolve or create Python environment with pyserial
PYTHON_BIN=""

# Check if local virtualenv in workspace exists and has pyserial
if [ -x "${WORKSPACE_ROOT}/.venv/bin/python" ]; then
    if "${WORKSPACE_ROOT}/.venv/bin/python" -c "import serial" 2>/dev/null; then
        PYTHON_BIN="${WORKSPACE_ROOT}/.venv/bin/python"
    fi
fi

# Check if permanent virtualenv already exists
if [ -z "${PYTHON_BIN}" ] && [ -x "${CONFIG_DIR}/venv/bin/python" ]; then
    if "${CONFIG_DIR}/venv/bin/python" -c "import serial" 2>/dev/null; then
        PYTHON_BIN="${CONFIG_DIR}/venv/bin/python"
    fi
fi

# Check system python
if [ -z "${PYTHON_BIN}" ]; then
    if python3 -c "import serial" 2>/dev/null; then
        PYTHON_BIN="$(which python3)"
    fi
fi

# If still not found, create an isolated virtualenv using uv or python3 venv
if [ -z "${PYTHON_BIN}" ]; then
    echo "Creating dedicated virtual environment in ${CONFIG_DIR}/venv..."
    UV_BIN="$(which uv 2>/dev/null || echo "$HOME/.local/bin/uv")"
    if [ -x "${UV_BIN}" ]; then
        "${UV_BIN}" venv "${CONFIG_DIR}/venv" --quiet
        "${UV_BIN}" pip install --python "${CONFIG_DIR}/venv/bin/python" pyserial pyautogui --quiet
    else
        python3 -m venv "${CONFIG_DIR}/venv"
        "${CONFIG_DIR}/venv/bin/pip" install --quiet pyserial pyautogui
    fi
    PYTHON_BIN="${CONFIG_DIR}/venv/bin/python"
fi

echo "Using Python executable: ${PYTHON_BIN}"

# 4. Generate systemd user service
#    NOTE: We do NOT hardcode DISPLAY, WAYLAND_DISPLAY, KDE_SESSION_VERSION, etc.
#    The launch.sh wrapper dynamically imports these from the live session at runtime.
#    This prevents stale environment issues after cold restarts.
cat <<EOF > "${SERVICE_FILE}"
[Unit]
Description=TouchBoard Capacitive Touch Automation Engine
After=graphical-session.target network.target
PartOf=graphical-session.target

[Service]
Type=simple
WorkingDirectory=${TARGET_SCRIPTS_DIR}
ExecStart=/bin/bash ${TARGET_SCRIPTS_DIR}/launch.sh
Restart=always
RestartSec=3
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=default.target
EOF

echo "Generated systemd user service at ${SERVICE_FILE}"

# 5. Reload, enable, and start service
systemctl --user daemon-reload
systemctl --user enable touchboard.service
systemctl --user restart touchboard.service

# 6. Write setup marker
echo "Installed: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" > "${MARKER_FILE}"

echo "TouchBoard background service successfully installed and started!"
echo "Service status: $(systemctl --user is-active touchboard.service || true)"
