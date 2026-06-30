import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  TbDiamond,
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

const FILTER_PARAM_KEYS = {
  search: "q",
  source: "source",
  itemType: "itemType",
  account: "account",
  status: "status",
  priceSource: "priceSource",
} as const;

const VALID_SOURCE_FILTERS = new Set(["manual", "existing"]);
const VALID_STATUS_FILTERS = new Set(["tradeable", "market", "protected", "hold"]);
const VALID_PRICE_SOURCE_FILTERS = new Set(["buff", "steam"]);

type ReadableSearchParams = Pick<URLSearchParams, "get" | "getAll">;

function readParamList(params: ReadableSearchParams, key: string): string[] {
  const values = params
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(values));
}

function readFilteredParamList(
  params: ReadableSearchParams,
  key: string,
  validValues: Set<string>,
): string[] {
  return readParamList(params, key).filter((value) => validValues.has(value));
}

function readSourceFilters(params: ReadableSearchParams): PortfolioSourceFilter[] {
  return readFilteredParamList(
    params,
    FILTER_PARAM_KEYS.source,
    VALID_SOURCE_FILTERS,
  ) as PortfolioSourceFilter[];
}

function areListsEqual(first: string[], second: string[]): boolean {
  if (first.length !== second.length) return false;
  return first.every((value, index) => value === second[index]);
}

function setParamList(params: URLSearchParams, key: string, values: string[]) {
  params.delete(key);
  for (const value of values) {
    params.append(key, value);
  }
}

export function accountMatchesFilters(
  row: PortfolioTableRow,
  accountFilters: string[],
): boolean {
  if (accountFilters.length === 0) return true;

  return row.sourceAccounts.some((account) =>
    accountFilters.includes(account.steamId64),
  );
}

export function sourceMatchesFilters(
  row: PortfolioTableRow,
  sourceFilters: PortfolioSourceFilter[],
): boolean {
  if (sourceFilters.length === 0) return true;

  return sourceFilters.some((sourceFilter) => {
    if (sourceFilter === "manual") {
      return isManualSourceRow(row);
    }

    if (sourceFilter === "existing") {
      return !isManualSourceRow(row);
    }

    return false;
  });
}

export function getAccountFilteredQuantity(
  row: PortfolioTableRow,
  accountFilters: string[],
): { quantity: number; storageUnitQuantity: number } {
  const matchingAccounts = row.sourceAccounts.filter((acc) =>
    accountFilters.includes(acc.steamId64),
  );

  let selectedAccountBreakdownQuantity = 0;
  let hasAccountWithBreakdown = false;

  for (const acc of matchingAccounts) {
    if (acc.breakdown) {
      hasAccountWithBreakdown = true;
      selectedAccountBreakdownQuantity +=
        (acc.breakdown.tradeable ?? 0) +
        (acc.breakdown.onMarket ?? 0) +
        (acc.breakdown.tradeProtected ?? 0) +
        (acc.breakdown.hold ?? 0);
    }
  }

  const selectedStorageUnitQuantity = 0;

  if (hasAccountWithBreakdown) {
    return {
      quantity: selectedAccountBreakdownQuantity,
      storageUnitQuantity: selectedStorageUnitQuantity,
    };
  }

  const selectedInventoryQuantity =
    matchingAccounts.length > 0
      ? Math.max(0, row.quantity - (row.storageUnitQuantity ?? 0))
      : 0;

  return {
    quantity: selectedInventoryQuantity + selectedStorageUnitQuantity,
    storageUnitQuantity: selectedStorageUnitQuantity,
  };
}

function isManualSourceRow(row: PortfolioTableRow): boolean {
  if (row.sourceType === "manual") return true;

  const note = row.note?.trim().toLowerCase();
  if (
    note === "manual" ||
    note === "thủ công" ||
    note === "thu cong" ||
    note === "thá»§ cã´ng"
  ) {
    return true;
  }

  return row.sourceAccounts.some((account) => {
    const steamId64 = account.steamId64.trim().toLowerCase();
    const name = account.name.trim().toLowerCase();
    return (
      steamId64 === "manual" ||
      name === "manual" ||
      name === "thủ công" ||
      name === "thu cong" ||
      name === "thá»§ cã´ng"
    );
  });
}

