<?php
declare(strict_types=1);

const SERVICE_NAMES = ['identity', 'ledger', 'planning', 'recurring', 'fx', 'reporting'];
const SCALES = ['VND' => 0, 'USD' => 2, 'EUR' => 2, 'JPY' => 0];
class ApiError extends RuntimeException {}
function check($ok, string $message, int $status = 422): void {
    if (!$ok) throw new ApiError($message, $status);
}
function setting(string $key, $default) { $value = getenv($key); return $value === false ? $default : $value; }
function fields(array $body, array $allowed, array $required): void {
    check(!array_diff(array_keys($body), $allowed) && !array_diff($required, array_keys($body)), 'Thiếu trường hoặc có trường không được phép');
}
function text_value($value, int $max = 120): string {
    check(is_string($value) && mb_strlen(trim($value)) > 0 && mb_strlen(trim($value)) <= $max, 'Nội dung không hợp lệ'); return trim($value);
}
function date_value($value): string {
    check(is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value), 'Ngày không hợp lệ');
    [$y, $m, $d] = array_map('intval', explode('-', $value)); check(checkdate($m, $d, $y), 'Ngày không hợp lệ'); return $value;
}
function currency_value($value): string { check(is_string($value) && array_key_exists($value, SCALES), 'Tiền tệ không hợp lệ'); return $value; }
function decimal_value($value, int $scale): string {
    check(is_string($value) || is_int($value) || is_float($value), 'Số tiền không hợp lệ');
    $s = trim((string)$value);
    check(preg_match('/^(?:0|[1-9]\d*)(?:\.\d+)?$/D', $s), 'Số tiền không hợp lệ');
    $fraction = explode('.', $s)[1] ?? '';
    check(!preg_match('/[1-9]/', substr($fraction, $scale)), 'Quá nhiều chữ số thập phân');
    check(bccomp($s, '0', $scale) > 0 && bccomp($s, '1000000000000', $scale) <= 0, 'Số tiền phải dương và không quá 10^12'); return $s;
}
function display_money($minor, string $unit): string { return bcdiv((string)$minor, bcpow('10', (string)SCALES[$unit], 0), SCALES[$unit]); }
function sum_money($a, $b): int {
    $sum = bcadd((string)$a, (string)$b, 0);
    check(bccomp($sum, (string)PHP_INT_MAX, 0) <= 0 && bccomp($sum, (string)PHP_INT_MIN, 0) >= 0, 'Tổng tiền vượt giới hạn'); return (int)$sum;
}
function sql(PDO $db, string $query, array $args = []): PDOStatement { $stmt = $db->prepare($query); $stmt->execute($args); return $stmt; }
function peer(string $name, string $method, string $path, ?string $token = null, ?array $body = null): array {
    $base = setting(strtoupper($name) . '_URL', 'http://127.0.0.1:' . ((int)setting('PORT_BASE', 8001) + array_search($name, SERVICE_NAMES, true)));
    $curl = curl_init($base . $path);
    $headers = [$token ? 'Authorization: Bearer ' . $token : 'X-Service-Key: ' . setting('INTERNAL_KEY', '')];
    if ($body !== null) $headers[] = 'Content-Type: application/json';
    curl_setopt_array($curl, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_HTTPHEADER => $headers, CURLOPT_PROXY => '']);
    if ($body !== null) curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($body, JSON_THROW_ON_ERROR));
    $raw = curl_exec($curl); $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    check($raw !== false && $status > 0, "Service $name không kết nối được", 503);
    $result = json_decode($raw, true); check(is_array($result), "Service $name trả dữ liệu không hợp lệ", 503);
    check($status < 400, is_string($result['detail'] ?? null) ? $result['detail'] : "Service $name báo lỗi", $status); return $result;
}
function ledger_records(int $user, string $start, string $end): array {
    $result = [];
    do { $page = peer('ledger', 'GET', "/internal/transactions/$user?" . http_build_query(['start' => $start, 'end' => $end, 'offset' => count($result)])); $result = array_merge($result, $page); } while (count($page) === 500);
    return $result;
}
function cors_headers(): void {
    // Trang người dùng (/app) chạy ở cổng khác với API nên cần CORS cho localhost.
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (!preg_match('#^http://(127\.0\.0\.1|localhost)(:\d+)?$#D', $origin)) return;
    header('Access-Control-Allow-Origin: ' . $origin); header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE'); header('Access-Control-Allow-Headers: Authorization, Content-Type, Idempotency-Key');
}
function send($value, int $status = 200): void {
    cors_headers(); http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}
