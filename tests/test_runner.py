import os
import shutil
import socket
import subprocess
import unittest
from unittest.mock import MagicMock, Mock, patch
import run


class RunnerTests(unittest.TestCase):
    def test_occupied_port_is_reported_without_stopping_its_owner(self):
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            listener.listen()
            port = listener.getsockname()[1]
            with patch("run.PORT_BASE", port):
                with self.assertRaisesRegex(SystemExit, f"identity: {port}"):
                    run.check_ports(["identity"], False)
            self.assertEqual(listener.getsockname()[1], port)

    def test_custom_ports_are_checked_for_the_selected_services_and_ui(self):
        probe = MagicMock()
        with (
            patch("run.PORT_BASE", 18001),
            patch.dict(os.environ, {"FRONTEND_PORT": "3100", "ADMIN_PORT": "8190"}),
            patch("run.socket.socket", return_value=probe),
        ):
            run.check_ports(["identity", "reporting"], True)
        self.assertEqual([call.args[0] for call in probe.__enter__.return_value.bind.call_args_list],
                         [("127.0.0.1", 18001), ("127.0.0.1", 18006),
                          ("127.0.0.1", 3100), ("127.0.0.1", 8190)])

    def test_invalid_or_overlapping_ports_fail_before_probing(self):
        for frontend in ("invalid", "0", "65536", "8001"):
            with self.subTest(frontend=frontend), patch("run.PORT_BASE", 8001), \
                 patch.dict(os.environ, {"FRONTEND_PORT": frontend, "ADMIN_PORT": "8090"}), \
                 patch("run.socket.socket") as probe:
                with self.assertRaises(SystemExit):
                    run.check_ports(["identity"], True)
                probe.assert_not_called()

    def test_preflight_failure_starts_no_process_and_touches_no_database(self):
        with (
            patch("sys.argv", ["run.py"]),
            patch("run.frontend_command"), patch("run.admin_command"), patch("run.command"),
            patch("run.check_ports", side_effect=SystemExit("occupied")),
            patch("run.subprocess.Popen") as start,
            patch("run.subprocess.run") as setup,
            patch("run.database") as database,
        ):
            with self.assertRaisesRegex(SystemExit, "occupied"):
                run.main()
            start.assert_not_called()
            setup.assert_not_called()
            database.assert_not_called()

    def test_database_outage_starts_no_process(self):
        with (
            patch("sys.argv", ["run.py"]),
            patch("run.frontend_command"), patch("run.admin_command"), patch("run.command"),
            patch("run.check_ports"),
            patch("run.database", side_effect=run.pymysql.OperationalError(2003, "refused")),
            patch("run.subprocess.Popen") as start,
            patch("run.subprocess.run") as setup,
        ):
            with self.assertRaisesRegex(SystemExit, "Chưa kết nối được MySQL"):
                run.main()
            start.assert_not_called()
            setup.assert_not_called()

    def test_custom_frontend_port_reaches_the_start_command(self):
        with patch.dict(os.environ, {"FRONTEND_PORT": "3100"}), \
             patch("run.shutil.which", return_value="node.exe"), \
             patch("pathlib.Path.is_file", return_value=True):
            self.assertEqual(run.frontend_command()[-2:], ["--port", "3100"])

    def test_frontend_command_and_missing_dependency(self):
        with patch("run.shutil.which", return_value="node.exe"), patch("pathlib.Path.is_file", return_value=True):
            command = run.frontend_command()
            self.assertEqual(command[0], "node.exe")
            self.assertIn("next", command[1])
            self.assertEqual(command[-4:], ["--hostname", "127.0.0.1", "--port", "3000"])
        with patch("run.shutil.which", return_value=None):
            with self.assertRaisesRegex(SystemExit, "Thiếu frontend"):
                run.frontend_command()

    def test_windows_cleanup_targets_only_owned_live_processes(self):
        alive = Mock(pid=12345)
        alive.poll.return_value = None
        stopped = Mock(pid=22222)
        stopped.poll.return_value = 0
        with patch("run.os.name", "nt"), patch("run.subprocess.run") as taskkill:
            run.stop_processes([alive, stopped])
            taskkill.assert_called_once_with(["taskkill", "/PID", "12345", "/T", "/F"], capture_output=True)
        alive.wait.assert_called_once_with(timeout=5)
        stopped.wait.assert_called_once_with(timeout=5)

    def test_unresponsive_process_is_killed(self):
        process = Mock()
        process.poll.return_value = None
        process.wait.side_effect = [subprocess.TimeoutExpired("node", 5), 0]
        with patch("run.os.name", "posix"):
            run.stop_processes([process])
        process.terminate.assert_called_once()
        process.kill.assert_called_once()

    @unittest.skipUnless(os.name == "nt" and shutil.which("node"), "Requires Windows and Node")
    def test_windows_cleanup_closes_real_child_process(self):
        script = "const {spawn}=require('node:child_process'); const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true}); console.log(child.pid); setInterval(()=>{},1000)"
        process = subprocess.Popen([shutil.which("node"), "-e", script], stdout=subprocess.PIPE, text=True)
        try:
            child_pid = int(process.stdout.readline().strip())
            run.stop_processes([process])
            result = subprocess.run(["tasklist", "/FI", f"PID eq {child_pid}", "/FO", "CSV", "/NH"], capture_output=True, text=True)
            self.assertNotIn(f'"{child_pid}"', result.stdout)
            self.assertIsNotNone(process.poll())
        finally:
            if process.poll() is None:
                run.stop_processes([process])
            process.stdout.close()


if __name__ == "__main__":
    unittest.main()
