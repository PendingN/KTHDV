# Báo cáo và hướng dẫn thuyết trình sáu dịch vụ KTHDV

Tài liệu đọc hiểu cho ba người thuyết trình • Đối chiếu mã nguồn ngày 16 tháng 10 năm 2026

Hệ thống KTHDV hỗ trợ quản lý tài chính cá nhân qua sáu dịch vụ: xác thực người dùng, ghi nhận thu chi, lập kế hoạch, theo dõi khoản định kỳ, quy đổi tiền tệ và tổng hợp báo cáo. Tài liệu này giúp mỗi người hiểu hai dịch vụ, giải thích được chúng liên kết với nhau như thế nào và biết mở đoạn mã nào khi cần minh họa.

**Cách chia đề xuất:** Người 1 trình bày Identity và Ledger; Người 2 trình bày Planning và Recurring; Người 3 trình bày FX và Reporting. Mạch kể đi từ đăng nhập và ghi tiền, đến theo dõi kế hoạch, rồi đọc kết quả tài chính. Đây là cách chia để thuyết trình, không phải thay đổi người đã thực hiện mã nguồn.

**Phạm vi kiểm chứng:** Nội dung được đối chiếu trực tiếp với mã nguồn đang có trong thư mục dự án, kể cả thay đổi chưa commit. Các số tiền và kết quả dưới đây là ví dụ tính toán minh họa, không phải dữ liệu thật hoặc biên bản chạy thử. Chưa chạy lại toàn bộ sáu dịch vụ và MySQL trong lần biên soạn này.

## Cách sử dụng tài liệu

1. Cả ba người đọc phần Tổng quan để thống nhất thuật ngữ và câu chuyện.
2. Mỗi người đọc kỹ phần được giao, nhất là mục Luồng xử lý và Điểm cần nói chính xác.
3. Mở mã nguồn theo đúng thứ tự được chỉ dẫn. Với mỗi hàm, trả lời bốn câu: nhận gì, kiểm tra gì, đọc hoặc ghi ở đâu, trả gì.
4. Dùng lời trình bày mẫu làm khung nói, sau đó diễn đạt bằng lời của mình. Các đoạn mẫu là bản rút gọn; phần giải thích và demo mới tạo thành toàn bộ thời lượng.
5. Cùng tập kịch bản liên hoàn ở cuối tài liệu. Trước buổi trình bày, chạy thử bằng một tài khoản demo riêng và ghi lại kết quả thực tế.

## Tổng quan và cách chia ba phần

### Phân chia nội dung thuyết trình

| Người trình bày | Hai dịch vụ | Câu hỏi chính cần trả lời | Thời lượng gợi ý |
| --- | --- | --- | --- |
| Người 1 | Identity và Ledger | Ai đang sử dụng và tiền được ghi nhận thế nào | 7 phút |
| Người 2 | Planning và Recurring | Đã chi bao nhiêu so với kế hoạch và sắp phải trả khoản gì | 7 phút |
| Người 3 | FX và Reporting | Quy đổi thế nào và xem kết quả thu chi ra sao | 6 phút |

Mốc 20 phút là đề xuất để tập nói, chưa phải yêu cầu thời gian của giảng viên. Nếu chỉ có 12 phút, mỗi người nói khoảng 4 phút, giữ một luồng xử lý và một ví dụ cho mỗi dịch vụ; dùng bảng API để trả lời câu hỏi thay vì đọc hết trên lớp.

Identity và Ledger liên quan vì mọi dữ liệu ví, danh mục và giao dịch phải gắn với một người dùng đã được xác thực. Planning và Recurring liên quan trực tiếp vì Planning nhờ Recurring lưu thông báo ngân sách. FX và Reporting cùng phục vụ việc đọc số liệu tài chính và cùng viết bằng PHP; **Reporting hiện chưa gọi FX**, vì vậy không vẽ mũi tên trực tiếp giữa hai dịch vụ này.

Trong `KTHDV.docx`, phân công thực hiện được ghi như sau. Nhóm giữ bảng này khi cần nói ai đã làm phần nào; thứ tự nói đề xuất ở trên là một mục đích khác.

| Thành viên trong báo cáo gốc | MSSV | Phần thực hiện ghi trong báo cáo gốc |
| --- | --- | --- |
| Nguyễn Thị Thanh Loan | 52400288 | Identity và FX |
| Vũ Thuỳ Linh | 52400079 | Planning và Recurring |
| Hà Tuấn Anh | 52400066 | Ledger và Reporting |

Nếu cần mỗi người trình bày đúng phần đã thực hiện, có thể giữ ba cặp trong bảng gốc. Ledger và Reporting liên hệ rất chặt; Identity và FX ít liên quan về nghiệp vụ, nhưng vẫn có thể trình bày nối tiếp. Tài liệu chi tiết từng dịch vụ bên dưới dùng được cho cả hai cách phân chia.

### Sáu dịch vụ trong một câu chuyện

Ví dụ, một sinh viên muốn ghi lại 2.000.000 đồng tiền sinh hoạt, khoản chi ăn uống và lịch đóng Internet. Identity xác định tài khoản của sinh viên. Ledger lưu tiền vào, tiền ra và số dư ví. Planning so sánh chi ăn uống với ngân sách. Recurring nhắc lịch Internet và hiển thị thông báo. FX giúp tính một khoản ngoại tệ theo tỷ giá đã nhập. Reporting tổng hợp thu chi từ Ledger để người dùng xem lại.

| Dịch vụ | Ý nghĩa dễ nhớ | Công nghệ API hiện tại | Cổng mặc định |
| --- | --- | --- | --- |
| Identity | Tài khoản và phiên đăng nhập | Python với FastAPI và Uvicorn | 8001 |
| Ledger | Sổ thu chi và biến động ví | Python với FastAPI và Uvicorn | 8002 |
| Planning | Ngân sách và mục tiêu | Node.js với thư viện `node:http` | 8003 |
| Recurring | Khoản định kỳ và thông báo | Node.js với thư viện `node:http` | 8004 |
| FX | Tỷ giá và quy đổi | PHP thuần với PDO và BCMath | 8005 |
| Reporting | Tổng hợp và xuất báo cáo | PHP thuần với PDO và BCMath | 8006 |

Node.js hiện dùng bộ HTTP có sẵn, không dùng Express. PHP hiện dùng bộ định tuyến tự viết và máy chủ `php -S`, không dùng Laravel. Sáu dịch vụ trao đổi chủ yếu bằng HTTP và JSON, nên không cần viết cùng ngôn ngữ. CSV là một dạng phản hồi riêng ở chức năng xuất báo cáo.

Giao diện người dùng Next.js nằm ở cổng 3000; trang quản trị Node.js nằm ở cổng 8090. Đây là hai thành phần giao diện và chuyển tiếp yêu cầu, không được tính thành dịch vụ nghiệp vụ thứ bảy và thứ tám. Cổng có thể thay đổi bằng cấu hình môi trường.

### Luồng liên kết cần nhớ

**Luồng thao tác người dùng:** Trình duyệt → Next.js `/api/{service}/...` → dịch vụ tương ứng → cơ sở dữ liệu của dịch vụ. Khi cần xác thực, dịch vụ nghiệp vụ hỏi Identity qua `/auth/me`.

**Luồng cảnh báo ngân sách:** Ledger lưu giao dịch và việc cần xử lý → `run.py` gọi Ledger dispatch → Ledger gọi Planning → Planning đọc lịch sử Ledger → Planning gửi thông báo sang Recurring → người dùng mở danh sách thông báo.

**Luồng đọc số liệu:** Reporting → Ledger để lấy giao dịch và ví. Recurring → Ledger để tìm mẫu chi lặp lại. FX đọc bảng tỷ giá của chính mình để quy đổi.

