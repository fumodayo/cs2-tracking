"use client";

import { Users, Search } from "lucide-react";

export function ScannerSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Replica of the Banner/Toolbar skeleton */}
      <section className="relative min-h-[16rem] overflow-hidden border-b border-stone-850 bg-stone-950">
        <div className="absolute inset-0 bg-gradient-to-r from-stone-900/60 via-stone-900/40 to-transparent" />
        <div className="relative mx-auto flex max-w-7xl flex-col justify-end px-4 pt-16 pb-8 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <div className="h-4 w-32 animate-pulse rounded bg-stone-800" />
            <div className="h-10 w-64 animate-pulse rounded bg-stone-800" />
            <div className="h-6 w-96 animate-pulse rounded bg-stone-800" />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Accounts Section Skeleton */}
        <div className="rounded-xl border border-stone-800 bg-stone-900/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-stone-600" />
              <div className="h-4 w-36 animate-pulse rounded bg-stone-800" />
            </div>
            <div className="h-8 w-24 animate-pulse rounded bg-stone-800" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Account Card Skeleton 1 */}
            <div className="flex flex-col rounded-lg border border-stone-800 bg-stone-950/40 p-4 space-y-4">
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

            {/* Account Card Skeleton 2 */}
            <div className="flex flex-col rounded-lg border border-stone-800 bg-stone-950/40 p-4 space-y-4">
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

        {/* Results Section Skeleton */}
        <div className="space-y-6">
          {/* Portfolio Sync Card Skeleton */}
          <div className="rounded-xl border border-stone-800 bg-stone-900/30 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="size-8 animate-pulse rounded bg-stone-800" />
              <div className="space-y-2">
                <div className="h-4 w-48 animate-pulse rounded bg-stone-800" />
                <div className="h-3 w-72 animate-pulse rounded bg-stone-800" />
              </div>
            </div>
            <div className="h-10 w-36 animate-pulse rounded bg-stone-800 w-full sm:w-auto" />
          </div>

          {/* Pricing Stats Grid Skeleton */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-stone-800 bg-stone-950/30 p-4 space-y-2">
                <div className="h-3 w-16 animate-pulse rounded bg-stone-800" />
                <div className="h-6 w-24 animate-pulse rounded bg-stone-800" />
              </div>
            ))}
          </div>

          {/* Table Toolbar & Grid Skeleton */}
          <div className="rounded-xl border border-stone-800 bg-stone-900/20 p-4 space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 size-4 text-stone-600" />
                <div className="h-9 w-full rounded-md border border-stone-800 bg-stone-900/20 animate-pulse" />
              </div>
              <div className="flex gap-2 w-full md:w-auto justify-end">
                <div className="h-9 w-24 animate-pulse rounded bg-stone-800" />
                <div className="h-9 w-24 animate-pulse rounded bg-stone-800" />
              </div>
            </div>

            {/* Table Skeleton */}
            <div className="overflow-x-auto rounded-lg border border-stone-850">
              <div className="min-w-full divide-y divide-stone-850">
                {/* Header */}
                <div className="bg-stone-900/50 flex py-3 px-4">
                  <div className="h-4 w-8 bg-stone-800 animate-pulse rounded mr-6" />
                  <div className="h-4 w-40 bg-stone-800 animate-pulse rounded mr-auto" />
                  <div className="h-4 w-16 bg-stone-800 animate-pulse rounded mr-12" />
                  <div className="h-4 w-24 bg-stone-800 animate-pulse rounded mr-12" />
                  <div className="h-4 w-20 bg-stone-800 animate-pulse rounded" />
                </div>
                {/* Rows */}
                <div className="divide-y divide-stone-850 bg-stone-950/20">
                  {Array.from({ length: 5 }).map((_, rowIndex) => (
                    <div key={rowIndex} className="flex items-center py-4 px-4">
                      <div className="h-4 w-4 bg-stone-800 animate-pulse rounded mr-8" />
                      <div className="flex items-center gap-3 mr-auto">
                        <div className="size-10 bg-stone-800 animate-pulse rounded-lg" />
                        <div className="space-y-1.5">
                          <div className="h-4 w-48 bg-stone-800 animate-pulse rounded" />
                          <div className="h-3 w-24 bg-stone-800 animate-pulse rounded" />
                        </div>
                      </div>
                      <div className="h-4 w-12 bg-stone-800 animate-pulse rounded mr-16" />
                      <div className="h-4.5 w-20 bg-stone-800 animate-pulse rounded mr-16" />
                      <div className="h-4.5 w-24 bg-stone-800 animate-pulse rounded" />
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
