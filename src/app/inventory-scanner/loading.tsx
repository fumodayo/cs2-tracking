import React from 'react';

export default function InventoryScannerLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Khung tải tiêu đề và mô tả */}
      <div className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-stone-800" />
        <div className="h-8 w-64 animate-pulse rounded bg-stone-800" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-stone-800" />
      </div>

      {/* Khung tải trường nhập và thẻ thiết lập */}
      <div className="h-48 animate-pulse space-y-4 rounded-xl border border-stone-800 bg-stone-900/40 p-5">
        <div className="h-6 w-40 rounded bg-stone-800" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="h-10 rounded bg-stone-800/60 md:col-span-2" />
          <div className="h-10 rounded bg-stone-800/60" />
        </div>
        <div className="flex gap-4 pt-2">
          <div className="h-9 w-24 rounded bg-stone-800" />
          <div className="h-9 w-32 rounded bg-stone-800" />
        </div>
      </div>

      {/* Khung tải bảng */}
      <div className="animate-pulse space-y-4 rounded-xl border border-stone-800 bg-stone-900/40 p-4">
        <div className="border-stone-850 flex items-center justify-between border-b pb-2">
          <div className="h-5 w-32 rounded bg-stone-800" />
          <div className="flex gap-2">
            <div className="h-9 w-20 rounded bg-stone-800" />
            <div className="h-9 w-20 rounded bg-stone-800" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="border-stone-850/40 flex items-center justify-between border-b py-3 last:border-0"
            >
              <div className="flex w-1/3 items-center gap-3">
                <div className="h-10 w-10 rounded bg-stone-800" />
                <div className="h-4 w-full rounded bg-stone-800/60" />
              </div>
              <div className="bg-stone-850 h-4 w-20 rounded" />
              <div className="bg-stone-850 h-4 w-16 rounded" />
              <div className="bg-stone-850 h-4 w-24 rounded" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