Mũi tên trong các câu trên biểu thị bên khởi tạo lời gọi hoặc bước tiếp theo. Riêng luồng cảnh báo có nhiều lần trao đổi hai chiều: Planning gọi Ledger để lấy dữ liệu, sau đó nhận dữ liệu trả về. Đây là chuỗi HTTP, chưa có RabbitMQ hoặc Kafka.

### Những thuật ngữ cần hiểu trước

| Thuật ngữ | Diễn giải trong dự án |
| --- | --- |
| API và endpoint | Cửa tiếp nhận một yêu cầu, ví dụ `POST /transactions` để tạo giao dịch |
| GET và POST | GET thường lấy dữ liệu; POST thực hiện tạo mới hoặc một thao tác nghiệp vụ |
| PUT và PATCH | PUT gửi bộ thông tin cập nhật; PATCH cập nhật một phần hoặc trạng thái theo route đã định nghĩa |
| Token | Chuỗi xác nhận phiên đăng nhập, được gửi tới API trong `Authorization: Bearer ...` |
| Xác thực và phân quyền | Xác thực xác định người dùng; phân quyền quyết định người đó được làm gì |
| Database transaction | Nhóm thao tác SQL cùng thành công hoặc cùng được hoàn tác khi lỗi |
| Giao dịch tài chính | Một bản ghi thu, chi, chuyển ví hoặc đảo giao dịch; khác với database transaction |
| Bút toán | Dòng tăng hoặc giảm tiền trong bảng `entries` của một ví |
| Idempotency | Gửi lại cùng yêu cầu với cùng khóa mà không chủ động tạo thêm giao dịch mới |
| Polling | Bộ chạy gọi API kiểm tra lặp lại theo thời gian, thay vì có máy chủ đẩy thông báo tức thì |

### Dữ liệu được chia như thế nào

Mỗi dịch vụ dùng một database riêng theo tiền tố mặc định `kthdv_`. Trong môi trường local, các database này có thể cùng nằm trên một máy chủ MySQL hoặc MariaDB. Vì vậy, “database riêng” không có nghĩa là đã có sáu máy chủ vật lý.

| Database mặc định | Các bảng được định nghĩa trong mã |
| --- | --- |
| `kthdv_identity` | `users`, `sessions` |
| `kthdv_ledger` | `wallets`, `categories`, `transactions`, `entries`, `pending_events` |
| `kthdv_planning` | `budgets`, `goals`, `goal_contributions`, `alerts` |
| `kthdv_recurring` | `subscriptions`, `payments`, `notifications` |
| `kthdv_fx` | `rates` |
| `kthdv_reporting` | `report_requests` |

Tổng cộng có 16 bảng trong định nghĩa hiện tại. Các khóa ngoại SQL chủ yếu nối bảng trong cùng một dịch vụ. Chẳng hạn, `user_id` trong Ledger tham chiếu người dùng về mặt nghiệp vụ nhưng không được khai báo thành khóa ngoại SQL sang database Identity. Khi trình bày ERD cần phân biệt quan hệ logic với ràng buộc SQL đã có.

## Phần 1 Identity và Ledger

### Mục tiêu của người trình bày thứ nhất

Giúp người nghe hiểu hai việc nền tảng: hệ thống nhận biết người đang dùng bằng cách nào và ghi nhận tiền của người đó ra sao. Dành khoảng 1 phút giới thiệu toàn hệ thống, 2 phút cho Identity, 3 phút cho Ledger và 1 phút demo hoặc chuyển ý.

### Identity quản lý người dùng và phiên đăng nhập

Identity chịu trách nhiệm đăng ký, đăng nhập, xác minh phiên, đăng xuất và cho admin khóa hoặc mở tài khoản người dùng. Có thể hình dung Identity là nơi cấp và kiểm tra thẻ ra vào cho hệ thống.

Bảng `users` lưu email, tên, mật khẩu đã băm, vai trò, trạng thái hoạt động và thông tin lần đăng nhập thất bại. Bảng `sessions` lưu mã băm token, người sở hữu và thời điểm hết hạn. Mật khẩu được băm bằng scrypt với salt; token ngẫu nhiên được băm SHA-256 trước khi lưu trong bảng phiên. Đây là hai loại dữ liệu khác nhau, dùng hai cách xử lý khác nhau.

#### Luồng đăng nhập từng bước

1. Người dùng nhập email và mật khẩu. Giao diện gửi tới API đăng nhập của Identity.
2. Hàm `login()` tìm tài khoản theo email và kiểm tra thời gian khóa tạm.
3. Hệ thống so sánh mật khẩu với giá trị đã băm và kiểm tra tài khoản còn hoạt động.
4. Nếu thông tin không hợp lệ, trả lỗi 401. Với tài khoản tồn tại, hệ thống tăng bộ đếm lỗi; từ lần thất bại thứ năm, đặt thời gian khóa thêm 120 giây. Yêu cầu đến trong thời gian đang khóa nhận 429.
5. Nếu hợp lệ, tạo token ngẫu nhiên, lưu mã băm token và thời hạn 8 giờ; đồng thời đặt lại bộ đếm lỗi.
6. API trả token và thời hạn phiên. Ở giao diện Next.js, máy chủ nhận token rồi lưu vào cookie `HttpOnly`, tên `kthdv_session`.
7. Khi trình duyệt gọi chức năng khác, Next.js đọc cookie và thêm Bearer token vào yêu cầu tới backend. Dịch vụ nghiệp vụ gọi Identity `/auth/me` để kiểm tra phiên.

Token hiện là chuỗi phiên ngẫu nhiên, **không phải JWT**. Không nên mô tả hệ thống là “giải mã JWT lấy user_id”. Identity tra bảng phiên để xác định người dùng. Đăng xuất xóa phiên hiện tại; khóa tài khoản xóa các phiên của tài khoản đó.

#### API chính của Identity

| Phương thức và đường dẫn | Công dụng | Điều kiện |
| --- | --- | --- |
| `POST /users` | Đăng ký tài khoản thường | Email, tên và mật khẩu hợp lệ |
| `POST /auth/login` | Tạo phiên đăng nhập | Thông tin đăng nhập đúng |
| `GET /auth/me` | Xem người dùng của phiên | Bearer token còn hiệu lực |
| `POST /auth/logout` | Xóa phiên hiện tại | Đang đăng nhập |
| `PATCH /users/{user_id}` | Khóa hoặc mở tài khoản | Admin; không khóa tài khoản admin |

Ví dụ đăng ký gửi `email`, `name`, `password`. Mật khẩu đăng ký phải dài từ 8 đến 128 ký tự. `role` không phải trường cho người đăng ký tự gửi để trở thành admin; tài khoản quản trị được tạo bằng chức năng riêng của runner.

#### Thứ tự đọc mã Identity

Mở `python/identity/main.py`, đọc `SCHEMA` trước để thấy hai bảng. Sau đó đọc các model `Register`, `Login`, `UserStatus` để hiểu dữ liệu đầu vào. Tiếp tục theo thứ tự `register()` → `login()` → `me()` → `logout()` → `set_status()`.

Cuối cùng mở `python/common.py`: `password_hash()` và `password_valid()` giải thích mật khẩu; `user()` giải thích việc kiểm tra phiên; `admin()` giải thích quyền quản trị. `User` trong chữ ký hàm FastAPI là dependency xác thực đã khai báo, không phải thông tin người dùng mà trình duyệt được tùy ý gửi lên.

**Câu tự kiểm tra:** Nếu chỉ đổi `user_id` trên trình duyệt thì có được xem dữ liệu người khác không? Luồng thông thường lấy danh tính từ phiên đã xác thực, còn thao tác vào bản ghi có kiểm tra chủ sở hữu. Không dựa riêng vào một `user_id` do khách gửi.

### Ledger ghi nhận tiền và tính số dư

Ledger quản lý ví, danh mục, giao dịch và các bút toán làm thay đổi ví. Đây là nguồn dữ liệu giao dịch mà Planning, Recurring và Reporting đọc qua API.

