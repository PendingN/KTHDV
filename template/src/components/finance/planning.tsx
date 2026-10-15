"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Budget, Category, Goal } from "@/lib/contracts";
import { amountInput, formatMoney, monthRange, today } from "@/lib/money";
import {
  Page,
  Panel,
  ResourceState,
  Progress,
  Editor,
  Action,
  Notice,
  useResource,
  currencyOptions,
  type Field,
  type Values,
} from "./common";
export function Planning() {
  const budgets = useResource<Budget[]>("planning", "/budgets"),
    goals = useResource<Goal[]>("planning", "/goals"),
    categories = useResource<Category[]>("ledger", "/categories");
  const [edit, setEdit] = useState<{
    type: "budget" | "goal" | "contribution";
    budget?: Budget;
    goal?: Goal;
  } | null>(null);
  const expenses =
    categories.data?.filter((c) => c.active && c.kind === "expense") || [];
  function reload() {
    budgets.reload();
    goals.reload();
  }
  let initial: Values = {},
    fields: Field[] = [];
  if (edit?.type === "budget") {
    const b = edit.budget;
    initial = {
      name: b?.name || "",
      category_id: String(b?.category_id || expenses[0]?.id || ""),
      currency: b?.currency || "VND",
      limit_amount: b ? amountInput(b.limit_minor, b.currency) : "",
      start_on: b?.start_on || monthRange().start,
      end_on: b?.end_on || monthRange().end,
      threshold: String(b?.threshold || 80),
    };
    const options = expenses.map((c) => ({
      value: String(c.id),
      label: c.name,
    }));
    if (b && !options.some((c) => c.value === String(b.category_id)))
      options.push({
        value: String(b.category_id),
        label:
          categories.data?.find((c) => c.id === b.category_id)?.name ||
          "Danh mục đã ngừng dùng",
      });
    fields = [
      { name: "name", label: "Tên ngân sách" },
      { name: "category_id", label: "Danh mục chi", options, disabled: !!b },
      {
        name: "currency",
        label: "Tiền tệ",
        options: currencyOptions,
        disabled: !!b,
      },
      { name: "limit_amount", label: "Hạn mức", money: true },
      { name: "start_on", label: "Bắt đầu", type: "date", disabled: !!b },
      { name: "end_on", label: "Kết thúc", type: "date", disabled: !!b },
      {
        name: "threshold",
        label: "Cảnh báo tại (%)",
        type: "number",
        min: 1,
        max: 100,
      },
    ];
  } else if (edit?.type === "goal") {
    const g = edit.goal;
    initial = {
      name: g?.name || "",
      currency: g?.currency || "VND",
      target_amount: g ? amountInput(g.target_minor, g.currency) : "",
      deadline: g?.deadline || today(),
    };
    fields = [
      { name: "name", label: "Tên mục tiêu" },
      {
        name: "currency",
        label: "Tiền tệ",
        options: currencyOptions,
        disabled: !!g,
      },
      { name: "target_amount", label: "Số tiền mục tiêu", money: true },
      { name: "deadline", label: "Ngày mục tiêu", type: "date" },
    ];
  } else if (edit) {
    initial = { amount: "" };
    fields = [
      {
        name: "amount",
        label: "Số tiền góp (" + edit.goal?.currency + ")",
        money: true,
      },
    ];
  }
  return (
    <Page
      title="Ngân sách & mục tiêu"
      actions={
        <>
          <Button
            disabled={!expenses.length}
            onClick={() => setEdit({ type: "budget" })}
          >
            Thêm ngân sách
          </Button>
          <Button variant="outline" onClick={() => setEdit({ type: "goal" })}>
            Thêm mục tiêu
          </Button>
        </>
      }
    >
      <ResourceState resource={categories} />
      {categories.data && !expenses.length && (
        <Notice>
          <Link className="underline" href="/accounts">
            Thêm danh mục chi
          </Link>{" "}
          để lập ngân sách.
        </Notice>
      )}
      <Panel title="Ngân sách">
        <div className="mb-4">
          <Action
            run={() => api("planning", "/budgets/evaluate", { method: "POST" })}
            onDone={budgets.reload}
          >
            Kiểm tra ngưỡng cảnh báo
          </Action>
        </div>
        <ResourceState resource={budgets} empty={budgets.data?.length === 0} />
        <div className="grid gap-4 lg:grid-cols-2">
          {budgets.data?.map((b) => (
            <div key={b.id} className="space-y-4 rounded-xl border p-5">
              <div className="flex justify-between gap-2">
                <h2 className="font-medium">{b.name}</h2>
                <span className="text-xs text-muted-foreground">
                  {b.active ? "Đang theo dõi" : "Đã dừng"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {b.start_on} đến {b.end_on} · cảnh báo {b.threshold}%
              </p>
              <p className="text-sm">
                <strong>{formatMoney(b.spent_minor, b.currency)}</strong> /{" "}
                {formatMoney(b.limit_minor, b.currency)}
              </p>
              <Progress value={b.used_percent} />
              {!!b.active && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEdit({ type: "budget", budget: b })}
                  >
                    Sửa ngân sách
                  </Button>
                  <Action
                    confirm="Dừng theo dõi ngân sách này?"
                    run={() =>
                      api("planning", "/budgets/" + b.id, { method: "DELETE" })
                    }
                    onDone={reload}
                  >
                    Dừng theo dõi
                  </Action>
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Mục tiêu tích lũy">
        <p className="mb-4 text-sm text-muted-foreground">
          Góp mục tiêu không trừ số dư ví.
        </p>
        <ResourceState resource={goals} empty={goals.data?.length === 0} />
        <div className="grid gap-4 lg:grid-cols-2">
          {goals.data?.map((g) => (
            <div key={g.id} className="space-y-4 rounded-xl border p-5">
              <div className="flex justify-between gap-2">
                <h2 className="font-medium">{g.name}</h2>
                <span className="text-xs text-muted-foreground">
                  {g.active ? "Đang tích lũy" : "Đã kết thúc"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Mục tiêu đến {g.deadline}
              </p>
              <p className="text-sm">
                <strong>{formatMoney(g.saved_minor, g.currency)}</strong> /{" "}
                {formatMoney(g.target_minor, g.currency)}
              </p>
              <Progress value={g.progress_percent} />
              {!!g.active && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => setEdit({ type: "contribution", goal: g })}
                  >
                    Góp mục tiêu
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEdit({ type: "goal", goal: g })}
                  >
                    Sửa mục tiêu
                  </Button>
                  <Action
                    confirm="Kết thúc theo dõi mục tiêu này?"
                    run={() =>
                      api("planning", "/goals/" + g.id, { method: "DELETE" })
                    }
                    onDone={reload}
                  >
                    Kết thúc
                  </Action>
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>
      {edit && (
        <Editor
          title={
            edit.type === "budget"
              ? edit.budget
                ? "Sửa ngân sách"
                : "Thêm ngân sách"
              : edit.type === "contribution"
                ? "Góp mục tiêu"
                : edit.goal
                  ? "Sửa mục tiêu"
                  : "Thêm mục tiêu"
          }
          description={
            edit.type === "contribution"
              ? "Chỉ cập nhật tiến độ, không trừ số dư ví."
              : edit.budget
                ? "Tạo ngân sách mới để đổi danh mục, tiền tệ hoặc kỳ."
                : undefined
          }
          initial={initial}
          fields={fields}
          onClose={() => setEdit(null)}
          onSave={async (v) => {
            if (edit.type === "contribution")
              await api(
                "planning",
                "/goals/" + edit.goal!.id + "/contributions",
                { method: "POST", body: v },
              );
            else {
              const item = edit.budget || edit.goal;
              await api(
                "planning",
                "/" +
                  (edit.type === "budget" ? "budgets" : "goals") +
                  (item ? "/" + item.id : ""),
                {
                  method: item ? "PUT" : "POST",
                  body:
                    edit.type === "budget"
                      ? {
                          ...v,
                          category_id: Number(v.category_id),
                          threshold: Number(v.threshold),
                        }
                      : v,
                },
              );
            }
            reload();
          }}
        />
      )}
    </Page>
  );
}
