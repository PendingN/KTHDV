import json
import os
import subprocess
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from run import ROOT, php_executable


class PhpPaginationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            cls.php = php_executable()
        except SystemExit as error:
            raise unittest.SkipTest(str(error)) from error

        class Ledger(BaseHTTPRequestHandler):
            def do_GET(self):
                request = urlparse(self.path)
                query = parse_qs(request.query)
                cls.requests.append((request.path, query))
                offset = int(query["offset"][0])
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(cls.records[offset:offset + 500]).encode())

            def log_message(self, *args):
                pass

        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Ledger)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_pages_keep_all_records_in_order_without_duplicate_or_missing_rows(self):
        for size in (0, 500, 1501):
            with self.subTest(size=size):
                type(self).records = [{"id": i, "amount_minor": -i} for i in range(size)]
                type(self).requests = []
                result = subprocess.run(
                    [self.php, "-r", 'require $argv[1]; echo json_encode(ledger_records(7, "2026-10-01", "2026-10-31"));',
                     str(ROOT / "php" / "common.php")],
                    env={**os.environ, "LEDGER_URL": f"http://127.0.0.1:{self.server.server_port}"},
                    capture_output=True, text=True, encoding="utf-8", timeout=15,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(json.loads(result.stdout), self.records)
                self.assertEqual([int(query["offset"][0]) for _, query in self.requests], list(range(0, size + 1, 500)))
                for path, query in self.requests:
                    self.assertEqual(path, "/internal/transactions/7")
                    self.assertEqual(query["start"], ["2026-10-01"])
                    self.assertEqual(query["end"], ["2026-10-31"])