Bảng `wallets` mô tả ví và tiền tệ. `categories` phân loại thu hoặc chi. `transactions` mô tả nghiệp vụ xảy ra. `entries` ghi tác động có dấu lên số dư. `pending_events` ghi việc cần nhờ Planning đánh giá sau khi giao dịch thu chi thay đổi.

#### Cách hiểu amount minor và số dư

Tiền được lưu ở đơn vị nhỏ nhất dưới dạng số nguyên. VND và JPY có hệ số 1; USD và EUR có hệ số 100. Vì vậy 50.000 VND được lưu là `50000`, còn 10,50 USD được lưu là `1050`. Trường có hậu tố `_minor` phải được hiểu theo tiền tệ đi kèm.

**Số dư ví = tổng `delta_minor` của các dòng `entries` thuộc ví.** Tạo ví không tự có tiền. Muốn có số dư ban đầu trong demo, ghi một giao dịch thu vào ví.

| Nghiệp vụ minh họa | Bút toán trên ví VND | Số dư nếu ví bắt đầu bằng 0 |
| --- | --- | --- |
| Thu tiền sinh hoạt 2.000.000 | +2.000.000 | 2.000.000 |
| Chi ăn trưa 50.000 | −50.000 | 1.950.000 |
| Đảo khoản chi 50.000 | +50.000 | 2.000.000 |
| Ghi lại khoản chi đúng 40.000 | −40.000 | 1.960.000 |

#### Luồng ghi một khoản chi

1. Gửi `POST /transactions` với ví, danh mục, loại `expense`, số tiền, ngày và ghi chú.
2. FastAPI kiểm tra cấu trúc và kiểu dữ liệu qua model `Transaction`; dependency `User` xác thực phiên.
3. `create_transaction()` mở một database transaction và kiểm tra `Idempotency-Key` nếu có.
4. `insert_transaction()` xác minh ví và danh mục thuộc người đang đăng nhập, còn hoạt động, loại danh mục khớp loại giao dịch.
5. `money()` chuyển số tiền sang đơn vị nhỏ nhất theo tiền tệ của ví.
6. Ghi một dòng `transactions`, một dòng `entries` có dấu âm và một dòng `pending_events`.
7. Nếu thành công, commit cả nhóm và trả mã giao dịch. Nếu phát sinh lỗi trong nhóm, rollback để tránh chỉ ghi được một phần.

Ví dụ body hợp lệ, trong đó các ID cần thay bằng ID thực tế của tài khoản demo:

```json
{
  "wallet_id": 1,
  "category_id": 2,
  "kind": "expense",
  "amount": "50000",
  "occurred_on": "2026-10-16",
  "note": "Ăn trưa"
}
```

`Idempotency-Key` là header tùy chọn. Gửi lại cùng khóa và cùng nội dung sẽ dùng lại giao dịch đã có; cùng khóa nhưng nội dung khác bị từ chối với 409. Không nên suy ra mọi API đều chống gửi lặp: cơ chế này đang nằm ở API tạo giao dịch. Bản thân endpoint còn có ràng buộc duy nhất trong database; không khẳng định mọi yêu cầu đồng thời đều nhận cùng một phản hồi thành công.

#### Hủy và điều chỉnh mà vẫn giữ lịch sử

Nếu ghi nhầm chi 50.000 thành chi 40.000, API điều chỉnh tạo một giao dịch đảo để triệt tiêu 50.000 rồi thêm giao dịch thay thế 40.000 trong cùng database transaction. Bản ghi gốc được giữ lại. `reversal_of` nối dòng đảo với giao dịch gốc; ràng buộc và kiểm tra giúp ngăn đảo cùng giao dịch gốc nhiều lần.

Nhờ số tiền âm của dòng đảo, Planning và Reporting có thể cộng lịch sử để ra số đúng: 50.000 − 50.000 + 40.000 = 40.000. Đừng bỏ dòng đảo khi tính tổng mà vẫn giữ dòng gốc, vì như vậy tổng chi sẽ sai.

#### Chuyển tiền giữa hai ví

`POST /transfers` tạo một giao dịch chuyển ví và hai bút toán: ví nguồn giảm, ví đích tăng. Hai ví phải khác nhau, thuộc cùng người dùng, còn hoạt động và **cùng tiền tệ**. Tổng tiền của hai ví không đổi. Reporting loại giao dịch chuyển ví khỏi tổng thu chi để tránh xem đây là thu nhập hoặc chi phí mới.

Mã hiện tại không kiểm tra số dư đủ trước khi ghi chi hoặc chuyển ví; vì vậy số dư có thể âm. Ledger là sổ ghi nhận tài chính của bài tập, chưa phải hệ thống thanh toán ngân hàng. Cũng không nên gọi cấu trúc `entries` hiện tại là hệ thống kế toán kép đầy đủ.

#### API chính của Ledger

| Phương thức và đường dẫn | Công dụng |
| --- | --- |
| `POST /wallets`, `GET /wallets` | Tạo ví và xem ví kèm số dư |
| `POST /categories`, `GET /categories` | Tạo và xem danh mục thu chi |
| `PATCH /wallets/{id}`, `PATCH /categories/{id}` | Đổi tên và trạng thái sử dụng |
| `POST /transactions`, `GET /transactions` | Ghi và xem giao dịch theo thời gian |
| `POST /transactions/{id}/reverse` | Đảo giao dịch thu hoặc chi gốc |
| `POST /transactions/{id}/adjust` | Đảo giao dịch cũ và thêm bản thay thế |
| `POST /transfers` | Chuyển giữa hai ví cùng tiền tệ |

Hai API nội bộ cần nhận biết: `GET /internal/transactions/{user_id}` cung cấp lịch sử cho dịch vụ khác; `POST /internal/dispatch` gửi việc đang chờ sang Planning. Chúng yêu cầu `X-Service-Key`, không dành cho giao diện người dùng gọi trực tiếp. Lịch sử nội bộ trả từng trang 500 dòng; bên gọi đọc tiếp bằng `offset`.

#### Thứ tự đọc mã Ledger

Trong `python/ledger/main.py`, đọc khai báo bảng → các model → `create_wallet()` và `wallets()` → `insert_transaction()` → `create_transaction()` → `reverse_in_db()` → `adjust()` → `transfer()` → `transaction_list()` → `dispatch()`.

Mở thêm `python/common.py` để đọc `owned()`, `money()` và `database()`. Ba hàm này lần lượt trả lời: dữ liệu có thuộc người dùng không, số tiền được lưu ra sao và khi lỗi thì rollback ở đâu. Khi thuyết trình bằng mã, chỉ cần mở `insert_transaction()` và phép tổng `SUM(e.delta_minor)` để minh họa phần cốt lõi.

### Lời trình bày mẫu của người thứ nhất

“Nhóm em xây dựng hệ thống quản lý tài chính cá nhân gồm sáu dịch vụ. Em trình bày phần nền tảng là Identity và Ledger. Identity quản lý tài khoản và phiên đăng nhập. Khi người dùng đăng nhập đúng, hệ thống tạo token có thời hạn. Các dịch vụ khác dùng token để hỏi Identity người đang thao tác là ai.

Sau khi xác định người dùng, Ledger quản lý ví và giao dịch của người đó. Một khoản chi vừa có bản ghi mô tả giao dịch, vừa có bút toán âm làm giảm số dư ví. Ví dụ nhận 2 triệu rồi chi 50 nghìn thì ví còn 1 triệu 950 nghìn. Số dư được tính từ tổng bút toán.

Nếu nhập sai, hệ thống giữ lịch sử bằng cách tạo dòng đảo rồi ghi lại khoản đúng. Các thay đổi liên quan được lưu trong cùng một transaction database. Ledger còn ghi việc cần xử lý để Planning đánh giá ngân sách sau đó.”

**Câu chuyển cho người 2:** “Khi đã có dữ liệu thu chi chính xác, phần tiếp theo dùng dữ liệu đó để theo dõi ngân sách và nhắc những khoản sắp đến hạn.”

