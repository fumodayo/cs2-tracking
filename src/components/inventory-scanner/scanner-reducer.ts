import {
  AccountEntry,
  CaseItemData,
  ScanProgress,
  ScanResponse,
  ScanResultItem,
} from "./types";
import {
  createAccount,
  getInventoryItemType,
} from "./utils";

export interface ScannerState {
  accounts: AccountEntry[];
  manualItems: ScanResultItem[];
  removedKeys: Set<string>;
  buffPricesCny: Record<string, number>;
  buffLoadingKeys: Set<string>;
  buffPriceErrors: Record<string, string>;
  scanningAll: boolean;
  expandedAccId: string | null;
  selectedTypes: Set<string>;
  globalFilter: string;
  portfolioImporting: boolean;
  portfolioImportStatus: string | null;
  portfolioImportMessage: string | null;
  portfolioImportError: string | null;
  retryingPrices: boolean;
  retryStatus: string | null;
}

export type ScannerAction =
  | {
      type: "INIT_LOAD";
      accounts: AccountEntry[];
      manualItems: ScanResultItem[];
      buffPricesCny: Record<string, number>;
    }
  | { type: "ADD_ACCOUNT" }
  | { type: "REMOVE_ACCOUNT"; id: string }
  | { type: "UPDATE_ACCOUNT_URL"; id: string; url: string }
  | { type: "UPDATE_ACCOUNT_COOKIE"; id: string; cookie: string }
  | { type: "UPDATE_ACCOUNT_SESSION_ID"; id: string; sessionId: string }
  | { type: "START_SCAN"; accountId: string }
  | { type: "UPDATE_SCAN_PROGRESS"; accountId: string; progress: ScanProgress }
  | {
      type: "SCAN_SUCCESS";
      accountId: string;
      result: ScanResponse;
      progress: ScanProgress;
    }
  | { type: "SCAN_FAILURE"; accountId: string; error: string }
  | { type: "SET_SCANNING_ALL"; scanning: boolean }
  | { type: "SET_EXPANDED_ACCOUNT"; id: string | null }
  | { type: "TOGGLE_TYPE_FILTER"; itemType: string }
  | { type: "CLEAR_TYPE_FILTERS" }
  | { type: "SET_GLOBAL_FILTER"; filter: string }
  | {
      type: "ADD_MANUAL_ITEM";
      caseItem: CaseItemData;
      price: number;
      quantity: number;
      buyPrice?: number;
      buyDate?: string;
      sourceAccounts?: Array<{ steamId64: string; name: string }>;
      storageUnitId?: string;
      storageUnitName?: string;
      buffPriceManual?: number;
      buffRateManual?: number;
      id?: string;
    }
  | { type: "UPDATE_MANUAL_QTY"; idOrName: string; qty: number }
  | {
      type: "REMOVE_ITEM";
      marketHashName: string;
      isManual?: boolean;
      id?: string;
    }
  | { type: "RESET_REMOVED_KEYS" }
  | { type: "START_BUFF_FETCH"; marketHashName: string }
  | { type: "BUFF_FETCH_SUCCESS"; marketHashName: string; priceCny: number }
  | { type: "BUFF_FETCH_FAILURE"; marketHashName: string; error: string }
  | { type: "UPDATE_BUFF_PRICE_CNY"; marketHashName: string; rawValue: string }
  | { type: "START_PORTFOLIO_IMPORT" }
  | { type: "UPDATE_PORTFOLIO_IMPORT_STATUS"; status: string }
  | { type: "PORTFOLIO_IMPORT_SUCCESS"; message: string }
  | { type: "PORTFOLIO_IMPORT_FAILURE"; error: string }
  | { type: "START_PRICE_RETRY" }
  | { type: "PRICE_RETRY_STATUS"; status: string }
  | {
      type: "PRICE_RETRY_SUCCESS";
      results: {
        marketHashName: string;
        price: number;
        priceSource?: string;
      }[];
      status: string;
    }
  | { type: "PRICE_RETRY_FAILURE"; status: string }
  | { type: "RESET_STATE_POST_IMPORT" };

