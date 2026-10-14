import os
import shutil
import subprocess
import unittest
from unittest.mock import Mock, patch
import run


class RunnerTests(unittest.TestCase):
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
