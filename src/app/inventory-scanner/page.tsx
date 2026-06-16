import { InventoryScanner } from "@/components/inventory-scanner/inventory-scanner";
import { Suspense } from "react";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function InventoryScannerPage() {
  return (
    <Suspense fallback={<div>Loading scanner...</div>}>
      <ErrorBoundary>
        <InventoryScanner />
      </ErrorBoundary>
    </Suspense>
  );
}
