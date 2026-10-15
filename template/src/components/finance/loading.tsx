import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingBlock({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Đang tải dữ liệu…</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <LoadingBlock>
      <div className="divide-y">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="flex items-center justify-between gap-6 py-4"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5 max-w-48" />
              <Skeleton className="h-3 w-2/5 max-w-32" />
            </div>
            <Skeleton className="h-6 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </LoadingBlock>
  );
}

export function TableSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <LoadingBlock>
      <div className="divide-y overflow-hidden rounded-lg border">
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="grid gap-4 px-2 py-3"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: columns }, (_, column) => (
              <Skeleton
                key={column}
                className={row === 0 ? "h-4 w-3/4" : "h-5 w-full"}
              />
            ))}
          </div>
        ))}
      </div>
    </LoadingBlock>
  );
}

export function CardsSkeleton({
  layout = "wallets",
}: {
  layout?: "wallets" | "plans" | "balances";
}) {
  const grid =
    layout === "plans"
      ? "lg:grid-cols-2"
      : layout === "balances"
        ? "sm:grid-cols-2 lg:grid-cols-3"
        : "md:grid-cols-2 xl:grid-cols-3";
  return (
    <LoadingBlock>
      <div className={"grid gap-4 " + grid}>
        {Array.from({ length: layout === "plans" ? 2 : 3 }, (_, index) => (
          <div key={index} className="space-y-4 rounded-xl border p-5">
            <div className="flex justify-between gap-4">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-7 w-1/2" />
            {layout === "plans" && (
              <Skeleton className="h-2 w-full rounded-full" />
            )}
            {layout !== "balances" && (
              <div className="flex gap-2">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-7 w-24" />
              </div>
            )}
          </div>
        ))}
      </div>
    </LoadingBlock>
  );
}

export function DashboardSkeleton() {
  return (
    <LoadingBlock>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="space-y-5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-8 w-28" />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardContent className="space-y-4">
            <Skeleton className="h-5 w-40" />
            <TableSkeleton />
          </CardContent>
        </Card>
      </div>
    </LoadingBlock>
  );
}

export function PageSkeleton({
  layout = "list",
  filters = false,
}: {
  layout?: "list" | "table" | "cards" | "dashboard";
  filters?: boolean;
}) {
  return (
    <LoadingBlock>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 md:p-7">
        <div className="flex flex-wrap justify-between gap-4">
          <Skeleton className="h-9 w-56 max-w-full" />
          <Skeleton className="h-8 w-32" />
        </div>
        {filters && (
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Skeleton className="h-14 w-full sm:w-44" />
            <Skeleton className="h-14 w-full sm:w-44" />
          </div>
        )}
        {layout === "dashboard" ? (
          <DashboardSkeleton />
        ) : (
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent>
              {layout === "cards" ? (
                <CardsSkeleton />
              ) : layout === "table" ? (
                <TableSkeleton />
              ) : (
                <ListSkeleton />
              )}
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-44" />
          </CardHeader>
          <CardContent>
            <ListSkeleton />
          </CardContent>
        </Card>
      </div>
    </LoadingBlock>
  );
}
