import hashlib
from datetime import date
from typing import Annotated, Literal

from fastapi import Header, Query
from pydantic import Field

from ..common import Currency, Internal, Model, Name, PositiveMoney, User, database, execute, many, money, owned, peer, require, rows, service

app = service("ledger", """
CREATE TABLE IF NOT EXISTS wallets (
 id INTEGER PRIMARY KEY AUTO_INCREMENT, user_id INTEGER NOT NULL, name VARCHAR(120) NOT NULL,
 currency CHAR(3) NOT NULL, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS categories (
 id INTEGER PRIMARY KEY AUTO_INCREMENT, user_id INTEGER NOT NULL, name VARCHAR(120) NOT NULL,
 kind VARCHAR(12) NOT NULL CHECK(kind IN ('income','expense')), active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS transactions (
 id INTEGER PRIMARY KEY AUTO_INCREMENT, user_id INTEGER NOT NULL, wallet_id INTEGER NOT NULL,
 category_id INTEGER, kind VARCHAR(12) NOT NULL,
 amount_minor BIGINT NOT NULL, currency CHAR(3) NOT NULL, occurred_on DATE NOT NULL,
 note VARCHAR(500) NOT NULL, reversal_of INTEGER UNIQUE,
 request_key VARCHAR(100), request_hash CHAR(64), UNIQUE(user_id,request_key),
 FOREIGN KEY(wallet_id) REFERENCES wallets(id), FOREIGN KEY(category_id) REFERENCES categories(id),
 FOREIGN KEY(reversal_of) REFERENCES transactions(id)
);
CREATE TABLE IF NOT EXISTS entries (
 id INTEGER PRIMARY KEY AUTO_INCREMENT, transaction_id INTEGER NOT NULL,
 wallet_id INTEGER NOT NULL, delta_minor BIGINT NOT NULL,
 FOREIGN KEY(transaction_id) REFERENCES transactions(id), FOREIGN KEY(wallet_id) REFERENCES wallets(id)
);
CREATE TABLE IF NOT EXISTS pending_events (
 id INTEGER PRIMARY KEY AUTO_INCREMENT, user_id INTEGER NOT NULL, sent INTEGER NOT NULL DEFAULT 0,
 last_error VARCHAR(300) NOT NULL DEFAULT ''
);
""", {
    "Ví tiền": "SELECT * FROM wallets ORDER BY id DESC LIMIT 200",
    "Danh mục": "SELECT * FROM categories ORDER BY id DESC LIMIT 200",
    "Giao dịch": "SELECT id,user_id,wallet_id,category_id,kind,amount_minor,currency,occurred_on,note,reversal_of FROM transactions ORDER BY id DESC LIMIT 200",
}, [
    {"label": "Tạo ví tiền", "method": "POST", "path": "/wallets", "body": {"name": "Tiền mặt", "currency": "VND"}},
    {"label": "Tạo danh mục", "method": "POST", "path": "/categories", "body": {"name": "Ăn uống", "kind": "expense"}},
    {"label": "Ghi thu hoặc chi", "method": "POST", "path": "/transactions", "body": {"wallet_id": 1, "category_id": 1, "kind": "expense", "amount": "50000", "occurred_on": "2026-10-05", "note": "Ăn trưa"}},
    {"label": "Chuyển tiền cùng tiền tệ", "method": "POST", "path": "/transfers", "body": {"from_wallet": 1, "to_wallet": 2, "amount": "100000", "occurred_on": "2026-10-05"}},
    {"label": "Xem số dư ví", "method": "GET", "path": "/wallets", "body": None},
    {"label": "Đổi tên hoặc ngừng dùng ví", "method": "PATCH", "path": "/wallets/{id}", "body": {"name": "Ví chính", "active": True}},
    {"label": "Đổi tên hoặc ngừng dùng danh mục", "method": "PATCH", "path": "/categories/{id}", "body": {"name": "Ăn uống", "active": True}},
    {"label": "Hủy và hoàn lại giao dịch", "method": "POST", "path": "/transactions/{id}/reverse", "body": None},
    {"label": "Điều chỉnh giao dịch", "method": "POST", "path": "/transactions/{id}/adjust", "body": {"wallet_id": 1, "category_id": 1, "kind": "expense", "amount": "40000", "occurred_on": "2026-10-05", "note": "Sửa số tiền"}},
])


class Wallet(Model):
    name: Name
    # Hiện chỉ hỗ trợ ví tiền Việt; ví ngoại tệ đã tạo trước đây vẫn đọc được.
    currency: Literal["VND"] = "VND"


class Category(Model):
    name: Name
    kind: Literal["income", "expense"]


class Rename(Model):
    name: Name
    active: bool = True


class Transaction(Model):
    wallet_id: Annotated[int, Field(gt=0)]
    category_id: Annotated[int, Field(gt=0)]
    kind: Literal["income", "expense"]
    amount: PositiveMoney
    occurred_on: date
    note: Annotated[str, Field(max_length=500)] = ""