## Phần 2 Planning và Recurring

### Mục tiêu của người trình bày thứ hai

Giải thích cách hệ thống biến lịch sử thu chi thành thông tin để người dùng chủ động quản lý tiền. Planning trả lời “đã chi bao nhiêu so với hạn mức”; Recurring trả lời “khoản nào sắp đến hạn” và lưu thông báo. Dành khoảng 3 phút cho Planning, 3 phút cho Recurring và 1 phút cho luồng liên kết.

### Planning theo dõi ngân sách và mục tiêu

Planning có hai nhóm chức năng. Ngân sách đặt giới hạn chi cho một danh mục trong một khoảng ngày. Mục tiêu ghi nhận số tiền muốn tích lũy, thời hạn và các lần đóng góp. Hai nhóm này cùng giúp lập kế hoạch nhưng cách lấy số liệu khác nhau: ngân sách đọc Ledger, còn đóng góp mục tiêu được ghi riêng ở Planning.

`budgets` lưu tên, chủ sở hữu, danh mục chi, tiền tệ, hạn mức, ngày đầu, ngày cuối và ngưỡng cảnh báo. `alerts` ghi các ngưỡng đã cảnh báo. `goals` lưu mục tiêu và tổng đã góp. `goal_contributions` lưu từng lần góp.

#### Tính mức sử dụng ngân sách

1. Khi tạo ngân sách, `budgetValues()` gọi Ledger `/categories` bằng token người dùng để kiểm tra danh mục chi tồn tại và còn hoạt động.
2. Khi xem ngân sách, hàm `usage()` đọc các ngân sách của người dùng từ Planning.
3. Với từng khoảng ngày, hàm lấy lịch sử tương ứng từ Ledger qua helper `records()`.
4. Chỉ cộng các giao dịch `expense` đúng danh mục và tiền tệ, bao gồm số âm của dòng đảo.
5. Trả `spent_minor` và `used_percent` để giao diện hiển thị.

**Mức sử dụng = số đã chi ÷ hạn mức × 100%.** Ví dụ hạn mức ăn uống là 100.000 VND, chi hợp lệ đang là 80.000 VND thì mức sử dụng là 80%. Nếu có hai ngân sách cùng khoảng ngày, mã dùng lại phần lịch sử đã lấy trong lượt tính đó rồi lọc theo danh mục và tiền tệ.

#### Khi nào có cảnh báo

`evaluate()` kiểm tra ngưỡng do người dùng chọn, mặc định 80%, cùng ngưỡng 100%. Khi mức chi đạt hoặc vượt ngưỡng chưa được ghi nhận, Planning gọi Recurring `POST /internal/notifications` rồi lưu dấu trong `alerts`.

Ví dụ từ 40% tăng lên 110% trong một lần, cả ngưỡng 80% và 100% đều có thể được cảnh báo. Nếu ngưỡng cấu hình là 100%, mã gộp hai ngưỡng trùng nhau thành một. Cảnh báo đã ghi theo cặp ngân sách và ngưỡng không được gửi lại trong các lượt đánh giá tiếp theo. Mã hiện chưa có cơ chế tự xóa dấu cảnh báo khi mức chi giảm sau khi đảo giao dịch.

Có hai cách kích hoạt: người dùng bấm kiểm tra qua `POST /budgets/evaluate`, hoặc runner gọi luồng dispatch từ Ledger. **Chỉ mở `GET /budgets` để xem mức sử dụng không tự tạo cảnh báo.** Ngân sách mới tạo sau khi đã có chi tiêu nên được bấm kiểm tra ngay khi demo.

#### Mục tiêu tiết kiệm hoạt động ra sao

Ví dụ tạo mục tiêu mua laptop 15.000.000 VND rồi ghi góp 500.000 VND. Planning thêm một dòng `goal_contributions` và tăng `saved_minor` trong cùng transaction database. Tiến độ hiển thị khoảng 3,33%.

Việc góp này chỉ là ghi nhận theo dõi. Request không chọn ví và hàm không gọi Ledger, nên không tự trừ 500.000 VND khỏi ví. Nếu cần phản ánh một nghiệp vụ tiền thực tế, người dùng phải ghi nhận nghiệp vụ tương ứng riêng ở Ledger.

#### API chính của Planning

| Phương thức và đường dẫn | Công dụng |
| --- | --- |
| `POST /budgets`, `GET /budgets` | Tạo ngân sách và xem mức đã sử dụng |
| `PUT /budgets/{id}`, `DELETE /budgets/{id}` | Cập nhật hoặc dừng ngân sách |
| `POST /budgets/evaluate` | Đánh giá ngưỡng và tạo thông báo |
| `POST /goals`, `GET /goals` | Tạo và xem mục tiêu |
| `PUT /goals/{id}`, `DELETE /goals/{id}` | Cập nhật hoặc kết thúc mục tiêu |
| `POST /goals/{id}/contributions` | Ghi một lần đóng góp |

DELETE ngân sách hoặc mục tiêu hiện đặt `active=0`, không xóa vật lý lịch sử. Khi sửa ngân sách, không đổi danh mục, tiền tệ hoặc kỳ theo dõi; cần tạo ngân sách mới nếu đổi những thuộc tính đó. Mục tiêu cũng không cho đổi tiền tệ sau khi tạo.

#### Thứ tự đọc mã Planning

Đọc trường `schema` trong `javascript/planning/service.json` → `budgetValues()` và `goalValues()` trong `main.js` → `usage()` trong `usage.js` → `evaluate()` trong `main.js` → các nhánh `/budgets` → các nhánh `/goals` và `/contributions`.

Trong `javascript/common.js`, `start()` tạo máy chủ và xác thực request trước khi gọi handler nghiệp vụ. `records()` đọc phân trang từ Ledger. `transaction()` và `owned()` giữ tính nhất quán và kiểm tra quyền trên bản ghi. Không nên tìm decorator như Python trong mã Node.js: bộ định tuyến ở đây dùng điều kiện trên `route` và `method`.

### Recurring theo dõi khoản định kỳ và thông báo

Recurring quản lý những khoản lặp lại như Internet, tiền thuê nhà hoặc dịch vụ thuê bao. Dịch vụ lưu lịch, kiểm tra ngày cần nhắc, ghi nhận đã thanh toán và chuyển sang kỳ tiếp theo. Ngoài ra, nó nhận thông báo ngân sách do Planning gửi.

`subscriptions` lưu tên khoản, số tiền, tiền tệ, chu kỳ, hạn tiếp theo, ngày gốc và số ngày nhắc trước. `payments` lưu các kỳ đã đánh dấu thanh toán. `notifications` lưu thông báo, khóa chống trùng và trạng thái đã đọc.

#### Luồng nhắc hạn dễ hiểu

1. Tạo khoản Internet 200.000 VND, chu kỳ tháng, hạn tiếp theo 18/10/2026, nhắc trước 3 ngày.
2. Ngày bắt đầu nhắc là 15/10/2026. Khi kiểm tra từ ngày đó trở đi và khoản còn hoạt động, mã tạo thông báo nếu chưa có.
3. Khóa `subscription:{id}:{next_due}` xác định thông báo của đúng khoản và đúng kỳ, giúp lượt kiểm tra sau không chèn lại cùng thông báo.
4. Người dùng mở thông báo hoặc đánh dấu đã đọc.
5. Khi đánh dấu khoản đã thanh toán, mã lưu kỳ đã trả và đổi ngày đến hạn tiếp theo.

Lịch nhắc hiện được xử lý bởi vòng lặp trong `run.py` hoặc API kiểm tra thủ công. Thông báo nằm trong ứng dụng; chưa có gửi email, SMS hoặc push qua nhà cung cấp bên ngoài trong luồng này.

#### Vì sao có ngày gốc anchor day

