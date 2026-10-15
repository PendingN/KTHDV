"use client";
import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Subscription, Suggestion } from "@/lib/contracts";
import { amountInput, formatMoney, today } from "@/lib/money";
import { TableSkeleton } from "./loading";
import {
  Page,
  Panel,
  ResourceState,
  DataTable,
  Editor,
  Action,
  Notice,
  useResource,
  currencyOptions,
} from "./common";
const periods = {
  weekly: "Hằng tuần",
  monthly: "Hằng tháng",
  yearly: "Hằng năm",
};
export function Recurring() {
  const subscriptions = useResource<Subscription[]>(
      "recurring",
      "/subscriptions",
    ),
    suggestions = useResource<Suggestion[]>("recurring", "/suggestions");
  const [edit, setEdit] = useState<{
      item?: Subscription;
      suggestion?: Suggestion;
    } | null>(null),
    [checked, setChecked] = useState(false);
  const s = edit?.item,
    suggestion = edit?.suggestion;
  return (
    <Page
      title="Khoản định kỳ"
      actions={
        <>
          <Button onClick={() => setEdit({})}>Thêm khoản định kỳ</Button>
          <Action
            run={() => api("recurring", "/reminders/check", { method: "POST" })}
            onDone={() => setChecked(true)}
          >
            Kiểm tra nhắc hạn
          </Action>
        </>
      }
    >
      <p className="text-xs text-muted-foreground">
        “Đã thanh toán” chỉ cập nhật lịch; ghi khoản chi riêng để trừ ví.
      </p>
      {checked && (
        <Notice>
          Đã kiểm tra nhắc hạn.{" "}
          <Link href="/notifications" className="underline">
            Xem thông báo
          </Link>
        </Notice>
      )}
      <Panel title="Danh sách định kỳ">
        <ResourceState
          resource={subscriptions}
          fallback={<TableSkeleton columns={5} />}
          empty={subscriptions.data?.length === 0}
        />
        {!!subscriptions.data?.length && (
          <DataTable
            columns={[
              "Khoản định kỳ",
              "Số tiền",
              "Chu kỳ",
              "Đến hạn",
              "Thao tác",
            ]}
            rows={subscriptions.data.map((item) => ({
              id: item.id,
              cells: [
                <div key="name" className="font-medium">
                  {item.name}
                  {!item.active && (
                    <p className="text-xs text-muted-foreground">
                      Đã ngừng theo dõi
                    </p>
                  )}
                </div>,
                formatMoney(item.amount_minor, item.currency),
                periods[item.period],
                <div key="due">
                  {item.next_due}
                  <p className="text-xs text-muted-foreground">
                    Nhắc trước {item.remind_days} ngày
                  </p>
                </div>,
                item.active ? (
                  <div key="actions" className="flex flex-wrap gap-2">
                    <Action
                      confirm="Chuyển sang kỳ tiếp theo? Khoản chi cần ghi riêng."
                      run={() =>
                        api(
                          "recurring",
                          "/subscriptions/" + item.id + "/paid",
                          { method: "POST" },
                        )
                      }
                      onDone={subscriptions.reload}
                    >
                      Đã thanh toán
                    </Action>
                    <Link
                      href={
                        "/transactions?expense=" +
                        encodeURIComponent(item.name) +
                        "&amount=" +
                        amountInput(item.amount_minor, item.currency) +
                        "&currency=" +
                        item.currency
                      }
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      Ghi khoản chi
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEdit({ item })}
                    >
                      Sửa
                    </Button>
                    <Action
                      confirm="Ngừng theo dõi khoản định kỳ này?"
                      run={() =>
                        api("recurring", "/subscriptions/" + item.id, {
                          method: "DELETE",
                        })
                      }
                      onDone={subscriptions.reload}
                    >
                      Dừng
                    </Action>
                  </div>
                ) : (
                  "—"
                ),
              ],
            }))}
          />
        )}
      </Panel>
      <Panel title="Gợi ý định kỳ">
        <ResourceState
          resource={suggestions}
          empty={suggestions.data?.length === 0}
        />
        {suggestions.data?.map((item, i) => (
          <div
            key={i}
            className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
          >
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatMoney(item.amount_minor, item.currency)} ·{" "}
                {item.occurrences} lần
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setEdit({ suggestion: item })}
            >
              Tạo lịch theo dõi
            </Button>
          </div>
        ))}
      </Panel>
      {edit && (
        <Editor
          title={s ? "Sửa khoản định kỳ" : "Thêm khoản định kỳ"}
          initial={{
            name: s?.name || suggestion?.name || "",
            amount: s
              ? amountInput(s.amount_minor, s.currency)
              : suggestion
                ? amountInput(suggestion.amount_minor, suggestion.currency)
                : "",
            currency: s?.currency || suggestion?.currency || "VND",
            period: s?.period || "monthly",
            next_due: s?.next_due || today(),
            remind_days: String(s?.remind_days ?? 3),
          }}
          fields={[
            { name: "name", label: "Tên khoản định kỳ" },
            { name: "amount", label: "Số tiền", money: true },
            { name: "currency", label: "Tiền tệ", options: currencyOptions },
            {
              name: "period",
              label: "Chu kỳ",
              options: Object.entries(periods).map(([value, label]) => ({
                value,
                label,
              })),
            },
            { name: "next_due", label: "Ngày đến hạn", type: "date" },
            {
              name: "remind_days",
              label: "Nhắc trước (ngày)",
              type: "number",
              min: 0,
              max: 30,
            },
          ]}
          onClose={() => setEdit(null)}
          onSave={async (v) => {
            await api("recurring", "/subscriptions" + (s ? "/" + s.id : ""), {
              method: s ? "PUT" : "POST",
              body: { ...v, remind_days: Number(v.remind_days) },
            });
            subscriptions.reload();
            suggestions.reload();
          }}
        />
      )}
    </Page>
  );
}
