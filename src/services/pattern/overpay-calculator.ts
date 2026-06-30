import multipliers from "@/data/overpay-multipliers.json";
import type { PatternInfo } from "@/domain/pattern-info";

export function estimateOverpay(
  patternInfo: PatternInfo,
  basePrice: number,
): {
  estimatedMin: number;
  estimatedMax: number;
  estimatedTypical: number;
  multiplierSource: string;
} | null {
  let mult = null;
  let source = "";

  if (patternInfo.dopplerPhase) {
    mult = (
      multipliers.doppler as Record<
        string,
        { min: number; max: number; typical: number }
      >
    )[patternInfo.dopplerPhase];
    source = `Doppler ${patternInfo.dopplerPhase}`;
  } else if (patternInfo.fadeTier) {
    mult = (
      multipliers.fade as Record<
        string,
        { min: number; max: number; typical: number }
      >
    )[patternInfo.fadeTier];
    source = `Fade ${patternInfo.fadePercentage ? patternInfo.fadePercentage.toFixed(1) : ""}%`;
  } else if (patternInfo.blueGemTier && patternInfo.blueGemTier !== "Normal") {
    mult = (
      multipliers.blueGem as Record<
        string,
        { min: number; max: number; typical: number }
      >
    )[patternInfo.blueGemTier];
    source = `Blue Gem ${patternInfo.blueGemTier}`;
  } else if (patternInfo.marbleFadeTier && patternInfo.marbleFadeTier !== "Normal") {
    mult = (
      multipliers.marbleFade as Record<
        string,
        { min: number; max: number; typical: number }
      >
    )[patternInfo.marbleFadeTier];
    source = `Marble Fade ${patternInfo.marbleFadeTier}`;
  }

  if (!mult) return null;
  return {
    estimatedMin: Math.round(basePrice * mult.min),
    estimatedMax: Math.round(basePrice * mult.max),
    estimatedTypical: Math.round(basePrice * mult.typical),
    multiplierSource: source,
  };
}
