# Quản lý tài chính cá nhân với 6 service

Bản thực hành chia cho 3 thành viên, mỗi người 2 service và một ngôn ngữ. Python dùng FastAPI; JavaScript dùng Node.js HTTP thuần; PHP dùng PDO MySQL. Mỗi service chạy ở một tiến trình, một cổng và một database riêng. Trang admin dùng HTML, CSS và JavaScript thuần.

## Chia việc cho 3 người

| Thành viên | Ngôn ngữ | Hai service | Thư mục |
| --- | --- | --- | --- |
| 1 | Python | Identity, Ledger | thanh_vien_1_python |
| 2 | JavaScript | Planning, Recurring | thanh_vien_2_javascript |
| 3 | PHP | FX, Reporting | thanh_vien_3_php |

Chỉ dùng README này để hướng dẫn cả nhóm. `giao_dien/admin.html` dùng chung; `run.py` khởi động các service, không xử lý nghiệp vụ thay cho Node/PHP. Mỗi người phụ trách code, dữ liệu/ERD, admin và báo cáo của hai service mình nhận. Người 3 có thể phụ trách thêm tổng hợp báo cáo và demo tích hợp để cân công việc. Chưa điền tên thành viên thật.

## Sáu phần được chọn

| Phần | Chức năng chính | Use Case gốc | Cổng | Database mặc định |
| --- | --- | --- | --- | --- |
| Identity | Đăng ký, đăng nhập, đăng xuất, khóa tài khoản | UC01, chưa có 2FA | 8001 | kthdv_identity |
| Ledger | Ví, danh mục, thu/chi, tra cứu, hủy/điều chỉnh | UC03–UC07 | 8002 | kthdv_ledger |
| Planning | Ngân sách, cảnh báo, mục tiêu và tích lũy | UC08, UC09, UC15 | 8003 | kthdv_planning |
| Recurring | Khoản định kỳ, nhắc hạn, thông báo, gợi ý | UC10–UC12 | 8004 | kthdv_recurring |
| FX | Nhập tỷ giá và quy đổi ngoại tệ | UC13; UC18 chưa tích hợp nhà cung cấp | 8005 | kthdv_fx |
| Reporting | Dashboard, báo cáo, so sánh kỳ, xuất CSV | UC14, UC16, UC17 | 8006 | kthdv_reporting |

Service Python có `main.py` chứa SQL/model/nghiệp vụ. Service JavaScript có `main.js`, service PHP có `index.php`; bốn service này có `service.json` chứa SQL, truy vấn bảng admin và form mẫu. Mỗi ngôn ngữ có file common riêng cho kết nối DB, xác thực và gọi HTTP. Các service không đọc bảng của nhau; Reporting lấy giao dịch qua Ledger API. Tiền và tỷ giá không dùng float để ghi vào DB; PHP dùng BCMath, JavaScript chuyển tiền sang số nguyên đơn vị nhỏ nhất và kiểm tra giới hạn an toàn.

Bảng dữ liệu để trình bày ERD: Identity (`users`, `sessions`); Ledger (`wallets`, `categories`, `transactions`, `entries`, `pending_events`); Planning (`budgets`, `alerts`, `goals`, `goal_contributions`); Recurring (`subscriptions`, `payments`, `notifications`); FX (`rates`); Reporting (`report_requests`). Không tạo FK xuyên database; tham chiếu giữa các service được kiểm tra qua API.

Các chức năng bổ sung so với bộ Use Case hiện tại: chuyển tiền giữa hai ví cùng tiền tệ, chống ghi trùng thu/chi bằng `Idempotency-Key`, lịch sử tích lũy mục tiêu, xuất CSV. Đây là đề xuất thực hiện thêm, không phải yêu cầu mới được thầy xác nhận.

## Hiểu yêu cầu về ngôn ngữ

Trong đoạn trao đổi đã cung cấp, thầy cho phép nhiều service cùng một ngôn ngữ hoặc nhiều ngôn ngữ khác nhau. Chưa có bằng chứng yêu cầu bắt buộc mỗi thành viên dùng một ngôn ngữ riêng; câu “đều tính điểm cộng” không xác định chỉ cách dùng nhiều ngôn ngữ mới được cộng điểm.

FastAPI là framework của Python, không phải tên chung của mọi REST API. Hai service JavaScript và hai service PHP hiện giao tiếp qua HTTP/JSON với Python; các phần này không gọi là FastAPI.

Lộ trình “bằng tay → framework → hướng dịch vụ” được hiểu là tự xây nghiệp vụ/API cơ bản, chuyển lên framework rồi tích hợp các service. Hiện Python có bản framework, Node/PHP có bản HTTP/code thuần, cả ba đã tích hợp SOA. Chưa có cả hai phiên bản thuần và framework riêng cho từng ngôn ngữ; không coi lộ trình này đã hoàn thành đầy đủ. Đoạn chat chưa quy định phải nộp riêng bao nhiêu phiên bản ở mỗi bước.

## Chạy trên Windows PowerShell

