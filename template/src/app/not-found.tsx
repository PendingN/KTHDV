import Link from "next/link";
export default function NotFound() {
  return (
    <main className="m-auto space-y-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">Không tìm thấy trang</h1>
      <p className="text-muted-foreground">
        Đường dẫn không tồn tại trong KTHDV.
      </p>
      <Link className="underline" href="/">
        Về trang chính
      </Link>
    </main>
  );
}
