import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  onAdd: () => void;
};

export function EmptyState({ onAdd }: EmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-dashed border-stone-700 bg-stone-950/45 px-6 py-14 text-center">
      <p className="text-lg font-semibold text-stone-100">
        {t("portfolio.emptyStateTitle", "No items in portfolio yet")}
      </p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-stone-400">
        {t("portfolio.emptyStateDesc", "Click the plus button, search for cases by name, enter buy price and quantity to start tracking profit/loss.")}
      </p>
      <Button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
      >
        <Plus className="size-4" />
        {t("portfolio.emptyStateAddButton", "Add case")}
      </Button>
    </div>
  );
}
