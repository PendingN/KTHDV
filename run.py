import argparse
import getpass
import importlib
import os
import secrets
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pymysql

from python.common import NAMES, PORT_BASE, ROOT, database, execute, initialize, password_hash

MEMBERS = {"1": NAMES[:2], "2": NAMES[2:4], "3": NAMES[4:]}


def php_executable():
    executable = os.getenv("PHP_EXE") or shutil.which("php")
    if not executable and Path("C:/xampp/php/php.exe").is_file():
        executable = "C:/xampp/php/php.exe"
    if not executable:
        raise SystemExit("Không tìm thấy PHP. Đặt biến PHP_EXE trỏ tới php.exe.")
    return executable


def command(name, setup=False):
    if name not in NAMES:
        raise ValueError("Service không hợp lệ")
    port = int(os.getenv("PORT_BASE", "8001")) + NAMES.index(name)
    if name in MEMBERS["1"]:
        if setup:
            raise ValueError("Setup Python bằng initialize")
        return [sys.executable, "-m", "uvicorn", f"python.{name}.main:app",
                "--host", "127.0.0.1", "--port", str(port), "--log-level", "warning"]
    if name in MEMBERS["2"]:
        node = shutil.which("node")
        if not node:
            raise SystemExit("Cần cài Node.js để chạy thành viên 2.")
        result = [node, str(ROOT / "javascript" / name / "main.js")]
    else:
        router = str(ROOT / "php" / name / "index.php")
        result = [php_executable(), router] if setup else [php_executable(), "-d", "date.timezone=Asia/Ho_Chi_Minh",
                    "-S", f"127.0.0.1:{port}", router]
    return result + (["--setup"] if setup else [])


def admin_command():
    node = shutil.which("node")
    if not node:
        raise SystemExit("Cần cài Node.js để chạy trang admin.")
    return [node, str(ROOT / "giao_dien" / "main.js")]


def frontend_command():
    node = shutil.which("node")
    entry = ROOT / "template" / "node_modules" / "next" / "dist" / "bin" / "next"
    if not node or not entry.is_file():
        raise SystemExit("Thiếu frontend. Chạy: npx.cmd --yes pnpm@10.32.1 --dir template install --frozen-lockfile")
    return [node, str(entry), "dev", "--hostname", "127.0.0.1", "--port", os.getenv("FRONTEND_PORT", "3000")]


def check_ports(names, include_ui):
    ports = [(name, PORT_BASE + NAMES.index(name)) for name in names]
    if include_ui:
        try:
            ports += [("frontend", int(os.getenv("FRONTEND_PORT", "3000"))),
                      ("admin", int(os.getenv("ADMIN_PORT", "8090")))]
        except ValueError:
            raise SystemExit("FRONTEND_PORT và ADMIN_PORT phải là số nguyên.") from None
    if any(not 1 <= port <= 65535 for _, port in ports):
        raise SystemExit("Cổng phải nằm trong khoảng 1–65535.")
    if len({port for _, port in ports}) != len(ports):
        raise SystemExit("Cấu hình cổng bị trùng giữa các service/giao diện.")

    occupied = []
    for name, port in ports:
        with socket.socket() as probe:
            if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            try:
                probe.bind(("127.0.0.1", port))
            except OSError:
                occupied.append(f"{name}: {port}")
    if occupied:
        raise SystemExit(
            "Không khởi động thêm vì các cổng đang được sử dụng: " + ", ".join(occupied)
            + ".\nNếu KTHDV đã chạy, hãy dùng bản đang mở. Muốn chạy lại, nhấn Ctrl+C ở cửa sổ cũ trước."
            + "\nCó thể đổi PORT_BASE, FRONTEND_PORT và ADMIN_PORT nếu cổng thuộc ứng dụng khác."
        )


def stop_processes(processes):
    for process in processes:
        if process.poll() is None:
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True)
            else:
                process.terminate()
    for process in processes:
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


