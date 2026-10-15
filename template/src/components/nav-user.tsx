"use client";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Action } from "@/components/finance/common";
import { api } from "@/lib/api";
import type { User } from "@/lib/contracts";
export function NavUser({ user }: { user: User }) {
  const router = useRouter();
  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="flex items-center gap-2">
        <Avatar>
          <AvatarFallback>{user.name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <Action
        run={() => api("identity", "/auth/logout", { method: "POST" })}
        onDone={() => {
          router.replace("/sign-in");
          router.refresh();
        }}
      >
        <LogOutIcon />
        Đăng xuất
      </Action>
    </div>
  );
}
