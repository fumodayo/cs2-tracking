import type { CaseItem } from "@/domain/case-item";

export const DEFAULT_CASES: Omit<CaseItem, "id" | "isActive">[] = [
  // ─── Cases ───────────────────────────────────────────────────────────────────
  { name: "Fever Case", marketHashName: "Fever Case" },
  { name: "Gallery Case", marketHashName: "Gallery Case" },
  { name: "Kilowatt Case", marketHashName: "Kilowatt Case" },
  { name: "Revolution Case", marketHashName: "Revolution Case" },
  { name: "Recoil Case", marketHashName: "Recoil Case" },
  {
    name: "Dreams & Nightmares Case",
    marketHashName: "Dreams & Nightmares Case",
  },
  { name: "Operation Riptide Case", marketHashName: "Operation Riptide Case" },
  { name: "Snakebite Case", marketHashName: "Snakebite Case" },
  { name: "Fracture Case", marketHashName: "Fracture Case" },
  {
    name: "Operation Broken Fang Case",
    marketHashName: "Operation Broken Fang Case",
  },
  { name: "Prisma 2 Case", marketHashName: "Prisma 2 Case" },
  { name: "CS20 Case", marketHashName: "CS20 Case" },
  { name: "Shattered Web Case", marketHashName: "Shattered Web Case" },
  { name: "Prisma Case", marketHashName: "Prisma Case" },
  { name: "Danger Zone Case", marketHashName: "Danger Zone Case" },
  { name: "Horizon Case", marketHashName: "Horizon Case" },
  { name: "Clutch Case", marketHashName: "Clutch Case" },
  { name: "Spectrum 2 Case", marketHashName: "Spectrum 2 Case" },
  { name: "Operation Hydra Case", marketHashName: "Operation Hydra Case" },
  { name: "Spectrum Case", marketHashName: "Spectrum Case" },
  { name: "Glove Case", marketHashName: "Glove Case" },
  { name: "Gamma 2 Case", marketHashName: "Gamma 2 Case" },
  { name: "Gamma Case", marketHashName: "Gamma Case" },
  { name: "Chroma 3 Case", marketHashName: "Chroma 3 Case" },
  {
    name: "Operation Wildfire Case",
    marketHashName: "Operation Wildfire Case",
  },
  { name: "Revolver Case", marketHashName: "Revolver Case" },
  { name: "Shadow Case", marketHashName: "Shadow Case" },
  { name: "Falchion Case", marketHashName: "Falchion Case" },
  { name: "Chroma 2 Case", marketHashName: "Chroma 2 Case" },
  { name: "Chroma Case", marketHashName: "Chroma Case" },
  {
    name: "Operation Vanguard Weapon Case",
    marketHashName: "Operation Vanguard Weapon Case",
  },
  {
    name: "Operation Breakout Weapon Case",
    marketHashName: "Operation Breakout Weapon Case",
  },
  { name: "Huntsman Weapon Case", marketHashName: "Huntsman Weapon Case" },
  {
    name: "Operation Phoenix Weapon Case",
    marketHashName: "Operation Phoenix Weapon Case",
  },
  { name: "CS:GO Weapon Case 3", marketHashName: "CS:GO Weapon Case 3" },
  {
    name: "Winter Offensive Weapon Case",
    marketHashName: "Winter Offensive Weapon Case",
  },
  {
    name: "eSports 2013 Winter Case",
    marketHashName: "eSports 2013 Winter Case",
  },
  { name: "CS:GO Weapon Case 2", marketHashName: "CS:GO Weapon Case 2" },
  { name: "Operation Bravo Case", marketHashName: "Operation Bravo Case" },
  { name: "eSports 2013 Case", marketHashName: "eSports 2013 Case" },
  { name: "CS:GO Weapon Case", marketHashName: "CS:GO Weapon Case" },
  {
    name: "Sealed Genesis Terminal",
    marketHashName: "Sealed Genesis Terminal",
  },
  {
    name: "Sealed Dead Hand Terminal",
    marketHashName: "Sealed Dead Hand Terminal",
  },

  // ─── Sticker Capsules ────────────────────────────────────────────────────────
  { name: "Sticker Capsule", marketHashName: "Sticker Capsule" },
  { name: "Sticker Capsule 2", marketHashName: "Sticker Capsule 2" },
  {
    name: "Community Sticker Capsule 1",
    marketHashName: "Community Sticker Capsule 1",
  },
  { name: "Enfu Sticker Capsule", marketHashName: "Enfu Sticker Capsule" },
  { name: "Slid3 Sticker Capsule", marketHashName: "Slid3 Sticker Capsule" },
  { name: "Pinups Sticker Capsule", marketHashName: "Pinups Sticker Capsule" },
  {
    name: "Sugarface Sticker Capsule",
    marketHashName: "Sugarface Sticker Capsule",
  },
  {
    name: "Warhammer 40,000 Sticker Capsule",
    marketHashName: "Warhammer 40,000 Sticker Capsule",
  },
  {
    name: "Battlefield 2042 Sticker Capsule",
    marketHashName: "Battlefield 2042 Sticker Capsule",
  },
  {
    name: "Half-Life: Alyx Sticker Capsule",
    marketHashName: "Half-Life: Alyx Sticker Capsule",
  },
  { name: "Poorly Drawn Capsule", marketHashName: "Poorly Drawn Capsule" },
  { name: "Skill Groups Capsule", marketHashName: "Skill Groups Capsule" },
  { name: "Halo Capsule", marketHashName: "Halo Capsule" },
  {
    name: "CS 20 Years Sticker Capsule",
    marketHashName: "CS 20 Years Sticker Capsule",
  },
  {
    name: "Armory Sticker Collection",
    marketHashName: "Armory Sticker Collection",
  },

  // ─── Major Sticker Capsules ──────────────────────────────────────────────────
  {
    name: "Austin 2025 Sticker Capsule",
    marketHashName: "Austin 2025 Sticker Capsule",
  },
  {
    name: "Austin 2025 Legends Sticker Capsule",
    marketHashName: "Austin 2025 Legends Sticker Capsule",
  },
  {
    name: "Austin 2025 Challengers Sticker Capsule",
    marketHashName: "Austin 2025 Challengers Sticker Capsule",
  },
  {
    name: "Austin 2025 Contenders Sticker Capsule",
    marketHashName: "Austin 2025 Contenders Sticker Capsule",
  },
  {
    name: "Shanghai 2024 Sticker Capsule",
    marketHashName: "Shanghai 2024 Sticker Capsule",
  },
  {
    name: "Shanghai 2024 Legends Sticker Capsule",
    marketHashName: "Shanghai 2024 Legends Sticker Capsule",
  },
  {
    name: "Shanghai 2024 Challengers Sticker Capsule",
    marketHashName: "Shanghai 2024 Challengers Sticker Capsule",
  },
  {
    name: "Shanghai 2024 Contenders Sticker Capsule",
    marketHashName: "Shanghai 2024 Contenders Sticker Capsule",
  },
  {
    name: "Copenhagen 2024 Sticker Capsule",
    marketHashName: "Copenhagen 2024 Sticker Capsule",
  },
  {
    name: "Copenhagen 2024 Legends Sticker Capsule",
    marketHashName: "Copenhagen 2024 Legends Sticker Capsule",
  },
  {
    name: "Copenhagen 2024 Challengers Sticker Capsule",
    marketHashName: "Copenhagen 2024 Challengers Sticker Capsule",
  },
  {
    name: "Copenhagen 2024 Contenders Sticker Capsule",
    marketHashName: "Copenhagen 2024 Contenders Sticker Capsule",
  },
  {
    name: "Paris 2023 Sticker Capsule",
    marketHashName: "Paris 2023 Sticker Capsule",
  },
  {
    name: "Paris 2023 Legends Sticker Capsule",
    marketHashName: "Paris 2023 Legends Sticker Capsule",
  },
  {
    name: "Paris 2023 Challengers Sticker Capsule",
    marketHashName: "Paris 2023 Challengers Sticker Capsule",
  },
  {
    name: "Paris 2023 Contenders Sticker Capsule",
    marketHashName: "Paris 2023 Contenders Sticker Capsule",
  },
  {
    name: "Rio 2022 Sticker Capsule",
    marketHashName: "Rio 2022 Sticker Capsule",
  },
  {
    name: "Rio 2022 Legends Sticker Capsule",
    marketHashName: "Rio 2022 Legends Sticker Capsule",
  },
  {
    name: "Rio 2022 Challengers Sticker Capsule",
    marketHashName: "Rio 2022 Challengers Sticker Capsule",
  },
  {
    name: "Rio 2022 Contenders Sticker Capsule",
    marketHashName: "Rio 2022 Contenders Sticker Capsule",
  },
  {
    name: "Antwerp 2022 Sticker Capsule",
    marketHashName: "Antwerp 2022 Sticker Capsule",
  },
  {
    name: "Antwerp 2022 Legends Sticker Capsule",
    marketHashName: "Antwerp 2022 Legends Sticker Capsule",
  },
  {
    name: "Antwerp 2022 Challengers Sticker Capsule",
    marketHashName: "Antwerp 2022 Challengers Sticker Capsule",
  },
  {
    name: "Antwerp 2022 Contenders Sticker Capsule",
    marketHashName: "Antwerp 2022 Contenders Sticker Capsule",
  },
  {
    name: "Stockholm 2021 Sticker Capsule",
    marketHashName: "Stockholm 2021 Sticker Capsule",
  },
  {
    name: "Stockholm 2021 Legends Sticker Capsule",
    marketHashName: "Stockholm 2021 Legends Sticker Capsule",
  },
  {
    name: "Stockholm 2021 Challengers Sticker Capsule",
    marketHashName: "Stockholm 2021 Challengers Sticker Capsule",
  },
  {
    name: "Stockholm 2021 Contenders Sticker Capsule",
    marketHashName: "Stockholm 2021 Contenders Sticker Capsule",
  },
  { name: "2020 RMR Legends", marketHashName: "2020 RMR Legends" },
  { name: "2020 RMR Challengers", marketHashName: "2020 RMR Challengers" },
  { name: "2020 RMR Contenders", marketHashName: "2020 RMR Contenders" },

  // ─── Autograph Capsules ──────────────────────────────────────────────────────
  {
    name: "Austin 2025 Legends Autograph Capsule",
    marketHashName: "Austin 2025 Legends Autograph Capsule",
  },
  {
    name: "Austin 2025 Challengers Autograph Capsule",
    marketHashName: "Austin 2025 Challengers Autograph Capsule",
  },
  {
    name: "Austin 2025 Contenders Autograph Capsule",
    marketHashName: "Austin 2025 Contenders Autograph Capsule",
  },
  {
    name: "Shanghai 2024 Legends Autograph Capsule",
    marketHashName: "Shanghai 2024 Legends Autograph Capsule",
  },
  {
    name: "Shanghai 2024 Challengers Autograph Capsule",
    marketHashName: "Shanghai 2024 Challengers Autograph Capsule",
  },
  {
    name: "Shanghai 2024 Contenders Autograph Capsule",
    marketHashName: "Shanghai 2024 Contenders Autograph Capsule",
  },
  {
    name: "Copenhagen 2024 Legends Autograph Capsule",
    marketHashName: "Copenhagen 2024 Legends Autograph Capsule",
  },
  {
    name: "Copenhagen 2024 Challengers Autograph Capsule",
    marketHashName: "Copenhagen 2024 Challengers Autograph Capsule",
  },
  {
    name: "Copenhagen 2024 Contenders Autograph Capsule",
    marketHashName: "Copenhagen 2024 Contenders Autograph Capsule",
  },
  {
    name: "Paris 2023 Legends Autograph Capsule",
    marketHashName: "Paris 2023 Legends Autograph Capsule",
  },
  {
    name: "Paris 2023 Challengers Autograph Capsule",
    marketHashName: "Paris 2023 Challengers Autograph Capsule",
  },
  {
    name: "Paris 2023 Contenders Autograph Capsule",
    marketHashName: "Paris 2023 Contenders Autograph Capsule",
  },
  {
    name: "Rio 2022 Legends Autograph Capsule",
    marketHashName: "Rio 2022 Legends Autograph Capsule",
  },
  {
    name: "Rio 2022 Challengers Autograph Capsule",
    marketHashName: "Rio 2022 Challengers Autograph Capsule",
  },
  {
    name: "Rio 2022 Contenders Autograph Capsule",
    marketHashName: "Rio 2022 Contenders Autograph Capsule",
  },
  {
    name: "Antwerp 2022 Legends Autograph Capsule",
    marketHashName: "Antwerp 2022 Legends Autograph Capsule",
  },
  {
    name: "Antwerp 2022 Challengers Autograph Capsule",
    marketHashName: "Antwerp 2022 Challengers Autograph Capsule",
  },
  {
    name: "Antwerp 2022 Contenders Autograph Capsule",
    marketHashName: "Antwerp 2022 Contenders Autograph Capsule",
  },
  {
    name: "Stockholm 2021 Legends Autograph Capsule",
    marketHashName: "Stockholm 2021 Legends Autograph Capsule",
  },
  {
    name: "Stockholm 2021 Challengers Autograph Capsule",
    marketHashName: "Stockholm 2021 Challengers Autograph Capsule",
  },
  {
    name: "Stockholm 2021 Contenders Autograph Capsule",
    marketHashName: "Stockholm 2021 Contenders Autograph Capsule",
  },

  // ─── Patches & Collections ───────────────────────────────────────────────────
  { name: "Patch Pack", marketHashName: "Patch Pack" },
  { name: "CS2 Patch Pack", marketHashName: "CS2 Patch Pack" },
];
