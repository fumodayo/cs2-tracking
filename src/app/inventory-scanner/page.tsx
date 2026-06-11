import { InventoryScanner } from "@/components/inventory-scanner/inventory-scanner";
import { Suspense } from "react";

export default function InventoryScannerPage() {
  return (
    <Suspense fallback={<div>Loading scanner...</div>}>
      <InventoryScanner />
    </Suspense>
  );
}
