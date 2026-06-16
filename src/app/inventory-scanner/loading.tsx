import React from "react";

export default function InventoryScannerLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Title & Description Skeleton */}
      <div className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-stone-800" />
        <div className="h-8 w-64 animate-pulse rounded bg-stone-800" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-stone-800" />
      </div>

      {/* Input Fields / Setup Card Skeleton */}
      <div className="h-48 animate-pulse rounded-xl border border-stone-800 bg-stone-900/40 p-5 space-y-4">
        <div className="h-6 w-40 rounded bg-stone-800" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-10 rounded bg-stone-800/60 md:col-span-2" />
          <div className="h-10 rounded bg-stone-800/60" />
        </div>
        <div className="flex gap-4 pt-2">
          <div className="h-9 w-24 rounded bg-stone-800" />
          <div className="h-9 w-32 rounded bg-stone-800" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="animate-pulse rounded-xl border border-stone-800 bg-stone-900/40 p-4 space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-stone-850">
          <div className="h-5 w-32 rounded bg-stone-800" />
          <div className="flex gap-2">
            <div className="h-9 w-20 rounded bg-stone-800" />
            <div className="h-9 w-20 rounded bg-stone-800" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between py-3 border-b border-stone-850/40 last:border-0">
              <div className="flex items-center gap-3 w-1/3">
                <div className="h-10 w-10 rounded bg-stone-800" />
                <div className="h-4 w-full rounded bg-stone-800/60" />
              </div>
              <div className="h-4 w-20 rounded bg-stone-850" />
              <div className="h-4 w-16 rounded bg-stone-850" />
              <div className="h-4 w-24 rounded bg-stone-850" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
