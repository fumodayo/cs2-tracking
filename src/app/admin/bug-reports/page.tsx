import { getCurrentUser } from "@/services/auth-service";
import { redirect } from "next/navigation";
import { AdminBugReportsClient } from "@/components/admin/bug-reports-client";
import { Suspense } from "react";

export const metadata = {
  title: "Quản lý Báo cáo Lỗi - CS2 Tracker",
  description: "Trang quản trị dành cho Admin để theo dõi và xử lý các lỗi hệ thống.",
};

export default async function AdminBugReportsPage() {
  const user = await getCurrentUser();

  // Permitted admin check
  if (!user || user.email !== "thaigiui2016@gmail.com") {
    redirect("/");
  }

  return (
    <Suspense fallback={<div className="container mx-auto py-12 text-center text-muted-foreground">Đang tải trang quản trị...</div>}>
      <AdminBugReportsClient />
    </Suspense>
  );
}
