"""Một kiểm thử xuyên 6 tiến trình HTTP và MySQL thật; dùng database tạm riêng."""

import calendar
import os
import secrets
import subprocess
import sys
import tempfile
import time
from datetime import date, timedelta

import httpx

os.environ["DB_PREFIX"] = "kthdv_test_" + secrets.token_hex(4) + "_"
os.environ["PORT_BASE"] = "18001"
os.environ["INTERNAL_KEY"] = secrets.token_urlsafe(32)
os.environ["PYTHONUTF8"] = "1"
sys.stdout.reconfigure(encoding="utf-8")

from thanh_vien_1_python.common import NAMES, ROOT, database, database_name, execute
from run import command, MEMBERS, php_executable


def main():
    assert tuple(name for pair in MEMBERS.values() for name in pair) == NAMES
    assert all(len(pair) == 2 for pair in MEMBERS.values())
    subprocess.run(["node", str(ROOT / "thanh_vien_2_javascript/recurring/main.js"), "--self-test"], check=True)
    subprocess.run([php_executable(), str(ROOT / "thanh_vien_3_php/fx/index.php"), "--self-test"], check=True)
    processes = []
    password = secrets.token_urlsafe(16)
    env = dict(os.environ, ADMIN_PASSWORD=password)
    names = [database_name(name) for name in NAMES]
    with database() as db:
        for name in names:
            assert not execute(db, "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=%s", (name,)).fetchone()
    with tempfile.TemporaryFile(mode="w+b") as log, httpx.Client(timeout=20, trust_env=False) as client:
        def call(name, method, path, *, token=None, expected=200, headers=None, **kwargs):
            address = f"http://127.0.0.1:{18001 + NAMES.index(name)}{path}"
            request_headers = dict(headers or {})
            if token:
                request_headers["Authorization"] = f"Bearer {token}"
            response = client.request(method, address, headers=request_headers, **kwargs)
            assert response.status_code == expected, (name, path, response.status_code, response.text[:500])
            return response

        def start(name):
            return subprocess.Popen(command(name), cwd=ROOT, env=env,
                                    stdout=log, stderr=log, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))

        def wait_ready(name):
            deadline = time.monotonic() + 25
            while time.monotonic() < deadline:
                try:
                    if client.get(f"http://127.0.0.1:{18001 + NAMES.index(name)}/health").status_code == 200:
                        return
                except httpx.HTTPError:
                    pass
                time.sleep(0.2)
            raise AssertionError(f"{name} chưa khởi động")

        try:
            subprocess.run([sys.executable, "run.py", "--create-admin", "--email", "admin@test.local"],
                           cwd=ROOT, env=env, stdout=log, stderr=log, check=True)
            processes.extend(start(name) for name in NAMES)
            for name in NAMES:
                wait_ready(name)
                call(name, "GET", "/admin/data", expected=401)
                assert "<form" in call(name, "GET", "/admin").text
                assert call(name, "GET", "/openapi.json").json()["info"]["title"]
            admin = call("identity", "POST", "/auth/login", json={"email": "admin@test.local", "password": password}).json()["access_token"]
            for name in NAMES:
                assert call(name, "GET", "/admin/actions", token=admin).json()["service"] == name
                call(name, "GET", "/admin/data", token=admin)
                assert call(name, "POST", "/auth/login", json={"email": "admin@test.local", "password": password}).json()["access_token"]
            register = {"email": "user@test.local", "name": "Người dùng", "password": password}
            user_id = call("identity", "POST", "/users", json=register, expected=201).json()["id"]
            call("identity", "POST", "/users", json={**register, "role": "admin"}, expected=422)
            call("identity", "POST", "/users", json=register, expected=409)
            token = call("ledger", "POST", "/auth/login", json={"email": register["email"], "password": password}).json()["access_token"]
            for name in NAMES:
                call(name, "GET", "/admin/data", token=token, expected=403)
            w1 = call("ledger", "POST", "/wallets", token=token, json={"name": "Tiền mặt", "currency": "VND"}, expected=201).json()["id"]
            w2 = call("ledger", "POST", "/wallets", token=token, json={"name": "Ngân hàng", "currency": "VND"}, expected=201).json()["id"]
            usd = call("ledger", "POST", "/wallets", token=token, json={"name": "USD", "currency": "USD"}, expected=201).json()["id"]
            income = call("ledger", "POST", "/categories", token=token, json={"name": "Lương", "kind": "income"}, expected=201).json()["id"]
            expense = call("ledger", "POST", "/categories", token=token, json={"name": "Ăn uống", "kind": "expense"}, expected=201).json()["id"]
            today = date.today()
            record = {"wallet_id": w1, "category_id": income, "kind": "income", "amount": "1000000", "occurred_on": str(today)}
            call("ledger", "POST", "/transactions", token=token, json=record, expected=201)
            budget = {"name": "Ăn uống", "category_id": expense, "currency": "VND", "limit_amount": "100000",
                      "start_on": str(today.replace(day=1)), "end_on": str(today.replace(day=calendar.monthrange(today.year, today.month)[1])), "threshold": 80}
            budget_id = call("planning", "POST", "/budgets", token=token, json=budget, expected=201).json()["id"]
            call("planning", "PUT", f"/budgets/{budget_id}", token=token, json=budget)
            call("planning", "PUT", f"/budgets/{budget_id}", token=admin, json=budget, expected=422)
            call("planning", "POST", "/budgets", token=token, json={**budget, "threshold": 101}, expected=422)
            call("planning", "POST", "/budgets", token=token, json={**budget, "start_on": "2026-02-30"}, expected=422)
            spend = {**record, "category_id": expense, "kind": "expense", "amount": "80000"}
            key = {"Idempotency-Key": "test-expense"}
            original = call("ledger", "POST", "/transactions", token=token, json=spend, headers=key, expected=201).json()
            duplicate = call("ledger", "POST", "/transactions", token=token, json=spend, headers=key, expected=201).json()
            assert original == duplicate
            call("ledger", "POST", "/transactions", token=token, json={**spend, "amount": "90000"}, headers=key, expected=409)
            internal = {"X-Service-Key": os.environ["INTERNAL_KEY"]}
            call("ledger", "POST", "/internal/dispatch", headers=internal)
            call("ledger", "POST", "/internal/dispatch", headers=internal)
            notices = call("recurring", "GET", "/notifications", token=token).json()
            assert len(notices) == 1 and "80%" in notices[0]["message"]
            call("ledger", "POST", "/internal/dispatch", expected=403)
            call("ledger", "POST", f"/transactions/{original['id']}/adjust", token=token, json={**spend, "category_id": income}, expected=422)
            assert call("planning", "GET", "/budgets", token=token).json()[0]["spent_minor"] == 80000
            call("ledger", "POST", f"/transactions/{original['id']}/adjust", token=token, json={**spend, "amount": "70000"})
            call("ledger", "POST", f"/transactions/{original['id']}/reverse", token=token, expected=409)
            assert call("planning", "GET", "/budgets", token=token).json()[0]["spent_minor"] == 70000
            call("ledger", "POST", "/transfers", token=token, json={"from_wallet": w1, "to_wallet": w2, "amount": "10000", "occurred_on": str(today)}, expected=201)
            call("ledger", "POST", "/transfers", token=token, json={"from_wallet": w1, "to_wallet": usd, "amount": "10", "occurred_on": str(today)}, expected=422)
            call("ledger", "POST", "/transactions", token=token, json={**record, "wallet_id": usd, "amount": "10.50"}, expected=201)
            call("ledger", "POST", "/transactions", token=token, json={**record, "wallet_id": usd, "amount": "0.001"}, expected=422)
            call("ledger", "POST", "/transactions", token=token, json={**record, "amount": "-1"}, expected=422)
            call("ledger", "POST", "/transactions", token=token, json={**record, "wallet_id": 999999}, expected=404)
            goal = call("planning", "POST", "/goals", token=token, json={"name": "Laptop", "currency": "VND", "target_amount": "1000000", "deadline": str(today + timedelta(days=90))}, expected=201).json()["id"]
            call("planning", "POST", f"/goals/{goal}/contributions", token=token, json={"amount": "500000"}, expected=201)
            assert call("planning", "GET", "/goals", token=token).json()[0]["progress_percent"] == 50
            goal_payload = {"name": "Laptop mới", "currency": "VND", "target_amount": "2000000", "deadline": str(today + timedelta(days=90))}
            call("planning", "PUT", f"/goals/{goal}", token=token, json=goal_payload)
            call("planning", "POST", f"/goals/{goal}/contributions", token=admin, json={"amount": "1"}, expected=404)
            call("planning", "POST", f"/goals/{goal}/contributions", token=token, json={"amount": "-1"}, expected=422)
            call("planning", "DELETE", f"/goals/{goal}", token=token)
            call("planning", "POST", f"/goals/{goal}/contributions", token=token, json={"amount": "1"}, expected=422)
            subscription = call("recurring", "POST", "/subscriptions", token=token, json={"name": "Internet", "amount": "200000", "currency": "VND", "period": "monthly", "next_due": str(today + timedelta(days=1)), "remind_days": 3}, expected=201).json()["id"]
            assert call("recurring", "POST", "/reminders/check", token=token).json()["created"] == 1
            assert call("recurring", "POST", "/reminders/check", token=token).json()["created"] == 0
            notices = call("recurring", "GET", "/notifications", token=token).json()
            call("recurring", "PATCH", f"/notifications/{notices[0]['id']}/read", token=token)
            call("recurring", "PATCH", f"/notifications/{notices[0]['id']}/read", token=admin, expected=404)
            call("recurring", "POST", "/internal/reminders/check", expected=403)
            call("recurring", "GET", "/suggestions", token=token)
            call("recurring", "POST", f"/subscriptions/{subscription}/paid", token=token)
            calendar_sub = call("recurring", "POST", "/subscriptions", token=token, json={"name": "Cuối tháng", "amount": "1", "next_due": "2027-01-31"}, expected=201).json()["id"]
            assert call("recurring", "POST", f"/subscriptions/{calendar_sub}/paid", token=token).json()["next_due"] == "2027-02-28"
            assert call("recurring", "POST", f"/subscriptions/{calendar_sub}/paid", token=token).json()["next_due"] == "2027-03-31"
            subscription_payload = {"name": "Sửa lịch", "amount": "1", "next_due": "2027-01-31"}
            call("recurring", "PUT", f"/subscriptions/{calendar_sub}", token=token, json=subscription_payload)
            call("recurring", "POST", f"/subscriptions/{calendar_sub}/paid", token=admin, expected=404)
            call("recurring", "DELETE", f"/subscriptions/{calendar_sub}", token=token)
            call("recurring", "POST", f"/subscriptions/{calendar_sub}/paid", token=token, expected=422)
            call("fx", "POST", "/rates", token=token, json={"base": "USD", "quote": "VND", "rate": "25000", "effective_on": str(today)}, expected=403)
            call("fx", "POST", "/rates", token=admin, json={"base": "USD", "quote": "VND", "rate": "25000", "effective_on": str(today)}, expected=201)
            conversion = call("fx", "POST", "/convert", token=token, json={"base": "USD", "quote": "VND", "amount": "10", "as_of": str(today)}).json()
            assert conversion["converted_amount"] == "250000" and conversion["source"] == "Nhập tay"
            call("fx", "POST", "/rates", token=admin, json={"base": "USD", "quote": "VND", "rate": "0.0000000000001", "effective_on": str(today)}, expected=422)
            call("fx", "POST", "/convert", token=token, json={"base": "USD", "quote": "VND", "amount": "-1", "as_of": str(today)}, expected=422)
            same = call("fx", "POST", "/convert", token=token, json={"base": "USD", "quote": "USD", "amount": "10.50", "as_of": str(today)}).json()
            assert same["converted_amount"] == "10.50"
            call("fx", "POST", "/convert", token=token, json={"base": "USD", "quote": "VND", "amount": "0.001", "as_of": str(today)}, expected=422)
            call("fx", "POST", "/convert", token=token, json={"base": "EUR", "quote": "VND", "amount": "10", "as_of": str(today)}, expected=404)
            query = f"?start={today}&end={today}"
            totals = call("reporting", "GET", "/reports" + query, token=token).json()["by_currency"]
            assert totals["VND"]["expense_minor"] == 70000 and totals["VND"]["net_minor"] == 930000
            assert totals["USD"]["income"] == "10.50"
            dashboard = call("reporting", "GET", "/dashboard" + query, token=token).json()
            assert dashboard["wallet_total_minor_by_currency"]["VND"] == 930000
            compare_query = query + f"&previous_start={today-timedelta(days=2)}&previous_end={today-timedelta(days=1)}"
            assert call("reporting", "GET", "/compare" + compare_query, token=token).json()["difference_minor"]["VND"]["net_minor"] == 930000
            assert "VND,1000000,70000,930000" in call("reporting", "GET", "/reports.csv" + query, token=token).text
            call("reporting", "GET", f"/reports?start={today+timedelta(days=1)}&end={today}", token=token, expected=422)
            call("ledger", "PATCH", f"/wallets/{w1}", token=admin, json={"name": "Không thuộc tôi", "active": True}, expected=404)
            processes[1].terminate(); processes[1].wait(timeout=5)
            call("reporting", "GET", "/reports" + query, token=token, expected=503)
            processes[1] = start("ledger"); wait_ready("ledger")
            assert call("reporting", "GET", "/reports" + query, token=token).json()["by_currency"] == totals
            call("identity", "PATCH", f"/users/{user_id}", token=admin, json={"active": False})
            call("ledger", "GET", "/wallets", token=token, expected=401)
            call("identity", "POST", "/auth/login", json={"email": register["email"], "password": password}, expected=401)
            print("PASS: 6 service, MySQL, quyền truy cập, giao dịch/rollback, chống trùng, ngân sách, mục tiêu, lịch nhắc, tỷ giá, báo cáo và lưu dữ liệu sau khởi động lại.")
        except BaseException:
            log.seek(0)
            print(log.read().decode("utf-8", errors="replace")[-6000:])
            raise
        finally:
            for process in processes:
                if process.poll() is None:
                    process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill(); process.wait()
            # Chỉ xóa đúng sáu database test có tên ngẫu nhiên đã xác nhận chưa tồn tại.
            with database() as db:
                for name in names:
                    assert name.startswith(os.environ["DB_PREFIX"]) and name.startswith("kthdv_test_")
                    execute(db, f"DROP DATABASE IF EXISTS `{name}`")


if __name__ == "__main__":
    main()