const WEAPON_CATEGORIES: Record<string, string[]> = {
  rifles: ["AK-47", "AWP", "M4A4", "M4A1-S", "Galil AR", "FAMAS", "SSG 08", "SG 553", "AUG", "SCAR-20", "G3SG1"],
  pistols: ["USP-S", "Glock-18", "Desert Eagle", "P250", "Five-SeveN", "Tec-9", "CZ75-Auto", "Dual Berettas", "P2000", "R8 Revolver"],
  smgs: ["MAC-10", "MP9", "MP7", "MP5-SD", "UMP-45", "P90", "PP-Bizon"],
  heavy: ["Nova", "XM1014", "MAG-7", "Sawed-Off", "M249", "Negev"],
  knives_gloves: ["Knives", "Gloves"],
};

function getWeaponCategoryKey(subtype: string): string {
  const lowerSubtype = subtype.toLowerCase();
  if (lowerSubtype === "knives" || lowerSubtype === "gloves") {
    return "knives_gloves";
  }
  for (const [key, weapons] of Object.entries(WEAPON_CATEGORIES)) {
    if (weapons.some((w) => w.toLowerCase() === lowerSubtype)) {
      return key;
    }
  }
  return "others";
}

export function usePortfolioFilters({ rows, buffPricesCny }: UsePortfolioFiltersProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [sourceFilters, setSourceFilters] = useState<PortfolioSourceFilter[]>(
    () => readSourceFilters(searchParams),
  );
  const [itemTypeFilters, setItemTypeFilters] = useState<string[]>(
    () => readParamList(searchParams, FILTER_PARAM_KEYS.itemType),
  );
  const [accountFilters, setAccountFilters] = useState<string[]>(
    () => readParamList(searchParams, FILTER_PARAM_KEYS.account),
  );
  const [statusFilters, setStatusFilters] = useState<string[]>(
    () => readFilteredParamList(searchParams, FILTER_PARAM_KEYS.status, VALID_STATUS_FILTERS),
  );
  const [priceSourceFilters, setPriceSourceFilters] = useState<string[]>(
    () =>
      readFilteredParamList(
        searchParams,
        FILTER_PARAM_KEYS.priceSource,
        VALID_PRICE_SOURCE_FILTERS,
      ),
  );
  const [globalFilter, setGlobalFilter] = useState(
    () => searchParams.get(FILTER_PARAM_KEYS.search) ?? "",
  );

  const handleSetItemTypeFilters = useCallback((values: string[]) => {
    const wasSkinChecked = values.includes("skin");
    const wasSkinPreviouslyChecked = itemTypeFilters.includes("skin");
    const addedSkin = wasSkinChecked && !wasSkinPreviouslyChecked;

    const hasSubtypes = values.some(v => v.startsWith("subtype:"));
    const prevSubtypes = itemTypeFilters.filter(v => v.startsWith("subtype:"));
    const currentSubtypes = values.filter(v => v.startsWith("subtype:"));
    const addedSubtype = currentSubtypes.length > prevSubtypes.length;

    let nextValues = values;
    if (addedSkin) {
      nextValues = values.filter(v => !v.startsWith("subtype:"));
    } else if (addedSubtype && wasSkinChecked) {
      nextValues = values.filter(v => v !== "skin");
    }

    setItemTypeFilters(nextValues);
  }, [itemTypeFilters]);

  useEffect(() => {
    const nextGlobalFilter = searchParams.get(FILTER_PARAM_KEYS.search) ?? "";
    const nextSourceFilters = readSourceFilters(searchParams);
    const nextItemTypeFilters = readParamList(searchParams, FILTER_PARAM_KEYS.itemType);
    const nextAccountFilters = readParamList(searchParams, FILTER_PARAM_KEYS.account);
    const nextStatusFilters = readFilteredParamList(
      searchParams,
      FILTER_PARAM_KEYS.status,
      VALID_STATUS_FILTERS,
    );
    const nextPriceSourceFilters = readFilteredParamList(
      searchParams,
      FILTER_PARAM_KEYS.priceSource,
      VALID_PRICE_SOURCE_FILTERS,
    );

    setGlobalFilter((current) =>
      current === nextGlobalFilter ? current : nextGlobalFilter,
    );
    setSourceFilters((current) =>
      areListsEqual(current, nextSourceFilters) ? current : nextSourceFilters,
    );
    setItemTypeFilters((current) =>
      areListsEqual(current, nextItemTypeFilters) ? current : nextItemTypeFilters,
    );
    setAccountFilters((current) =>
      areListsEqual(current, nextAccountFilters) ? current : nextAccountFilters,
    );
    setStatusFilters((current) =>
      areListsEqual(current, nextStatusFilters) ? current : nextStatusFilters,
    );
    setPriceSourceFilters((current) =>
      areListsEqual(current, nextPriceSourceFilters)
        ? current
        : nextPriceSourceFilters,
    );
  }, [searchParams]);

  const syncFiltersToUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const trimmedGlobalFilter = globalFilter.trim();

    if (trimmedGlobalFilter) {
      params.set(FILTER_PARAM_KEYS.search, trimmedGlobalFilter);
    } else {
      params.delete(FILTER_PARAM_KEYS.search);
    }

    setParamList(params, FILTER_PARAM_KEYS.source, sourceFilters);
    setParamList(params, FILTER_PARAM_KEYS.itemType, itemTypeFilters);
    setParamList(params, FILTER_PARAM_KEYS.account, accountFilters);
    setParamList(params, FILTER_PARAM_KEYS.status, statusFilters);
    setParamList(params, FILTER_PARAM_KEYS.priceSource, priceSourceFilters);

    const queryString = params.toString();
    const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  }, [
    accountFilters,
    globalFilter,
    itemTypeFilters,
    pathname,
    priceSourceFilters,
    router,
    sourceFilters,
    statusFilters,
  ]);
  useEffect(() => {
    syncFiltersToUrl();
  }, [syncFiltersToUrl]);

  const accountOptions = useMemo(() => buildAccountOptions(rows), [rows]);

  const subtypeOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of rows) {
      if (row.itemType === "skin") {
        const subtype = getRowSubtype(row);
        counts[subtype] = (counts[subtype] || 0) + row.quantity;
      }
    }
    const subtypes = Object.keys(counts).sort((a, b) => a.localeCompare(b));
    return subtypes.map((subtype) => ({
      name: subtype,
      count: counts[subtype],
    }));
  }, [rows]);

  const itemTypeOptions = useMemo(() => {
    const base = [
      { label: t("portfolio.itemTypeCase", "Case"), value: "case", icon: TbPackage },
      { label: t("portfolio.itemTypeCapsule", "Capsule"), value: "capsule", icon: TbPills },
      { label: t("portfolio.itemTypeSticker", "Sticker"), value: "sticker", icon: TbTag },
      { label: t("portfolio.itemTypeSkinAll", "Skin (All)"), value: "skin", icon: TbSword },
    ];
    if (subtypeOptions.length > 0) {
      const categories: Record<
        string,
        { label: string; items: Array<{ name: string; count: number }>; totalCount: number }
      > = {
        rifles: { label: t("portfolio.categoryRifles", "Rifles"), items: [], totalCount: 0 },
        pistols: { label: t("portfolio.categoryPistols", "Pistols"), items: [], totalCount: 0 },
        smgs: { label: t("portfolio.categorySMGs", "SMGs"), items: [], totalCount: 0 },
        heavy: { label: t("portfolio.categoryHeavy", "Heavy"), items: [], totalCount: 0 },
        knives_gloves: {
          label: t("portfolio.categoryKnivesGloves", "Knives & Gloves"),
          items: [],
          totalCount: 0,
        },
        others: { label: t("portfolio.categoryOthers", "Others"), items: [], totalCount: 0 },
      };

      for (const item of subtypeOptions) {
        const catKey = getWeaponCategoryKey(item.name);
        categories[catKey].items.push(item);
        categories[catKey].totalCount += item.count;
      }

      const resultOptions: Array<{
        label: string;
        value: string;
        icon?: React.ComponentType<{ className?: string }>;
        group?: string;
        subValues?: string[];
      }> = [...base];

      resultOptions.push({
        label: t("portfolio.itemTypeSkinDetails", "── Chi tiết Skin ──"),
        value: "separator",
      });

      const order = ["rifles", "pistols", "smgs", "heavy", "knives_gloves", "others"];
      for (const key of order) {
        const cat = categories[key];
        if (cat.items.length > 0) {
          const subValues = cat.items.map((item) => `subtype:${item.name}`);
          resultOptions.push({
            label: `${cat.label} (${cat.totalCount})`,
            value: `group:${key}`,
            subValues,
          });
          for (const item of cat.items) {
            let Icon = TbSword;
            if (item.name === "Knives") Icon = TbSword;
            else if (item.name === "Gloves") Icon = TbHandGrab;
            else if (item.name === "Agent") Icon = TbUser;
            else if (item.name === "Music Kit") Icon = TbMusic;
            else if (item.name === "Pin") Icon = TbPin;
            else if (item.name === "Patch") Icon = TbCircleDot;
            else if (item.name === "Graffiti") Icon = TbPalette;
            else if (item.name === "Charm") Icon = TbDiamond;

            resultOptions.push({
              label: `${item.name} (${item.count})`,
              value: `subtype:${item.name}`,
              icon: Icon,
              group: key,
            });
          }
        }
      }

      return resultOptions;
    }
    return base;
  }, [subtypeOptions, t]);

  const filteredData = useMemo(
    () => {
      const filtered = rows.filter((row) => {
        if (!sourceMatchesFilters(row, sourceFilters)) return false;
        if (itemTypeFilters.length > 0) {
          const matches = itemTypeFilters.some((filterVal) => {
            if (filterVal.startsWith("subtype:")) {
              const subtype = filterVal.substring(8);
              return getRowSubtype(row) === subtype;
            }
            if (filterVal.startsWith("group:")) {
              const catKey = filterVal.substring(6);
              return getWeaponCategoryKey(getRowSubtype(row)) === catKey;
            }
            return row.itemType === filterVal;
          });
          if (!matches) return false;
        }
        if (
          accountFilters.length > 0 &&
          !accountMatchesFilters(row, accountFilters)
        ) {
          return false;
        }
        if (statusFilters.length > 0) {
          const itemForStatus = accountFilters.length > 0
            ? {
                ...row,
                sourceAccounts: row.sourceAccounts.filter((account) => accountFilters.includes(account.steamId64))
              }
            : row;
          const breakdown = getItemStatusBreakdown(itemForStatus);
          const statuses = new Set<string>();
          if (breakdown.tradeable > 0) statuses.add("tradeable");
          if (breakdown.onMarket > 0) statuses.add("market");
          if (breakdown.tradeProtected > 0) statuses.add("protected");
          if (breakdown.hold > 0) statuses.add("hold");

          // If status is unknown (no breakdown data), don't exclude the item —
          // we can't determine its real status so we let it pass all status filters.
          if (statuses.size === 0) return true;

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
      });

      if (accountFilters.length === 0) {
        return filtered;
      }

      return filtered.map((row) => {
        const {
          quantity: selectedQuantity,
          storageUnitQuantity: selectedStorageUnitQuantity,
        } = getAccountFilteredQuantity(row, accountFilters);
        const buyPrice = row.buyPrice;
        const investedValue = selectedQuantity * buyPrice;
        const currentValue = row.currentPrice !== null ? selectedQuantity * row.currentPrice : null;
        const profitAmount = currentValue !== null ? currentValue - investedValue : null;
        const profitPercent = investedValue > 0 && profitAmount !== null ? (profitAmount / investedValue) * 100 : 0;

        return {
          ...row,
          quantity: selectedQuantity,
          storageUnitQuantity: selectedStorageUnitQuantity,
          investedValue,
          currentValue,
          profitAmount,
          profitPercent,
        };
      });
    },
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
    setItemTypeFilters: handleSetItemTypeFilters,
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
