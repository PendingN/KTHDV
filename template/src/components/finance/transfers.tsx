"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Wallet } from "@/lib/contracts";
import { today, formatMoney } from "@/lib/money";
import {
  Page,
  Panel,
  Editor,
  Notice,
  ResourceState,
  useResource,
} from "./common";
export function Transfers() {
  const wallets = useResource<Wallet[]>("ledger", "/wallets"),
    [open, setOpen] = useState(false),
    [success, setSuccess] = useState(false);
  const active = wallets.data?.filter((w) => w.active) || [],
    source = active.find((w) =>
      active.some((t) => t.id !== w.id && t.currency === w.currency),
    ),
    target = active.find(
      (w) => w.id !== source?.id && w.currency === source?.currency,
    );
  return (
    <Page
      title="Chuyển tiền"
      actions={
        <Button
          disabled={!source}
          onClick={() => {
            setOpen(true);
            setSuccess(false);
          }}
        >
          Chuyển giữa hai ví
        </Button>
      }
    >
      <ResourceState resource={wallets} />
      {success && <Notice>Đã chuyển tiền.</Notice>}
      {wallets.data && !source && (
        <Notice>
          Cần 2 ví đang dùng cùng tiền tệ.{" "}
          <Link className="underline" href="/accounts">
            Quản lý ví
          </Link>
        </Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {wallets.data?.map((w) => (
          <Panel key={w.id} title={w.name}>
            <p className="text-2xl font-semibold">
              {formatMoney(w.balance_minor, w.currency)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {w.active ? "Đang dùng" : "Đã ngừng dùng"}
            </p>
          </Panel>
        ))}
      </div>
      {open && (
        <Editor
          title="Chuyển tiền giữa ví"
          description="Hai ví phải cùng tiền tệ."
          initial={{
            from_wallet: String(source?.id || ""),
            to_wallet: String(target?.id || ""),
            amount: "",
            occurred_on: today(),
          }}
          fields={(v) => [
            {
              name: "from_wallet",
              label: "Ví nguồn",
              options: active.map((w) => ({
                value: String(w.id),
                label: w.name + " · " + w.currency,
              })),
            },
            {
              name: "to_wallet",
              label: "Ví nhận",
              options: active
                .filter(
                  (w) =>
                    String(w.id) !== v.from_wallet &&
                    w.currency ===
                      active.find((s) => String(s.id) === v.from_wallet)
                        ?.currency,
                )
                .map((w) => ({
                  value: String(w.id),
                  label: w.name + " · " + w.currency,
                })),
            },
            { name: "amount", label: "Số tiền", money: true },
            { name: "occurred_on", label: "Ngày chuyển", type: "date" },
          ]}
          onClose={() => setOpen(false)}
          onSave={async (v) => {
            await api("ledger", "/transfers", {
              method: "POST",
              body: {
                ...v,
                from_wallet: Number(v.from_wallet),
                to_wallet: Number(v.to_wallet),
              },
            });
            wallets.reload();
            setSuccess(true);
          }}
        />
      )}
    </Page>
  );
}
