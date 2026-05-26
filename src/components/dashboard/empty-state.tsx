import { Plus } from "lucide-react";

type EmptyStateProps = {
  onAdd: () => void;
};

export function EmptyState({ onAdd }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-stone-700 bg-stone-950/45 px-6 py-14 text-center">
      <p className="text-lg font-semibold text-stone-100">Chưa có case nào trong portfolio</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-stone-400">
        Bấm dấu cộng, tìm case theo tên, nhập giá mua và số lượng để bắt đầu theo dõi lời lỗ.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-amber-300"
      >
        <Plus className="size-4" />
        Thêm case
      </button>
    </div>
  );
}
