<?php
declare(strict_types=1);
require dirname(__DIR__) . '/common.php';

// Quy đổi một số tiền (đơn vị nhỏ nhất) sang tiền đích theo tỷ giá có hiệu lực tại $asOf.
function convert_minor(array $u, int $minor, string $unit, string $target, string $asOf): int {
    if ($minor === 0 || $unit === $target) return $minor;
    // /convert chỉ nhận số dương nên quy đổi giá trị tuyệt đối rồi đổi lại dấu.
    $converted = peer('fx', 'POST', '/convert', $u['token'], [
        'base' => $unit, 'quote' => $target, 'amount' => display_money(abs($minor), $unit), 'as_of' => $asOf]);
    $value = (int)bcmul($converted['converted_amount'], bcpow('10', (string)SCALES[$target], 0), 0);
    return $minor < 0 ? -$value : $value;
}

function report_data(array $u, string $start, string $end, ?string $target = null): array {
    check($start <= $end, 'Khoảng thời gian không hợp lệ');
    $records = ledger_records($u['id'], $start, $end); $totals = []; $reversed = [];
    foreach ($records as $item) if ($item['reversal_of'] !== null) $reversed[$item['reversal_of']] = true;
    $count = 0;
    foreach ($records as $item) {
        if (!in_array($item['kind'], ['income', 'expense'], true)) continue;
        $unit = $item['currency']; $key = $item['kind'] . '_minor';
        if (!isset($totals[$unit])) $totals[$unit] = ['income_minor' => 0, 'expense_minor' => 0];
        // Giao dịch đảo có số tiền âm, triệt tiêu giao dịch gốc.
        $totals[$unit][$key] = sum_money($totals[$unit][$key], $item['amount_minor']);
        // Chỉ đếm bút toán còn hiệu lực: không đếm dòng đảo và giao dịch gốc đã bị đảo.
        if ($item['reversal_of'] === null && !isset($reversed[$item['id']])) $count++;
    }
    foreach ($totals as $unit => &$total) {
        $total['net_minor'] = sum_money($total['income_minor'], -$total['expense_minor']);
        foreach (['income', 'expense', 'net'] as $key) $total[$key] = display_money($total[$key . '_minor'], $unit);
    }
    unset($total);
    $result = ['start' => $start, 'end' => $end, 'by_currency' => $totals ?: (object)[], 'record_count' => $count];
    if ($target !== null) {
        $income = 0; $expense = 0;
        foreach ($totals as $unit => $total) {
            $income = sum_money($income, convert_minor($u, $total['income_minor'], $unit, $target, $end));
            $expense = sum_money($expense, convert_minor($u, $total['expense_minor'], $unit, $target, $end));
        }
        $result['converted'] = ['currency' => $target, 'as_of' => $end, 'income_minor' => $income, 'expense_minor' => $expense,
            'net_minor' => sum_money($income, -$expense), 'income' => display_money($income, $target),
            'expense' => display_money($expense, $target), 'net' => display_money(sum_money($income, -$expense), $target)];
    }
    return $result;
}
serve('reporting', function(PDO $db, string $route, string $method, array $p, array $u): ?array {
    // Ghi nhận lượt xem báo cáo là một thao tác riêng, không làm GET thay đổi dữ liệu.
    if ($method === 'POST' && $route === '/reports/requests') {
        $start = date_value($p['start'] ?? null); $end = date_value($p['end'] ?? null);
        check($start <= $end, 'Khoảng thời gian không hợp lệ');
        sql($db, 'INSERT INTO report_requests(user_id,start_on,end_on,created_on) VALUES(?,?,?,?)', [$u['id'], $start, $end, date('Y-m-d')]);
        return ['status' => 201, 'data' => ['start' => $start, 'end' => $end]];
    }
    if ($method !== 'GET' || !in_array($route, ['/reports', '/dashboard', '/compare', '/reports.csv'], true)) return null;
    $start = date_value($_GET['start'] ?? null); $end = date_value($_GET['end'] ?? null);
    $target = isset($_GET['currency']) ? currency_value($_GET['currency']) : null;
    $result = report_data($u, $start, $end, $target);
    if ($route === '/reports') return $result;
    if ($route === '/dashboard') {
        $wallets = peer('ledger', 'GET', '/wallets', $u['token']); $totals = [];
        foreach ($wallets as $w) $totals[$w['currency']] = sum_money($totals[$w['currency']] ?? 0, $w['balance_minor']);
        $extra = ['wallets' => $wallets, 'wallet_total_minor_by_currency' => $totals ?: (object)[]];
        if ($target !== null) {
            $converted = 0;
            foreach ($totals as $unit => $minor) $converted = sum_money($converted, convert_minor($u, $minor, $unit, $target, $end));
            $extra['wallet_total_converted'] = ['currency' => $target, 'as_of' => $end, 'minor' => $converted, 'amount' => display_money($converted, $target)];
        }
        return $result + $extra;
    }
    if ($route === '/compare') {
        $previous = report_data($u, date_value($_GET['previous_start'] ?? null), date_value($_GET['previous_end'] ?? null), $target);
        $difference = []; $nowTotals = (array)$result['by_currency']; $previousTotals = (array)$previous['by_currency'];
        foreach (array_unique(array_merge(array_keys($nowTotals), array_keys($previousTotals))) as $unit) {
            foreach (['income_minor', 'expense_minor', 'net_minor'] as $key) $difference[$unit][$key] = sum_money($nowTotals[$unit][$key] ?? 0, -($previousTotals[$unit][$key] ?? 0));
        }
        return ['current' => $result, 'previous' => $previous, 'difference_minor' => $difference ?: (object)[]];
    }
    $stream = fopen('php://temp', 'w+'); fwrite($stream, "\xEF\xBB\xBF");
    fputcsv($stream, ['currency', 'income', 'expense', 'net'], ',', '"', '\\');
    foreach ($result['by_currency'] as $unit => $total) fputcsv($stream, [$unit, $total['income'], $total['expense'], $total['net']], ',', '"', '\\');
    if (isset($result['converted'])) {
        $converted = $result['converted'];
        fputcsv($stream, [$converted['currency'] . ' (quy đổi ' . $converted['as_of'] . ')', $converted['income'], $converted['expense'], $converted['net']], ',', '"', '\\');
    }
    rewind($stream); $csv = stream_get_contents($stream); fclose($stream); return ['_csv' => $csv];
});
