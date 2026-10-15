"use client";
import Link from "next/link";
import {
  LayoutDashboardIcon,
  WalletIcon,
  ArrowLeftRightIcon,
  SendIcon,
  TargetIcon,
  BellIcon,
  RepeatIcon,
  ChartAreaIcon,
  CoinsIcon,
  UserIcon,
} from "lucide-react";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { User } from "@/lib/contracts";
const daily = [
  { title: "Tổng quan", url: "/dashboard", icon: <LayoutDashboardIcon /> },
  { title: "Ví & danh mục", url: "/accounts", icon: <WalletIcon /> },
  { title: "Giao dịch", url: "/transactions", icon: <ArrowLeftRightIcon /> },
  { title: "Chuyển tiền", url: "/transfers", icon: <SendIcon /> },
];
const planning = [
  { title: "Ngân sách & mục tiêu", url: "/budgets", icon: <TargetIcon /> },
  { title: "Khoản định kỳ", url: "/subscriptions", icon: <RepeatIcon /> },
  { title: "Thông báo", url: "/notifications", icon: <BellIcon /> },
];
const insights = [
  { title: "Quy đổi tiền tệ", url: "/exchange", icon: <CoinsIcon /> },
  { title: "Báo cáo", url: "/analytics", icon: <ChartAreaIcon /> },
  { title: "Hồ sơ", url: "/settings", icon: <UserIcon /> },
];
export function AppSidebar({ user }: { user: User }) {
  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <div className="grid size-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
                <WalletIcon className="size-5" />
              </div>
              <div>
                <span className="block font-semibold">KTHDV</span>
                <span className="text-xs text-muted-foreground">
                  Tài chính cá nhân
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain label="Hằng ngày" items={daily} />
        <NavMain label="Kế hoạch" items={planning} />
        <NavMain label="Phân tích & tài khoản" items={insights} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
