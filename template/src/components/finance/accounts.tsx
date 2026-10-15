"use client";
import { useState } from "react";
import { PlusIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Wallet, Category } from "@/lib/contracts";
import { formatMoney } from "@/lib/money";
import { CardsSkeleton, TableSkeleton } from "./loading";
import {
  Page,
  Panel,
  ResourceState,
  DataTable,
  Editor,
  Action,
  currencyOptions,
  useResource,
} from "./common";
export function Accounts() {
  const wallets = useResource<Wallet[]>("ledger", "/wallets"),
    categories = useResource<Category[]>("ledger", "/categories");
  const [edit, setEdit] = useState<{
    type: "wallets" | "categories";
    item?: Wallet | Category;
  } | null>(null);
  function reload() {
    wallets.reload();
    categories.reload();
  }
  return (
    <Page
      title="Ví & danh mục"
      actions={
        <>
          <Button onClick={() => setEdit({ type: "wallets" })}>
            <PlusIcon />
            Thêm ví
          </Button>
          <Button
            variant="outline"
            onClick={() => setEdit({ type: "categories" })}
          >
            Thêm danh mục
          </Button>
        </>
      }
    >
      <Panel title="Ví tiền">
        <ResourceState
          resource={wallets}
          empty={wallets.data?.length === 0}
          fallback={<CardsSkeleton />}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {wallets.data?.map((w) => (
            <div
              key={w.id}
              className="motion-item space-y-4 rounded-xl border bg-muted/20 p-5"
            >
              <div className="flex items-center justify-between">
                <WalletIcon className="size-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {w.active ? "Đang dùng" : "Đã ngừng dùng"}
                </span>
              </div>
              <div>
                <h2 className="font-medium">{w.name}</h2>
                <p className="mt-2 break-words text-2xl font-semibold tracking-tight">
                  {formatMoney(w.balance_minor, w.currency)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEdit({ type: "wallets", item: w })}
                >
                  Đổi tên
                </Button>
                <Action
                  confirm={
                    w.active
                      ? "Ngừng dùng ví này? Lịch sử giao dịch vẫn được giữ."
                      : undefined
                  }
                  run={() =>
                    api("ledger", "/wallets/" + w.id, {
                      method: "PATCH",
                      body: { name: w.name, active: !w.active },
                    })
                  }
                  onDone={reload}
                >
                  {w.active ? "Ngừng dùng" : "Dùng lại"}
                </Action>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Danh mục thu chi">
        <ResourceState
          resource={categories}
          fallback={<TableSkeleton />}
          empty={categories.data?.length === 0}
        />
        {!!categories.data?.length && (
          <DataTable
            columns={["Tên danh mục", "Loại", "Trạng thái", "Thao tác"]}
            rows={categories.data.map((c) => ({
              id: c.id,
              cells: [
                c.name,
                c.kind === "income" ? "Thu nhập" : "Chi tiêu",
                c.active ? "Đang dùng" : "Đã ngừng dùng",
                <div key="actions" className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEdit({ type: "categories", item: c })}
                  >
                    Đổi tên
                  </Button>
                  <Action
                    confirm={c.active ? "Ngừng dùng danh mục này?" : undefined}
                    run={() =>
                      api("ledger", "/categories/" + c.id, {
                        method: "PATCH",
                        body: { name: c.name, active: !c.active },
                      })
                    }
                    onDone={reload}
                  >
                    {c.active ? "Ngừng dùng" : "Dùng lại"}
                  </Action>
                </div>,
              ],
            }))}
          />
        )}
      </Panel>
      {edit && (
        <Editor
          title={
            (edit.item ? "Đổi tên " : "Thêm ") +
            (edit.type === "wallets" ? "ví" : "danh mục")
          }
          initial={{
            name: edit.item?.name || "",
            currency: "VND",
            kind: "expense",
          }}
          fields={[
            { name: "name", label: "Tên" },
            ...(!edit.item
              ? edit.type === "wallets"
                ? [
                    {
                      name: "currency",
                      label: "Tiền tệ",
                      options: currencyOptions,
                    },
                  ]
                : [
                    {
                      name: "kind",
                      label: "Loại danh mục",
                      options: [
                        { value: "income", label: "Thu nhập" },
                        { value: "expense", label: "Chi tiêu" },
                      ],
                    },
                  ]
              : []),
          ]}
          onClose={() => setEdit(null)}
          onSave={async (v) => {
            await api(
              "ledger",
              "/" + edit.type + (edit.item ? "/" + edit.item.id : ""),
              {
                method: edit.item ? "PATCH" : "POST",
                body: edit.item
                  ? { name: v.name, active: !!edit.item.active }
                  : edit.type === "wallets"
                    ? { name: v.name, currency: v.currency }
                    : { name: v.name, kind: v.kind },
              },
            );
            reload();
          }}
        />
      )}
    </Page>
  );
}
