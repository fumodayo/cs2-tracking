"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Search, Loader2, AlertCircle, ShoppingBag, Plus, X, Users, ChevronDown, ChevronUp, ArrowUpDown, ChevronLeft, ChevronRight, Check, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CaseItemData = { id: string; name: string; marketHashName: string; imageUrl: string | null; isActive: boolean };
type ScanResultItem = { caseItem: CaseItemData; type: "Case" | "Capsule"; quantity: number; price: number; total: number; isManual?: boolean };
type SteamProfile = { name: string; avatarUrl: string | null };
type ScanResponse = {
  steamId64: string; profile: SteamProfile; items: ScanResultItem[];
  totalPrice: number; totalQuantity: number; totalInventoryCount: number;
  cached: boolean; scannedAt: string; expiresAt: string;
};
type AccountEntry = { id: string; url: string; status: "idle" | "scanning" | "done" | "error"; result: ScanResponse | null; error: string | null };

const LS_RATE_ALL = "cs2t_rateAll";
const LS_RATE_LE = "cs2t_rateLe";
const LS_ACCOUNTS = "cs2t_accounts";
const LS_MANUAL_ITEMS = "cs2t_manualItems";

function readRate(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const v = localStorage.getItem(key);
  return v ? Number(v) || fallback : fallback;
}

let nextId = 1;
function createAccount(url: string): AccountEntry {
  return { id: `acc_${Date.now()}_${nextId++}`, url, status: "idle", result: null, error: null };
}

/** Normalize a Steam URL/vanity for duplicate comparison */
function normalizeSteamInput(raw: string): string {
  return raw.trim().replace(/\/+$/, "").toLowerCase();
}

/** Extract a comparable key from a Steam URL for quick duplicate check */
function extractSteamKey(raw: string): string | null {
  const s = normalizeSteamInput(raw);
  if (!s) return null;
  // /profiles/76561198xxxxxxxx
  const profileMatch = s.match(/\/profiles\/(\d{17})/);
  if (profileMatch) return profileMatch[1];
  // /id/vanityname
  const idMatch = s.match(/\/id\/([^\/]+)/);
  if (idMatch) return `vanity:${idMatch[1]}`;
  // raw steamid64
  if (/^\d{17}$/.test(s)) return s;
  // raw vanity
  if (!s.includes("/")) return `vanity:${s}`;
  return s;
}

