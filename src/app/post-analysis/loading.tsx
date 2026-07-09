import React from 'react';

export default function PostAnalysisLoading() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Khung tải tiêu đề và mô tả */}
      <div className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-stone-800" />
        <div className="h-8 w-64 animate-pulse rounded bg-stone-800" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-stone-800" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-stone-800" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Khung tải ô nhập nhiều dòng */}
        <div className="space-y-4 lg:col-span-2">
          <div className="h-80 animate-pulse space-y-4 rounded-xl border border-stone-800 bg-stone-900/40 p-4">
            <div className="h-6 w-48 rounded bg-stone-800" />
            <div className="h-48 rounded bg-stone-800/60" />
            <div className="flex items-center justify-between pt-2">
              <div className="h-10 w-28 rounded bg-stone-800" />
              <div className="h-10 w-32 rounded bg-stone-800" />
            </div>
          </div>
        </div>

        {/* Khung tải thanh bên lịch sử và thao tác */}
        <div className="space-y-4">
          <div className="h-80 animate-pulse space-y-4 rounded-xl border border-stone-800 bg-stone-900/40 p-4">
            <div className="h-6 w-32 rounded bg-stone-800" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-stone-800" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 rounded bg-stone-800" />
                    <div className="h-2 w-1/2 rounded bg-stone-800/60" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