Hàm `nextDate()` hỗ trợ tuần, tháng và năm. Với tháng, nếu ngày gốc là 31 mà tháng kế tiếp chỉ có 28 ngày, hệ thống dùng ngày 28 nhưng vẫn giữ ngày gốc 31 để kỳ sau quay lại ngày 31.

Ví dụ: 31/01/2027 → 28/02/2027 → 31/03/2027. Nếu chỉ cộng 30 ngày hoặc luôn lấy ngày 28 làm mốc mới, lịch có thể bị trôi. Chu kỳ tuần cộng 7 ngày. Mã cũng xử lý trường hợp ngày 29/02 khi chuyển sang năm không nhuận.

#### Đánh dấu đã trả có thay đổi số dư không

Không. `POST /subscriptions/{id}/paid` ghi bảng `payments` và cập nhật `next_due`. Phản hồi nhắc người dùng ghi khoản chi riêng ở Ledger. Giao diện hiện có đường dẫn hỗ trợ chuyển sang ghi khoản chi, nhưng hai thao tác vẫn riêng biệt.

Vì mỗi lần bấm có thể chuyển sang một kỳ tiếp theo, không coi endpoint này là cơ chế chống nhấn lặp giống `Idempotency-Key` của Ledger. Khi demo, bấm một lần rồi quan sát ngày mới trước khi thao tác tiếp.

#### Gợi ý khoản chi định kỳ

`GET /suggestions` đọc lịch sử Ledger của khoảng 180 ngày gần đây. Mã nhóm khoản chi theo ghi chú viết thường, số tiền và tiền tệ, bỏ các dòng đảo và giao dịch gốc được nhận diện đã đảo trong tập dữ liệu đọc được. Một nhóm được gợi ý theo tháng khi có ít nhất 3 lần và mọi khoảng cách giữa hai lần liên tiếp nằm trong 26 đến 35 ngày.

Ví dụ ba khoản “Internet” cùng số tiền vào 16/08, 16/09 và 16/10 có thể đủ điều kiện. Đây là quy tắc nhận dạng đơn giản, chưa phải mô hình AI. Gợi ý cũng không tự tạo lịch mới: người dùng cần chọn tạo lịch theo dõi.

#### API chính của Recurring

| Phương thức và đường dẫn | Công dụng |
| --- | --- |
| `POST /subscriptions`, `GET /subscriptions` | Tạo và xem khoản định kỳ |
| `PUT /subscriptions/{id}`, `DELETE /subscriptions/{id}` | Sửa hoặc dừng theo dõi |
| `POST /subscriptions/{id}/paid` | Ghi nhận đã trả và chuyển kỳ |
| `POST /reminders/check` | Kiểm tra lịch nhắc cho người dùng hiện tại |
| `GET /notifications` | Xem tối đa 200 thông báo gần nhất |
| `PATCH /notifications/{id}/read` | Đánh dấu một thông báo đã đọc |
| `GET /suggestions` | Tìm nhóm chi có nhịp tháng |

API nội bộ `/internal/notifications` nhận thông báo từ Planning; `/internal/reminders/check` kiểm tra lịch của tất cả người dùng. Các đường dẫn này được lớp dùng chung bảo vệ bằng khóa dịch vụ.

#### Thứ tự đọc mã Recurring

Đọc `javascript/recurring/service.json` để hiểu ba bảng. Trong `main.js`, đọc `subscriptionValues()` → `nextDate()` → `reminders()` → nhánh `/subscriptions/{id}/paid` → các nhánh `/notifications` → `/suggestions`. Hàm `nextDate()` và phần `--self-test` là nơi phù hợp để giải thích xử lý cuối tháng bằng ví dụ cụ thể.

### Luồng liên kết giữa hai dịch vụ

Ledger ghi khoản chi → bảng `pending_events` có việc chưa gửi → runner gọi `/internal/dispatch` → Ledger gom việc theo người dùng → Planning tính lại ngân sách → Recurring lưu thông báo → Ledger đánh dấu việc đã gửi khi lời gọi đánh giá thành công.

Nếu một lời gọi trong quá trình dispatch phát sinh lỗi, Ledger giữ việc chưa gửi và ghi `last_error` để lần sau thử lại. Phản hồi `processed` của dispatch hiện đếm số việc được lấy ra xử lý, không phải số thông báo đã gửi thành công. Cơ chế này giúp tách thao tác ghi tiền khỏi việc chờ gửi cảnh báo, nhưng chưa phải hệ thống hàng đợi có broker độc lập.

Trong chế độ chạy toàn bộ, runner bắt đầu kiểm tra sau khoảng 5 giây, rồi đặt lượt tiếp theo khoảng 30 giây sau khi lượt hiện tại kết thúc. Vì thế không hứa thông báo xuất hiện tức thì hoặc đúng tuyệt đối sau 30 giây. Chạy bằng `--service` không kích hoạt vòng kiểm tra này.

### Lời trình bày mẫu của người thứ hai

“Phần em phụ trách gồm Planning và Recurring. Planning dùng lịch sử từ Ledger để so sánh chi thực tế với ngân sách. Ví dụ đặt hạn mức ăn uống 100 nghìn và đã chi 80 nghìn thì hệ thống đạt ngưỡng cảnh báo 80%. Planning nhờ Recurring lưu thông báo để người dùng xem.

Planning còn quản lý mục tiêu như mua laptop và các lần đóng góp. Đóng góp hiện chỉ ghi nhận tiến độ, chưa tự trừ tiền ví. Với Recurring, người dùng tạo các khoản lặp lại như Internet, chọn kỳ trả và số ngày nhắc trước. Khi kiểm tra tới thời điểm cần nhắc, hệ thống tạo thông báo và tránh tạo lại cùng thông báo của một kỳ.

Khi người dùng đánh dấu đã trả, ngày đến hạn được chuyển sang kỳ tiếp theo. Phần tính ngày giữ ngày gốc để lịch cuối tháng không bị trôi. Việc ghi chi thật vẫn thực hiện riêng ở Ledger.”

**Câu chuyển cho người 3:** “Sau khi đã theo dõi chi tiêu và các khoản sắp đến hạn, người dùng cần xem tổng kết và có công cụ tính tiền ngoại tệ. Phần tiếp theo trình bày FX và Reporting.”

## Phần 3 FX và Reporting

### Mục tiêu của người trình bày thứ ba

Giải thích cách quy đổi một số tiền và cách hệ thống tổng hợp dữ liệu đã ghi. Nêu rõ ranh giới giữa tính quy đổi, chuyển tiền thật và báo cáo theo từng tiền tệ. Dành khoảng 2 phút cho FX, 3 phút cho Reporting và 1 phút demo hoặc kết thúc.

### FX lưu tỷ giá và tính quy đổi

FX là viết tắt của foreign exchange, trong dự án có nghĩa là dịch vụ tỷ giá và quy đổi. Admin nhập tỷ giá; người dùng chọn tiền nguồn, tiền đích, số tiền và ngày cần quy đổi. Dịch vụ trả kết quả tính toán cùng tỷ giá, ngày hiệu lực và nguồn.

Bảng `rates` có `base`, `quote`, `rate`, `effective_on`, `source`. `base` là tiền nguồn, `quote` là tiền đích. Ví dụ base USD, quote VND, rate 25.000 được hiểu là 1 USD tương ứng 25.000 VND theo dữ liệu demo đã nhập. **25.000 ở đây là tỷ giá giả định phục vụ bài tập, không phải tỷ giá thị trường được tra cứu.**

#### Luồng quy đổi từng bước

