import unittest
from unittest.mock import patch

import pymysql
import httpx

from python.common import service


class DatabaseErrorTests(unittest.IsolatedAsyncioTestCase):
    async def response_for(self, error):
        app = service("identity", "", {}, [])

        @app.get("/probe")
        def probe():
            raise error

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            with patch("python.common.logging.exception"):
                return await client.get("/probe")

    async def test_connection_failures_return_actionable_json_without_internal_details(self):
        for code in (1040, 2002, 2003, 2006, 2013):
            with self.subTest(code=code):
                response = await self.response_for(pymysql.OperationalError(code, "private connection details"))
                self.assertEqual(response.status_code, 503)
                self.assertIn("MySQL", response.json()["detail"])
                self.assertNotIn("private", response.text)

    async def test_query_errors_remain_server_errors(self):
        response = await self.response_for(pymysql.OperationalError(1054, "private SQL details"))
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"detail": "Lỗi xử lý dữ liệu"})

    async def test_unique_constraint_errors_remain_conflicts(self):
        response = await self.response_for(pymysql.IntegrityError(1062, "private user details"))
        self.assertEqual(response.status_code, 409)
        self.assertNotIn("private", response.text)