class Transfer(Model):
    from_wallet: Annotated[int, Field(gt=0)]
    to_wallet: Annotated[int, Field(gt=0)]
    amount: PositiveMoney
    # Chỉ nhập khi hai ví khác tiền tệ: số tiền thực nhận bằng tiền của ví đích.
    received_amount: PositiveMoney | None = None
    occurred_on: date


@app.post("/wallets", status_code=201)
def create_wallet(payload: Wallet, current: User):
    with database("ledger") as db:
        row = execute(db, "INSERT INTO wallets(user_id,name,currency) VALUES(%s,%s,%s)", (
            current["id"], payload.name, payload.currency))
        return {"id": row.lastrowid, **payload.model_dump()}


@app.get("/wallets")
def wallets(current: User):
    with database("ledger") as db:
        return rows(db, "SELECT w.*,COALESCE(SUM(e.delta_minor),0) AS balance_minor "
                    "FROM wallets w LEFT JOIN entries e ON e.wallet_id=w.id "
                    "WHERE w.user_id=%s GROUP BY w.id", (current["id"],))


@app.post("/categories", status_code=201)
def create_category(payload: Category, current: User):
    with database("ledger") as db:
        row = execute(db, "INSERT INTO categories(user_id,name,kind) VALUES(%s,%s,%s)", (
            current["id"], payload.name, payload.kind))
        return {"id": row.lastrowid, **payload.model_dump()}


@app.get("/categories")
def categories(current: User):
    with database("ledger") as db:
        return rows(db, "SELECT * FROM categories WHERE user_id=%s", (current["id"],))


def rename(table, record_id, payload, current):
    with database("ledger") as db:
        owned(db, table, record_id, current["id"])
        execute(db, f"UPDATE {table} SET name=%s,active=%s WHERE id=%s", (
            payload.name, int(payload.active), record_id))
    return {"id": record_id, **payload.model_dump()}


@app.patch("/wallets/{record_id}")
def rename_wallet(record_id: int, payload: Rename, current: User):
    return rename("wallets", record_id, payload, current)


@app.patch("/categories/{record_id}")
def rename_category(record_id: int, payload: Rename, current: User):
    return rename("categories", record_id, payload, current)


def insert_transaction(db, current_id, payload, key=None, request_hash=None):
    wallet = owned(db, "wallets", payload.wallet_id, current_id)
    category = owned(db, "categories", payload.category_id, current_id)
    require(wallet["active"] and category["active"], "Ví hoặc danh mục đã ngừng dùng")
    require(category["kind"] == payload.kind, "Loại danh mục không khớp giao dịch")
    amount = money(payload.amount, wallet["currency"])
    cursor = execute(db, "INSERT INTO transactions(user_id,wallet_id,category_id,kind,amount_minor,currency,occurred_on,note,request_key,request_hash) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", (
        current_id, wallet["id"], category["id"], payload.kind, amount, wallet["currency"],
        payload.occurred_on.isoformat(), payload.note, key, request_hash))
    execute(db, "INSERT INTO entries(transaction_id,wallet_id,delta_minor) VALUES(%s,%s,%s)", (
        cursor.lastrowid, wallet["id"], amount if payload.kind == "income" else -amount))
    execute(db, "INSERT INTO pending_events(user_id) VALUES(%s)", (current_id,))
    return {"id": cursor.lastrowid, "amount_minor": amount, "currency": wallet["currency"]}


@app.post("/transactions", status_code=201)
def create_transaction(payload: Transaction, current: User,
                       idempotency_key: Annotated[str | None, Header(max_length=100, min_length=1)] = None):
    digest = hashlib.sha256(payload.model_dump_json().encode()).hexdigest()
    with database("ledger") as db:
        execute(db, "START TRANSACTION")
        if idempotency_key:
            previous = execute(db, "SELECT * FROM transactions WHERE user_id=%s AND request_key=%s", (
                current["id"], idempotency_key)).fetchone()
            if previous:
                require(previous["request_hash"] == digest, "Khóa chống trùng đã dùng cho dữ liệu khác", 409)
                return {"id": previous["id"], "amount_minor": previous["amount_minor"], "currency": previous["currency"]}
        return insert_transaction(db, current["id"], payload, idempotency_key, digest)


