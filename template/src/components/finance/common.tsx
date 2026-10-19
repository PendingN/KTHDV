"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { currencies } from "@/lib/money";
import { ListSkeleton } from "./loading";

export function useResource<T>(service: string, route: string) {
  const [version, setVersion] = useState(0);
  const source = service + ":" + route;
  const key = source + ":" + version;
  const [state, setState] = useState<{
    key: string;
    source?: string;
    data?: T;
    error?: string;
  }>({ key: "" });
  useEffect(() => {
    const controller = new AbortController();
    api<T>(service, route, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, source, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ key, source, error: error.message });
      });
    return () => controller.abort();
  }, [service, route, source, key]);
  return {
    data: state.source === source ? state.data : undefined,
    error: state.key === key ? state.error : undefined,
    loading: state.key !== key,
    reload: () => setVersion((v) => v + 1),
  };
}
export function Page({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      key={title}
      className="motion-page mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {title}
          </h1>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
export function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={
        "motion-feedback rounded-lg border p-3 text-sm " +
        (error
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "bg-muted/40 text-muted-foreground")
      }
    >
      {children}
    </div>
  );
}
export function Spinner() {
  return (
    <LoaderCircleIcon
      aria-hidden="true"
      className="size-4 shrink-0 animate-spin"
    />
  );
}
export function ResourceState({
  resource,
  empty = false,
  fallback = <ListSkeleton />,
}: {
  resource: {
    loading: boolean;
    data?: unknown;
    error?: string;
    reload: () => void;
  };
  empty?: boolean;
  fallback?: ReactNode;
}) {
  if (resource.loading && resource.data === undefined) return fallback;
  if (resource.error)
    return (
      <div className="space-y-3">
        <Notice error>{resource.error}</Notice>
        <Button variant="outline" onClick={resource.reload}>
          Thử lại
        </Button>
      </div>
    );
  return empty ? (
    <p role="status" className="py-2 text-sm text-muted-foreground">
      Chưa có dữ liệu.
    </p>
  ) : null;
}
export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: { id: string | number; cells: ReactNode[] }[];
}) {
  if (!rows.length)
    return (
      <p role="status" className="py-2 text-sm text-muted-foreground">
        Chưa có dữ liệu.
      </p>
    );
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c}>{c}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="motion-item">
              {row.cells.map((cell, i) => (
                <TableCell key={i} className="max-w-80 whitespace-normal">
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
export const currencyOptions = currencies.map((value) => ({
  value,
  label: value,
}));
export type Field = {
  name: string;
  label: string;
  type?: "text" | "date" | "number" | "email" | "password";
  options?: { value: string; label: string }[];
  required?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  minLength?: number;
  autoComplete?: string;
  money?: boolean;
  hint?: string;
};
export type Values = Record<string, string>;
export function FieldInput({
  field,
  value,
  onChange,
  error,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const id = "field-" + field.name;
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium" htmlFor={id}>
        {field.label}
      </label>
      {field.options ? (
        <Select
          value={value}
          onValueChange={(v) => onChange(v || "")}
          disabled={field.disabled}
        >
          <SelectTrigger
            id={id}
            className="w-full"
            aria-invalid={!!error}
            aria-describedby={error ? id + "-error" : undefined}
          >
            <SelectValue placeholder="Chọn…">
              {field.options.find((o) => o.value === value)?.label || "Chọn…"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {field.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={id}
          type={field.type || "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={field.disabled}
          required={field.required !== false}
          min={field.min}
          max={field.max}
          maxLength={field.maxLength ?? (field.money ? 30 : 120)}
          minLength={field.minLength}
          inputMode={field.money ? "decimal" : undefined}
          pattern={field.money ? "[0-9]+([.][0-9]+)?" : undefined}
          aria-invalid={!!error}
          aria-describedby={error ? id + "-error" : undefined}
          autoComplete={
            field.autoComplete ||
            (field.type === "password" ? "current-password" : undefined)
          }
        />
      )}
      {field.hint && (
        <p className="text-xs text-muted-foreground">{field.hint}</p>
      )}
      {error && (
        <p id={id + "-error"} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
export function Editor({
  title,
  description,
  fields,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  description?: string;
  fields: Field[] | ((values: Values) => Field[]);
  initial: Values;
  onSave: (values: Values) => Promise<unknown>;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true),
    [values, setValues] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<ApiError | null>(null);
  const visible = typeof fields === "function" ? fields(values) : fields;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const missing = visible.find(
      (f) =>
        f.required !== false &&
        (!values[f.name]?.trim() ||
          (f.options && !f.options.some((o) => o.value === values[f.name]))),
    );
    if (missing) {
      setError(
        new ApiError("Vui lòng nhập " + missing.label, 422, {
          [missing.name]: "Thông tin bắt buộc",
        }),
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(values);
      setOpen(false);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e
          : new ApiError(
              e instanceof Error ? e.message : "Chưa lưu được dữ liệu",
              500,
            ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!busy) setOpen(nextOpen);
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-lg"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={save} aria-busy={busy} className="space-y-4">
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            {visible.map((field) => (
              <FieldInput
                key={field.name}
                field={field}
                value={values[field.name] || ""}
                onChange={(value) =>
                  setValues((v) => ({ ...v, [field.name]: value }))
                }
                error={error?.fields[field.name]}
              />
            ))}
          </fieldset>
          {error && <Notice error>{error.message}</Notice>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Spinner />}
              {busy ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function Action({
  children,
  run,
  confirm,
  onDone,
  iconLabel,
}: {
  children: ReactNode;
  run: () => Promise<unknown>;
  confirm?: string;
  onDone?: () => void;
  iconLabel?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function act() {
    if (busy || (confirm && !window.confirm(confirm))) return;
    setBusy(true);
    setError("");
    try {
      await run();
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa hoàn tất");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        size={iconLabel ? "icon-sm" : "sm"}
        variant="outline"
        aria-label={iconLabel}
        title={iconLabel}
        disabled={busy}
        aria-busy={busy}
        onClick={act}
      >
        {busy && <Spinner />}
        {busy ? (iconLabel ? null : "Đang xử lý…") : children}
      </Button>
      {error && (
        <span role="alert" className="max-w-64 text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
export function DateRange({
  range,
  onChange,
  id = "range",
}: {
  id?: string;
  range: { start: string; end: string };
  onChange: (value: { start: string; end: string }) => void;
}) {
  const [draft, setDraft] = useState(range);
  return (
    <form
      className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap"
      onSubmit={(e) => {
        e.preventDefault();
        onChange(draft);
      }}
    >
      <div className="min-w-0 space-y-1 sm:w-44">
        <label
          htmlFor={id + "-start"}
          className="text-xs text-muted-foreground"
        >
          Từ ngày
        </label>
        <Input
          id={id + "-start"}
          type="date"
          required
          value={draft.start}
          max={draft.end}
          onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
        />
      </div>
      <div className="min-w-0 space-y-1 sm:w-44">
        <label htmlFor={id + "-end"} className="text-xs text-muted-foreground">
          Đến ngày
        </label>
        <Input
          id={id + "-end"}
          type="date"
          required
          value={draft.end}
          min={draft.start}
          onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
        />
      </div>
      <Button type="submit" variant="outline" className="col-span-2 w-fit">
        Áp dụng
      </Button>
    </form>
  );
}
export function Progress({ value }: { value: number }) {
  const percent = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1">
      <progress
        max={100}
        value={percent}
        aria-label="Tiến độ"
        className="sr-only"
      />
      <div
        aria-hidden="true"
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="motion-progress h-full origin-left rounded-full bg-foreground"
          style={{
            transform: `scaleX(${percent / 100})`,
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {value.toLocaleString("vi-VN")}%
      </p>
    </div>
  );
}
