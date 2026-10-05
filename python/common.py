"""Kết nối MySQL và xác thực cho hai service Python."""

import hashlib
import hmac
import os
import secrets
import json
import re
from contextlib import asynccontextmanager, contextmanager
from decimal import Decimal
from pathlib import Path
from typing import Annotated, Literal

import httpx
import pymysql
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field

NAMES = ("identity", "ledger", "planning", "recurring", "fx", "reporting")
ROOT = Path(__file__).resolve().parent.parent
PORT_BASE = int(os.getenv("PORT_BASE", "8001"))
SCALES = {"VND": 0, "USD": 2, "EUR": 2, "JPY": 0}
Currency = Literal["VND", "USD", "EUR", "JPY"]
Name = Annotated[str, Field(min_length=1, max_length=120, pattern=r".*\S.*")]
PositiveMoney = Annotated[Decimal, Field(gt=0, le=Decimal("1000000000000"))]


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


def money(value: Decimal, currency: str) -> int:
    scaled = value * 10 ** SCALES[currency]
    if not value.is_finite() or scaled != scaled.to_integral_value():
        raise HTTPException(422, f"Số tiền {currency} có quá nhiều chữ số thập phân")
    return int(scaled)


def display(value: int, currency: str) -> str:
    return f"{Decimal(value) / 10 ** SCALES[currency]:.{SCALES[currency]}f}"


def settings():
    path = ROOT / "config.local.json"
    config = json.loads(path.read_text(encoding="utf-8-sig")) if path.exists() else {}
    return {
        "host": os.getenv("DB_HOST", config.get("host", "127.0.0.1")),
        "port": int(os.getenv("DB_PORT", config.get("port", 3306))),
        "user": os.getenv("DB_USER", config.get("user", "root")),
        "password": os.getenv("DB_PASSWORD", config.get("password", "")),
        "prefix": os.getenv("DB_PREFIX", config.get("prefix", "kthdv_")),
    }


def database_name(name):
    value = settings()["prefix"] + name
    require(name in NAMES and re.fullmatch(r"[a-zA-Z0-9_]{1,64}", value), "Tên database không hợp lệ")
    return value


@contextmanager
def database(name: str | None = None):
    config = settings()
    config.pop("prefix")
    connection = pymysql.connect(**config, database=database_name(name) if name else None,
                                 charset="utf8mb4", cursorclass=pymysql.cursors.DictCursor,
                                 connect_timeout=5, read_timeout=10, write_timeout=10)
    try:
        yield connection
        connection.commit()
    except BaseException:
        connection.rollback()
        raise
    finally:
        connection.close()


def execute(connection, sql, args=()):
    cursor = connection.cursor()
    cursor.execute(sql, args)
    return cursor


def many(connection, sql, args):
    cursor = connection.cursor()
    cursor.executemany(sql, args)
    return cursor


def rows(connection, sql, args=()):
    return execute(connection, sql, args).fetchall()


