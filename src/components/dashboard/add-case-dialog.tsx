"use client";

import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { CaseDto } from "@/types/report";
import { formatInputDate } from "@/utils/format";
import { CaseThumbnail } from "./case-thumbnail";

type AddCaseDialogProps = {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    caseId: string;
    quantity: number;
    buyPrice: number;
    buyDate: string;
    note?: string;
  }) => Promise<void>;
};

export function AddCaseDialog({ open, saving, onClose, onSubmit }: AddCaseDialogProps) {
  const [query, setQuery] = useState("");
  const [selectedCase, setSelectedCase] = useState<CaseDto | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [buyPrice, setBuyPrice] = useState("");
  const [buyDate, setBuyDate] = useState(formatInputDate(new Date()));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => selectedCase && Number(quantity) > 0 && Number(buyPrice) > 0 && buyDate,
    [buyDate, buyPrice, quantity, selectedCase],
  );

  const caseQuery = useQuery({
    queryKey: ["cases", query],
    queryFn: () => fetchCases(query),
    enabled: open,
    staleTime: 60_000,
  });

  const cases = caseQuery.data ?? [];

  if (!open) {
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedCase || !canSubmit) {
      setError("Vui lòng chọn case, nhập giá mua và số lượng hợp lệ.");
      return;
    }

    await onSubmit({
      caseId: selectedCase.id,
      quantity: Number(quantity),
      buyPrice: Number(buyPrice),
      buyDate,
      note: note.trim() || undefined,
    });

    setQuery("");
    setSelectedCase(null);
    setQuantity("1");
    setBuyPrice("");
    setBuyDate(formatInputDate(new Date()));
    setNote("");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl rounded-lg border border-stone-700 bg-[#151514] p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-stone-50">Thêm case đã mua</h2>
            <p className="mt-1 text-sm text-stone-400">Tìm case, nhập giá mua cho 1 case và số lượng.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-md border border-stone-700 text-stone-300 hover:bg-stone-800"
            aria-label="Đóng"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5">
          <label className="text-sm font-medium text-stone-200" htmlFor="case-search">
            Tên case
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-stone-700 bg-stone-950/70 px-3">
            <Search className="size-4 text-stone-500" />
            <input
              id="case-search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedCase(null);
              }}
              placeholder="Ví dụ: Kilowatt Case"
              className="h-11 w-full bg-transparent text-sm text-stone-100 outline-none placeholder:text-stone-600"
            />
          </div>
          <div className="mt-2 max-h-52 overflow-auto rounded-md border border-stone-800 bg-stone-950/50">
            {cases.map((caseItem) => {
              const selected = selectedCase?.id === caseItem.id;

              return (
                <button
                  type="button"
                  key={caseItem.id}
                  onClick={() => {
                    setSelectedCase(caseItem);
                    setQuery(caseItem.name);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-stone-800 ${
                    selected ? "bg-amber-400/12 text-amber-100" : "text-stone-200"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <CaseThumbnail imageUrl={caseItem.imageUrl} name={caseItem.name} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{caseItem.name}</span>
                      <span className="block truncate text-xs text-stone-500">{caseItem.marketHashName}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-stone-200">
            Giá mua / case
            <input
              value={buyPrice}
              onChange={(event) => setBuyPrice(event.target.value)}
              inputMode="numeric"
              placeholder="VD: 12500"
              className="mt-2 h-11 w-full rounded-md border border-stone-700 bg-stone-950/70 px-3 text-sm text-stone-100 outline-none focus:border-amber-400"
            />
          </label>
          <label className="text-sm font-medium text-stone-200">
            Số lượng
            <input
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              inputMode="numeric"
              className="mt-2 h-11 w-full rounded-md border border-stone-700 bg-stone-950/70 px-3 text-sm text-stone-100 outline-none focus:border-amber-400"
            />
          </label>
          <label className="text-sm font-medium text-stone-200">
            Ngày mua
            <input
              type="date"
              value={buyDate}
              onChange={(event) => setBuyDate(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-stone-700 bg-stone-950/70 px-3 text-sm text-stone-100 outline-none focus:border-amber-400"
            />
          </label>
        </div>

        <label className="mt-4 block text-sm font-medium text-stone-200">
          Ghi chú
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            className="mt-2 w-full resize-none rounded-md border border-stone-700 bg-stone-950/70 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-400"
            placeholder="Nguồn mua, kế hoạch bán..."
          />
        </label>

        {error || caseQuery.error ? (
          <p className="mt-3 text-sm text-red-300">
            {error ?? (caseQuery.error instanceof Error ? caseQuery.error.message : "Không thể tìm case.")}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stone-700 px-4 py-2 text-sm font-medium text-stone-200 hover:bg-stone-800"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!canSubmit || saving}
            className="rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu case"}
          </button>
        </div>
      </form>
    </div>
  );
}

async function fetchCases(query: string): Promise<CaseDto[]> {
  const response = await fetch(`/api/cases?search=${encodeURIComponent(query)}`);
  const data = (await response.json()) as { cases?: CaseDto[]; message?: string };

  if (!response.ok) {
    throw new Error(data.message ?? "Không thể tìm case.");
  }

  return data.cases ?? [];
}
