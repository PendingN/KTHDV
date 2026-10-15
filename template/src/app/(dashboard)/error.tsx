"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="space-y-4 p-8">
      <h1 className="text-xl font-semibold">Chưa tải được trang</h1>
      <p>Dịch vụ chưa phản hồi. Vui lòng kiểm tra các dịch vụ và thử lại.</p>
      <Button onClick={reset}>Thử lại</Button>
    </div>
  );
}