def reverse_in_db(db, transaction_id, current_id):
    original = owned(db, "transactions", transaction_id, current_id)
    require(original["kind"] in ("income", "expense") and original["reversal_of"] is None,
            "Chỉ hủy giao dịch thu/chi gốc")
    require(not execute(db, "SELECT id FROM transactions WHERE reversal_of=%s", (transaction_id,)).fetchone(),
            "Giao dịch đã được hủy hoặc điều chỉnh", 409)
    cursor = execute(db, "INSERT INTO transactions(user_id,wallet_id,category_id,kind,amount_minor,currency,occurred_on,note,reversal_of) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s)", (
        current_id, original["wallet_id"], original["category_id"], original["kind"],
        -original["amount_minor"], original["currency"], original["occurred_on"], "Đảo giao dịch", transaction_id))
    for entry in execute(db, "SELECT * FROM entries WHERE transaction_id=%s", (transaction_id,)).fetchall():
        execute(db, "INSERT INTO entries(transaction_id,wallet_id,delta_minor) VALUES(%s,%s,%s)", (
            cursor.lastrowid, entry["wallet_id"], -entry["delta_minor"]))
    execute(db, "INSERT INTO pending_events(user_id) VALUES(%s)", (current_id,))
    return cursor.lastrowid


@app.post("/transactions/{transaction_id}/reverse")
def reverse(transaction_id: int, current: User):
    with database("ledger") as db:
        execute(db, "START TRANSACTION")
        return {"reversal_id": reverse_in_db(db, transaction_id, current["id"])}


@app.post("/transactions/{transaction_id}/adjust")
def adjust(transaction_id: int, payload: Transaction, current: User):
    with database("ledger") as db:
        execute(db, "START TRANSACTION")
        reversal_id = reverse_in_db(db, transaction_id, current["id"])
        return {"reversal_id": reversal_id, "replacement": insert_transaction(db, current["id"], payload)}


@app.post("/transfers", status_code=201)
def transfer(payload: Transfer, current: User):
    with database("ledger") as db:
        execute(db, "START TRANSACTION")
        source = owned(db, "wallets", payload.from_wallet, current["id"])
        target = owned(db, "wallets", payload.to_wallet, current["id"])
        require(source["id"] != target["id"], "Hai ví phải khác nhau")
        require(source["active"] and target["active"], "Ví đã ngừng dùng")
        same_currency = source["currency"] == target["currency"]
        require(same_currency or payload.received_amount is not None, "Ví khác tiền tệ cần nhập số tiền thực nhận")
        require(not same_currency or payload.received_amount is None, "Ví cùng tiền tệ không cần số tiền thực nhận")
        amount = money(payload.amount, source["currency"])
        received = amount if same_currency else money(payload.received_amount, target["currency"])
        note = "Chuyển giữa ví" if same_currency else f"Chuyển {source['currency']} sang {target['currency']}"
        cursor = execute(db, "INSERT INTO transactions(user_id,wallet_id,kind,amount_minor,currency,occurred_on,note) VALUES(%s,%s,%s,%s,%s,%s,%s)", (
            current["id"], source["id"], "transfer", amount, source["currency"], payload.occurred_on.isoformat(), note))
        many(db, "INSERT INTO entries(transaction_id,wallet_id,delta_minor) VALUES(%s,%s,%s)", (
            (cursor.lastrowid, source["id"], -amount), (cursor.lastrowid, target["id"], received)))
        return {"id": cursor.lastrowid, "amount_minor": amount, "received_minor": received, "received_currency": target["currency"]}


def transaction_list(user_id, start, end, limit, offset):
    require(start <= end, "Khoảng thời gian không hợp lệ")
    with database("ledger") as db:
        return rows(db, "SELECT id,wallet_id,category_id,kind,amount_minor,currency,occurred_on,note,reversal_of FROM transactions "
                    "WHERE user_id=%s AND occurred_on>=%s AND occurred_on<=%s ORDER BY occurred_on,id LIMIT %s OFFSET %s", (
                        user_id, start.isoformat(), end.isoformat(), limit, offset))


@app.get("/transactions")
def transactions(current: User, start: date = date(2000, 1, 1), end: date = date(2100, 1, 1),
                 limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0)):
    return transaction_list(current["id"], start, end, limit, offset)


@app.get("/internal/transactions/{user_id}")
def internal_transactions(user_id: int, access: Internal, start: date = date(2000, 1, 1),
                          end: date = date(2100, 1, 1), offset: int = Query(0, ge=0)):
    return transaction_list(user_id, start, end, 500, offset)


@app.post("/internal/dispatch")
async def dispatch(access: Internal):
    with database("ledger") as db:
        events = rows(db, "SELECT id,user_id FROM pending_events WHERE sent=0 ORDER BY id LIMIT 30")
    events_by_user = {}
    for event in events:
        events_by_user.setdefault(event["user_id"], []).append(event["id"])

    for user_id, event_ids in events_by_user.items():
        try:
            await peer("planning", "POST", f"/internal/evaluate/{user_id}")
            with database("ledger") as db:
                many(db, "UPDATE pending_events SET sent=1,last_error='' WHERE id=%s",
                     [(event_id,) for event_id in event_ids])
        except Exception as error:
            with database("ledger") as db:
                many(db, "UPDATE pending_events SET last_error=%s WHERE id=%s",
                     [(str(error)[:300], event_id) for event_id in event_ids])
    return {"processed": len(events)}
