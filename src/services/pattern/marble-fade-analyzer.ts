import tiers from "@/data/marble-fade-tiers.json";
import type { MarbleFadeTier } from "@/domain/pattern-info";

export function getMarbleFadeTier(
  marketHashName: string,
  paintSeed: number,
): MarbleFadeTier | null {
  if (!marketHashName.toLowerCase().includes("marble fade")) return null;
  const weapon = extractWeaponFromMHN(marketHashName);
  if (!weapon) return null;

  const weaponTiers = (tiers as Record<string, Record<string, number[]>>)[
    weapon
  ];
  if (!weaponTiers) return "Normal";

  for (const [tier, seeds] of Object.entries(weaponTiers)) {
    if (seeds.includes(paintSeed)) {
      return tier as MarbleFadeTier;
    }
  }
  return "Normal";
}

function extractWeaponFromMHN(mhn: string): string | null {
  const cleaned = mhn.replace(/^★\s*/, "").replace(/\s*\(.*?\)\s*$/, "");
  const parts = cleaned.split(" | ");
  if (parts.length < 1) return null;
  const weapon = parts[0].trim();
  if (weapon.includes("Karambit")) return "Karambit";
  if (weapon.includes("M9 Bayonet")) return "M9 Bayonet";
  return weapon;
}
