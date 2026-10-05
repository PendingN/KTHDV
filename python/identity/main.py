import hashlib
import secrets
import time
from typing import Annotated

from fastapi import HTTPException
from pydantic import Field

from ..common import Admin, Model, Name, User, database, execute, password_hash, password_valid, require, service

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTO_INCREMENT, email VARCHAR(254) NOT NULL UNIQUE, name VARCHAR(120) NOT NULL,
 password VARCHAR(200) NOT NULL, role VARCHAR(10) NOT NULL DEFAULT 'user', active INTEGER NOT NULL DEFAULT 1,
 failures INTEGER NOT NULL DEFAULT 0,
 locked_until DOUBLE NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash CHAR(64) PRIMARY KEY, user_id INTEGER NOT NULL, expires_at DOUBLE NOT NULL,
 FOREIGN KEY(user_id) REFERENCES users(id)
);
"""
app = service("identity", SCHEMA, {
    "Người dùng": "SELECT id,email,name,role,active FROM users ORDER BY id DESC LIMIT 200"
}, [
    {"label": "Tạo người dùng", "method": "POST", "path": "/users", "body": {
        "email": "ban@example.com", "name": "Thành viên", "password": ""}},
    {"label": "Khóa hoặc mở tài khoản", "method": "PATCH", "path": "/users/{id}", "body": {"active": False}},
])


class Register(Model):
    email: Annotated[str, Field(max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    name: Name
    password: Annotated[str, Field(min_length=8, max_length=128)]


class Login(Model):
    email: Annotated[str, Field(min_length=1, max_length=254)]
    password: Annotated[str, Field(min_length=1, max_length=128)]


class UserStatus(Model):
    active: bool


@app.post("/users", status_code=201)
def register(payload: Register):
    with database("identity") as db:
        cursor = execute(db, "INSERT INTO users(email,name,password) VALUES(%s,%s,%s)", (
            payload.email.lower(), payload.name, password_hash(payload.password)))
        return {"id": cursor.lastrowid, "email": payload.email.lower(), "role": "user"}


@app.post("/auth/login")
def login(payload: Login):
    with database("identity") as db:
        execute(db, "START TRANSACTION")
        account = execute(db, "SELECT * FROM users WHERE email=%s FOR UPDATE", (payload.email.lower(),)).fetchone()
        if account and account["locked_until"] > time.time():
            raise HTTPException(429, "Thử lại sau 2 phút")
        if not account or not password_valid(payload.password, account["password"]) or not account["active"]:
            if account:
                failures = account["failures"] + 1
                execute(db, "UPDATE users SET failures=%s,locked_until=%s WHERE id=%s", (
                    failures, time.time() + 120 if failures >= 5 else 0, account["id"]))
                db.commit()
            raise HTTPException(401, "Thông tin đăng nhập không hợp lệ")
        token = secrets.token_urlsafe(32)
        expires = time.time() + 8 * 3600
        execute(db, "DELETE FROM sessions WHERE expires_at<%s", (time.time(),))
        execute(db, "INSERT INTO sessions VALUES(%s,%s,%s)", (
            hashlib.sha256(token.encode()).hexdigest(), account["id"], expires))
        execute(db, "UPDATE users SET failures=0,locked_until=0 WHERE id=%s", (account["id"],))
        return {"access_token": token, "token_type": "bearer", "expires_at": expires}


@app.get("/auth/me")
def me(current: User):
    return {key: value for key, value in current.items() if key != "token"}


@app.post("/auth/logout")
def logout(current: User):
    with database("identity") as db:
        execute(db, "DELETE FROM sessions WHERE token_hash=%s", (
            hashlib.sha256(current["token"].encode()).hexdigest(),))
    return {"message": "Đã đăng xuất"}


@app.patch("/users/{user_id}")
def set_status(user_id: int, payload: UserStatus, current: Admin):
    with database("identity") as db:
        account = execute(db, "SELECT id,role FROM users WHERE id=%s", (user_id,)).fetchone()
        require(account is not None, "Không tìm thấy tài khoản", 404)
        require(account["role"] != "admin", "Không khóa tài khoản admin", 403)
        execute(db, "UPDATE users SET active=%s WHERE id=%s", (int(payload.active), user_id))
        if not payload.active:
            execute(db, "DELETE FROM sessions WHERE user_id=%s", (user_id,))
    return {"id": user_id, "active": payload.active}
