import {
  FadeCalculator,
  AmberFadeCalculator,
  AcidFadeCalculator,
} from "csgo-fade-percentage-calculator";
import type { FadeTier } from "@/domain/pattern-info";

const SUPPORTED_WEAPONS = new Set(
  FadeCalculator.getSupportedWeapons().map((w) => String(w).toLowerCase()),
);
const AMBER_WEAPONS = new Set(
  AmberFadeCalculator.getSupportedWeapons().map((w) => String(w).toLowerCase()),
);
const ACID_WEAPONS = new Set(
  AcidFadeCalculator.getSupportedWeapons().map((w) => String(w).toLowerCase()),
);

export function getFadePercentage(
  marketHashName: string,
  paintSeed: number,
): { percentage: number; tier: FadeTier } | null {
  const mhn = marketHashName.toLowerCase();

  // Decide which calculator to use
  let calc:
    | typeof FadeCalculator
    | typeof AmberFadeCalculator
    | typeof AcidFadeCalculator = FadeCalculator;
  let type: "fade" | "amber" | "acid" = "fade";

  if (mhn.includes("amber fade")) {
    calc = AmberFadeCalculator;
    type = "amber";
  } else if (mhn.includes("acid fade")) {
    calc = AcidFadeCalculator;
    type = "acid";
  } else if (!mhn.includes("fade")) {
    return null;
  }

  // Extract weapon name: "★ Butterfly Knife | Fade (Factory New)" -> "Butterfly Knife"
  const weaponName = extractWeaponName(marketHashName);
  if (!weaponName) return null;

  const weaponKey = weaponName.toLowerCase();

  // Check if weapon is supported by the chosen calculator
  const isSupported =
    type === "fade"
      ? SUPPORTED_WEAPONS.has(weaponKey)
      : type === "amber"
        ? AMBER_WEAPONS.has(weaponKey)
        : ACID_WEAPONS.has(weaponKey);

  if (!isSupported) return null;

  try {
    // MP7 Fade coordinates in the npm library are bugged/incorrect, resulting in percentages
    // that don't match CSFloat or standard community guides. Falling back to the default
    // weapon configuration (like Glock-18) aligns the calculations with the community standards.
    const queryWeaponName = weaponKey === "mp7" ? "Glock-18" : weaponName;
    const result = calc.getFadePercentage(queryWeaponName, paintSeed);
    if (!result || typeof result.percentage !== "number") return null;

    return {
      percentage: result.percentage,
      tier: categorizeFade(result.percentage),
    };
  } catch (err) {
    console.error(
      `Error calculating fade percentage for ${weaponName} with seed ${paintSeed}:`,
      err,
    );
    return null;
  }
}

function extractWeaponName(mhn: string): string | null {
  const cleaned = mhn.replace(/^★\s*/, "").replace(/\s*\(.*?\)\s*$/, "");
  const parts = cleaned.split(" | ");
  if (parts.length < 1) return null;
  return parts[0].trim();
}

function categorizeFade(pct: number): FadeTier {
  if (pct >= 99.5) return "Full Fade";
  if (pct >= 96) return "96-99%";
  if (pct >= 90) return "90-95%";
  if (pct >= 85) return "85-89%";
  return "80-84%";
}
