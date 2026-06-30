import type { PriceProvider } from "@/domain/price-provider";
import { getSteamCaseImageUrl } from "@/infrastructure/cases/steam-case-image-provider";
import type { PostAnalysisDto, PostAnalysisRowDto } from "@/types/post-analysis";
import {
  DEFAULT_ITEM_RATE,
  PRICE_LOOKUP_CONCURRENCY,
  PostAnalysisImageInput,
  parsePostWithGemini,
  parseItemRate,
  parseAllRate,
  parseItems,
  resolveParsedItems,
  chooseItemResolution,
  parseInventoryImagesWithGemini,
  getResolutionQuantity,
  fetchBuffPriceCny,
  mapWithConcurrency,
  ParsedItem,
  ResolvedItem,
} from "./post-analysis-parser";

const STEAM_TO_BUFF_RATIO = 1.35;
const CNY_TO_VND_RATE = 3600;

export class PostAnalysisService {
  constructor(private readonly priceProvider: PriceProvider) {}

  async analyze(
    text: string,
    imageOrImages?: PostAnalysisImageInput | PostAnalysisImageInput[],
  ): Promise<PostAnalysisDto> {
    const images = imageOrImages
      ? Array.isArray(imageOrImages)
        ? imageOrImages
        : [imageOrImages]
      : [];
    const geminiParsedPost = await parsePostWithGemini(text);
    const itemRate =
      geminiParsedPost?.itemRate ?? parseItemRate(text) ?? DEFAULT_ITEM_RATE;

    // Always prioritize "câm" slang parsing from text if present, to override Gemini's potentially incorrect allRate
    const camRate = parseAllRate(text);
    const rawAllRate =
      camRate !== null ? camRate : (geminiParsedPost?.allRate ?? itemRate);
    const allRate = adjustAllRate(itemRate, rawAllRate);

    const parsedItems = parseItems(text);
    const textResolution = chooseItemResolution(
      resolveParsedItems(geminiParsedPost?.items ?? []),
      resolveParsedItems(parsedItems),
    );
    const imageResolution =
      images.length > 0
        ? resolveParsedItems(await parseInventoryImagesWithGemini(images))
        : null;
    const hasImageItems = imageResolution
      ? getResolutionQuantity(imageResolution) > 0
      : false;
    const itemResolution =
      hasImageItems && imageResolution ? imageResolution : textResolution;
    const itemSource = hasImageItems ? "image" : "text";
    const { resolvedItems, unknownItems } = itemResolution;

    if (resolvedItems.length === 0 && unknownItems.length === 0) {
      throw new Error(
        images.length > 0
          ? "noCaseDetectedInPostOrImages"
          : "noCaseDetectedInPost",
      );
    }

    const rows = await this.buildPricedRows(resolvedItems, itemRate, allRate);

    return buildResultDto(rows, unknownItems, itemRate, allRate, itemSource);
  }

  async analyzeWithExternalJson(
    text: string,
    chatGptJson: {
      itemRate?: number | null;
      allRate?: number | null;
      items?: Array<{ name: string; quantity: number }>;
    },
  ): Promise<PostAnalysisDto> {
    const itemRate =
      chatGptJson.itemRate ?? parseItemRate(text) ?? DEFAULT_ITEM_RATE;
    const camRate = parseAllRate(text);
    const rawAllRate =
      camRate !== null ? camRate : (chatGptJson.allRate ?? itemRate);
    const allRate = adjustAllRate(itemRate, rawAllRate);

    const items = chatGptJson.items ?? [];
    const parsedItems: ParsedItem[] = items.map((item) => ({
      quantity: item.quantity,
      inputName: item.name,
      originalName: item.name,
    }));

    const itemResolution = resolveParsedItems(parsedItems);
    const { resolvedItems, unknownItems } = itemResolution;

    if (resolvedItems.length === 0 && unknownItems.length === 0) {
      throw new Error("invalidChatGptJson");
    }

    const rows = await this.buildPricedRows(resolvedItems, itemRate, allRate);

    return buildResultDto(rows, unknownItems, itemRate, allRate, "image");
  }

