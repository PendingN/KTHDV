# KTHDV – Quản lý tài chính cá nhân

Ứng dụng gồm 6 service:

- Python/FastAPI: Identity `8001`, Ledger `8002`
- JavaScript/Node.js: Planning `8003`, Recurring `8004`
- PHP: FX `8005`, Reporting `8006`
- Next.js trang người dùng: `3000`
- Node.js admin console: `8090`

## Cài đặt

Yêu cầu: Python, Node.js, PHP có PDO MySQL và MySQL/MariaDB.

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm.cmd install --prefix javascript
npx.cmd --yes pnpm@10.32.1 --dir template install --frozen-lockfile
Copy-Item config.example.json config.local.json
```

Sửa `config.local.json` nếu thông tin MySQL khác mặc định.

## Chạy

```powershell
.\.venv\Scripts\python.exe run.py --create-admin --email admin@example.com
.\.venv\Scripts\python.exe run.py
```

Mở `http://127.0.0.1:3000` để đăng ký, đăng nhập và sử dụng dịch vụ. Trang quản trị: `http://127.0.0.1:8090/admin`. Dùng `Ctrl+C` để dừng cả frontend và các service.

Bật MySQL trong XAMPP trước khi chạy. Chỉ mở một cửa sổ chạy toàn hệ thống; muốn chạy lại, nhấn `Ctrl+C` ở cửa sổ cũ. Runner kiểm tra các cổng và kết nối MySQL trước khi khởi động để tránh chạy dở dang.

Nếu cổng mặc định thuộc ứng dụng khác, đổi cổng trong cùng cửa sổ PowerShell rồi chạy:

```powershell
$env:PORT_BASE = "18001"     # 6 API: 18001–18006
$env:FRONTEND_PORT = "3100"
$env:ADMIN_PORT = "8190"
.\.venv\Scripts\python.exe run.py
```

Khi đó mở `http://127.0.0.1:3100` và trang admin `http://127.0.0.1:8190/admin`.

Chạy riêng frontend khi các API đã chạy:

```powershell
npm.cmd --prefix template run dev -- --hostname 127.0.0.1 --port 3000
```

Frontend dùng `PORT_BASE` giống backend (mặc định `8001`). Cần Node.js từ 20.9 trở lên. Quy đổi dùng tỷ giá do admin nhập; góp mục tiêu và đánh dấu khoản định kỳ đã thanh toán chỉ ghi nhận theo dõi, không tự tạo giao dịch ví.

Có thể chạy riêng giao diện admin:

```powershell
node giao_dien/main.js
```

Trang HTML bổ sung từ remote vẫn có tại `http://127.0.0.1:8001/app` khi chạy Identity.

Chạy riêng một service:

```powershell
.\.venv\Scripts\python.exe run.py --service identity
```

Không commit `config.local.json` hoặc `data/internal.key`.

## Kiểm thử

```powershell
npm.cmd --prefix template run lint
node template/node_modules/typescript/bin/tsc --noEmit --project template/tsconfig.json
npm.cmd --prefix template run build
npm.cmd --prefix template test
npm.cmd --prefix javascript test
node javascript/recurring/main.js --self-test
node --test giao_dien/*.test.cjs
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py"
```

Các test tự động dùng Node.js 24; test frontend khởi động bản build trên cổng `3011` và API giả lập `18101–18106`. Các test này không ghi vào MySQL; test PHP cần PHP có cURL.

Kiểm thử trình duyệt (Chrome đã cài, frontend và 6 API đang chạy):

```powershell
npm.cmd install --prefix tmp/browser-tools --no-save playwright@1.58.2
node template/tests/browser-smoke.mjs
```

Kiểm thử trình duyệt tạo tài khoản `qa.frontend.*@example.test` và `qa.isolation.*@example.test` với dữ liệu mẫu riêng; ảnh và kết quả nằm trong `tmp/frontend*`.