def main():
    os.environ.setdefault("PYTHONUTF8", "1")
    parser = argparse.ArgumentParser()
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument("--service", choices=NAMES)
    selection.add_argument("--member", choices=MEMBERS)
    parser.add_argument("--setup", action="store_true", help="Tạo database/bảng của phần được chọn")
    parser.add_argument("--create-admin", action="store_true")
    parser.add_argument("--email")
    args = parser.parse_args()
    names = [args.service] if args.service else MEMBERS[args.member] if args.member else NAMES
    if args.setup or args.create_admin:
        for name in NAMES if args.create_admin else names:
            if name in MEMBERS["1"]:
                app = importlib.import_module(f"python.{name}.main").app
                initialize(name, app.state.schema)
            else:
                subprocess.run(command(name, setup=True), cwd=ROOT, check=True)
        print("Đã tạo database MySQL cho các service được chọn.", flush=True)
        if args.create_admin:
            email = (args.email or input("Email admin: ")).strip().lower()
            password = os.getenv("ADMIN_PASSWORD") or getpass.getpass("Mật khẩu admin (ít nhất 8 ký tự): ")
            from python.identity.main import Register
            payload = Register(email=email, name="Admin", password=password)
            with database("identity") as db:
                existing = execute(db, "SELECT id,role FROM users WHERE email=%s", (email,)).fetchone()
                if existing:
                    if existing["role"] != "admin":
                        raise SystemExit("Email đã thuộc tài khoản người dùng. Chọn email admin khác.")
                    print("Admin đã tồn tại; giữ nguyên mật khẩu.")
                else:
                    execute(db, "INSERT INTO users(email,name,password,role) VALUES(%s,%s,%s,'admin')", (
                        payload.email, payload.name, password_hash(payload.password)))
                    print("Đã tạo admin. Dùng tài khoản này đăng nhập tại từng service.")
        return

    include_ui = not args.service and not args.member
    frontend = frontend_command() if include_ui else None
    admin = admin_command() if include_ui else None
    commands = [(name, command(name)) for name in names]
    check_ports(names, include_ui)
    try:
        with database() as db:
            execute(db, "SELECT 1")
    except pymysql.MySQLError:
        raise SystemExit("Chưa kết nối được MySQL. Bật MySQL trong XAMPP và kiểm tra config.local.json rồi chạy lại.") from None
    key_file = ROOT / "data" / "internal.key"
    key_file.parent.mkdir(exist_ok=True)
    if not key_file.exists():
        try:
            with key_file.open("x", encoding="utf-8") as stream:
                stream.write(secrets.token_urlsafe(32))
        except FileExistsError:
            pass
    os.environ.setdefault("INTERNAL_KEY", key_file.read_text(encoding="utf-8").strip())
    # PHP router kết nối database đã setup; Node/Python tự tạo bảng khi khởi động.
    for name in names:
        if name in MEMBERS["3"]:
            subprocess.run(command(name, setup=True), cwd=ROOT, check=True)
    processes = []
    try:
        if admin:
            processes.append(subprocess.Popen(admin, cwd=ROOT))
            print(f"admin: http://127.0.0.1:{os.getenv('ADMIN_PORT', '8090')}/admin", flush=True)
        for name, service_command in commands:
            port = PORT_BASE + NAMES.index(name)
            processes.append(subprocess.Popen(service_command, cwd=ROOT))
            print(f"{name}: http://127.0.0.1:{port}/admin", flush=True)
        if frontend:
            processes.append(subprocess.Popen(frontend, cwd=ROOT / "template"))
            print(f"user: http://127.0.0.1:{os.getenv('FRONTEND_PORT', '3000')}", flush=True)
        print("Ctrl+C để dừng. Runner kiểm tra cảnh báo/lịch nhắc của phần đang chạy mỗi 30 giây.", flush=True)
        next_check = time.monotonic() + 5
        with httpx.Client(timeout=15, trust_env=False) as client:
            while all(process.poll() is None for process in processes):
                if not args.service and time.monotonic() >= next_check:
                    for name, path in (("ledger", "/internal/dispatch"), ("recurring", "/internal/reminders/check")):
                        if name not in names:
                            continue
                        port = PORT_BASE + NAMES.index(name)
                        try:
                            result = client.post(f"http://127.0.0.1:{port}{path}", headers={"X-Service-Key": os.environ["INTERNAL_KEY"]})
                            result.raise_for_status()
                        except httpx.HTTPError:
                            print("Một lượt kiểm tra chưa hoàn tất; sẽ thử lại.", flush=True)
                    next_check = time.monotonic() + 30
                time.sleep(0.5)
        raise SystemExit("Một service đã dừng. Kiểm tra MySQL hoặc cổng đang bị chiếm.")
    except KeyboardInterrupt:
        print("Đang dừng các service...")
    finally:
        stop_processes(processes)


if __name__ == "__main__":
    main()
