#!/usr/bin/env bash
# TouchBoard Dynamic Launcher
# Imports the live graphical session environment before launching main.py.
# This ensures DISPLAY, WAYLAND_DISPLAY, KDE_SESSION_VERSION, etc. are always
# current — even after a cold restart — instead of relying on hardcoded values
# baked into the systemd service file at install time.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/touchboard"

# Session environment variables required for GUI, xdg-open, and input automation
SESSION_VARS=(
    DISPLAY
    WAYLAND_DISPLAY
    XDG_RUNTIME_DIR
    XDG_CURRENT_DESKTOP
    XDG_SESSION_TYPE
    XDG_SESSION_DESKTOP
    XDG_DATA_DIRS
    XDG_CONFIG_DIRS
    DBUS_SESSION_BUS_ADDRESS
    KDE_SESSION_VERSION
    KDE_FULL_SESSION
    KDE_SESSION_UID
    KDEDIRS
    KDE_APPLICATIONS_AS_SCOPE
    QT_WAYLAND_RECONNECT
    PATH
)

import_from_systemd() {
    local env_output
    env_output="$(systemctl --user show-environment 2>/dev/null)" || return 1

    while IFS= read -r line; do
        local var="${line%%=*}"
        local val="${line#*=}"
        case "$var" in
            DISPLAY|WAYLAND_DISPLAY|XDG_RUNTIME_DIR|XDG_CURRENT_DESKTOP|XDG_SESSION_TYPE|XDG_SESSION_DESKTOP|XDG_DATA_DIRS|XDG_CONFIG_DIRS|DBUS_SESSION_BUS_ADDRESS|KDE_SESSION_VERSION|KDE_FULL_SESSION|KDE_SESSION_UID|KDEDIRS|KDE_APPLICATIONS_AS_SCOPE|QT_WAYLAND_RECONNECT|PATH)
                if [ -n "$val" ]; then
                    export "$var=$val"
                fi
                ;;
        esac
    done <<< "$env_output"
}

import_from_proc() {
    # Fallback: scan environ of active desktop process if systemctl was not yet populated
    local pids
    pids="$(pgrep -u "$UID" -f "(plasma|kwin|gnome-shell|weston|sway|hyprland)" 2>/dev/null)" || return 1

    for pid in $pids; do
        if [ -r "/proc/$pid/environ" ]; then
            while IFS= read -r -d '' line; do
                local var="${line%%=*}"
                local val="${line#*=}"
                case "$var" in
                    DISPLAY|WAYLAND_DISPLAY|XDG_RUNTIME_DIR|XDG_CURRENT_DESKTOP|XDG_SESSION_TYPE|XDG_SESSION_DESKTOP|XDG_DATA_DIRS|XDG_CONFIG_DIRS|DBUS_SESSION_BUS_ADDRESS|KDE_SESSION_VERSION|KDE_FULL_SESSION|KDE_SESSION_UID|KDEDIRS|KDE_APPLICATIONS_AS_SCOPE|QT_WAYLAND_RECONNECT|PATH)
                        if [ -n "$val" ] && [ -z "${!var}" ]; then
                            export "$var=$val"
                        fi
                        ;;
                esac
            done < "/proc/$pid/environ"

            if [ -n "$WAYLAND_DISPLAY" ] || [ -n "$DISPLAY" ]; then
                return 0
            fi
        fi
    done
    return 1
}

# Retry loop: wait up to 5 seconds if display variables are not yet populated at cold boot
for _ in {1..5}; do
    import_from_systemd
    if [ -n "$WAYLAND_DISPLAY" ] || [ -n "$DISPLAY" ]; then
        break
    fi
    import_from_proc && break
    sleep 1
done

# Resolve the Python binary
PYTHON_BIN=""

if [ -x "${CONFIG_DIR}/venv/bin/python" ]; then
    PYTHON_BIN="${CONFIG_DIR}/venv/bin/python"
elif [ -x "${SCRIPT_DIR}/../.venv/bin/python" ]; then
    PYTHON_BIN="${SCRIPT_DIR}/../.venv/bin/python"
elif [ -x "${SCRIPT_DIR}/../../touch-board-script/.venv/bin/python" ]; then
    PYTHON_BIN="${SCRIPT_DIR}/../../touch-board-script/.venv/bin/python"
elif command -v python3 &>/dev/null; then
    PYTHON_BIN="$(command -v python3)"
fi

if [ -z "$PYTHON_BIN" ]; then
    echo "ERROR: No Python binary found for TouchBoard service" >&2
    exit 1
fi

exec "$PYTHON_BIN" "${SCRIPT_DIR}/main.py"