def initialize(name, schema):
    with database() as connection:
        execute(connection, f"CREATE DATABASE IF NOT EXISTS `{database_name(name)}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    with database(name) as connection:
        for statement in schema.split(";"):
            if statement.strip():
                execute(connection, statement + " ENGINE=InnoDB")


def owned(connection, table: str, record_id: int, user_id: int):
    # Table names are constants supplied by our route handlers, never request data.
    row = execute(connection,
        f"SELECT * FROM {table} WHERE id=%s AND user_id=%s FOR UPDATE", (record_id, user_id)
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Không tìm thấy dữ liệu thuộc người dùng")
    return dict(row)


def require(condition, message, status=422):
    if not condition:
        raise HTTPException(status, message)


def password_hash(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1)
    return f"{salt}:{digest.hex()}"


def password_valid(password: str, stored: str) -> bool:
    return hmac.compare_digest(password_hash(password, stored.split(":")[0]), stored)


def internal_key(x_service_key: str | None = Header(default=None)):
    expected = os.getenv("INTERNAL_KEY", "")
    if not expected or not x_service_key or not hmac.compare_digest(expected, x_service_key):
        raise HTTPException(403, "Chỉ dành cho giao tiếp nội bộ")


Internal = Annotated[None, Depends(internal_key)]


async def peer(name: str, method: str, path: str, *, token=None, user_id=None, **kwargs):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    else:
        headers["X-Service-Key"] = os.getenv("INTERNAL_KEY", "")
        if user_id is not None:
            headers["X-User-ID"] = str(user_id)
    url = os.getenv(f"{name.upper()}_URL", f"http://127.0.0.1:{PORT_BASE + NAMES.index(name)}")
    try:
        async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
            response = await client.request(method, url + path, headers=headers, **kwargs)
    except httpx.HTTPError as exc:
        raise HTTPException(503, f"Service {name} không kết nối được") from exc
    if response.is_error:
        try:
            detail = response.json().get("detail", f"Service {name} báo lỗi")
        except ValueError:
            detail = f"Service {name} báo lỗi"
        raise HTTPException(response.status_code, detail)
    return response.json()


async def ledger_records(user_id, start, end):
    result = []
    while True:
        page = await peer("ledger", "GET", f"/internal/transactions/{user_id}", params={
            "start": str(start), "end": str(end), "offset": len(result)})
        result.extend(page)
        if len(page) < 500:
            return result


bearer = HTTPBearer(auto_error=False)


async def user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
):
    if not credentials:
        raise HTTPException(401, "Cần đăng nhập", headers={"WWW-Authenticate": "Bearer"})
    token = credentials.credentials
    if request.app.state.name == "identity":
        import time
        with database("identity") as connection:
            found = execute(connection,
                "SELECT u.id,u.email,u.name,u.role,u.active "
                "FROM sessions s JOIN users u ON u.id=s.user_id "
                "WHERE s.token_hash=%s AND s.expires_at>%s AND u.active=1",
                (hashlib.sha256(token.encode()).hexdigest(), time.time()),
            ).fetchone()
        if found is None:
            raise HTTPException(401, "Phiên đã hết hạn hoặc tài khoản bị khóa")
        result = dict(found)
    else:
        result = await peer("identity", "GET", "/auth/me", token=token)
    result["token"] = token
    return result


User = Annotated[dict, Depends(user)]


def admin(current: User):
    require(current["role"] == "admin", "Cần quyền admin", 403)
    return current


Admin = Annotated[dict, Depends(admin)]


def service(name: str, schema: str, tables: dict[str, str], actions: list[dict]):
    @asynccontextmanager
    async def lifespan(app):
        initialize(name, schema)
        yield

    app = FastAPI(title=f"{name.title()} Service", version="0.1.0", lifespan=lifespan)
    app.state.name = name
    app.state.schema = schema

    @app.exception_handler(pymysql.IntegrityError)
    async def integrity_error(request, exc):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=409, content={"detail": "Dữ liệu trùng hoặc vi phạm ràng buộc"})

    @app.get("/health")
    def health():
        return {"service": name, "status": "ok"}

    @app.get("/", response_class=HTMLResponse)
    @app.get("/admin", response_class=HTMLResponse)
    def page():
        return (ROOT / "giao_dien" / "admin.html").read_text(encoding="utf-8")

    @app.get("/admin/actions")
    def admin_actions(current: Admin):
        return {"service": name, "actions": actions, "services": [
            {"name": item, "url": f"http://127.0.0.1:{PORT_BASE + index}/admin"}
            for index, item in enumerate(NAMES)
        ]}

    @app.get("/admin/data")
    def admin_data(current: Admin):
        with database(name) as connection:
            return {label: rows(connection, query) for label, query in tables.items()}

    if name != "identity":
        @app.post("/auth/login")
        async def login_proxy(payload: dict):
            return await peer("identity", "POST", "/auth/login", json=payload)

        @app.get("/auth/me")
        def whoami(current: User):
            return {k: v for k, v in current.items() if k != "token"}

        @app.post("/auth/logout")
        async def logout_proxy(current: User):
            return await peer("identity", "POST", "/auth/logout", token=current["token"])

    return app
