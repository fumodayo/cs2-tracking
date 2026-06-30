import { InventoryScanner } from "@/components/inventory-scanner/inventory-scanner";
import { ScannerSkeleton } from "@/components/inventory-scanner/components/scanner-skeleton";
import { Suspense } from "react";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function InventoryScannerPage() {
  return (
    <Suspense fallback={<ScannerSkeleton />}>
      <ErrorBoundary>
        <InventoryScanner />
      </ErrorBoundary>
    </Suspense>
  );
}
