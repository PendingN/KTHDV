<?php
declare(strict_types=1);
require dirname(__DIR__) . '/common.php';

function report_data(array $u, string $start, string $end): array {
    check($start <= $end, 'Khoảng thời gian không hợp lệ');
    $records = ledger_records($u['id'], $start, $end); $totals = [];
    foreach ($records as $item) {
        if (!in_array($item['kind'], ['income', 'expense'], true)) continue;
        $unit = $item['currency']; $key = $item['kind'] . '_minor';
        if (!isset($totals[$unit])) $totals[$unit] = ['income_minor' => 0, 'expense_minor' => 0];
        // Giao dịch đảo có số tiền âm, triệt tiêu giao dịch gốc.
        $totals[$unit][$key] = sum_money($totals[$unit][$key], $item['amount_minor']);
    }
    foreach ($totals as $unit => &$total) {
        $total['net_minor'] = sum_money($total['income_minor'], -$total['expense_minor']);
        foreach (['income', 'expense', 'net'] as $key) $total[$key] = display_money($total[$key . '_minor'], $unit);
    }
    unset($total);
    return ['start' => $start, 'end' => $end, 'by_currency' => $totals ?: (object)[], 'record_count' => count($records)];
}
serve('reporting', function(PDO $db, string $route, string $method, array $p, array $u): ?array {
    if ($method !== 'GET' || !in_array($route, ['/reports', '/dashboard', '/compare', '/reports.csv'], true)) return null;
    $start = date_value($_GET['start'] ?? null); $end = date_value($_GET['end'] ?? null);
    $result = report_data($u, $start, $end);
    if ($route === '/reports') {
        sql($db, 'INSERT INTO report_requests(user_id,start_on,end_on,created_on) VALUES(?,?,?,?)', [$u['id'], $start, $end, date('Y-m-d')]); return $result;
    }
    if ($route === '/dashboard') {
        $wallets = peer('ledger', 'GET', '/wallets', $u['token']); $totals = [];
        foreach ($wallets as $w) $totals[$w['currency']] = sum_money($totals[$w['currency']] ?? 0, $w['balance_minor']);
        return $result + ['wallets' => $wallets, 'wallet_total_minor_by_currency' => $totals ?: (object)[]];
    }
    if ($route === '/compare') {
        $previous = report_data($u, date_value($_GET['previous_start'] ?? null), date_value($_GET['previous_end'] ?? null));
        $difference = []; $nowTotals = (array)$result['by_currency']; $previousTotals = (array)$previous['by_currency'];
        foreach (array_unique(array_merge(array_keys($nowTotals), array_keys($previousTotals))) as $unit) {
            foreach (['income_minor', 'expense_minor', 'net_minor'] as $key) $difference[$unit][$key] = sum_money($nowTotals[$unit][$key] ?? 0, -($previousTotals[$unit][$key] ?? 0));
        }
        return ['current' => $result, 'previous' => $previous, 'difference_minor' => $difference ?: (object)[]];
    }
    $stream = fopen('php://temp', 'w+'); fwrite($stream, "\xEF\xBB\xBF");
    fputcsv($stream, ['currency', 'income', 'expense', 'net'], ',', '"', '\\');
    foreach ($result['by_currency'] as $unit => $total) fputcsv($stream, [$unit, $total['income'], $total['expense'], $total['net']], ',', '"', '\\');
    rewind($stream); $csv = stream_get_contents($stream); fclose($stream); return ['_csv' => $csv];
});
