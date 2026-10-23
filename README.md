# TouchBoard

Turn an Arduino Uno into a **6-channel capacitive touch macro pad** without external resistors or physical buttons. The firmware detects capacitance changes on analog pins `A0–A5` and streams binary touch states over Serial to a Python automation engine.

The Python engine maps touch inputs and multi-touch combinations to configurable desktop actions, including launching applications, opening URLs, running terminal commands, and typing text.

## Features

- **Zero Extra Components** — Use the [ADCTouch](<https://github.com/martin2250/ADCTouch>) library to detect touch through bare wires, aluminum foil, or copper pads.
- **Six Touch Channels** — Connect touch inputs to Arduino analog pins `A0–A5`.
- **JSON-Based Configuration** — Define all triggers and actions in `config.json` without modifying the Python engine.
- **Multi-Touch Combinations** — Support individual triggers such as `0` and simultaneous combinations such as `0+1`.
- **Modular Automation Handlers** — Execute different actions through a unified configuration system.
- **Automatic Serial Detection** — Detect common Arduino serial ports on Linux and Windows.
- **Edge-Triggered Execution** — Run actions when a touch input transitions from released to touched.

### Supported Actions

| Action | Description |
| --- | --- |
| `launch_app` | Launch local applications and system binaries. |
| `open_url` | Open one or more URLs in a browser. |
| `run_command` | Execute shell commands or start development tools and terminal processes. |
| `type_text` | Type text or boilerplate at the active cursor position. |

## Hardware Requirements

- Arduino Uno
- USB cable for programming and serial communication
- Jumper wires, aluminum foil, or conductive touch pads
- Computer running Python 3

**No external resistors or physical buttons are required.**

## Hardware Setup

Connect each conductive touch pad directly to an Arduino Uno analog pin.

```
[Touch Pad 0] ────> A0
[Touch Pad 1] ────> A1
[Touch Pad 2] ────> A2
[Touch Pad 3] ────> A3
[Touch Pad 4] ────> A4
[Touch Pad 5] ────> A5
```

### Calibration Notes

- Leave all touch pads untouched while powering up or resetting the Arduino.
- The firmware samples ambient capacitance during startup to establish its initial baseline.
- Keep the touch wiring reasonably short and avoid placing it near sources of electrical interference for more reliable detection.

> **Note:** Capacitive sensing performance depends on the electrode size, wiring, grounding, and surrounding electrical environment.

## Quickstart

### 1\. Upload the Arduino Firmware

1. Install the [Arduino IDE](<https://www.arduino.cc/en/software>).
2. Open the Library Manager by navigating to **Sketch → Include Library → Manage Libraries**.
3. Search for and install the **ADCTouch** library.
4. Open `firmware/firmware.ino`.
5. Select your Arduino Uno and its corresponding serial port.
6. Upload the firmware.
7. Close the Arduino IDE Serial Monitor so the Python engine can access the serial port.

### 2\. Set Up the Python Environment

Clone the repository and enter the project directory:

```
git clone https://github.com/<your-username>/arduino-capacitive-macro.git
cd arduino-capacitive-macro
```

Create and activate a virtual environment.

**Linux / macOS**

```
python3 -m venv venv
source venv/bin/activate
```

**Windows (Command Prompt)**

```
python -m venv venv
venv\Scripts\activate.bat
```

Install the required dependencies:

```
pip install pyserial pyautogui
```

Alternatively, if the repository includes a complete `requirements.txt`:

```
pip install -r requirements.txt
```

### 3\. Configure Serial Access on Linux

If you encounter permission errors when accessing the Arduino serial port, add your user to the `dialout` group:

```
sudo usermod -aG dialout "$USER"
```

Log out and log back in for the group membership change to take effect.

The exact group may vary by Linux distribution.

## Configuration

All touch-to-action mappings are defined in `config.json`.

Each trigger contains a human-readable name, an action type, and a payload containing the action's parameters.

### Example `config.json`

```
{
  "serial_port": "auto",
  "baud_rate": 9600,
  "triggers": {
    "0": {
      "name": "Open Dev Sites",
      "type": "open_url",
      "payload": {
        "urls": [
          "https://github.com",
          "https://stackoverflow.com"
        ]
      }
    },
    "1": {
      "name": "Launch Calculator",
      "type": "launch_app",
      "payload": {
        "command": "calc.exe"
      }
    },
    "2": {
      "name": "Run Vite Server",
      "type": "run_command",
      "payload": {
        "working_dir": "/path/to/project",
        "command": "npm run dev"
      }
    },
    "0+1": {
      "name": "Secret Combo Shortcut",
      "type": "type_text",
      "payload": {
        "text": "Hello World!",
        "press_enter": true
      }
    }
  }
}
```

### Configuration Reference

| Setting | Description |
| --- | --- |
| `serial_port` | Serial device to use. Set to `"auto"` for automatic detection. |
| `baud_rate` | Serial communication speed. Must match the firmware; the example uses `9600`. |
| `triggers` | Object mapping touch inputs and combinations to actions. |
| `name` | Human-readable action name. |
| `type` | Action handler to execute. |
| `payload` | Parameters required by the selected handler. |

### Trigger Mapping

Pin indices correspond to the analog pins as follows:

| Trigger index | Arduino pin |
| --- | --- |
| `0` | `A0` |
| `1` | `A1` |
| `2` | `A2` |
| `3` | `A3` |
| `4` | `A4` |
| `5` | `A5` |

Use a single index for an individual touch input or combine indices with `+` for multi-touch triggers.

For example:

- `"0"` — Touch pad 0.
- `"3"` — Touch pad 3.
- `"0+1"` — Touch pads 0 and 1 touched simultaneously.

### Action Payloads

#### `launch_app`

Launch a local application.

```
{
  "type": "launch_app",
  "payload": {
    "command": "calc.exe"
  }
}
```

Replace `calc.exe` with the appropriate executable or application command for your operating system.

#### `open_url`

Open multiple URLs in your browser.

```
{
  "type": "open_url",
  "payload": {
    "urls": [
      "https://github.com",
      "https://stackoverflow.com"
    ]
  }
}
```

#### `run_command`

Execute a command from a specified working directory.

```
{
  "type": "run_command",
  "payload": {
    "working_dir": "/path/to/project",
    "command": "npm run dev"
  }
}
```

Update `working_dir` to the actual project directory on your machine. Ensure the required executable, such as `npm`, is installed and accessible.

#### `type_text`

Type predefined text at the currently active cursor position.

```
{
  "type": "type_text",
  "payload": {
    "text": "Hello World!",
    "press_enter": true
  }
}
```

When supported by the handler, `press_enter: true` presses Enter after typing the text.

**Important:** The target application must have focus before triggering text input.

## Running the Engine

1. Connect the Arduino Uno to your computer through USB.
2. Ensure the firmware has been uploaded.
3. Close any other application using the Arduino serial port.
4. Activate the Python virtual environment.
5. Make sure `config.json` contains valid action mappings.
6. Run the automation engine:

```
python engine.py
```

The engine is designed to:

1. Detect the active Arduino serial port, including common Linux devices such as `/dev/ttyACM*` and `/dev/ttyUSB*`, and Windows ports such as `COM3`.
2. Read incoming touch-state data over Serial.
3. Monitor touch-state transitions.
4. Match detected inputs against the configured triggers.
5. Dispatch the corresponding automation actions when a trigger becomes active.

The exact serial message format and trigger behavior depend on the implementation in `firmware/firmware.ino` and `engine.py`.

## Project Structure

```
arduino-capacitive-macro/
├── firmware/
│   └── firmware.ino      # Capacitive sensing and serial output
├── engine.py             # Serial listener and action dispatcher
├── config.json           # Trigger mappings and action payloads
├── requirements.txt      # Python dependencies
└── README.md             # Project documentation
```

## Troubleshooting

### Arduino Serial Port Not Found

- Verify that the Arduino is connected through USB.
- Check that the correct USB cable supports data transfer.
- Close the Arduino IDE Serial Monitor and other serial terminal applications.
- Check the device name and configure `serial_port` manually if necessary.

### Permission Denied on Linux

Confirm that your user has access to the Arduino's serial device. Depending on your distribution, this may require membership in the `dialout` or another serial-access group.

### Touch Inputs Trigger Unexpectedly

- Keep the touch pads untouched during startup calibration.
- Avoid excessively long or tangled wires.
- Reduce nearby electrical interference.
- Adjust the firmware's sensitivity or threshold settings if the implementation exposes them.

### Applications Do Not Launch

- Verify that the command exists on your operating system.
- Use the correct executable path where needed.
- Confirm that the Python process has permission to launch the application.

### Text Is Typed into the Wrong Application

The `type_text` handler sends keystrokes to the active application. Focus the intended window before touching the configured pad.

### Multi-Touch Triggers Do Not Work

- Verify that the combination key matches the format used by `engine.py`.
- Ensure both touch inputs are detected simultaneously.
- Check whether the firmware and Python engine agree on the serial protocol and pin-index mapping.

## Security Considerations

Automation actions can launch applications, execute shell commands, and type into active windows.

- Only use configuration files that you trust.
- Review shell commands before adding them to `config.json`.
- Avoid running the engine with elevated privileges unless absolutely necessary.
- Be careful when using `type_text` with sensitive applications or terminals.

## License

This project is licensed under the **MIT License**.

See the `LICENSE` file for the full license text.