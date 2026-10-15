"use client";
import { api } from "@/lib/api";
import type { Notification } from "@/lib/contracts";
import { Page, Panel, ResourceState, Action, useResource } from "./common";
export function Notifications() {
  const notifications = useResource<Notification[]>(
    "recurring",
    "/notifications",
  );
  return (
    <Page
      title="Thông báo"
      actions={
        <Action
          run={() => api("recurring", "/reminders/check", { method: "POST" })}
          onDone={notifications.reload}
        >
          Kiểm tra nhắc hạn
        </Action>
      }
    >
      <Panel title="Hộp thông báo">
        <ResourceState
          resource={notifications}
          empty={notifications.data?.length === 0}
        />
        {notifications.data?.map((n) => (
          <div
            key={n.id}
            className={
              "flex flex-wrap items-center justify-between gap-4 border-b p-4 " +
              (!n.is_read ? "bg-muted/40" : "")
            }
          >
            <div>
              <p
                className={!n.is_read ? "font-medium" : "text-muted-foreground"}
              >
                {n.message}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {n.created_on} · {n.is_read ? "Đã đọc" : "Chưa đọc"}
              </p>
            </div>
            {!n.is_read && (
              <Action
                run={() =>
                  api("recurring", "/notifications/" + n.id + "/read", {
                    method: "PATCH",
                  })
                }
                onDone={notifications.reload}
              >
                Đánh dấu đã đọc
              </Action>
            )}
          </div>
        ))}
      </Panel>
    </Page>
  );
}
