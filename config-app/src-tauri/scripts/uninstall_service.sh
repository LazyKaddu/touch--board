#!/usr/bin/env bash
# TouchBoard Background Service Uninstaller
# Stops and disables the systemd user service, cleans up service files and setup markers

set -e

CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/touchboard"
TARGET_SCRIPTS_DIR="${CONFIG_DIR}/scripts"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SERVICE_FILE="${SYSTEMD_USER_DIR}/touchboard.service"
MARKER_FILE="${CONFIG_DIR}/.setup_complete"

PURGE=false
if [ "$1" = "--purge" ] || [ "$1" = "-p" ] || [ "$1" = "--all" ]; then
    PURGE=true
fi

echo "=== TouchBoard Background Service Uninstaller ==="

# 1. Stop the running service if active
if systemctl --user is-active --quiet touchboard.service 2>/dev/null; then
    echo "Stopping touchboard.service..."
    systemctl --user stop touchboard.service || true
fi

# 2. Disable the systemd user service
if systemctl --user is-enabled --quiet touchboard.service 2>/dev/null; then
    echo "Disabling touchboard.service..."
    systemctl --user disable touchboard.service || true
fi

# 3. Remove the systemd service file
if [ -f "${SERVICE_FILE}" ]; then
    echo "Removing service definition at ${SERVICE_FILE}..."
    rm -f "${SERVICE_FILE}"
fi

# 4. Reload systemd daemon to unregister the service
echo "Reloading systemd user daemon..."
systemctl --user daemon-reload
systemctl --user reset-failed touchboard.service 2>/dev/null || true

# 5. Remove the setup marker file
if [ -f "${MARKER_FILE}" ]; then
    echo "Removing setup marker ${MARKER_FILE}..."
    rm -f "${MARKER_FILE}"
fi

# 6. Clean up deployed scripts
if [ -d "${TARGET_SCRIPTS_DIR}" ]; then
    echo "Removing deployed scripts in ${TARGET_SCRIPTS_DIR}..."
    rm -rf "${TARGET_SCRIPTS_DIR}"
fi

# 7. Clean up virtual environment if present in config directory
if [ -d "${CONFIG_DIR}/venv" ]; then
    echo "Removing virtual environment in ${CONFIG_DIR}/venv..."
    rm -rf "${CONFIG_DIR}/venv"
fi

# 8. Handle configuration files
if [ "$PURGE" = true ]; then
    echo "Purge requested: removing all configuration files in ${CONFIG_DIR}..."
    rm -rf "${CONFIG_DIR}"
else
    if [ -f "${CONFIG_DIR}/config.json" ]; then
        echo "Note: Your configuration file at ${CONFIG_DIR}/config.json has been preserved."
        echo "To completely remove all data, run with: $0 --purge"
    fi
fi

echo "================================================================"
echo "TouchBoard background service successfully uninstalled."
echo "================================================================"