1. Admin gửi `POST /rates` để lưu tỷ giá cho một cặp tiền và ngày hiệu lực.
2. Người dùng gửi `POST /convert` với `base`, `quote`, `amount`, `as_of`.
3. Hệ thống kiểm tra tiền tệ hỗ trợ, số tiền dương và ngày hợp lệ.
4. Nếu hai tiền tệ giống nhau, dùng tỷ giá 1. Nếu khác nhau, tìm đúng chiều cặp tiền và ngày hiệu lực gần nhất nhưng không lớn hơn `as_of`.
5. Nếu không có tỷ giá phù hợp, trả 404 và yêu cầu admin nhập trước.
6. Hàm `converted()` nhân số tiền với tỷ giá bằng BCMath, rồi làm tròn theo số chữ số thập phân của tiền đích.
7. Trả số tiền sau quy đổi và thông tin tỷ giá đã dùng. Không ghi giao dịch ví.

Ví dụ nhập USD → VND có hiệu lực 01/10 là 25.000 và 20/10 là 25.500. Yêu cầu ngày 16/10 dùng 25.000; tỷ giá ngày 20/10 chưa được áp dụng. Với 10,50 USD, kết quả minh họa là 10,50 × 25.000 = 262.500 VND.

#### API chính của FX

| Phương thức và đường dẫn | Công dụng | Quyền |
| --- | --- | --- |
| `GET /rates` | Xem các tỷ giá đã lưu | Người dùng đăng nhập |
| `POST /rates` | Nhập hoặc cập nhật tỷ giá cùng cặp và ngày | Admin |
| `POST /convert` | Tính quy đổi tại ngày yêu cầu | Người dùng đăng nhập |

API người dùng Next.js chỉ mở xem tỷ giá và quy đổi; thao tác nhập tỷ giá thực hiện ở trang quản trị hoặc API backend với tài khoản admin. Khóa duy nhất của bảng theo cặp tiền và ngày cho phép cập nhật tỷ giá đã nhập ở đúng mốc đó.

#### Những điểm cần nói chính xác

FX hiện dùng tỷ giá nhập tay, chưa tự kết nối ngân hàng hoặc dịch vụ tỷ giá ngoài. Nếu chỉ có USD → VND, hệ thống không tự suy ra VND → USD bằng nghịch đảo, cũng không tự tìm đường quy đổi qua tiền tệ thứ ba.

Quy đổi chỉ trả một kết quả tính toán. Nó không rút tiền từ ví USD rồi nạp vào ví VND. Ledger hiện chỉ hỗ trợ chuyển giữa ví cùng tiền tệ, nên không mô tả đây là chức năng chuyển ví đa tiền tệ đã hoàn thiện.

BCMath giúp tính số thập phân bằng chuỗi để hạn chế sai số của số thực nhị phân. Ví dụ tự kiểm tra có trường hợp 1 × 1,005 USD làm tròn thành 1,01 USD. Hệ thống hỗ trợ VND, USD, EUR và JPY theo cấu hình đang có.

#### Thứ tự đọc mã FX

Đọc `php/fx/service.json` để hiểu bảng `rates` → `converted()` trong `php/fx/index.php` → nhánh `/rates` → nhánh `/convert`. Sau đó đọc `decimal_value()`, `currency_value()`, `date_value()` và `sql()` trong `php/common.php`.

`serve('fx', ...)` là lớp nhận HTTP, xác thực và gọi hàm xử lý nghiệp vụ. `sql()` dùng câu lệnh chuẩn bị sẵn với tham số. Như vậy file `index.php` tập trung vào nghiệp vụ, còn phần kết nối, phản hồi và xác thực được dùng chung.

### Reporting tổng hợp dữ liệu từ Ledger

Reporting đọc giao dịch từ Ledger để tính thu, chi và chênh lệch trong khoảng ngày. Nó cung cấp báo cáo, dashboard, so sánh hai kỳ và xuất CSV. Dịch vụ này không sở hữu bản sao toàn bộ giao dịch tài chính.

Bảng riêng `report_requests` ghi người đã yêu cầu báo cáo và khoảng ngày. Trong mã hiện tại, chỉ nhánh `GET /reports` thêm bản ghi vào bảng đó; không nên nói tất cả lần mở dashboard hoặc xuất CSV đều được ghi lại.

#### Luồng tạo báo cáo

1. Người dùng chọn ngày bắt đầu và kết thúc.
2. Reporting xác thực qua Identity rồi kiểm tra khoảng ngày.
3. `report_data()` gọi `ledger_records()` để đọc lịch sử từ Ledger, từng trang tối đa 500 dòng cho tới hết.
4. Chỉ tổng hợp `income` và `expense`, tách theo `currency`.
5. Các dòng đảo có số tiền âm được cộng cùng nhóm để triệt tiêu tác động cũ.
6. Tính `net_minor = income_minor − expense_minor`; chuyển thành chuỗi số tiền hiển thị theo tiền tệ.
7. Trả dữ liệu hoặc viết CSV, tùy endpoint được gọi.

| Ví dụ trong một kỳ | Thu | Chi | Thu trừ chi |
| --- | --- | --- | --- |
| VND | 2.000.000 | 80.000 | 1.920.000 |
| USD | 20,00 | 5,00 | 15,00 |

Hai dòng tiền tệ phải được giữ riêng. Không được cộng 1.920.000 VND với 15 USD thành một tổng không rõ đơn vị. Reporting hiện chưa gọi FX để quy đổi về một đồng tiền chung.

#### Phân biệt kết quả trong kỳ với số dư ví

Thu trừ chi phản ánh các giao dịch nằm trong khoảng ngày chọn. Số dư ví là tổng bút toán của ví qua toàn bộ lịch sử mà truy vấn ví đang xét, không bị giới hạn bởi khoảng ngày báo cáo.

Ví dụ trước kỳ báo cáo ví đã có 500.000 VND, trong kỳ thu 2.000.000 và chi 80.000 thì chênh lệch kỳ là 1.920.000, còn số dư ví là 2.420.000 nếu không có biến động khác. Đây là lý do hai số trên dashboard có thể khác nhau mà không phải lỗi.

`GET /dashboard` lấy báo cáo trong kỳ rồi gọi thêm Ledger `/wallets`. Dữ liệu trả về có danh sách ví và tổng số dư theo từng tiền tệ. Trong ví dụ tài khoản mới ở cuối tài liệu, hai số trùng nhau vì chưa có lịch sử trước kỳ.

#### So sánh kỳ và xuất CSV

`GET /compare` tính báo cáo cho hai khoảng ngày, sau đó lấy kỳ hiện tại trừ kỳ trước cho từng tiền tệ và từng chỉ tiêu. Ví dụ kỳ trước chi 60.000 VND, kỳ này chi 80.000 VND thì chênh lệch chi là +20.000 VND. API này trả mức chênh lệch tuyệt đối, không tự trả phần trăm tăng trưởng.

`GET /reports.csv` xuất các cột `currency`, `income`, `expense`, `net`. File là bảng tổng hợp theo tiền tệ, không phải danh sách từng giao dịch, không phải file Excel `.xlsx` và chưa phải PDF. CSV có dấu BOM UTF-8 để hỗ trợ cách đọc mã hóa của một số phần mềm bảng tính.

#### API chính của Reporting

| Đường dẫn GET | Công dụng | Tham số |
| --- | --- | --- |
| `/reports` | Tổng thu chi và ghi lần yêu cầu báo cáo | `start`, `end` |
| `/dashboard` | Tổng thu chi, ví và tổng số dư theo tiền tệ | `start`, `end` |
| `/compare` | So sánh hai kỳ | Thêm `previous_start`, `previous_end` |
| `/reports.csv` | Xuất bảng tổng hợp CSV | `start`, `end` |

Ví dụ: `/reports?start=2026-10-01&end=2026-10-31`. Hai ngày đầu và cuối đều được tính trong truy vấn Ledger. Trường `record_count` đếm số dòng lịch sử đã đọc, có thể gồm giao dịch chuyển ví và dòng đảo; không phải chỉ đếm các khoản chi có hiệu lực.

#### Thứ tự đọc mã Reporting

Đọc `php/reporting/service.json` → `report_data()` trong `index.php` → nhánh `/reports` → `/dashboard` → `/compare` → đoạn tạo CSV. Trong `php/common.php`, đọc `ledger_records()`, `peer()`, `sum_money()` và `display_money()`.