Bật MySQL trong XAMPP Control Panel hoặc bật MySQL Server đã cài. XAMPP trên máy đang dùng MariaDB 10.4.32, kết nối qua giao thức MySQL; mã nguồn dùng PyMySQL và InnoDB. Không cần bật Apache.

Tại thư mục dự án:

```powershell
Set-Location 'C:\Users\anh\Documents\ChatGPT\KTHDV'
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm.cmd install --prefix thanh_vien_2_javascript
Copy-Item config.example.json config.local.json
```

Nếu đã có `config.local.json`, giữ file hiện tại, không chạy lại lệnh Copy-Item. Sửa host, port, user, password trong file theo MySQL của bạn. Mặc định dùng cấu hình XAMPP local: `127.0.0.1:3306`, user `root`, mật khẩu rỗng. Tài khoản DB cần quyền tạo sáu database khi setup. Giữ nguyên sáu database đã có, không xóa dữ liệu khi đổi ngôn ngữ.

Cần Node.js (máy hiện tại có v24.21.0) và PHP với PDO MySQL, cURL, BCMath, mbstring. Runner tìm PHP trong PATH hoặc `C:\xampp\php\php.exe`; đặt biến `PHP_EXE` nếu dùng chỗ khác. Không cần Apache, Composer hoặc Docker.

Tạo database và tài khoản admin; chương trình hỏi mật khẩu, không có mật khẩu admin mặc định:

```powershell
.\.venv\Scripts\python.exe run.py --create-admin --email admin@example.com
.\.venv\Scripts\python.exe run.py
```

Mở `http://127.0.0.1:8001/admin`. Sáu trang dùng cùng tài khoản admin nhưng lưu phiên riêng theo từng cổng, nên chuyển sang trang service khác thì đăng nhập lại. Python `/docs` có Swagger; Node/PHP `/docs` chỉ liệt kê thao tác API mẫu bằng JSON, chưa có Swagger/OpenAPI đầy đủ. Trang admin dùng được cho cả ba ngôn ngữ.

Nhấn Ctrl+C tại terminal chạy `run.py` để dừng các service. Chạy lại không xóa dữ liệu. Khóa nội bộ được tạo ở `data/internal.key` và không đưa lên Git. `config.local.json` cũng được bỏ qua bởi Git.

## Chạy từng phần riêng

Chạy theo thành viên, mỗi lệnh một terminal tại thư mục gốc:

```powershell
.\.venv\Scripts\python.exe run.py --member 1
.\.venv\Scripts\python.exe run.py --member 2
.\.venv\Scripts\python.exe run.py --member 3
```

Ba lệnh này ghép đủ sáu service. Hoặc chỉ dùng `run.py` để chạy cả nhóm. Không chạy đồng thời hai cách vì sẽ trùng cổng. Mỗi người sửa code trong thư mục mình, không cần sao chép service của người khác.

Chạy từ thư mục gốc, mỗi lệnh ở một terminal riêng:

```powershell
.\.venv\Scripts\python.exe run.py --service identity
.\.venv\Scripts\python.exe run.py --service ledger
.\.venv\Scripts\python.exe run.py --service planning
.\.venv\Scripts\python.exe run.py --service recurring
.\.venv\Scripts\python.exe run.py --service fx
.\.venv\Scripts\python.exe run.py --service reporting
```

Identity cần chạy để các phần còn lại xác thực. Planning và Reporting cần Ledger. Cảnh báo Planning cần Recurring để lưu thông báo. FX hoạt động với Identity và database tỷ giá riêng.

Khi chạy toàn bộ hoặc theo thành viên, runner tự kiểm tra sự kiện ngân sách/lịch nhắc của phần đang chạy mỗi 30 giây. Khi chạy một service riêng bằng `--service`, bấm “Kiểm tra và gửi cảnh báo” ở Planning hoặc “Kiểm tra lịch nhắc ngay” ở Recurring. Terminal runner phải còn mở để chạy tự động.

Có thể đổi `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_PREFIX`, `PORT_BASE` bằng biến môi trường. Các service khác máy dùng các biến `IDENTITY_URL`, `LEDGER_URL`, `PLANNING_URL`, `RECURRING_URL`, `FX_URL`, `REPORTING_URL` và cùng `INTERNAL_KEY`. Bản mặc định chỉ lắng nghe trên localhost.

## Thao tác demo

1. Đăng nhập Ledger. Tạo ví VND và hai danh mục `income`/`expense`; ghi lại ID trong bảng.
2. Ghi khoản thu để có số dư, rồi tạo ngân sách ở Planning cho danh mục chi đó.
3. Ghi một khoản chi làm ngân sách đạt 80%; kiểm tra cảnh báo ở Planning và xem thông báo ở Recurring.
4. Hủy hoặc điều chỉnh khoản chi bằng ID gốc. Ledger giữ giao dịch cũ và thêm bút toán đảo; số dư và báo cáo tính cả số đảo để triệt tiêu số tiền cũ.
5. Tạo mục tiêu, thêm tích lũy và xem tiến độ. Tích lũy là ghi chú kế hoạch, không tự chuyển tiền giữa ví.
6. Tạo khoản định kỳ, chọn ngày đến hạn gần hôm nay, kiểm tra nhắc hạn. Đánh dấu đã thanh toán chỉ cập nhật lịch theo dõi; nếu cần ghi tiền chi thì nhập riêng tại Ledger.
7. Admin nhập một tỷ giá mẫu tại FX, sau đó quy đổi. Tỷ giá mẫu là dữ liệu nhập tay, không đại diện tỷ giá thị trường.
8. Mở Reporting, chọn thời gian ngay trong đường dẫn API, xem báo cáo và tải CSV.

