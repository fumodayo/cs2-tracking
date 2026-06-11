import { Dashboard } from "@/components/dashboard/dashboard";
import { Suspense } from "react";

export default function PortfolioPage() {
  return (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  );
}
