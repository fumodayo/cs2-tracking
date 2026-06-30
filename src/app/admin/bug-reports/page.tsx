/* eslint-disable react-refresh/only-export-components */
import { getCurrentUser, isAdminUser } from "@/services/auth-service";
import { redirect } from "next/navigation";
import { AdminBugReportsClient } from "@/components/admin/bug-reports-client";
import { Suspense } from "react";

export const metadata = {
  title: "Bug Reports Management - CS2 Tracker",
  description: "Admin dashboard to manage and resolve user bug reports.",
};

export default async function AdminBugReportsPage() {
  const user = await getCurrentUser();

  // Permitted admin check
  if (!user || !isAdminUser(user.email)) {
    redirect("/");
  }

  return (
    <Suspense fallback={<div className="container mx-auto py-12 text-center text-muted-foreground">Loading admin dashboard...</div>}>
      <AdminBugReportsClient />
    </Suspense>
  );
}
