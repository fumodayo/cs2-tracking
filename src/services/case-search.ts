import { createServices } from '@/infrastructure/container';
import type { CaseItem } from '@/domain/case-item';

/**
 * Common case search logic that queries MongoDB and handles external dynamic Steam image fetching if needed.
 */
export async function searchCases(query: string): Promise<CaseItem[]> {
  const { caseRepository } = createServices();
  const cases = await caseRepository.search(query);

  const trimmedQuery = query.trim();
  if (trimmedQuery.length >= 3) {
    const hasExactMatch = cases.some(
      (c) =>
        c.marketHashName.toLowerCase() === trimmedQuery.toLowerCase() ||
        c.name.toLowerCase() === trimmedQuery.toLowerCase()
    );
    if (!hasExactMatch) {
      // Dynamically import to avoid circular dependencies in some setups
      const { getSteamCaseImageUrl } =
        await import('@/infrastructure/cases/steam-case-image-provider');
      const imageUrl = await getSteamCaseImageUrl(trimmedQuery);

      if (imageUrl) {
        cases.unshift({
          id: `ext_${trimmedQuery}`,
          name: trimmedQuery,
          marketHashName: trimmedQuery,
          imageUrl: imageUrl,
          isActive: true,
        });
      }
    }
  }

  return cases;
}
