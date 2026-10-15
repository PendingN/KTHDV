"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { Conversion, Rate } from "@/lib/contracts";
import { today } from "@/lib/money";
import {
  Page,
  Panel,
  Notice,
  ResourceState,
  DataTable,
  FieldInput,
  currencyOptions,
  useResource,
  type Field,
} from "./common";
export function Exchange() {
  const rates = useResource<Rate[]>("fx", "/rates"),
    [values, setValues] = useState({
      base: "USD",
      quote: "VND",
      amount: "",
      as_of: today(),
    }),
    [result, setResult] = useState<Conversion | null>(null),
    [error, setError] = useState<ApiError | null>(null),
    [busy, setBusy] = useState(false);
  const fields: Field[] = [
    { name: "base", label: "Từ tiền tệ", options: currencyOptions },
    { name: "quote", label: "Sang tiền tệ", options: currencyOptions },
    { name: "amount", label: "Số tiền", money: true },
    { name: "as_of", label: "Theo ngày", type: "date" },
  ];
  async function convert(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(
        await api<Conversion>("fx", "/convert", {
          method: "POST",
          body: values,
        }),
      );
    } catch (e) {
      setError(
        e instanceof ApiError ? e : new ApiError("Chưa quy đổi được", 502),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="Quy đổi tiền tệ">
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Quy đổi">
          <form className="space-y-4" onSubmit={convert}>
            <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => (
                <FieldInput
                  key={f.name}
                  field={f}
                  value={values[f.name as keyof typeof values]}
                  onChange={(v) => {
                    setValues((old) => ({ ...old, [f.name]: v }));
                    setResult(null);
                  }}
                  error={error?.fields[f.name]}
                />
              ))}
            </fieldset>
            {error && <Notice error>{error.message}</Notice>}
            <Button type="submit" disabled={busy}>
              {busy ? "Đang quy đổi…" : "Quy đổi"}
            </Button>
          </form>
        </Panel>
        <Panel title="Kết quả">
          {result ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {result.amount} {result.base}
              </p>
              <p className="break-words text-3xl font-semibold tracking-tight">
                {result.converted_amount} {result.quote}
              </p>
              <p className="text-sm">
                1 {result.base} = {result.rate} {result.quote}
              </p>
              <p className="text-xs text-muted-foreground">
                Nguồn: {result.source}
                <br />
                Ngày hiệu lực: {result.effective_on}
              </p>
            </div>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">
              Chưa có kết quả.
            </p>
          )}
        </Panel>
      </div>
      <Panel title="Tỷ giá hiện có">
        <ResourceState resource={rates} empty={rates.data?.length === 0} />
        {!!rates.data?.length && (
          <DataTable
            columns={["Cặp tiền tệ", "Tỷ giá", "Ngày hiệu lực", "Nguồn"]}
            rows={rates.data.map((r) => ({
              id: r.id,
              cells: [
                r.base + " / " + r.quote,
                r.rate,
                r.effective_on,
                r.source,
              ],
            }))}
          />
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Thiếu tỷ giá? Liên hệ quản trị viên.
        </p>
      </Panel>
    </Page>
  );
}
