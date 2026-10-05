<?php
declare(strict_types=1);
require dirname(__DIR__) . '/common.php';

function converted(string $amount, string $rate, string $unit): string {
    $scale = SCALES[$unit];
    $half = $scale === 0 ? '0.5' : '0.' . str_repeat('0', $scale) . '5';
    return bcadd(bcmul($amount, $rate, 26), $half, $scale);
}
if (PHP_SAPI === 'cli' && in_array('--self-test', $_SERVER['argv'], true)) {
    check(converted('10.50', '25000', 'VND') === '262500', 'Quy đổi sai');
    check(converted('1', '1.005', 'USD') === '1.01', 'Làm tròn sai');
    check(display_money(-1050, 'USD') === '-10.50', 'Hiển thị sai');
    check(converted('1000000000000', '1000000000000', 'VND') === '1000000000000000000000000', 'Mất độ chính xác');
    echo "PASS: BCMath, làm tròn và tiền lớn\n"; return;
}
serve('fx', function(PDO $db, string $route, string $method, array $p, array $u): ?array {
    if ($route === '/rates' && $method === 'GET') return sql($db, 'SELECT * FROM rates ORDER BY effective_on DESC,id DESC LIMIT 200')->fetchAll();
    if ($route === '/rates' && $method === 'POST') {
        check($u['role'] === 'admin', 'Cần quyền admin', 403);
        fields($p, ['base', 'quote', 'rate', 'effective_on', 'source'], ['base', 'quote', 'rate', 'effective_on']);
        $base = currency_value($p['base']); $quote = currency_value($p['quote']); check($base !== $quote, 'Hai tiền tệ phải khác nhau');
        $rate = decimal_value($p['rate'], 12); $effective = date_value($p['effective_on']); $source = text_value($p['source'] ?? 'Nhập tay');
        sql($db, 'INSERT INTO rates(base,quote,rate,effective_on,source) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE rate=VALUES(rate),source=VALUES(source)', [$base, $quote, $rate, $effective, $source]);
        return ['status' => 201, 'data' => ['base' => $base, 'quote' => $quote, 'rate' => $rate, 'effective_on' => $effective, 'source' => $source]];
    }
    if ($route === '/convert' && $method === 'POST') {
        fields($p, ['base', 'quote', 'amount', 'as_of'], ['base', 'quote', 'amount', 'as_of']);
        $base = currency_value($p['base']); $quote = currency_value($p['quote']);
        $amount = decimal_value($p['amount'], SCALES[$base]); $asOf = date_value($p['as_of']);
        if ($base === $quote) { $rate = '1'; $effective = $asOf; $source = 'Cùng tiền tệ'; }
        else {
            $row = sql($db, 'SELECT * FROM rates WHERE base=? AND quote=? AND effective_on<=? ORDER BY effective_on DESC LIMIT 1', [$base, $quote, $asOf])->fetch();
            check($row, 'Chưa có tỷ giá phù hợp; admin cần nhập trước', 404);
            $rate = $row['rate']; $effective = $row['effective_on']; $source = $row['source'];
        }
        return ['amount' => $amount, 'base' => $base, 'quote' => $quote, 'converted_amount' => converted($amount, $rate, $quote), 'rate' => $rate, 'effective_on' => $effective, 'source' => $source];
    }
    return null;
});
