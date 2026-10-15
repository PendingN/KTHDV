"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import type { Comparison, Currency, Report } from "@/lib/contracts";
import { formatMoney, monthRange, previousRange } from "@/lib/money";
import { TableSkeleton } from "./loading";
import {
  Page,
  Panel,
  DateRange,
  ResourceState,
  DataTable,
  Action,
  useResource,
} from "./common";
export function TotalsTable({ report }: { report: Report }) {
  const entries = Object.entries(report.by_currency);
  return entries.length ? (
    <DataTable
      columns={["Tiền tệ", "Thu nhập", "Chi tiêu", "Chênh lệch"]}
      rows={entries.map(([unit, total]) => ({
        id: unit,
        cells: [
          unit,
          formatMoney(total.income_minor, unit as Currency),
          formatMoney(total.expense_minor, unit as Currency),
          formatMoney(total.net_minor, unit as Currency),
        ],
      }))}
    />
  ) : (
    <p role="status" className="py-2 text-sm text-muted-foreground">
      Chưa có thu chi.
    </p>
  );
}
export function Reports() {
  const [range, setRange] = useState(monthRange),
    [previous, setPrevious] = useState(() =>
      previousRange(range.start, range.end),
    );
  const query = "?start=" + range.start + "&end=" + range.end;
  const report = useResource<Report>("reporting", "/reports" + query),
    comparison = useResource<Comparison>(
      "reporting",
      "/compare" +
        query +
        "&previous_start=" +
        previous.start +
        "&previous_end=" +
        previous.end,
    );
  async function download() {
    const blob = await api<Blob>("reporting", "/reports.csv" + query, {
        blob: true,
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "thu-chi-" + range.start + "-" + range.end + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Page
      title="Báo cáo thu chi"
      actions={<Action run={download}>Tải CSV</Action>}
    >
      <DateRange
        range={range}
        onChange={(r) => {
          setRange(r);
          setPrevious(previousRange(r.start, r.end));
        }}
      />
      <Panel title="Thu chi trong kỳ">
        <ResourceState resource={report} fallback={<TableSkeleton />} />
        {report.data && (
          <>
            <p className="mb-4 text-xs text-muted-foreground">
              {report.data.start} đến {report.data.end} ·{" "}
              {report.data.record_count} bút toán
            </p>
            <TotalsTable report={report.data} />
          </>
        )}
      </Panel>
      <Panel title="So sánh với kỳ khác">
        <div className="mb-5">
          <DateRange
            key={previous.start + previous.end}
            id="previous"
            range={previous}
            onChange={setPrevious}
          />
        </div>
        <ResourceState
          resource={comparison}
          fallback={
            <div className="space-y-5">
              <TableSkeleton />
              <TableSkeleton />
            </div>
          }
        />
        {comparison.data && (
          <div className="space-y-5">
            <TotalsTable report={comparison.data.previous} />
            <div>
              <h2 className="mb-3 text-sm font-medium">Chênh lệch</h2>
              <DataTable
                columns={["Tiền tệ", "Thu nhập", "Chi tiêu", "Ròng"]}
                rows={Object.entries(comparison.data.difference_minor).map(
                  ([unit, t]) => ({
                    id: unit,
                    cells: [
                      unit,
                      formatMoney(t.income_minor, unit as Currency),
                      formatMoney(t.expense_minor, unit as Currency),
                      formatMoney(t.net_minor, unit as Currency),
                    ],
                  }),
                )}
              />
            </div>
          </div>
        )}
      </Panel>
    </Page>
  );
}
