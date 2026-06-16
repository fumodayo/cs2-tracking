import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  TbPackage,
  TbPills,
  TbTag,
  TbSword,
  TbHandGrab,
  TbUser,
  TbMusic,
  TbPin,
  TbCircleDot,
  TbPalette,
} from "react-icons/tb";
import {
  type PortfolioSourceFilter,
  type PortfolioTableRow,
  getItemStatusBreakdown,
  getRowSubtype,
} from "../portfolio-table-model";
import { buildAccountOptions } from "../portfolio-table-utils";

interface UsePortfolioFiltersProps {
  rows: PortfolioTableRow[];
  buffPricesCny: Record<string, number>;
}

export function usePortfolioFilters({ rows, buffPricesCny }: UsePortfolioFiltersProps) {
  const { t } = useTranslation();

  const [sourceFilters, setSourceFilters] = useState<PortfolioSourceFilter[]>([]);
  const [itemTypeFilters, setItemTypeFilters] = useState<string[]>([]);
  const [accountFilters, setAccountFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [priceSourceFilters, setPriceSourceFilters] = useState<string[]>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const accountOptions = useMemo(() => buildAccountOptions(rows), [rows]);

  const subtypeOptions = useMemo(() => {
    const subtypes = new Set<string>();
    for (const row of rows) {
      if (row.itemType === "skin") {
        subtypes.add(getRowSubtype(row));
      }
    }
    return Array.from(subtypes)
      .sort((a, b) => {
        const special = ["Knives", "Gloves", "Agent", "Music Kit", "Patch", "Pin", "Graffiti"];
        const aIndex = special.indexOf(a);
        const bIndex = special.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return 1;
        if (bIndex !== -1) return -1;
        return a.localeCompare(b);
      })
      .map((subtype) => {
        let Icon = TbSword;
        if (subtype === "Knives") Icon = TbSword;
        else if (subtype === "Gloves") Icon = TbHandGrab;
        else if (subtype === "Agent") Icon = TbUser;
        else if (subtype === "Music Kit") Icon = TbMusic;
        else if (subtype === "Pin") Icon = TbPin;
        else if (subtype === "Patch") Icon = TbCircleDot;
        else if (subtype === "Graffiti") Icon = TbPalette;
        
        return {
          label: subtype,
          value: `subtype:${subtype}`,
          icon: Icon,
        };
      });
  }, [rows]);

  const itemTypeOptions = useMemo(() => {
    const base = [
      { label: t("portfolio.itemTypeCase", "Hòm (Case)"), value: "case", icon: TbPackage },
      { label: t("portfolio.itemTypeCapsule", "Capsule"), value: "capsule", icon: TbPills },
      { label: t("portfolio.itemTypeSticker", "Sticker"), value: "sticker", icon: TbTag },
      { label: t("portfolio.itemTypeSkinAll", "Skin (Tất cả)"), value: "skin", icon: TbSword },
    ];
    if (subtypeOptions.length > 0) {
      return [
        ...base,
        { label: t("portfolio.itemTypeSkinDetails", "── Chi tiết Skin ──"), value: "separator" },
        ...subtypeOptions,
      ];
    }
    return base;
  }, [subtypeOptions, t]);

  const filteredData = useMemo(
    () =>
      rows.filter((row) => {
        if (sourceFilters.length > 0 && !sourceFilters.includes(row.sourceType)) return false;
        if (itemTypeFilters.length > 0) {
          const matches = itemTypeFilters.some((filterVal) => {
            if (filterVal.startsWith("subtype:")) {
              const subtype = filterVal.substring(8);
              return getRowSubtype(row) === subtype;
            }
            return row.itemType === filterVal;
          });
          if (!matches) return false;
        }
        if (
          accountFilters.length > 0 &&
          !row.sourceAccounts.some((account) => accountFilters.includes(account.steamId64))
        ) {
          return false;
        }
        if (statusFilters.length > 0) {
          const breakdown = getItemStatusBreakdown(row);
          const statuses = new Set<string>();
          if (breakdown.tradeable > 0) statuses.add("tradeable");
          if (breakdown.onMarket > 0) statuses.add("market");
          if (breakdown.tradeProtected > 0) statuses.add("protected");
          if (breakdown.hold > 0) statuses.add("hold");

          if (statuses.size === 0) statuses.add("tradeable");

          const matchesStatus = statusFilters.some((s) => statuses.has(s));
          if (!matchesStatus) return false;
        }
        if (priceSourceFilters.length > 0) {
          const hasBuffPrice = buffPricesCny[row.case.marketHashName] !== undefined && buffPricesCny[row.case.marketHashName] > 0;
          const matchesBuff = priceSourceFilters.includes("buff") && hasBuffPrice;
          const matchesSteam = priceSourceFilters.includes("steam") && !hasBuffPrice;
          if (!matchesBuff && !matchesSteam) return false;
        }
        return true;
      }),
    [rows, sourceFilters, itemTypeFilters, accountFilters, statusFilters, priceSourceFilters, buffPricesCny]
  );

  const isResetVisible =
    sourceFilters.length > 0 ||
    itemTypeFilters.length > 0 ||
    accountFilters.length > 0 ||
    statusFilters.length > 0 ||
    priceSourceFilters.length > 0;

  const handleResetFilters = () => {
    setSourceFilters([]);
    setItemTypeFilters([]);
    setAccountFilters([]);
    setStatusFilters([]);
    setPriceSourceFilters([]);
  };

  return {
    sourceFilters,
    setSourceFilters,
    itemTypeFilters,
    setItemTypeFilters,
    accountFilters,
    setAccountFilters,
    statusFilters,
    setStatusFilters,
    priceSourceFilters,
    setPriceSourceFilters,
    globalFilter,
    setGlobalFilter,
    filteredData,
    accountOptions,
    itemTypeOptions,
    isResetVisible,
    handleResetFilters,
  };
}
