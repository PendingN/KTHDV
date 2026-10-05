# KTHDV – Quản lý tài chính cá nhân

Ứng dụng gồm 6 service:

- Python/FastAPI: Identity `8001`, Ledger `8002`
- JavaScript/Node.js: Planning `8003`, Recurring `8004`
- PHP: FX `8005`, Reporting `8006`

## Cài đặt

Yêu cầu: Python, Node.js, PHP có PDO MySQL và MySQL/MariaDB.

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm.cmd install --prefix javascript
Copy-Item config.example.json config.local.json
```

Sửa `config.local.json` nếu thông tin MySQL khác mặc định.

## Chạy

```powershell
.\.venv\Scripts\python.exe run.py --create-admin --email admin@example.com
.\.venv\Scripts\python.exe run.py
```

Mở `http://127.0.0.1:8001/admin`. Dùng `Ctrl+C` để dừng.

Chạy riêng một service:

```powershell
.\.venv\Scripts\python.exe run.py --service identity
```

Không commit `config.local.json` hoặc `data/internal.key`.