function serve(string $name, callable $handler): void {
    $root = dirname(__DIR__);
    try {
        $metadata = json_decode(file_get_contents(__DIR__ . "/$name/service.json"), true, 512, JSON_THROW_ON_ERROR);
        $config = is_file($root . '/config.local.json') ? json_decode(ltrim(file_get_contents($root . '/config.local.json'), "\xEF\xBB\xBF"), true, 512, JSON_THROW_ON_ERROR) : [];
        $database = setting('DB_PREFIX', $config['prefix'] ?? 'kthdv_') . $name;
        check(preg_match('/^[a-zA-Z0-9_]{1,64}$/D', $database), 'Tên database không hợp lệ');
        $dsn = 'mysql:host=' . setting('DB_HOST', $config['host'] ?? '127.0.0.1') . ';port=' . setting('DB_PORT', $config['port'] ?? 3306) . ';charset=utf8mb4';
        $setup = PHP_SAPI === 'cli' && in_array('--setup', $_SERVER['argv'], true);
        $db = new PDO($dsn . ($setup ? '' : ';dbname=' . $database), setting('DB_USER', $config['user'] ?? 'root'), setting('DB_PASSWORD', $config['password'] ?? ''), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
        if ($setup) {
            $db->exec("CREATE DATABASE IF NOT EXISTS `$database` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"); $db->exec("USE `$database`");
            foreach (explode(';', $metadata['schema']) as $statement) if (trim($statement)) $db->exec($statement . ' ENGINE=InnoDB'); return;
        }
        $route = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH); $method = $_SERVER['REQUEST_METHOD'];
        if ($method === 'OPTIONS') { cors_headers(); http_response_code(204); return; }
        if ($method === 'GET' && in_array($route, ['/', '/admin'], true)) { header('Content-Type: text/html; charset=utf-8'); readfile($root . '/giao_dien/admin.html'); return; }
        if ($method === 'GET' && $route === '/app') { header('Content-Type: text/html; charset=utf-8'); readfile($root . '/giao_dien/user.html'); return; }
        if ($method === 'GET' && $route === '/health') { send(['service' => $name, 'status' => 'ok']); return; }
        if ($method === 'GET' && $route === '/docs') { send(['service' => $name, 'actions' => $metadata['actions']]); return; }
        if ($method === 'GET' && $route === '/openapi.json') { send(['openapi' => '3.0.3', 'info' => ['title' => "$name Service", 'version' => '0.1'], 'paths' => (object)[]]); return; }
        $raw = file_get_contents('php://input', false, null, 0, 65537); check(strlen($raw) <= 65536, 'JSON quá lớn', 413);
        $body = $raw === '' ? [] : json_decode($raw, true);
        check(is_array($body) && ($raw === '' || substr(ltrim($raw), 0, 1) === '{') && json_last_error() === JSON_ERROR_NONE, 'Cần JSON object hợp lệ');
        if ($method === 'POST' && $route === '/auth/login') { send(peer('identity', $method, $route, null, $body)); return; }
        check(preg_match('/^Bearer\s+(\S+)$/iD', $_SERVER['HTTP_AUTHORIZATION'] ?? '', $match), 'Cần đăng nhập', 401);
        $user = peer('identity', 'GET', '/auth/me', $match[1]); $user['token'] = $match[1];
        if ($method === 'GET' && $route === '/auth/me') { $public = $user; unset($public['token']); send($public); return; }
        if ($method === 'POST' && $route === '/auth/logout') { send(peer('identity', $method, $route, $user['token'])); return; }
        if (str_starts_with($route, '/admin/')) {
            check($user['role'] === 'admin', 'Cần quyền admin', 403);
            if ($method === 'GET' && $route === '/admin/actions') {
                $services = []; foreach (SERVICE_NAMES as $i => $service) $services[] = ['name' => $service, 'url' => 'http://127.0.0.1:' . ((int)setting('PORT_BASE', 8001) + $i) . '/admin'];
                send(['service' => $name, 'actions' => $metadata['actions'], 'services' => $services]); return;
            }
            if ($method === 'GET' && $route === '/admin/data') { $data = []; foreach ($metadata['tables'] as $label => $query) $data[$label] = sql($db, $query)->fetchAll(); send($data); return; }
        }
        $result = $handler($db, $route, $method, $body, $user); check($result !== null, 'Không tìm thấy API', 404);
        if (array_key_exists('_csv', $result)) { cors_headers(); header('Content-Type: text/csv; charset=utf-8'); header('Content-Disposition: attachment; filename="report.csv"'); echo $result['_csv']; }
        else send($result['data'] ?? $result, $result['status'] ?? 200);
    } catch (ApiError $error) { send(['detail' => $error->getMessage()], $error->getCode()); }
    catch (Throwable $error) {
        error_log((string)$error); $status = $error instanceof PDOException && $error->getCode() === '23000' ? 409 : 500;
        send(['detail' => $status === 409 ? 'Dữ liệu trùng hoặc vi phạm ràng buộc' : 'Lỗi xử lý dữ liệu'], $status);
        if (PHP_SAPI === 'cli') exit(1);
    }
}
