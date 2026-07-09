'use client';

import { Users, Search } from 'lucide-react';

export function ScannerSkeleton() {
  return (
    <div className="bg-background min-h-screen">
      {/* Bản mô phỏng khung tải của Banner/Toolbar */}
      <section className="border-stone-850 relative min-h-[16rem] overflow-hidden border-b bg-stone-950">
        <div className="absolute inset-0 bg-gradient-to-r from-stone-900/60 via-stone-900/40 to-transparent" />
        <div className="relative mx-auto flex max-w-7xl flex-col justify-end px-4 pt-16 pb-8 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <div className="h-4 w-32 animate-pulse rounded bg-stone-800" />
            <div className="h-10 w-64 animate-pulse rounded bg-stone-800" />
            <div className="h-6 w-96 animate-pulse rounded bg-stone-800" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Khung tải khu vực tài khoản */}
        <div className="rounded-xl border border-stone-800 bg-stone-900/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-stone-600" />
              <div className="h-4 w-36 animate-pulse rounded bg-stone-800" />
            </div>
            <div className="h-8 w-24 animate-pulse rounded bg-stone-800" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Khung tải thẻ tài khoản 1 */}
            <div className="flex flex-col space-y-4 rounded-lg border border-stone-800 bg-stone-950/40 p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 animate-pulse rounded-full bg-stone-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-stone-800" />
                  <div className="h-3 w-48 animate-pulse rounded bg-stone-800" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 flex-1 animate-pulse rounded bg-stone-800" />
                <div className="h-8 w-20 animate-pulse rounded bg-stone-800" />
              </div>
            </div>

            {/* Khung tải thẻ tài khoản 2 */}
            <div className="flex flex-col space-y-4 rounded-lg border border-stone-800 bg-stone-950/40 p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 animate-pulse rounded-full bg-stone-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-28 animate-pulse rounded bg-stone-800" />
                  <div className="h-3 w-40 animate-pulse rounded bg-stone-800" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-8 flex-1 animate-pulse rounded bg-stone-800" />
                <div className="h-8 w-20 animate-pulse rounded bg-stone-800" />
              </div>
            </div>
          </div>
        </div>

        {/* Khung tải khu vực kết quả */}
        <div className="space-y-6">
          {/* Khung tải thẻ đồng bộ portfolio */}
          <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-stone-800 bg-stone-900/30 p-5 sm:flex-row">
            <div className="flex w-full items-center gap-3 sm:w-auto">
              <div className="size-8 animate-pulse rounded bg-stone-800" />
              <div className="space-y-2">
                <div className="h-4 w-48 animate-pulse rounded bg-stone-800" />
                <div className="h-3 w-72 animate-pulse rounded bg-stone-800" />
              </div>
            </div>
            <div className="h-10 w-36 w-full animate-pulse rounded bg-stone-800 sm:w-auto" />
          </div>

          {/* Khung tải lưới thống kê giá */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="space-y-2 rounded-lg border border-stone-800 bg-stone-950/30 p-4"
              >
                <div className="h-3 w-16 animate-pulse rounded bg-stone-800" />
                <div className="h-6 w-24 animate-pulse rounded bg-stone-800" />
              </div>
            ))}
          </div>

          {/* Khung tải thanh công cụ và lưới bảng */}
          <div className="space-y-4 rounded-xl border border-stone-800 bg-stone-900/20 p-4">
            <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
              <div className="relative w-full md:w-80">
                <Search className="absolute top-2.5 left-3 size-4 text-stone-600" />
                <div className="h-9 w-full animate-pulse rounded-md border border-stone-800 bg-stone-900/20" />
              </div>
              <div className="flex w-full justify-end gap-2 md:w-auto">
                <div className="h-9 w-24 animate-pulse rounded bg-stone-800" />
                <div className="h-9 w-24 animate-pulse rounded bg-stone-800" />
              </div>
            </div>

            {/* Khung tải bảng */}
            <div className="border-stone-850 overflow-x-auto rounded-lg border">
              <div className="divide-stone-850 min-w-full divide-y">
                {/* Phần đầu */}
                <div className="flex bg-stone-900/50 px-4 py-3">
                  <div className="mr-6 h-4 w-8 animate-pulse rounded bg-stone-800" />
                  <div className="mr-auto h-4 w-40 animate-pulse rounded bg-stone-800" />
                  <div className="mr-12 h-4 w-16 animate-pulse rounded bg-stone-800" />
                  <div className="mr-12 h-4 w-24 animate-pulse rounded bg-stone-800" />
                  <div className="h-4 w-20 animate-pulse rounded bg-stone-800" />
                </div>
                {/* Các dòng */}
                <div className="divide-stone-850 divide-y bg-stone-950/20">
                  {Array.from({ length: 5 }).map((_, rowIndex) => (
                    <div key={rowIndex} className="flex items-center px-4 py-4">
                      <div className="mr-8 h-4 w-4 animate-pulse rounded bg-stone-800" />
                      <div className="mr-auto flex items-center gap-3">
                        <div className="size-10 animate-pulse rounded-lg bg-stone-800" />
                        <div className="space-y-1.5">
                          <div className="h-4 w-48 animate-pulse rounded bg-stone-800" />
                          <div className="h-3 w-24 animate-pulse rounded bg-stone-800" />
                        </div>
                      </div>
                      <div className="mr-16 h-4 w-12 animate-pulse rounded bg-stone-800" />
                      <div className="mr-16 h-4.5 w-20 animate-pulse rounded bg-stone-800" />
                      <div className="h-4.5 w-24 animate-pulse rounded bg-stone-800" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