Các form có sẵn dữ liệu ví dụ tháng 10/2026; cần thay ngày và các ID bằng dữ liệu thực tế. API kiểm tra loại danh mục, quyền sở hữu, số tiền dương và độ chính xác theo tiền tệ. USD/EUR dùng cent; VND/JPY dùng đơn vị nguyên. Dữ liệu tiền được lưu bằng số nguyên đơn vị nhỏ nhất, không dùng float để ghi tiền.

## Kiểm thử

```powershell
.\.venv\Scripts\python.exe test_smoke.py
```

Kiểm thử chạy sáu tiến trình thật ở cổng 18001–18006, tạo sáu database có tiền tố ngẫu nhiên `kthdv_test_...`, rồi chỉ xóa đúng các database test do lần chạy đó tạo. Không xóa database `kthdv_...` của ứng dụng.

Đã chạy qua kiểm thử HTTP/MySQL với đủ ba ngôn ngữ: phân quyền admin, khóa tài khoản và hủy phiên, thu/chi, chống trùng, rollback khi điều chỉnh lỗi, chuyển ví, dữ liệu tiền tệ, mức ngân sách và chống lặp thông báo, tích lũy mục tiêu, nhắc hạn, xử lý cuối tháng, quy đổi BCMath, báo cáo/CSV, lỗi khi Ledger dừng và lưu dữ liệu sau khi Ledger khởi động lại. Không coi các kiểm thử này là bằng chứng hoàn thành toàn bộ UR/SR của môn học.

## Phạm vi hiện tại

- Có API và trang admin cơ bản cho đủ sáu phần; dữ liệu lưu MySQL. Chưa có trang người dùng đầy đủ hoặc biểu đồ đẹp.
- Chưa có 2FA, gửi email/SMS, nhà cung cấp tỷ giá trực tiếp, UC19 sao lưu và UC20 khôi phục dữ liệu.
- Dashboard là số dư ví và thu/chi theo từng tiền tệ. Chưa có mô hình khoản nợ nên không gọi tổng số dư này là tài sản ròng đầy đủ.
- Chuyển ví chỉ cùng tiền tệ, chưa hủy/điều chỉnh chuyển ví, chưa có kiểm tra cấm số dư âm. Idempotency-Key hiện chỉ áp dụng tạo thu/chi, chưa áp dụng mọi thao tác ghi.
- Gợi ý khoản định kỳ dùng quy tắc cùng nội dung, cùng số tiền, xuất hiện ít nhất ba lần cách nhau khoảng một tháng; chưa phải thuật toán AI và chưa có luồng xác nhận/từ chối gợi ý lưu riêng.
- Lịch nhắc gửi một thông báo trong ứng dụng cho mỗi kỳ đến hạn; không coi trạng thái gửi thành công là người dùng đã đọc. Khoản đến hạn quá lâu cần đánh dấu từng kỳ hoặc sửa lịch.
- Bản học tập dùng chung thư viện và khóa giao tiếp nội bộ; trước khi đưa ra Internet cần tài khoản DB riêng cho từng service, HTTPS và kiểm soát quyền giao tiếp chi tiết hơn.

## Đối chiếu tài liệu gốc

`Usecase&UML/UC.docx` là căn cứ về tên và nội dung nghiệp vụ. `Diagram/` có các luồng giao dịch/ngân sách, đảo giao dịch, nhắc định kỳ và báo cáo. Các ảnh gốc được giữ nguyên.

Những điểm cần sửa trong tài liệu: `UC13.png` là ảnh trắng nhỏ; `UC14.png` đang mô tả nhắc thanh toán thay vì dashboard; `UC08-09.png` và `UC10-11.png` có actor “Tour Guide”; sơ đồ gộp UC15–UC20 gán báo cáo cho Admin trong khi bảng UC ghi chức năng này cho người dùng. UC17 trong bảng chưa có SR tương ứng. Sơ đồ ghi chi nên kiểm tra dữ liệu trước khi lưu; bước nhận nhắc định kỳ cần phân biệt bộ lập lịch, bộ xử lý và người nhận thông báo.

Tài liệu kỹ thuật: [FastAPI cho Python](https://fastapi.tiangolo.com/), [kết nối MySQL bằng PyMySQL](https://pymysql.readthedocs.io/en/latest/user/examples.html), [khóa bản ghi khi cập nhật trong MySQL](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html).