  private async buildPricedRows(
    resolvedItems: ResolvedItem[],
    itemRate: number,
    allRate: number,
  ): Promise<PostAnalysisRowDto[]> {
    const isBuffRate = (r: number) =>
      (r >= 1.5 && r <= 5.0) || (r >= 1500 && r <= 5000);
    const useBuffPricing = isBuffRate(itemRate) || isBuffRate(allRate);

    const itemRateVnd = itemRate >= 1500 ? itemRate : itemRate * 1000;
    const allRateVnd = allRate >= 1500 ? allRate : allRate * 1000;

    const rows = await mapWithConcurrency(
      resolvedItems,
      PRICE_LOOKUP_CONCURRENCY,
      async (item) => {
        const currentPrice = await this.priceProvider.getCurrentPrice({
          id: item.caseItem.marketHashName,
          name: item.caseItem.name,
          marketHashName: item.caseItem.marketHashName,
          isActive: true,
        });
        const steamUnitPrice = currentPrice?.price ?? null;
        const imageUrl =
          item.caseItem.imageUrl ??
          (await getSteamCaseImageUrl(item.caseItem.marketHashName)) ??
          undefined;

        let itemRateUnitPrice: number | null = null;
        let allRateTotalPrice: number | null = null;

        if (useBuffPricing) {
          const buffPriceCny = await fetchBuffPriceCny(
            item.caseItem.marketHashName,
          );
          if (buffPriceCny !== null) {
            itemRateUnitPrice = Math.round(buffPriceCny * itemRateVnd);
            allRateTotalPrice = Math.round(
              buffPriceCny * item.quantity * allRateVnd,
            );
          } else {
            if (steamUnitPrice !== null) {
              const estimatedBuffCny =
                steamUnitPrice / STEAM_TO_BUFF_RATIO / CNY_TO_VND_RATE;
              itemRateUnitPrice = Math.round(estimatedBuffCny * itemRateVnd);
              allRateTotalPrice = Math.round(
                estimatedBuffCny * item.quantity * allRateVnd,
              );
            }
          }
        } else {
          const normalizedItemRate = itemRate > 1 ? itemRate / 100 : itemRate;
          const normalizedAllRate = allRate > 1 ? allRate / 100 : allRate;
          itemRateUnitPrice =
            steamUnitPrice === null
              ? null
              : Math.round(steamUnitPrice * normalizedItemRate);
          allRateTotalPrice =
            steamUnitPrice === null
              ? null
              : Math.round(steamUnitPrice * item.quantity * normalizedAllRate);
        }

        return {
          inputName: item.inputName,
          marketHashName: item.caseItem.marketHashName,
          name: item.caseItem.name,
          imageUrl,
          quantity: item.quantity,
          steamUnitPrice,
          itemRateUnitPrice,
          allRateTotalPrice,
        };
      },
    );

    rows.sort(
      (first, second) =>
        (second.allRateTotalPrice ?? 0) - (first.allRateTotalPrice ?? 0),
    );

    return rows;
  }
}

/**
 * Adjusts the "all" rate for Vietnamese "câm" slang patterns.
 * E.g. "rate 3.7 câm .65" → wholesale rate 3.65
 */
function adjustAllRate(itemRate: number, allRate: number): number {
  if (itemRate >= 3.0 && itemRate <= 4.5) {
    if (allRate < 1.0) {
      return Math.floor(itemRate) + allRate;
    }
    if (allRate >= 10 && allRate <= 99) {
      return Math.floor(itemRate) + allRate / 100;
    }
    if (allRate >= 100 && allRate <= 999) {
      return allRate / 100;
    }
  }
  return allRate;
}

function buildResultDto(
  rows: PostAnalysisRowDto[],
  unknownItems: ParsedItem[],
  itemRate: number,
  allRate: number,
  itemSource: "text" | "image",
): PostAnalysisDto {
  return {
    itemSource,
    itemRate,
    allRate,
    totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
    totalSteamValue: rows.reduce(
      (sum, row) => sum + (row.steamUnitPrice ?? 0) * row.quantity,
      0,
    ),
    totalItemRateValue: rows.reduce(
      (sum, row) => sum + (row.itemRateUnitPrice ?? 0) * row.quantity,
      0,
    ),
    totalAllRateValue: rows.reduce(
      (sum, row) => sum + (row.allRateTotalPrice ?? 0),
      0,
    ),
    rows,
    unknownItems,
  };
}
