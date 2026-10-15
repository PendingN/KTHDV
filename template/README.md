# Giao diện KTHDV

Giao diện Next.js cho 6 service của dự án. Hướng dẫn cài đặt và chạy toàn hệ thống nằm trong [README chính](../README.md).

## Chạy riêng giao diện

Yêu cầu Node.js từ 20.9 và các backend đã chạy.

```powershell
npx.cmd --yes pnpm@10.32.1 install --frozen-lockfile
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

Mở `http://127.0.0.1:3000`. `PORT_BASE` phải trùng backend, mặc định `8001`.

## Cấu trúc

- `src/app`: trang, bố cục và API chuyển tiếp tới backend.
- `src/components/finance`: các màn hình dùng dữ liệu thật từ API.
- `src/components/ui`: thành phần giao diện đang được sử dụng.
- `src/lib`: kiểu dữ liệu, phiên đăng nhập, kiểm soát API và định dạng tiền.
- `tests`: kiểm tra tiền tệ, phân quyền API và luồng trình duyệt.

Các chức năng hiện tại: đăng ký/đăng nhập, tổng quan, ví/danh mục, thu chi, chuyển tiền, ngân sách/mục tiêu, khoản định kỳ, thông báo, quy đổi, báo cáo CSV và hồ sơ.

## Kiểm tra

```powershell
npm.cmd run lint
node node_modules/typescript/bin/tsc --noEmit
npm.cmd run build
npm.cmd test
```

Test dùng Node.js 24 và API giả lập, không ghi vào MySQL.

Giao diện được phát triển từ [Shadcn Fintech của Abderrahim Ghazali](https://github.com/abderrahimghazali/shadcn-fintech), giữ [giấy phép MIT](LICENSE).