export function initScannerState(): ScannerState {
  return {
    accounts: [createAccount("")],
    manualItems: [],
    removedKeys: new Set<string>(),
    buffPricesCny: {},
    buffLoadingKeys: new Set<string>(),
    buffPriceErrors: {},
    scanningAll: false,
    expandedAccId: null,
    selectedTypes: new Set<string>(),
    globalFilter: "",
    portfolioImporting: false,
    portfolioImportStatus: null,
    portfolioImportMessage: null,
    portfolioImportError: null,
    retryingPrices: false,
    retryStatus: null,
  };
}

export function scannerReducer(
  state: ScannerState,
  action: ScannerAction,
): ScannerState {
  switch (action.type) {
    case "INIT_LOAD":
      return {
        ...state,
        accounts: action.accounts,
        manualItems: action.manualItems,
        buffPricesCny: action.buffPricesCny,
      };

    case "ADD_ACCOUNT":
      return {
        ...state,
        accounts: [...state.accounts, createAccount("")],
      };

    case "REMOVE_ACCOUNT":
      return {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== action.id),
        expandedAccId:
          state.expandedAccId === action.id ? null : state.expandedAccId,
      };

    case "UPDATE_ACCOUNT_URL":
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.id
            ? {
                ...a,
                url: action.url,
                status: "idle",
                result: null,
                error: null,
              }
            : a,
        ),
      };

    case "UPDATE_ACCOUNT_COOKIE":
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.id ? { ...a, steamCookie: action.cookie } : a,
        ),
      };

    case "UPDATE_ACCOUNT_SESSION_ID":
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.id ? { ...a, steamSessionId: action.sessionId } : a,
        ),
      };

    case "START_SCAN":
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.accountId
            ? {
                ...a,
                status: "scanning",
                error: null,
                result: null,
                progress: {
                  status: "queued",
                  stage: "queued",
                  message: "Đang tạo job quét inventory.",
                  percent: 0,
                },
              }
            : a,
        ),
      };

    case "UPDATE_SCAN_PROGRESS":
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.accountId ? { ...a, progress: action.progress } : a,
        ),
      };

    case "SCAN_SUCCESS": {
      const { accountId, result, progress } = action;
      const existingDupe = state.accounts.find(
        (a) =>
          a.id !== accountId &&
          a.status === "done" &&
          a.result?.steamId64 === result.steamId64,
      );

      if (existingDupe) {
        const dupeIdx = state.accounts.indexOf(existingDupe) + 1;
        const dupeName = existingDupe.result?.profile?.name || `TK ${dupeIdx}`;
        return {
          ...state,
          accounts: state.accounts.map((a) =>
            a.id === accountId
              ? {
                  ...a,
                  status: "error",
                  error: `Trùng lặp với "${dupeName}" (cùng SteamID64: ${result.steamId64}). Vui lòng nhập tài khoản khác.`,
                  result: null,
                }
              : a,
          ),
        };
      }

      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === accountId
            ? { ...a, status: "done", result, error: null, progress }
            : a,
        ),
      };
    }

    case "SCAN_FAILURE":
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.accountId
            ? { ...a, status: "error", error: action.error }
            : a,
        ),
      };

    case "SET_SCANNING_ALL":
      return { ...state, scanningAll: action.scanning };

    case "SET_EXPANDED_ACCOUNT":
      return { ...state, expandedAccId: action.id };

    case "TOGGLE_TYPE_FILTER": {
      const next = new Set(state.selectedTypes);
      if (next.has(action.itemType)) {
        next.delete(action.itemType);
      } else {
        next.add(action.itemType);
      }
      return { ...state, selectedTypes: next };
    }

    case "CLEAR_TYPE_FILTERS":
      return { ...state, selectedTypes: new Set<string>() };

    case "SET_GLOBAL_FILTER":
      return { ...state, globalFilter: action.filter };

    case "ADD_MANUAL_ITEM": {
      const {
        caseItem,
        price,
        quantity,
        buyPrice,
        buyDate,
        sourceAccounts,
        storageUnitId,
        storageUnitName,
        buffPriceManual,
        buffRateManual,
        id,
      } = action;
      const type = getInventoryItemType(caseItem.name);

      const existingIdx = state.manualItems.findIndex(
        (i) =>
          i.caseItem.marketHashName === caseItem.marketHashName &&
          i.buyPrice === buyPrice &&
          i.buyDate === buyDate &&
          i.storageUnitId === storageUnitId &&
          JSON.stringify(i.sourceAccounts) === JSON.stringify(sourceAccounts),
      );

      let nextManualItems: ScanResultItem[];
      if (existingIdx !== -1) {
        nextManualItems = state.manualItems.map((item, idx) =>
          idx === existingIdx
            ? {
                ...item,
                quantity: item.quantity + quantity,
                total: item.price * (item.quantity + quantity),
              }
            : item,
        );
      } else {
        nextManualItems = [
          ...state.manualItems,
          {
            id: id || `manual-${Date.now()}-${Math.random()}`,
            caseItem,
            type,
            quantity,
            price,
            total: price * quantity,
            isManual: true,
            buyPrice,
            buyDate,
            sourceAccounts,
            storageUnitId,
            storageUnitName,
            buffPriceManual,
            buffRateManual,
          },
        ];
      }

      const nextRemovedKeys = new Set(state.removedKeys);
      nextRemovedKeys.delete(caseItem.marketHashName);

      return {
        ...state,
        manualItems: nextManualItems,
        removedKeys: nextRemovedKeys,
      };
    }

    case "UPDATE_MANUAL_QTY":
      return {
        ...state,
        manualItems:
          action.qty <= 0
            ? state.manualItems.filter((i) =>
                action.idOrName.startsWith("manual-")
                  ? i.id !== action.idOrName
                  : i.caseItem.marketHashName !== action.idOrName,
              )
            : state.manualItems.map((i) =>
                (
                  action.idOrName.startsWith("manual-")
                    ? i.id === action.idOrName
                    : i.caseItem.marketHashName === action.idOrName
                )
                  ? { ...i, quantity: action.qty, total: i.price * action.qty }
                  : i,
              ),
      };

    case "REMOVE_ITEM": {
      if (action.isManual) {
        return {
          ...state,
          manualItems: state.manualItems.filter((i) =>
            action.id
              ? i.id !== action.id
              : i.caseItem.marketHashName !== action.marketHashName,
          ),
        };
      }
      const nextRemovedKeys = new Set(state.removedKeys);
      nextRemovedKeys.add(action.marketHashName);
      return {
        ...state,
        removedKeys: nextRemovedKeys,
      };
    }

    case "RESET_REMOVED_KEYS":
      return { ...state, removedKeys: new Set<string>() };

    case "START_BUFF_FETCH": {
      const nextLoading = new Set(state.buffLoadingKeys);
      nextLoading.add(action.marketHashName);
      const nextErrors = { ...state.buffPriceErrors };
      delete nextErrors[action.marketHashName];

      return {
        ...state,
        buffLoadingKeys: nextLoading,
        buffPriceErrors: nextErrors,
      };
    }

    case "BUFF_FETCH_SUCCESS": {
      const nextLoading = new Set(state.buffLoadingKeys);
      nextLoading.delete(action.marketHashName);

      return {
        ...state,
        buffPricesCny: {
          ...state.buffPricesCny,
          [action.marketHashName]: action.priceCny,
        },
        buffLoadingKeys: nextLoading,
      };
    }

    case "BUFF_FETCH_FAILURE": {
      const nextLoading = new Set(state.buffLoadingKeys);
      nextLoading.delete(action.marketHashName);

      return {
        ...state,
        buffLoadingKeys: nextLoading,
        buffPriceErrors: {
          ...state.buffPriceErrors,
          [action.marketHashName]: action.error,
        },
      };
    }

    case "UPDATE_BUFF_PRICE_CNY": {
      const { marketHashName, rawValue } = action;
      const nextPrice = Number(rawValue.replace(",", "."));
      const nextBuffPrices = { ...state.buffPricesCny };

      if (!rawValue || !Number.isFinite(nextPrice) || nextPrice <= 0) {
        delete nextBuffPrices[marketHashName];
      } else {
        nextBuffPrices[marketHashName] = nextPrice;
      }

      return {
        ...state,
        buffPricesCny: nextBuffPrices,
      };
    }

    case "START_PORTFOLIO_IMPORT":
      return {
        ...state,
        portfolioImporting: true,
        portfolioImportStatus: "Đang khởi động...",
        portfolioImportMessage: null,
        portfolioImportError: null,
      };

    case "UPDATE_PORTFOLIO_IMPORT_STATUS":
      return {
        ...state,
        portfolioImportStatus: action.status,
      };

    case "PORTFOLIO_IMPORT_SUCCESS":
      return {
        ...state,
        portfolioImporting: false,
        portfolioImportStatus: null,
        portfolioImportMessage: action.message,
        accounts: [createAccount("")],
        manualItems: [],
        removedKeys: new Set<string>(),
        selectedTypes: new Set<string>(),
        globalFilter: "",
        expandedAccId: null,
      };

    case "PORTFOLIO_IMPORT_FAILURE":
      return {
        ...state,
        portfolioImporting: false,
        portfolioImportStatus: null,
        portfolioImportError: action.error,
      };

    case "RESET_STATE_POST_IMPORT":
      return {
        ...state,
        accounts: [createAccount("")],
        manualItems: [],
        removedKeys: new Set<string>(),
        selectedTypes: new Set<string>(),
        globalFilter: "",
        expandedAccId: null,
      };

    case "START_PRICE_RETRY":
      return {
        ...state,
        retryingPrices: true,
      };

    case "PRICE_RETRY_STATUS":
      return {
        ...state,
        retryStatus: action.status,
      };

    case "PRICE_RETRY_SUCCESS": {
      const { results, status } = action;
      const priceMap = new Map<
        string,
        { price: number; priceSource?: string }
      >();
      for (const r of results) {
        if (r.price > 0) priceMap.set(r.marketHashName, r);
      }

      const updatedAccounts = state.accounts.map((acc) => {
        if (acc.status !== "done" || !acc.result) return acc;
        const updatedItems = acc.result.items.map((scanItem) => {
          const found = priceMap.get(scanItem.caseItem.marketHashName);
          if (!found) return scanItem;
          return {
            ...scanItem,
            price: found.price,
            total: found.price * scanItem.quantity,
            priceSource: found.priceSource as ScanResultItem["priceSource"],
          };
        });
        return {
          ...acc,
          result: {
            ...acc.result,
            items: updatedItems,
            totalPrice: updatedItems.reduce(
              (s: number, it: ScanResultItem) => s + it.total,
              0,
            ),
          },
        };
      });

      const updatedManualItems = state.manualItems.map((mi) => {
        const found = priceMap.get(mi.caseItem.marketHashName);
        if (!found) return mi;
        return {
          ...mi,
          price: found.price,
          total: found.price * mi.quantity,
          priceSource: found.priceSource as ScanResultItem["priceSource"],
        };
      });

      return {
        ...state,
        accounts: updatedAccounts,
        manualItems: updatedManualItems,
        retryingPrices: false,
        retryStatus: status,
      };
    }

    case "PRICE_RETRY_FAILURE":
      return {
        ...state,
        retryingPrices: false,
        retryStatus: action.status,
      };

    default:
      return state;
  }
}
