import { currentUser } from "@/lib/session";
import { Page, Panel } from "@/components/finance/common";
export default async function Profile() {
  const user = await currentUser();
  return (
    <Page title="Hồ sơ">
      <Panel title="Tài khoản">
        <dl className="grid gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Họ và tên</dt>
            <dd className="mt-1 font-medium">{user?.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="mt-1">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Vai trò</dt>
            <dd className="mt-1">
              {user?.role === "admin" ? "Quản trị viên" : "Người dùng"}
            </dd>
          </div>
        </dl>
      </Panel>
    </Page>
  );
}
