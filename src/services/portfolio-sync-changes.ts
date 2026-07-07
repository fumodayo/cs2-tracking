import type { CaseItem } from '@/domain/case-item';
import type { PortfolioSourceAccount } from '@/domain/portfolio-item';
import { buildItemIdentityKey } from '@/utils/item-identity';
import type {
  AccountChangeDetail,
  ExistingPortfolioItem,
  ExtraItem,
  GroupedInput,
  MissingItem,
} from '@/services/portfolio-sync';

type SourceAccountBreakdownSummary = NonNullable<ExtraItem['breakdown']>;

type SyncCaseRepository = {
  findById: (id: string) => Promise<CaseItem | null>;
};

function buildChangeGroupKey(input: {
  caseId: string;
  dopplerPhase?: string;
  inspectLink?: string;
  patternInfo?: unknown;
}): string {
  return buildItemIdentityKey(input);
}

function getSourceAccountQuantity(account: PortfolioSourceAccount): number {
  return account.breakdown
    ? (account.breakdown.tradeable ?? 0) +
        (account.breakdown.onMarket ?? 0) +
        (account.breakdown.tradeProtected ?? 0) +
        (account.breakdown.hold ?? 0)
    : 0;
}

function buildSourceAccountQuantityMap(
  accounts: PortfolioSourceAccount[] | undefined,
  targetSteamId64?: string
): Map<string, { steamId64: string; name: string; quantity: number }> {
  const map = new Map<string, { steamId64: string; name: string; quantity: number }>();
  if (!accounts) return map;

  for (const account of accounts) {
    if (targetSteamId64 && String(account.steamId64) !== targetSteamId64) {
      continue;
    }

    const quantity = getSourceAccountQuantity(account);
    const existing = map.get(account.steamId64);
    if (existing) {
      existing.quantity += quantity;
    } else {
      map.set(account.steamId64, {
        steamId64: account.steamId64,
        name: account.name,
        quantity,
      });
    }
  }

  return map;
}

function mergeAccountQuantityMaps(
  target: Map<string, { steamId64: string; name: string; quantity: number }>,
  source: Map<string, { steamId64: string; name: string; quantity: number }>
) {
  for (const [steamId64, account] of source) {
    const existing = target.get(steamId64);
    if (existing) {
      existing.quantity += account.quantity;
    } else {
      target.set(steamId64, { ...account });
    }
  }
}

function summarizeSourceAccountBreakdown(
  accounts: PortfolioSourceAccount[] | undefined
): SourceAccountBreakdownSummary {
  const breakdown = {
    tradeable: 0,
    onMarket: 0,
    tradeProtected: 0,
    hold: 0,
  };

  if (!accounts) return breakdown;

  for (const account of accounts) {
    if (!account.breakdown) continue;
    breakdown.tradeable += account.breakdown.tradeable ?? 0;
    breakdown.onMarket += account.breakdown.onMarket ?? 0;
    breakdown.tradeProtected += account.breakdown.tradeProtected ?? 0;
    breakdown.hold += account.breakdown.hold ?? 0;
  }

  return breakdown;
}

function buildExistingQuantityMap(
  existingPortfolioItems: ExistingPortfolioItem[],
  targetSteamId64?: string
): Map<string, number> {
  const quantities = new Map<string, number>();

  for (const item of existingPortfolioItems) {
    const groupKey = buildChangeGroupKey({
      caseId: String(item.caseId),
      dopplerPhase: item.dopplerPhase,
      inspectLink: item.inspectLink,
      patternInfo: item.patternInfo,
    });

    const quantity = targetSteamId64
      ? Array.from(
          buildSourceAccountQuantityMap(item.sourceAccounts, targetSteamId64).values()
        ).reduce((sum, account) => sum + account.quantity, 0)
      : Number(item.quantity);

    quantities.set(groupKey, (quantities.get(groupKey) ?? 0) + quantity);
  }

  return quantities;
}

function getGroupedInputQuantity(
  input: GroupedInput | undefined,
  targetSteamId64?: string
): number {
  if (!input) return 0;
  if (!targetSteamId64) return input.quantity;

  return Array.from(
    buildSourceAccountQuantityMap(input.sourceAccounts, targetSteamId64).values()
  ).reduce((sum, account) => sum + account.quantity, 0);
}

