"use client";
import { useState } from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Category, Transaction, Wallet } from "@/lib/contracts";
import { amountInput, formatMoney, monthRange, today } from "@/lib/money";
import { TableSkeleton } from "./loading";
import {
  Page,
  Panel,
  Notice,
  DateRange,
  ResourceState,
  DataTable,
  Editor,
  Action,
  useResource,
  type Values,
} from "./common";
export function Transactions({
  draft,
}: {
  draft?: { note: string; amount: string; currency: string };
}) {
  const [range, setRange] = useState(monthRange),
    [offset, setOffset] = useState(0);
  const wallets = useResource<Wallet[]>("ledger", "/wallets"),
    categories = useResource<Category[]>("ledger", "/categories");
  const transactions = useResource<Transaction[]>(
    "ledger",
    "/transactions?start=" +
      range.start +
      "&end=" +
      range.end +
      "&limit=51&offset=" +
      offset,
  );
  const [edit, setEdit] = useState<{ item?: Transaction; key?: string } | null>(
    draft ? { key: crypto.randomUUID() } : null,
  );
  const activeWallets = wallets.data?.filter((w) => w.active) || [],
    activeCategories = categories.data?.filter((c) => c.active) || [];
  const items = transactions.data?.slice(0, 50) || [];
  const reversed = new Set(
    items.filter((t) => t.reversal_of).map((t) => t.reversal_of),
  );
  const initial: Values = {
    wallet_id: String(
      edit?.item?.wallet_id ||
        activeWallets.find((w) => !draft || w.currency === draft.currency)
          ?.id ||
        "",
    ),
    category_id: String(
      edit?.item?.category_id ||
        activeCategories.find((c) => c.kind === "expense")?.id ||
        "",
    ),
    kind: edit?.item?.kind || "expense",
    amount: edit?.item
      ? amountInput(edit.item.amount_minor, edit.item.currency)
      : draft?.amount || "",
    occurred_on: edit?.item?.occurred_on || today(),
    note: edit?.item?.note || draft?.note || "",
  };
  return (
    <Page
      title="Giao dịch"
      actions={
        <Button
          disabled={!activeWallets.length || !activeCategories.length}
          onClick={() => setEdit({ key: crypto.randomUUID() })}
        >
          <PlusIcon />
          Ghi thu / chi
        </Button>
      }
    >
      <DateRange
        range={range}
        onChange={(r) => {
          setRange(r);
          setOffset(0);
        }}
      />
      <ResourceState resource={wallets} fallback={null} />
      <ResourceState resource={categories} fallback={null} />
      {wallets.data &&
        categories.data &&
        (!activeWallets.length || !activeCategories.length) && (
          <Notice>
            <Link href="/accounts" className="underline">
              Thêm ví & danh mục
            </Link>
            {" để ghi thu chi."}
          </Notice>
        )}
      <Panel title="Lịch sử giao dịch">
        <ResourceState
          resource={transactions}
          fallback={<TableSkeleton columns={6} />}
          empty={transactions.data?.length === 0}
        />
        {!!items.length && (
          <>
            <DataTable
              columns={[
                "Ngày",
                "Nội dung",
                "Ví / danh mục",
                "Loại",
                "Số tiền",
                "Thao tác",
              ]}
              rows={items.map((t) => ({
                id: t.id,
                cells: [
                  t.occurred_on,
                  <div key="note">
                    {t.note || "Không có ghi chú"}
                    <p className="text-xs text-muted-foreground">
                      {t.reversal_of
                        ? "Bút toán đảo của #" + t.reversal_of
                        : "#" + t.id}
                    </p>
                  </div>,
                  <div key="refs">
                    {wallets.data?.find((w) => w.id === t.wallet_id)?.name ||
                      "Ví #" + t.wallet_id}
                    <p className="text-xs text-muted-foreground">
                      {
                        categories.data?.find((c) => c.id === t.category_id)
                          ?.name
                      }
                    </p>
                  </div>,
                  t.kind === "income"
                    ? "Thu nhập"
                    : t.kind === "expense"
                      ? "Chi tiêu"
                      : "Chuyển ví",
                  <span key="amount" className="whitespace-nowrap font-medium">
                    {formatMoney(t.amount_minor, t.currency)}
                  </span>,
                  t.kind !== "transfer" &&
                  !t.reversal_of &&
                  !reversed.has(t.id) ? (
                    <div key="actions" className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEdit({ item: t })}
                      >
                        Điều chỉnh
                      </Button>
                      <Action
                        confirm="Hủy giao dịch bằng bút toán đảo? Lịch sử gốc vẫn được giữ."
                        run={() =>
                          api("ledger", "/transactions/" + t.id + "/reverse", {
                            method: "POST",
                          })
                        }
                        onDone={transactions.reload}
                      >
                        Hủy giao dịch
                      </Action>
                    </div>
                  ) : (
                    "—"
                  ),
                ],
              }))}
            />
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Trang {offset / 50 + 1} · theo thứ tự thời gian
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={offset === 0}
                  onClick={() => setOffset((n) => Math.max(0, n - 50))}
                >
                  Trước
                </Button>
                <Button
                  variant="outline"
                  disabled={(transactions.data?.length || 0) <= 50}
                  onClick={() => setOffset((n) => n + 50)}
                >
                  Sau
                </Button>
              </div>
            </div>
          </>
        )}
      </Panel>
      {edit && wallets.data && categories.data && (
        <Editor
          title={edit.item ? "Điều chỉnh giao dịch" : "Ghi thu / chi"}
          description={
            edit.item
              ? "Tạo bút toán đảo và giao dịch mới; giữ lịch sử gốc."
              : "Dùng dấu chấm cho số thập phân."
          }
          initial={initial}
          fields={(v) => [
            {
              name: "kind",
              label: "Loại giao dịch",
              options: [
                { value: "expense", label: "Chi tiêu" },
                { value: "income", label: "Thu nhập" },
              ],
            },
            {
              name: "wallet_id",
              label: "Ví tiền",
              options: activeWallets.map((w) => ({
                value: String(w.id),
                label: w.name + " · " + w.currency,
              })),
            },
            {
              name: "category_id",
              label: "Danh mục",
              options: activeCategories
                .filter((c) => c.kind === v.kind)
                .map((c) => ({ value: String(c.id), label: c.name })),
            },
            {
              name: "amount",
              label:
                "Số tiền (" +
                (activeWallets.find((w) => String(w.id) === v.wallet_id)
                  ?.currency || "") +
                ")",
              money: true,
            },
            { name: "occurred_on", label: "Ngày giao dịch", type: "date" },
            { name: "note", label: "Ghi chú", required: false, maxLength: 500 },
          ]}
          onClose={() => setEdit(null)}
          onSave={async (v) => {
            await api(
              "ledger",
              "/transactions" +
                (edit.item ? "/" + edit.item.id + "/adjust" : ""),
              {
                method: "POST",
                key: edit.key,
                body: {
                  ...v,
                  wallet_id: Number(v.wallet_id),
                  category_id: Number(v.category_id),
                },
              },
            );
            transactions.reload();
            wallets.reload();
          }}
        />
      )}
    </Page>
  );
}