export function InventoryScanner() {
  const [accounts, setAccounts] = useState<AccountEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [rateAll, setRateAll] = useState(() => readRate(LS_RATE_ALL, 60));
  const [rateLe, setRateLe] = useState(() => readRate(LS_RATE_LE, 65));
  const [scanningAll, setScanningAll] = useState(false);
  const [expandedAccId, setExpandedAccId] = useState<string | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [globalFilter, setGlobalFilter] = useState("");
  const [manualItems, setManualItems] = useState<ScanResultItem[]>([]);
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_ACCOUNTS);
      if (saved) {
        setAccounts(JSON.parse(saved));
      } else {
        setAccounts([createAccount("")]);
      }
    } catch {
      setAccounts([createAccount("")]);
    }
    try {
      const savedManual = localStorage.getItem(LS_MANUAL_ITEMS);
      if (savedManual) setManualItems(JSON.parse(savedManual));
    } catch { /* ignore */ }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(LS_ACCOUNTS, JSON.stringify(accounts));
    }
  }, [accounts, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(LS_MANUAL_ITEMS, JSON.stringify(manualItems));
    }
  }, [manualItems, isLoaded]);

  useEffect(() => { localStorage.setItem(LS_RATE_ALL, String(rateAll)); }, [rateAll]);
  useEffect(() => { localStorage.setItem(LS_RATE_LE, String(rateLe)); }, [rateLe]);

  const updateAccountUrl = (id: string, url: string) => setAccounts(p => p.map(a => a.id === id ? { ...a, url, status: "idle", result: null, error: null } : a));
  const removeAccount = (id: string) => { setAccounts(p => p.filter(a => a.id !== id)); if (expandedAccId === id) setExpandedAccId(null); };
  const addAccount = () => setAccounts(p => [...p, createAccount("")]);

  /** Check if this account's URL is a duplicate of another account (by normalized URL key) */
  const findUrlDuplicate = useCallback((accountId: string, url: string, currentAccounts: AccountEntry[]): AccountEntry | undefined => {
    const key = extractSteamKey(url);
    if (!key) return undefined;
    return currentAccounts.find(a => a.id !== accountId && extractSteamKey(a.url) === key);
  }, []);

  const doScan = useCallback(async (accountId: string, forceRefresh: boolean, currentAccounts: AccountEntry[]) => {
    const account = currentAccounts.find(a => a.id === accountId);
    if (!account || !account.url.trim()) return;

    // Pre-check: URL-level duplicate
    const urlDupe = findUrlDuplicate(accountId, account.url, currentAccounts);
    if (urlDupe) {
      const dupeName = urlDupe.result?.profile?.name || `TK ${currentAccounts.indexOf(urlDupe) + 1}`;
      setAccounts(p => p.map(a => a.id === accountId
        ? { ...a, status: "error" as const, error: `URL trùng với "${dupeName}". Vui lòng nhập tài khoản khác.`, result: null }
        : a
      ));
      return;
    }

    setAccounts(p => p.map(a => a.id === accountId ? { ...a, status: "scanning", error: null, result: null } : a));
    try {
      const res = await fetch("/api/inventory/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ steamUrl: account.url.trim(), forceRefresh }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");

      // Post-check: SteamID64 duplicate (catches different URL formats → same account)
      setAccounts(p => {
        const existingDupe = p.find(a => a.id !== accountId && a.status === "done" && a.result?.steamId64 === data.steamId64);
        if (existingDupe) {
          const dupeName = existingDupe.result?.profile?.name || `TK ${p.indexOf(existingDupe) + 1}`;
          return p.map(a => a.id === accountId
            ? { ...a, status: "error" as const, error: `Trùng lặp với "${dupeName}" (cùng SteamID64: ${data.steamId64}). Vui lòng nhập tài khoản khác.`, result: null }
            : a
          );
        }
        return p.map(a => a.id === accountId ? { ...a, status: "done", result: data, error: null } : a);
      });
    } catch (err) {
      setAccounts(p => p.map(a => a.id === accountId ? { ...a, status: "error", error: err instanceof Error ? err.message : "Lỗi" } : a));
    }
  }, [findUrlDuplicate]);

  const scanAll = async (forceRefresh = false) => {
    const valid = accounts.filter(a => a.url.trim());
    if (!valid.length) return;
    setScanningAll(true);
    setRemovedKeys(new Set()); // Reset deleted items so re-scan restores everything
    for (let i = 0; i < valid.length; i++) {
      await doScan(valid[i].id, forceRefresh, accounts);
      // Small delay between scans to avoid Steam rate limiting
      if (i < valid.length - 1) await new Promise(r => setTimeout(r, 500));
    }
    setScanningAll(false);
  };

  const addManualItem = useCallback((caseItem: CaseItemData, price: number, quantity: number) => {
    const nameLower = caseItem.name.toLowerCase();
    const type: "Case" | "Capsule" = (nameLower.includes("capsule") || nameLower.includes("package")) ? "Capsule" : "Case";
    setManualItems(prev => {
      const existing = prev.find(i => i.caseItem.marketHashName === caseItem.marketHashName);
      if (existing) {
        return prev.map(i => i.caseItem.marketHashName === caseItem.marketHashName
          ? { ...i, quantity: i.quantity + quantity, total: i.price * (i.quantity + quantity) }
          : i
        );
      }
      return [...prev, { caseItem, type, quantity, price, total: price * quantity, isManual: true }];
    });
    // Also remove from removedKeys if it was previously removed
    setRemovedKeys(prev => {
      const next = new Set(prev);
      next.delete(caseItem.marketHashName);
      return next;
    });
  }, []);

  const updateManualItemQty = useCallback((marketHashName: string, qty: number) => {
    setManualItems(prev => {
      if (qty <= 0) return prev.filter(i => i.caseItem.marketHashName !== marketHashName);
      return prev.map(i => i.caseItem.marketHashName === marketHashName ? { ...i, quantity: qty, total: i.price * qty } : i);
    });
  }, []);

  const removeItem = useCallback((marketHashName: string, isManual?: boolean) => {
    if (isManual) {
      setManualItems(prev => prev.filter(i => i.caseItem.marketHashName !== marketHashName));
    } else {
      setRemovedKeys(prev => new Set(prev).add(marketHashName));
    }
  }, []);

  const mergedRaw = useMemo(() => {
    const done = accounts.filter(a => a.status === "done" && a.result).map(a => a.result!);
    const hasScanned = done.length > 0;
    const hasManual = manualItems.length > 0;
    if (!hasScanned && !hasManual) return null;
    const map = new Map<string, ScanResultItem>();
    for (const r of done) for (const item of r.items) {
      if (removedKeys.has(item.caseItem.marketHashName)) continue;
      const k = item.caseItem.marketHashName, ex = map.get(k);
      if (ex) { ex.quantity += item.quantity; ex.total += item.total; } else map.set(k, { ...item });
    }
    const scannedItems = Array.from(map.values());
    const items = [...manualItems, ...scannedItems];
    return {
      items,
      scannedItems,
      totalInventoryCount: done.reduce((s, r) => s + r.totalInventoryCount, 0),
      accountCount: done.length,
    };
  }, [accounts, manualItems, removedKeys]);

  const merged = useMemo(() => {
    if (!mergedRaw) return null;
    const items = mergedRaw.items.filter(i => selectedTypes.size === 0 || selectedTypes.has(i.type));
    const scannedItems = mergedRaw.scannedItems.filter(i => selectedTypes.size === 0 || selectedTypes.has(i.type));
    return {
      ...mergedRaw,
      items,
      scannedItems,
      totalPrice: items.reduce((s, i) => s + i.total, 0),
      totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
    };
  }, [mergedRaw, selectedTypes]);

  const filteredManualItems = useMemo(() => {
    const query = globalFilter.trim().toLowerCase();
    const items = manualItems.filter(i => selectedTypes.size === 0 || selectedTypes.has(i.type));
    if (!query) return items;
    return items.filter(i => i.caseItem.name.toLowerCase().includes(query));
  }, [manualItems, globalFilter, selectedTypes]);

  const isAnyScanPending = accounts.some(a => a.status === "scanning");
  const hasValidUrls = accounts.some(a => a.url.trim());

  const columns = useMemo<ColumnDef<ScanResultItem>[]>(
    () => [
      {
        id: "case",
        header: "Case",
        accessorFn: (row) => row.caseItem.name,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stone-800">
              {row.original.caseItem.imageUrl ? (
                <img src={row.original.caseItem.imageUrl} alt={row.original.caseItem.name} className="size-8 object-contain" loading="lazy" />
              ) : (
                <ShoppingBag className="size-5 text-stone-500" />
              )}
            </div>
            <span className="font-medium text-stone-200">{row.original.caseItem.name}</span>
          </div>
        ),
      },
      {
        id: "quantity",
        header: ({ column }) => (
          <button type="button" onClick={() => column.toggleSorting()} className="inline-flex w-full items-center justify-end gap-1 hover:text-stone-100">
            SL <ArrowUpDown className="size-3.5" />
          </button>
        ),
        accessorFn: (row) => row.quantity,
        cell: ({ row }) => <div className="text-right font-medium text-stone-300">{row.original.quantity}</div>,
      },
      {
        id: "price",
        header: ({ column }) => (
          <button type="button" onClick={() => column.toggleSorting()} className="inline-flex w-full items-center justify-end gap-1 hover:text-stone-100">
            Đơn giá <ArrowUpDown className="size-3.5" />
          </button>
        ),
        accessorFn: (row) => row.price,
        cell: ({ row }) => <div className="text-right text-stone-400">{formatVND(row.original.price)}</div>,
      },
      {
        id: "total",
        header: ({ column }) => (
          <button type="button" onClick={() => column.toggleSorting()} className="inline-flex w-full items-center justify-end gap-1 hover:text-stone-100">
            Tổng (100%) <ArrowUpDown className="size-3.5" />
          </button>
        ),
        accessorFn: (row) => row.total,
        cell: ({ row }) => <div className="text-right font-medium text-emerald-400">{formatVND(row.original.total)}</div>,
      },
      {
        id: "rateAll",
        header: ({ column }) => (
          <button type="button" onClick={() => column.toggleSorting()} className="inline-flex w-full items-center justify-end gap-1 text-amber-400 hover:text-amber-300">
            Sỉ ({rateAll}%) <ArrowUpDown className="size-3.5" />
          </button>
        ),
        accessorFn: (row) => row.total * rateAll / 100,
        cell: ({ row }) => <div className="text-right font-medium text-amber-300">{formatVND(row.original.total * rateAll / 100)}</div>,
      },
      {
        id: "rateLe",
        header: ({ column }) => (
          <button type="button" onClick={() => column.toggleSorting()} className="inline-flex w-full items-center justify-end gap-1 text-violet-400 hover:text-violet-300">
            Lẻ ({rateLe}%) <ArrowUpDown className="size-3.5" />
          </button>
        ),
        accessorFn: (row) => row.total * rateLe / 100,
        cell: ({ row }) => <div className="text-right font-medium text-violet-300">{formatVND(row.original.total * rateLe / 100)}</div>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => removeItem(row.original.caseItem.marketHashName)}
            className="inline-flex size-8 items-center justify-center rounded-md text-stone-500 hover:bg-red-950/30 hover:text-red-400 transition-colors"
            title="Xóa khỏi danh sách"
          >
            <Trash2 className="size-3.5" />
          </button>
        ),
        enableSorting: false,
      },
    ],
    [rateAll, rateLe, removeItem]
  );

  const table = useReactTable({
    data: merged?.scannedItems || [],
    columns,
    state: { globalFilter },
    initialState: {
      pagination: { pageSize: 10 },
      sorting: [{ id: "total", desc: true }]
    },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => {
      const query = String(filterValue).trim().toLowerCase();
      if (!query) return true;
      return String(row.original.caseItem.name).toLowerCase().includes(query);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <main className="min-h-screen">
      <section className="relative min-h-[16rem] overflow-hidden border-b border-stone-800">
        <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{ backgroundImage: "url('/assets/dashboard-banner.png')" }} />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0e0f0f] via-[#0e0f0f]/84 to-[#0e0f0f]/20" />
        <div className="relative mx-auto flex max-w-7xl flex-col justify-end px-4 pb-8 pt-16 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">Công cụ CS2</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-normal text-stone-50 sm:text-5xl">Quét hòm đồ Steam</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-300">Nhập một hoặc nhiều link profile Steam để quét toàn bộ case và tính tổng giá trị gộp từ nhiều tài khoản.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Account list */}
        <div className="mb-8 rounded-xl border border-stone-800 bg-stone-900/50 p-6">
          {!isLoaded ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-stone-500" />
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-300">Danh sách tài khoản</h2>
                <span className="text-xs text-stone-500">{accounts.length} tài khoản</span>
              </div>
          <div className="space-y-3">
            {accounts.map((acc, idx) => (
              <div key={acc.id}>
                <div className="flex items-center gap-2">
                  {/* Avatar or number */}
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-stone-800 text-xs font-medium text-stone-400 overflow-hidden">
                    {acc.result?.profile?.avatarUrl ? <img src={acc.result.profile.avatarUrl} alt="" className="size-8 object-cover" /> : idx + 1}
                  </div>
                  <div className="relative flex-1">
                    <input type="text" placeholder="https://steamcommunity.com/id/fumodayo/"
                      value={acc.url} onChange={e => updateAccountUrl(acc.id, e.target.value)} disabled={acc.status === "scanning"}
                      className={`w-full rounded-lg border bg-stone-950 px-4 py-2.5 pr-28 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-1 disabled:opacity-50 ${acc.status === "error" ? "border-red-500/50 focus:ring-red-500" : acc.status === "done" ? "border-emerald-500/30 focus:ring-emerald-500" : "border-stone-700 focus:ring-amber-500"}`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      {acc.status === "scanning" && <Loader2 className="size-4 animate-spin text-amber-400" />}
                      {acc.status === "done" && (
                        <span className="text-xs font-medium text-emerald-400 max-w-[8rem] truncate" title={acc.result?.profile?.name}>
                          {acc.result?.profile?.name ?? "✓"}
                        </span>
                      )}
                      {acc.status === "error" && <AlertCircle className="size-4 text-red-400" />}
                    </div>
                  </div>
                  <button type="button" onClick={() => doScan(acc.id, false, accounts)} disabled={isAnyScanPending || !acc.url.trim()}
                    className="inline-flex size-[42px] shrink-0 items-center justify-center rounded-lg border border-stone-700 text-stone-300 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40" title="Quét">
                    <Search className="size-4" />
                  </button>
                  {/* Per-account expand */}
                  {acc.status === "done" && (
                    <button type="button" onClick={() => setExpandedAccId(expandedAccId === acc.id ? null : acc.id)}
                      className="inline-flex size-[42px] shrink-0 items-center justify-center rounded-lg border border-stone-700 text-stone-300 hover:bg-stone-800" title="Chi tiết">
                      {expandedAccId === acc.id ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>
                  )}
                  {accounts.length > 1 && (
                    <button type="button" onClick={() => removeAccount(acc.id)} disabled={acc.status === "scanning"}
                      className="inline-flex size-[42px] shrink-0 items-center justify-center rounded-lg border border-stone-700 text-stone-400 hover:border-red-500/30 hover:bg-red-950/20 hover:text-red-400 disabled:opacity-40" title="Xóa">
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                {/* Per-account expanded detail */}
                {expandedAccId === acc.id && acc.result && (
                  <div className="ml-10 mt-2 rounded-lg border border-stone-800 bg-stone-950/60 p-4">
                    <div className="mb-3 flex items-center gap-3">
                      {acc.result.profile?.avatarUrl && <img src={acc.result.profile.avatarUrl} alt="" className="size-10 rounded-full" />}
                      <div>
                        <p className="text-sm font-semibold text-stone-200">{acc.result.profile?.name ?? "Unknown"}</p>
                        <p className="text-xs text-stone-500">{acc.result.totalQuantity} case · {formatVND(acc.result.totalPrice)} · {acc.result.cached ? "cache" : "fresh"}</p>
                      </div>
                    </div>
                    {acc.result.items.length > 0 ? (
                      <div className="space-y-1.5">
                        {[...acc.result.items].sort((a, b) => b.total - a.total).map(item => (
                          <div key={item.caseItem.marketHashName} className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-stone-800/40">
                            <div className="flex items-center gap-2.5">
                              <div className="flex size-7 shrink-0 items-center justify-center rounded bg-stone-800">
                                {item.caseItem.imageUrl ? <img src={item.caseItem.imageUrl} alt="" className="size-6 object-contain" /> : <ShoppingBag className="size-3.5 text-stone-500" />}
                              </div>
                              <span className="text-stone-300">{item.caseItem.name}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-stone-400">×{item.quantity}</span>
                              <span className="font-medium text-emerald-400">{formatVND(item.total)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-stone-500">Không có case.</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Errors */}
          {accounts.filter(a => a.error).map(a => (
            <div key={`err-${a.id}`} className="mt-3 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-2.5 text-sm text-red-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p><span className="font-medium">TK {accounts.findIndex(x => x.id === a.id) + 1}:</span> {a.error}</p>
            </div>
          ))}
          {/* Buttons */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={addAccount} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-stone-600 px-4 py-2 text-sm font-medium text-stone-300 hover:border-stone-500 hover:bg-stone-800/50">
              <Plus className="size-4" /> Thêm tài khoản
            </button>
            <button type="button" onClick={() => scanAll(false)} disabled={scanningAll || isAnyScanPending || !hasValidUrls}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-2 text-sm font-semibold text-stone-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50">
              {scanningAll ? <><Loader2 className="size-4 animate-spin" /> Đang quét...</> : <><Search className="size-4" /> Quét tất cả</>}
            </button>

          </div>
            </>
          )}
        </div>

        {/* Merged results */}
        {merged && (
          <div className="space-y-6">
            {merged.accountCount > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-500/20 bg-sky-950/20 px-5 py-3.5 text-sm text-sky-200">
                <Users className="size-4 text-sky-400" />
                <span>Kết quả gộp từ <span className="font-semibold text-sky-100">{merged.accountCount} tài khoản</span>{manualItems.length > 0 && <> + <span className="font-semibold text-sky-100">{manualItems.length} item thủ công</span></>}</span>
              </div>
            )}

            {/* Add case manually */}
            <AddCaseSearch onAdd={addManualItem} />

            {/* Rate inputs */}
            <div className="grid gap-4 sm:grid-cols-2">
              <RateCard id="rateAll" label="Rate sỉ (all)" value={rateAll} onChange={setRateAll} total={merged.totalPrice} color="amber" desc="Giá bán khi bán sỉ toàn bộ" />
              <RateCard id="rateLe" label="Rate lẻ" value={rateLe} onChange={setRateLe} total={merged.totalPrice} color="violet" desc="Giá bán khi bán lẻ từng hòm" />
            </div>

            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Tổng số lượng Case" value={String(merged.totalQuantity)} unit="hòm" />
              <StatCard label="Giá trị thị trường (100%)" value={formatVND(merged.totalPrice)} valueClass="text-emerald-400" />
              <StatCard label="Tổng item trong hòm đồ" value={String(merged.totalInventoryCount)} unit="item" />
            </div>

            {/* Table */}
            {merged.items.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-stone-800 bg-stone-900/50">
                {/* Table Toolbar */}
                <div className="flex flex-col gap-3 border-b border-stone-800 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <label className="flex h-10 w-full sm:max-w-[16rem] items-center gap-2 rounded-md border border-stone-700 bg-stone-950/70 px-3 text-sm">
                      <Search className="size-4 text-stone-500" />
                      <input
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        placeholder="Tìm case, capsule..."
                        className="w-full bg-transparent text-stone-100 outline-none placeholder:text-stone-600"
                      />
                    </label>

                    <FacetedFilter
                      title="Type"
                      options={[
                        { label: "Case", value: "Case" },
                        { label: "Sticker Capsule", value: "Capsule" },
                      ]}
                      selectedValues={selectedTypes}
                      onChange={setSelectedTypes}
                    />
                  </div>
                  <select
                    value={table.getState().pagination.pageSize}
                    onChange={(e) => table.setPageSize(Number(e.target.value))}
                    className="h-10 rounded-md border border-stone-700 bg-stone-950/70 px-3 text-sm text-stone-100 outline-none"
                  >
                    {[10, 20, 50, 100].map(size => (
                      <option key={size} value={size}>{size} dòng</option>
                    ))}
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-stone-300">
                    <thead className="bg-stone-900/80 text-xs uppercase text-stone-400">
                      {table.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map(header => (
                            <th key={header.id} className={`px-5 py-3 font-medium ${header.column.id !== "case" ? "text-right" : ""}`}>
                              {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody className="divide-y divide-stone-800">
                      {filteredManualItems.length > 0 && (
                        filteredManualItems.map(item => (
                          <tr key={`manual-${item.caseItem.marketHashName}`} className="bg-amber-500/[0.04] border-l-2 border-l-amber-500 hover:bg-amber-500/[0.08] transition-colors">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                                  {item.caseItem.imageUrl ? (
                                    <img src={item.caseItem.imageUrl} alt={item.caseItem.name} className="size-8 object-contain" />
                                  ) : (
                                    <ShoppingBag className="size-5 text-amber-500/70" />
                                  )}
                                </div>
                                <div>
                                  <span className="font-semibold text-amber-200">{item.caseItem.name}</span>
                                  <span className="ml-2 inline-flex items-center rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-400">Thủ công</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center justify-end gap-2.5">
                                <button
                                  type="button"
                                  onClick={() => updateManualItemQty(item.caseItem.marketHashName, item.quantity - 1)}
                                  className="inline-flex size-6 items-center justify-center rounded bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200 font-bold transition-colors"
                                >
                                  -
                                </button>
                                <span className="w-8 text-center font-bold text-amber-400">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => updateManualItemQty(item.caseItem.marketHashName, item.quantity + 1)}
                                  className="inline-flex size-6 items-center justify-center rounded bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200 font-bold transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right text-stone-400 font-medium">
                              {formatVND(item.price)}
                            </td>
                            <td className="px-5 py-4 text-right font-medium text-emerald-400">
                              {formatVND(item.total)}
                            </td>
                            <td className="px-5 py-4 text-right font-medium text-amber-300">
                              {formatVND(item.total * rateAll / 100)}
                            </td>
                            <td className="px-5 py-4 text-right font-medium text-violet-300">
                              {formatVND(item.total * rateLe / 100)}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <button
                                type="button"
                                onClick={() => removeItem(item.caseItem.marketHashName, true)}
                                className="inline-flex size-8 items-center justify-center rounded-md text-stone-500 hover:bg-red-950/30 hover:text-red-400 transition-colors"
                                title="Xóa khỏi danh sách"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}

                      {table.getRowModel().rows.length > 0 ? (
                        table.getRowModel().rows.map(row => (
                          <tr key={row.id} className="transition-colors hover:bg-stone-800/50">
                            {row.getVisibleCells().map(cell => (
                              <td key={cell.id} className="px-5 py-4">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        filteredManualItems.length === 0 && (
                          <tr>
                            <td colSpan={columns.length} className="px-5 py-8 text-center text-stone-500">
                              Không tìm thấy kết quả nào phù hợp
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col gap-3 border-t border-stone-800 p-3 text-sm text-stone-400 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    Trang {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)} · {table.getFilteredRowModel().rows.length} dòng
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                      className="inline-flex h-9 items-center gap-1 rounded-md border border-stone-700 px-3 text-stone-200 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="size-4" /> Trước
                    </button>
                    <button
                      type="button"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                      className="inline-flex h-9 items-center gap-1 rounded-md border border-stone-700 px-3 text-stone-200 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Sau <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-800 bg-stone-900/30 py-16 text-center">
                <ShoppingBag className="mb-4 size-10 text-stone-600" />
                <p className="text-lg font-medium text-stone-300">Không tìm thấy case nào</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Show add case even without merged results */}
      {!merged && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <AddCaseSearch onAdd={addManualItem} />
          </div>
        </section>
      )}
    </main>
  );
}

function RateCard({ id, label, value, onChange, total, color, desc }: { id: string; label: string; value: number; onChange: (v: number) => void; total: number; color: "amber" | "violet"; desc: string }) {
  const textClass = color === "amber" ? "text-amber-300" : "text-violet-300";
  const focusClass = color === "amber" ? "focus:border-amber-500 focus:ring-amber-500" : "focus:border-violet-500 focus:ring-violet-500";
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900/50 p-5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-stone-300">{label}</label>
        <div className="flex items-center gap-1.5">
          <input id={id} type="number" min={1} max={100} value={value} onChange={e => onChange(Math.min(100, Math.max(1, Number(e.target.value) || 0)))}
            className={`w-16 rounded-md border border-stone-700 bg-stone-950 px-2.5 py-1.5 text-right text-sm font-semibold ${textClass} ${focusClass} focus:outline-none focus:ring-1`} />
          <span className="text-sm font-medium text-stone-400">%</span>
        </div>
      </div>
      <div className="mt-3"><span className={`text-2xl font-bold ${textClass}`}>{formatVND(total * value / 100)}</span></div>
      <p className="mt-1 text-xs text-stone-500">{desc}</p>
    </div>
  );
}

function StatCard({ label, value, unit, valueClass = "text-stone-50" }: { label: string; value: string; unit?: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900/50 p-6">
      <p className="text-sm font-medium text-stone-400">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${valueClass}`}>{value}</span>
        {unit && <span className="text-sm text-stone-400">{unit}</span>}
      </div>
    </div>
  );
}

function formatVND(value: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
}

function FacetedFilter({ title, options, selectedValues, onChange }: { title: string, options: { label: string, value: string }[], selectedValues: Set<string>, onChange: (v: Set<string>) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = () => setIsOpen(false);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [isOpen]);

  const toggleValue = (val: string) => {
    const next = new Set(selectedValues);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    onChange(next);
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 items-center gap-2 rounded-md border border-dashed border-stone-700 bg-stone-950/70 px-3 text-sm font-medium text-stone-300 hover:bg-stone-800"
      >
        <Plus className="size-4 text-stone-400" />
        {title}
        {selectedValues.size > 0 && (
          <>
            <div className="mx-1 h-4 w-px bg-stone-700" />
            <span className="flex h-5 items-center justify-center rounded-sm bg-stone-800 px-1.5 text-xs text-stone-200">
              {selectedValues.size}
            </span>
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-48 rounded-md border border-stone-800 bg-stone-950 p-1 shadow-xl z-50">
          <div className="flex flex-col gap-0.5">
            {options.map((opt) => {
              const isSelected = selectedValues.has(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleValue(opt.value)}
                  className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm text-stone-300 hover:bg-stone-800 hover:text-stone-100"
                >
                  <div className={`flex size-4 shrink-0 items-center justify-center rounded-[3px] border ${isSelected ? "border-stone-100 bg-stone-100 text-stone-950" : "border-stone-600 bg-transparent"}`}>
                    {isSelected && <Check className="size-3" strokeWidth={3} />}
                  </div>
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
          {selectedValues.size > 0 && (
            <>
              <div className="my-1 h-px bg-stone-800" />
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="w-full rounded-sm px-2 py-1.5 text-center text-xs text-stone-400 hover:bg-stone-800 hover:text-stone-100"
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type SearchResult = { caseItem: CaseItemData; price: number };

function AddCaseSearch({ onAdd }: { onAdd: (caseItem: CaseItemData, price: number, quantity: number) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchCases = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/search-case?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(data.results || []);
      setIsOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchCases(value), 350);
  };

  const handleAdd = (result: SearchResult) => {
    const qty = quantities[result.caseItem.id] || 1;
    onAdd(result.caseItem, result.price, qty);
    // Reset quantity for this item
    setQuantities(prev => ({ ...prev, [result.caseItem.id]: 1 }));
  };

  return (
    <div ref={containerRef} className="rounded-xl border border-stone-800 bg-stone-900/50 p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-300">Thêm case thủ công</h3>
      <div className="relative">
        <label className="flex h-10 items-center gap-2 rounded-lg border border-stone-700 bg-stone-950 px-3 text-sm">
          <Search className="size-4 text-stone-500" />
          <input
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => { if (results.length > 0) setIsOpen(true); }}
            placeholder="Tìm case hoặc sticker capsule... (VD: dream, kilowatt, sticker)"
            className="w-full bg-transparent text-stone-100 outline-none placeholder:text-stone-600"
          />
          {loading && <Loader2 className="size-4 animate-spin text-stone-500" />}
        </label>

        {isOpen && results.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-lg border border-stone-800 bg-stone-950 shadow-2xl">
            {results.map((r) => {
              const qty = quantities[r.caseItem.id] || 1;
              return (
                <div key={r.caseItem.id} className="flex items-center gap-3 border-b border-stone-800/50 px-4 py-3 last:border-b-0 hover:bg-stone-800/40 transition-colors">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-stone-800">
                    {r.caseItem.imageUrl ? (
                      <img src={r.caseItem.imageUrl} alt="" className="size-7 object-contain" />
                    ) : (
                      <ShoppingBag className="size-4 text-stone-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-200 truncate">{r.caseItem.name}</p>
                    <p className="text-xs text-stone-500">{r.price > 0 ? formatVND(r.price) : "Chưa có giá"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={qty}
                      onChange={(e) => setQuantities(prev => ({ ...prev, [r.caseItem.id]: Math.max(1, Number(e.target.value) || 1) }))}
                      className="w-16 rounded-md border border-stone-700 bg-stone-900 px-2 py-1 text-center text-sm text-stone-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      type="button"
                      onClick={() => handleAdd(r)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-amber-400/90 px-3 text-xs font-semibold text-stone-950 hover:bg-amber-300 transition-colors"
                    >
                      <Plus className="size-3.5" /> Thêm
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isOpen && query.trim() && results.length === 0 && !loading && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-lg border border-stone-800 bg-stone-950 px-4 py-6 text-center text-sm text-stone-500 shadow-2xl">
            Không tìm thấy case nào phù hợp
          </div>
        )}
      </div>
    </div>
  );
}
