import { Dashboard } from "@/components/dashboard/dashboard";
import { Suspense } from "react";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function PortfolioPage() {
  return (
    <Suspense fallback={null}>
      <ErrorBoundary>
        <Dashboard />
      </ErrorBoundary>
    </Suspense>
  );
}
