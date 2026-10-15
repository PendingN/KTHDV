"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRightIcon, PlusIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type {
  Budget,
  Currency,
  Dashboard as DashboardData,
  Subscription,
  Transaction,
} from "@/lib/contracts";
import { formatMoney, monthRange } from "@/lib/money";
import {
  Page,
  Panel,
  DateRange,
  ResourceState,
  DataTable,
  Progress,
  Notice,
  useResource,
} from "./common";
import { TotalsTable } from "./reports";
import { DashboardSkeleton, TableSkeleton } from "./loading";
export function Dashboard() {
  const [range, setRange] = useState(monthRange),
    query = "?start=" + range.start + "&end=" + range.end;
  const dashboard = useResource<DashboardData>(
      "reporting",
      "/dashboard" + query,
    ),
    budgets = useResource<Budget[]>("planning", "/budgets"),
    subscriptions = useResource<Subscription[]>("recurring", "/subscriptions"),
    transactions = useResource<Transaction[]>(
      "ledger",
      "/transactions" + query + "&limit=5",
    );
  const upcoming = subscriptions.data
    ?.filter((s) => s.active)
    .sort((a, b) => a.next_due.localeCompare(b.next_due))
    .slice(0, 5);
  return (
    <Page
      title="Tổng quan"
      actions={
        <Link href="/transactions" className={buttonVariants()}>
          <PlusIcon />
          Ghi thu / chi
        </Link>
      }
    >
      <DateRange range={range} onChange={setRange} />
      <ResourceState resource={dashboard} fallback={<DashboardSkeleton />} />
      {dashboard.data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(dashboard.data.wallet_total_minor_by_currency).map(
              ([unit, total]) => (
                <Panel key={unit} title={"Tổng số dư · " + unit}>
                  <p className="break-words text-2xl font-semibold tracking-tight">
                    {formatMoney(total, unit as Currency)}
                  </p>
                </Panel>
              ),
            )}
          </div>
          {dashboard.data.wallets.length === 0 && (
            <Notice>
              <Link className="underline" href="/accounts">
                Thêm ví & danh mục
              </Link>
            </Notice>
          )}
          <Panel title="Thu chi trong kỳ">
            <TotalsTable report={dashboard.data} />
          </Panel>
        </>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Ngân sách">
          <ResourceState
            resource={budgets}
            empty={budgets.data?.filter((b) => b.active).length === 0}
          />
          {budgets.data
            ?.filter((b) => b.active)
            .slice(0, 4)
            .map((b) => (
              <div key={b.id} className="space-y-2 border-b py-4">
                <div className="flex justify-between gap-3">
                  <span className="text-sm font-medium">{b.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatMoney(b.spent_minor, b.currency)}
                  </span>
                </div>
                <Progress value={b.used_percent} />
              </div>
            ))}
          <Link
            className="mt-4 inline-flex items-center gap-1 text-sm underline underline-offset-4"
            href="/budgets"
          >
            Quản lý ngân sách
            <ArrowRightIcon className="size-3" />
          </Link>
        </Panel>
        <Panel title="Sắp đến hạn">
          <ResourceState
            resource={subscriptions}
            empty={upcoming?.length === 0}
          />
          {upcoming?.map((s) => (
            <div
              key={s.id}
              className="flex items-start justify-between gap-3 border-b py-4"
            >
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.next_due}
                </p>
              </div>
              <p className="text-sm">
                {formatMoney(s.amount_minor, s.currency)}
              </p>
            </div>
          ))}
          <Link
            className="mt-4 inline-block text-sm underline underline-offset-4"
            href="/subscriptions"
          >
            Quản lý khoản định kỳ
          </Link>
        </Panel>
      </div>
      <Panel title="Giao dịch trong kỳ">
        <ResourceState
          resource={transactions}
          fallback={<TableSkeleton />}
          empty={transactions.data?.length === 0}
        />
        {!!transactions.data?.length && (
          <DataTable
            columns={["Ngày", "Nội dung", "Loại", "Số tiền"]}
            rows={transactions.data.map((t) => ({
              id: t.id,
              cells: [
                t.occurred_on,
                t.note || "Không có ghi chú",
                t.reversal_of
                  ? "Bút toán đảo"
                  : t.kind === "income"
                    ? "Thu nhập"
                    : t.kind === "expense"
                      ? "Chi tiêu"
                      : "Chuyển ví",
                formatMoney(t.amount_minor, t.currency),
              ],
            }))}
          />
        )}
        <Link
          className="mt-4 inline-block text-sm underline underline-offset-4"
          href="/transactions"
        >
          Xem giao dịch
        </Link>
      </Panel>
    </Page>
  );
}
