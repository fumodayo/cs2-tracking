import tiers from "@/data/blue-gem-tiers.json";
import type { BlueGemTier } from "@/domain/pattern-info";

export function getBlueGemTier(
  marketHashName: string,
  paintSeed: number,
): BlueGemTier | null {
  if (!marketHashName.toLowerCase().includes("case hardened")) return null;
  const weapon = extractWeaponFromMHN(marketHashName);
  if (!weapon) return null;

  const weaponTiers = (tiers as Record<string, Record<string, number[]>>)[
    weapon
  ];
  if (!weaponTiers) return null;

  for (const [tier, seeds] of Object.entries(weaponTiers)) {
    if (seeds.includes(paintSeed)) {
      return tier as BlueGemTier;
    }
  }
  return "Normal";
}

function extractWeaponFromMHN(mhn: string): string | null {
  const cleaned = mhn.replace(/^★\s*/, "").replace(/\s*\(.*?\)\s*$/, "");
  const parts = cleaned.split(" | ");
  if (parts.length < 1) return null;
  const weapon = parts[0].trim();
  if (weapon.includes("Five-SeveN")) return "Five-SeveN";
  if (weapon.includes("AK-47")) return "AK-47";
  if (weapon.includes("Karambit")) return "Karambit";
  return weapon;
}
