import json
import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# Ensure 'src' is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src")))
import main


class TestBinarySerialHandling(unittest.TestCase):
    def test_parse_binary_packet(self):
        # Valid cases
        self.assertEqual(main.parse_binary_packet("100000\r\n"), "100000")
        self.assertEqual(main.parse_binary_packet("010000\n"), "010000")
        self.assertEqual(main.parse_binary_packet("000000"), "000000")
        self.assertEqual(main.parse_binary_packet("1 0 0 0 0 0\r\n"), "100000")
        self.assertEqual(main.parse_binary_packet("0\t0\t0\t0\t0\t0\r\n"), "000000")
        self.assertEqual(main.parse_binary_packet("1\t0\t0\t0\t0\t0\r\n"), "100000")
        self.assertEqual(main.parse_binary_packet("110000"), "110000")

        # Invalid cases
        self.assertIsNone(main.parse_binary_packet("a0\ta1\ta2\ta3\ta4\ta5\r\n"))  # header
        self.assertIsNone(main.parse_binary_packet("10000"))  # length 5
        self.assertIsNone(main.parse_binary_packet("1000000"))  # length 7
        self.assertIsNone(main.parse_binary_packet("100002"))  # invalid char
        self.assertIsNone(main.parse_binary_packet("hello!"))
        self.assertIsNone(main.parse_binary_packet(""))

    def test_config_json_format(self):
        config = main.load_config()
        self.assertIn("triggers", config)
        triggers = config["triggers"]
        for key, val in triggers.items():
            self.assertEqual(len(key), 6, f"Key '{key}' is not 6 chars")
            self.assertTrue(all(c in ("0", "1") for c in key), f"Key '{key}' contains non-binary chars")
            self.assertIn("name", val)
            self.assertIn("type", val)

    def test_handle_binary_state_trigger_and_debounce(self):
        mock_action = MagicMock()
        with patch.dict(main.ACTION_HANDLERS, {"open_url": mock_action}):
            triggers = {
                "100000": {
                    "name": "Dev Websites",
                    "type": "open_url",
                    "payload": {"urls": ["https://github.com"]}
                },
                "110000": {
                    "name": "Combo",
                    "type": "open_url",
                    "payload": {"urls": ["https://example.com"]}
                }
            }

            last_key = None

            # First touch: 100000
            last_key = main.handle_binary_state("100000", triggers, last_key)
            self.assertEqual(last_key, "100000")
            self.assertEqual(mock_action.call_count, 1)

            # Hold touch (debounce): 100000 again
            last_key = main.handle_binary_state("100000", triggers, last_key)
            self.assertEqual(last_key, "100000")
            self.assertEqual(mock_action.call_count, 1)  # not called again

            # Combo touch while holding: 110000
            last_key = main.handle_binary_state("110000", triggers, last_key)
            self.assertEqual(last_key, "110000")
            self.assertEqual(mock_action.call_count, 2)

            # Release all pins: 000000
            last_key = main.handle_binary_state("000000", triggers, last_key)
            self.assertIsNone(last_key)
            self.assertEqual(mock_action.call_count, 2)  # no new action on release

            # Touch again: 100000
            last_key = main.handle_binary_state("100000", triggers, last_key)
            self.assertEqual(last_key, "100000")
            self.assertEqual(mock_action.call_count, 3)  # triggered again!

    def test_action_run_command_cross_platform(self):
        with patch("subprocess.Popen") as mock_popen:
            main.action_run_command({"command": "echo hello", "working_dir": "."})
            self.assertTrue(mock_popen.called)

    def test_simulated_serial_stream_with_config(self):
        config = main.load_config()
        triggers = config["triggers"]
        recorded_actions = []

        def spy_action(name):
            def handler(payload):
                recorded_actions.append(name)
            return handler

        custom_handlers = {k: spy_action(k) for k in main.ACTION_HANDLERS}

        with patch.dict(main.ACTION_HANDLERS, custom_handlers):
            stream = [
                "000000\r\n",       # idle
                "100000\r\n",       # touch pin 0 -> open_url
                "100000\r\n",       # still touching (debounced)
                "000000\r\n",       # released
                "010000\r\n",       # touch pin 1 -> launch_app
                "000100\r\n",       # switch to pin 3 -> run_command
                "110000\r\n",       # secret combo -> launch_app
                "000000\r\n",       # released
            ]

            last_key = None
            for raw_line in stream:
                packet = main.parse_binary_packet(raw_line)
                if packet:
                    last_key = main.handle_binary_state(packet, triggers, last_key)

            expected_actions = [
                triggers["100000"]["type"],
                triggers["010000"]["type"],
                triggers["000100"]["type"],
                triggers["110000"]["type"],
            ]
            self.assertEqual(recorded_actions, expected_actions)


if __name__ == "__main__":
    unittest.main()
