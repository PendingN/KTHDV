"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const labelMap: Record<string, string> = {
  dashboard: "Tổng quan",
  accounts: "Ví & danh mục",
  transactions: "Giao dịch",
  transfers: "Chuyển tiền",
  analytics: "Báo cáo",
  budgets: "Ngân sách & mục tiêu",
  subscriptions: "Khoản định kỳ",
  exchange: "Quy đổi tiền tệ",
  settings: "Hồ sơ",
  notifications: "Thông báo",
};

export function DynamicBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const href = "/" + segments.slice(0, index + 1).join("/");
          const label =
            labelMap[segment] ||
            segment.charAt(0).toUpperCase() + segment.slice(1);
          const isLast = index === segments.length - 1;

          return (
            <BreadcrumbItem
              key={href}
              className={
                index === 0 && segments.length > 1
                  ? "hidden md:block"
                  : undefined
              }
            >
              {isLast ? (
                <BreadcrumbPage>{label}</BreadcrumbPage>
              ) : (
                <>
                  <BreadcrumbLink render={<Link href={href} />}>
                    {label}
                  </BreadcrumbLink>
                  <BreadcrumbSeparator className="hidden md:block" />
                </>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