export function getSyncAccountChanges(input: {
  groupKey: string;
  existingPortfolioItems: ExistingPortfolioItem[];
  groupedInputs: Map<string, GroupedInput>;
  targetSteamId64?: string;
}): AccountChangeDetail[] {
  const previousMap = new Map<string, { steamId64: string; name: string; quantity: number }>();
  const currentMap = new Map<string, { steamId64: string; name: string; quantity: number }>();

  for (const item of input.existingPortfolioItems) {
    const groupKey = buildChangeGroupKey({
      caseId: String(item.caseId),
      dopplerPhase: item.dopplerPhase,
      inspectLink: item.inspectLink,
      patternInfo: item.patternInfo,
    });

    if (groupKey === input.groupKey) {
      mergeAccountQuantityMaps(
        previousMap,
        buildSourceAccountQuantityMap(item.sourceAccounts, input.targetSteamId64)
      );
    }
  }

  const groupedInput = input.groupedInputs.get(input.groupKey);
  mergeAccountQuantityMaps(
    currentMap,
    buildSourceAccountQuantityMap(groupedInput?.sourceAccounts, input.targetSteamId64)
  );

  const changes: AccountChangeDetail[] = [];
  for (const [steamId64, previous] of previousMap) {
    const current = currentMap.get(steamId64);
    const currentQuantity = current?.quantity ?? 0;
    const change = currentQuantity - previous.quantity;
    if (change !== 0) {
      changes.push({
        steamId64,
        name: previous.name,
        change,
        previousQuantity: previous.quantity,
        currentQuantity,
      });
    }
  }

  for (const [steamId64, current] of currentMap) {
    if (!previousMap.has(steamId64)) {
      changes.push({
        steamId64,
        name: current.name,
        change: current.quantity,
        previousQuantity: 0,
        currentQuantity: current.quantity,
      });
    }
  }

  return changes;
}

export async function buildSyncChangeSummary(input: {
  existingPortfolioItems: ExistingPortfolioItem[];
  groupedInputs: Map<string, GroupedInput>;
  caseRepository: SyncCaseRepository;
  targetSteamId64?: string;
}): Promise<{ missingItems: MissingItem[]; extraItems: ExtraItem[] }> {
  const missingItems: MissingItem[] = [];
  const extraItems: ExtraItem[] = [];
  const previousQuantities = buildExistingQuantityMap(
    input.existingPortfolioItems,
    input.targetSteamId64
  );

  const getAccountChanges = (groupKey: string) =>
    getSyncAccountChanges({
      groupKey,
      existingPortfolioItems: input.existingPortfolioItems,
      groupedInputs: input.groupedInputs,
      targetSteamId64: input.targetSteamId64,
    });

  for (const [groupKey, previousQuantity] of previousQuantities) {
    const currentQuantity = getGroupedInputQuantity(
      input.groupedInputs.get(groupKey),
      input.targetSteamId64
    );
    const [caseId] = groupKey.split(':');

    if (currentQuantity < previousQuantity) {
      const caseDoc = await input.caseRepository.findById(caseId);
      missingItems.push({
        caseId,
        marketHashName: caseDoc?.marketHashName ?? 'unknown',
        caseName: caseDoc?.name ?? 'Unknown Item',
        imageUrl: caseDoc?.imageUrl ?? null,
        previousQuantity,
        currentQuantity,
        missingQuantity: previousQuantity - currentQuantity,
        accounts: getAccountChanges(groupKey),
      });
    } else if (currentQuantity > previousQuantity) {
      const caseDoc = await input.caseRepository.findById(caseId);
      const groupedInput = input.groupedInputs.get(groupKey);
      extraItems.push({
        caseId,
        marketHashName: caseDoc?.marketHashName ?? 'unknown',
        caseName: caseDoc?.name ?? 'Unknown Item',
        imageUrl: caseDoc?.imageUrl ?? null,
        previousQuantity,
        currentQuantity,
        extraQuantity: currentQuantity - previousQuantity,
        accounts: getAccountChanges(groupKey),
        breakdown: summarizeSourceAccountBreakdown(groupedInput?.sourceAccounts),
      });
    }
  }

  for (const [groupKey, groupedInput] of input.groupedInputs) {
    if (previousQuantities.has(groupKey)) continue;

    const currentQuantity = getGroupedInputQuantity(groupedInput, input.targetSteamId64);
    if (input.targetSteamId64 && currentQuantity <= 0) {
      continue;
    }

    const [caseId] = groupKey.split(':');
    const caseDoc = await input.caseRepository.findById(caseId);
    extraItems.push({
      caseId,
      marketHashName: caseDoc?.marketHashName ?? 'unknown',
      caseName: caseDoc?.name ?? 'Unknown Item',
      imageUrl: caseDoc?.imageUrl ?? null,
      previousQuantity: 0,
      currentQuantity,
      extraQuantity: currentQuantity,
      accounts: getAccountChanges(groupKey),
      breakdown: summarizeSourceAccountBreakdown(groupedInput.sourceAccounts),
    });
  }

  return { missingItems, extraItems };
}