Khi mở mã để minh họa, tập trung vào điều kiện giữ `income` và `expense`, việc nhóm theo tiền tệ và công thức `net_minor`. Ba điểm này giải thích hầu hết con số xuất hiện trong báo cáo.

### Lời trình bày mẫu của người thứ ba

“Phần cuối gồm FX và Reporting. FX quản lý tỷ giá do admin nhập và tính quy đổi theo ngày. Chẳng hạn với tỷ giá demo 1 USD bằng 25 nghìn VND, 10,50 USD được tính thành 262.500 VND. Hệ thống chọn tỷ giá có hiệu lực gần nhất trước hoặc đúng ngày yêu cầu và trả cả nguồn tỷ giá để người dùng biết số đó từ đâu.

Reporting lấy giao dịch từ Ledger, cộng thu và chi theo từng tiền tệ, sau đó tính thu trừ chi. Giao dịch chuyển giữa các ví không được tính là thu hay chi mới. Những giao dịch đã điều chỉnh được phản ánh thông qua dòng đảo nên tổng vẫn đúng.

Reporting hỗ trợ xem dashboard, so sánh hai kỳ và xuất CSV. Ở phiên bản hiện tại, báo cáo giữ VND, USD và các tiền tệ khác thành từng nhóm; chưa tự gọi FX để quy về một đơn vị. Qua ba phần, hệ thống đi từ ghi nhận dữ liệu đến theo dõi kế hoạch và xem lại kết quả tài chính.”

## Kịch bản demo chung cho cả nhóm

### Chuẩn bị trước buổi trình bày

Sử dụng một tài khoản demo mới để tránh số liệu cũ làm kết quả lệch ví dụ. Bật MySQL, kiểm tra các thành phần đã cài theo README, rồi chạy toàn bộ dự án bằng lệnh dưới đây từ thư mục gốc. Nếu hệ thống đã chạy, dùng phiên đó hoặc dừng cửa sổ cũ trước; không mở thêm một bản trùng cổng.

```powershell
.\.venv\Scripts\python.exe run.py
```

Giao diện người dùng mặc định là `http://127.0.0.1:3000`; quản trị là `http://127.0.0.1:8090/admin`. Chuẩn bị sẵn một tài khoản admin nếu demo nhập tỷ giá. Lệnh tạo admin đã có trong README; không đưa mật khẩu hoặc nội dung khóa dịch vụ lên slide.

Ví dụ dưới đây dùng kỳ tháng 10/2026. Với demo lịch nhắc ở ngày khác, đặt hạn tiếp theo bằng ngày demo cộng 2 ngày và nhắc trước 3 ngày. Nếu chỉ chạy riêng một nhóm bằng `--member`, các dịch vụ phụ thuộc vẫn cần được chạy để luồng liên dịch vụ hoạt động. Demo cả hệ thống nên dùng `run.py` không kèm lựa chọn nhóm.

### Các bước và kết quả mong đợi

| Bước | Người thực hiện | Thao tác | Kết quả mong đợi theo mã |
| --- | --- | --- | --- |
| 1 | Người 1 | Đăng ký và đăng nhập tài khoản demo | Vào được giao diện người dùng |
| 2 | Người 1 | Tạo ví VND, danh mục thu Sinh hoạt và danh mục chi Ăn uống | Ví ban đầu có số dư 0 |
| 3 | Người 1 | Ghi thu 2.000.000 rồi chi 50.000 trong tháng 10 | Ví còn 1.950.000 |
| 4 | Người 1 | Điều chỉnh khoản chi thành 40.000 | Ví còn 1.960.000; lịch sử giữ dòng gốc, đảo và thay thế |
| 5 | Người 2 | Tạo ngân sách ăn uống 100.000, ngưỡng 80%, kỳ tháng 10 | Mức dùng hiện tại 40% |
| 6 | Người 2 | Ghi thêm chi ăn uống 40.000 qua Ledger | Tổng chi hợp lệ thành 80.000; số dư 1.920.000 |
| 7 | Người 2 | Bấm kiểm tra ngân sách, rồi mở thông báo | Có cảnh báo đạt ngưỡng 80%; kiểm tra lại không tạo bản trùng |
| 8 | Người 2 | Tạo mục tiêu 15 triệu và góp 500 nghìn | Tiến độ khoảng 3,33%; số dư ví vẫn 1.920.000 |
| 9 | Người 2 | Tạo Internet 200 nghìn, hạn sau ngày demo 2 ngày, nhắc trước 3 ngày; kiểm tra nhắc | Có thông báo khoản đến hạn |
| 10 | Người 2 | Đánh dấu Internet đã trả đúng một lần | Ngày đến hạn tăng một kỳ; ví vẫn 1.920.000 |
| 11 | Người 3 | Admin nhập USD → VND giá demo 25.000 có hiệu lực trước ngày quy đổi; user đổi 10,50 USD | Trả 262.500 VND, không đổi số dư ví |
| 12 | Người 3 | Xem báo cáo tháng 10 và xuất CSV | Thu 2.000.000; chi 80.000; thu trừ chi 1.920.000 VND |

Ở bước 10 cố ý chưa ghi khoản Internet vào Ledger để minh họa ranh giới chức năng. Nếu sau đó ghi chi Internet 200.000 VND vào đúng kỳ, tổng chi báo cáo thành 280.000 và số dư thành 1.720.000. Ngân sách Ăn uống vẫn 80% nếu Internet dùng danh mục chi riêng.

**Tình trạng demo:** Các giá trị trên là kết quả mong đợi được suy ra từ mã và phép tính. Nhóm cần chạy thử, chụp kết quả thật và đánh dấu bước nào đã đạt trước khi gọi đó là kết quả kiểm thử.

### Khi thao tác không ra kết quả như mong đợi

| Hiện tượng | Điều cần kiểm tra đầu tiên |
| --- | --- |
| Không đăng nhập được | Identity còn chạy, MySQL có kết nối, tài khoản có đang khóa hoặc nhập sai không |
| Có chi nhưng ngân sách bằng 0 | Danh mục, tiền tệ, khoảng ngày có khớp không; đang dùng cùng tài khoản không |
| Đạt 80% nhưng chưa thấy thông báo | Đã bấm đánh giá chưa; runner có chạy toàn bộ không; Planning và Recurring có phản hồi không |
| Không quy đổi được | Đã nhập đúng chiều cặp tiền và ngày hiệu lực không lớn hơn ngày yêu cầu chưa |
| Báo cáo lệch số dư | Báo cáo chỉ tính trong kỳ; ví có lịch sử trước kỳ hay chuyển ví không |
| Góp mục tiêu hoặc trả thuê bao nhưng ví không giảm | Đây là hành vi hiện tại; cần ghi nghiệp vụ thực tế riêng ở Ledger |

Không dùng riêng việc `/health` trả thành công để khẳng định toàn bộ nghiệp vụ đã chạy đúng. Với bài này, cần quan sát cả dữ liệu đầu vào, số dư, ngân sách, thông báo và báo cáo qua cùng một chuỗi thao tác.

## Câu hỏi thường gặp khi thuyết trình

### Vì sao chia thành sáu dịch vụ

Mỗi dịch vụ sở hữu một nhóm trách nhiệm và dữ liệu rõ ràng. Ví dụ Ledger tập trung tính đúng tiền, còn Recurring tập trung lịch nhắc. Chúng có thể viết bằng công nghệ khác nhau vì giao tiếp qua HTTP. Đổi lại, phải xử lý xác thực, lỗi kết nối và chậm cập nhật giữa các dịch vụ. Trong bài tập, tách dịch vụ là cách thể hiện kiến trúc; chưa có đo đạc để khẳng định hệ thống nhanh hơn hoặc chịu tải tốt hơn ứng dụng nguyên khối.

### Có phải mỗi dịch vụ hoàn toàn độc lập không

