"use client";

import { useTranslation } from "react-i18next";
import { CaseSearchSelect, type CaseItemSearchData } from "../../case-search-select";

interface CaseSelectionSectionProps {
  selectedCase: CaseItemSearchData | null;
  onSelect: (caseItem: CaseItemSearchData, price: number) => void;
  onClear: () => void;
}

export function CaseSelectionSection({
  selectedCase,
  onSelect,
  onClear,
}: CaseSelectionSectionProps) {
  const { t } = useTranslation();
  return (
    <CaseSearchSelect
      selectedCase={selectedCase}
      onSelect={onSelect}
      onClear={onClear}
      label={t("portfolio.caseName", "Case name")}
    />
  );
}
