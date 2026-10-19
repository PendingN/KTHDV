"""Đồng bộ tỷ giá từ open.er-api.com vào service FX cho các cặp USD, EUR, JPY, VND.

Chạy (cần tài khoản admin):
    FX_ADMIN_EMAIL=... FX_ADMIN_PASSWORD=... python scripts/sync_rates.py
"""
import getpass
import os
from datetime import datetime
from decimal import Decimal, getcontext

import httpx

SOURCE_URL = "https://open.er-api.com/v6/latest/USD"
IDENTITY_URL = os.getenv("IDENTITY_URL", "http://127.0.0.1:8001")
FX_URL = os.getenv("FX_URL", "http://127.0.0.1:8005")
CURRENCIES = ["USD", "EUR", "JPY", "VND"]
STEP = Decimal("0.000000000001")

getcontext().prec = 40


def login(client):
    email = os.getenv("FX_ADMIN_EMAIL") or input("Email admin: ")
    password = os.getenv("FX_ADMIN_PASSWORD") or getpass.getpass("Mật khẩu admin: ")
    response = client.post(f"{IDENTITY_URL}/auth/login", json={"email": email, "password": password})
    response.raise_for_status()
    return response.json()["access_token"]


def main():
    with httpx.Client(timeout=15, trust_env=False) as client:
        source = client.get(SOURCE_URL).raise_for_status().json()
        if source.get("result") != "success":
            raise SystemExit(f"Nguồn tỷ giá lỗi: {source.get('error-type', source.get('result'))}")
        effective_on = datetime.strptime(source["time_last_update_utc"], "%a, %d %b %Y %H:%M:%S %z").date().isoformat()
        usd = {code: Decimal(str(source["rates"][code])) for code in CURRENCIES}

        token = login(client)
        headers = {"Authorization": f"Bearer {token}"}
        saved = 0
        for base in CURRENCIES:
            for quote in CURRENCIES:
                if base == quote:
                    continue
                rate = (usd[quote] / usd[base]).quantize(STEP)
                response = client.post(f"{FX_URL}/rates", headers=headers, json={
                    "base": base, "quote": quote, "rate": str(rate),
                    "effective_on": effective_on, "source": "open.er-api.com",
                })
                response.raise_for_status()
                saved += 1
                print(f"{base}->{quote}: {rate} ({effective_on})", flush=True)
        print(f"Đã lưu {saved} tỷ giá.", flush=True)


if __name__ == "__main__":
    main()