Chúng có tiến trình và database riêng nhưng vẫn phụ thuộc API của nhau. Phần lớn thao tác người dùng cần Identity. Planning, Recurring và Reporting cần Ledger cho các chức năng đọc lịch sử. Một dịch vụ dừng có thể làm chức năng liên quan không hoạt động; không nên nói các phần hoàn toàn không ảnh hưởng nhau.

### Hệ thống đã có gateway chưa

Hiện có lớp chuyển tiếp API ở frontend Next.js và gateway phục vụ trang admin Node.js. Có thể giải thích đây là nơi giao diện gửi yêu cầu tới các backend đã cho phép. Không nên dùng mô tả cũ “hoàn toàn chưa có gateway”, cũng không nên suy ra đã có nền tảng gateway sản xuất với cân bằng tải, service discovery và giám sát phân tán.

### Token người dùng khác khóa nội bộ thế nào

Bearer token gắn với một phiên người dùng. `X-Service-Key` dùng cho các API `/internal/...` như đọc lịch sử nội bộ, đánh giá ngân sách hoặc nhận thông báo. Một lời gọi giữa hai dịch vụ vẫn có thể mang token người dùng, ví dụ Reporting lấy danh sách ví hoặc Planning kiểm tra danh mục. Vì thế không nói mọi lời gọi giữa các dịch vụ đều dùng duy nhất khóa nội bộ.

### Nếu Planning lỗi khi người dùng ghi chi thì sao

Thao tác ghi chi lưu giao dịch, bút toán và việc chờ trong cùng transaction database. Gọi Planning diễn ra sau, khi runner dispatch. Nếu bước gửi lỗi, việc vẫn chưa được đánh dấu đã gửi và có thể được thử lại. Chi tiêu đã ghi có thể xuất hiện trước cảnh báo. Đây là một dạng cập nhật sau giữa các dịch vụ, chưa có transaction phân tán bao trùm tất cả database.

### Có tự khóa chi tiêu khi vượt ngân sách không

Không. Planning theo dõi và cảnh báo. Ledger hiện không gọi Planning để xin phép trước khi ghi chi, cũng không kiểm tra số dư đủ để ngăn số âm. Ngân sách không phải cơ chế chặn thanh toán.

### Tại sao giữ bản ghi khi hủy hoặc dừng sử dụng

Ledger giữ giao dịch gốc và thêm dòng đảo để truy vết lịch sử. Ví, danh mục, ngân sách, mục tiêu và khoản định kỳ có trạng thái hoạt động để dừng sử dụng mà vẫn giữ dữ liệu cũ. Tuy nhiên cơ chế hủy giao dịch và cơ chế dừng một đối tượng là hai nghiệp vụ khác nhau.

### Dự án có AI và dữ liệu tỷ giá thời gian thực chưa

Nhận diện khoản chi định kỳ hiện dùng quy tắc trên ghi chú, số tiền và khoảng cách ngày, chưa dùng mô hình học máy. Tỷ giá hiện do admin nhập. Nếu đề cập AI hoặc đồng bộ tỷ giá tự động thì phải đặt trong phần đề xuất phát triển, không mô tả là tính năng đã có.

### Tại sao cùng một khoản có trong Planning và Reporting

Cả hai đọc nguồn Ledger nhưng trả lời câu hỏi khác nhau. Planning lọc chi theo danh mục và kỳ để so với hạn mức. Reporting cộng thu và chi theo kỳ và tiền tệ để tổng kết. Đọc chung nguồn giúp tránh mỗi nơi tự nhập một bộ lịch sử riêng.

### Phần nào mới có tài liệu API tự động đầy đủ

Identity và Ledger dùng FastAPI nên có trang tài liệu API tự sinh. Node.js và PHP hiện cung cấp `/docs` dạng dữ liệu hành động, còn `/openapi.json` có phần `paths` rỗng. Không nên nói sáu dịch vụ đều có Swagger đầy đủ giống nhau.

## Bản ghi nhớ trước khi lên trình bày

| Người | Năm ý cần nhớ |
| --- | --- |
| Người 1 | Token phiên không phải JWT; mỗi bản ghi gắn người dùng; tiền lưu theo đơn vị nhỏ nhất; số dư là tổng bút toán; điều chỉnh bằng đảo và ghi mới |
| Người 2 | Ngân sách đọc Ledger; đạt ngưỡng thì Planning gửi sang Recurring; mục tiêu không tự trừ ví; trả định kỳ không tự ghi chi; lịch cuối tháng giữ ngày gốc |
| Người 3 | Tỷ giá nhập tay; chọn tỷ giá theo ngày; quy đổi không chuyển tiền; báo cáo nhóm theo tiền tệ; số dư ví khác thu trừ chi trong kỳ |

Mỗi người nên tập giải thích được phần của mình trong 60 giây trước, rồi mới thêm ví dụ và đoạn mã. Khi bị hỏi sâu, dùng đúng tên hàm ở bảng tra cứu dưới đây; không cần học thuộc toàn bộ file.

## Nguồn đối chiếu trong dự án

Các đường dẫn dưới đây tính từ thư mục gốc KTHDV. Tên hàm hoặc nhánh xử lý được ghi để dễ tìm bằng chức năng tìm kiếm trong trình soạn thảo. Khi mã thay đổi, cần đối chiếu lại trước khi dùng tài liệu để bảo vệ tính năng mới.

| Nội dung | File cần mở | Điểm cần tìm |
| --- | --- | --- |
| Cách chạy, cổng và phạm vi frontend | `README.md`, `run.py` | `NAMES`, `MEMBERS`, `main`, vòng kiểm tra nội bộ |
| Phân công thực hiện ban đầu | `KTHDV.docx` | Bảng họ tên, MSSV, phần phụ trách |
| Identity | `python/identity/main.py` | `SCHEMA`, `Register`, `login`, `set_status` |
| Xác thực và dữ liệu Python | `python/common.py` | `user`, `admin`, `password_hash`, `owned`, `database`, `money` |
| Ledger | `python/ledger/main.py` | `insert_transaction`, `reverse_in_db`, `transfer`, `dispatch` |
| Planning | `javascript/planning/main.js`, `usage.js` | `budgetValues`, `evaluate`, `usage`, `contributions` |
| Schema Planning | `javascript/planning/service.json` | `schema` và các hành động |
| Recurring | `javascript/recurring/main.js`, `service.json` | `nextDate`, `reminders`, `paid`, `suggestions`, `schema` |
| HTTP và dữ liệu Node.js | `javascript/common.js` | `start`, `peer`, `records`, `transaction`, `owned` |
| FX | `php/fx/index.php`, `service.json` | `converted`, `/rates`, `/convert`, `schema` |
| Reporting | `php/reporting/index.php`, `service.json` | `report_data`, `/dashboard`, `/compare`, `_csv` |
| HTTP và dữ liệu PHP | `php/common.php` | `serve`, `peer`, `ledger_records`, `sum_money`, `display_money` |
| Phiên và chuyển tiếp frontend | `template/src/lib/backend.ts`, `session.ts` | `allowed`, `cookieOptions`, `currentUser` |
| Xử lý yêu cầu frontend | `template/src/app/api/[service]/[...path]/route.ts` | `handle`, lưu cookie và chuyển Bearer token |
| Giao diện ngân sách và định kỳ | `template/src/components/finance/planning.tsx`, `recurring.tsx` | Nút đánh giá, nhắc hạn và ghi khoản chi riêng |
| Cổng quản trị | `giao_dien/main.js` | Chuyển tiếp yêu cầu theo dịch vụ |

**Kết quả của lần biên soạn:** Đã đọc mã nguồn và đối chiếu trách nhiệm, dữ liệu, API, luồng gọi cùng các giới hạn được nêu trong tài liệu. Chưa kiểm thử lại toàn hệ thống, chưa đo hiệu năng và chưa xác nhận kết quả demo trên database chạy thật trong lần này.
