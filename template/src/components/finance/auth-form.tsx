"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { WalletIcon, ArrowRightIcon } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { FieldInput, Notice, type Field } from "./common";

export function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter(),
    [values, setValues] = useState<Record<string, string>>({
      name: "",
      email: "",
      password: "",
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<ApiError | null>(null),
    [created, setCreated] = useState(false);
  const fields: Field[] = [
    ...(register
      ? [{ name: "name", label: "Họ và tên", maxLength: 120 } as Field]
      : []),
    { name: "email", label: "Email", type: "email", maxLength: 254 },
    {
      name: "password",
      label: "Mật khẩu",
      type: "password",
      maxLength: 128,
      minLength: register ? 8 : 1,
      autoComplete: register ? "new-password" : "current-password",
      hint: register ? "Ít nhất 8 ký tự." : undefined,
    },
  ];
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (register && !created) {
        await api("identity", "/users", { method: "POST", body: values });
        setCreated(true);
      }
      await api("identity", "/auth/login", {
        method: "POST",
        body: { email: values.email, password: values.password },
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e
          : new ApiError("Chưa kết nối được dịch vụ", 502),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex min-h-svh">
      <aside className="relative hidden w-5/12 flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-white lg:flex">
        <div className="flex items-center gap-3 font-semibold">
          <WalletIcon />
          KTHDV
        </div>
        <div>
          <div
            aria-hidden
            className="mb-12 grid h-56 place-items-center rounded-3xl border border-white/15 bg-gradient-to-br from-white/10 to-transparent"
          >
            <WalletIcon className="size-24 stroke-1 text-white/75" />
          </div>
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Hiểu dòng tiền.
            <br />
            Chủ động mỗi ngày.
          </h2>
          <p className="mt-5 max-w-sm text-sm leading-7 text-zinc-400">
            Thu chi, ngân sách và mục tiêu.
          </p>
        </div>
        <p className="text-xs text-zinc-500">Quản lý tài chính cá nhân</p>
      </aside>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-10 flex items-center gap-2 font-semibold lg:hidden"
          >
            <WalletIcon />
            KTHDV
          </Link>
          <h1 className="mb-8 text-3xl font-semibold tracking-tight">
            {register ? "Tạo tài khoản" : "Chào mừng trở lại"}
          </h1>
          <form onSubmit={submit} className="space-y-5">
            <fieldset disabled={busy} className="space-y-5">
              {fields.map((field) => (
                <FieldInput
                  key={field.name}
                  field={field}
                  value={values[field.name]}
                  onChange={(value) =>
                    setValues((v) => ({ ...v, [field.name]: value }))
                  }
                  error={error?.fields[field.name]}
                />
              ))}
            </fieldset>
            {created && error && (
              <Notice>Đã tạo tài khoản. Thử đăng nhập lại.</Notice>
            )}
            {error && <Notice error>{error.message}</Notice>}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy
                ? "Đang xử lý…"
                : register && !created
                  ? "Tạo tài khoản"
                  : "Đăng nhập"}
              <ArrowRightIcon />
            </Button>
          </form>
          <p className="mt-7 text-sm text-muted-foreground">
            {register ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
            <Link
              className="font-medium text-foreground underline underline-offset-4"
              href={register ? "/sign-in" : "/sign-up"}
            >
              {register ? "Đăng nhập" : "Đăng ký"}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
