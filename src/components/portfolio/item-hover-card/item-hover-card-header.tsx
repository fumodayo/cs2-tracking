import {
  BlueGemBadge,
  DopplerBadge,
  FadeBadge,
  MarbleFadeBadge,
} from '@/components/shared/pattern-badge';

import { CaseThumbnail } from '../case-thumbnail';
import type { PortfolioTableRow } from '../portfolio-table-model';
import { colorWithAlpha, getItemTypeLabel } from '../portfolio-table-utils';

type ItemHoverCardHeaderProps = {
  item: PortfolioTableRow;
  typeColor: string;
  embedded?: boolean;
};

export function ItemHoverCardHeader({ item, typeColor, embedded }: ItemHoverCardHeaderProps) {
  return (
    <div
      className={`flex items-center gap-4 border-b border-stone-800/40 px-4 py-4 ${
        embedded ? 'sticky top-0 z-10 bg-stone-950/95 pt-5 backdrop-blur-md' : ''
      }`}
      style={{
        backgroundImage: `linear-gradient(to right, ${colorWithAlpha(typeColor, 0.08)}, var(--card) 95%)`,
      }}
    >
      <div className="group relative flex shrink-0 items-center justify-center rounded-xl border border-stone-800 bg-stone-950/80 p-1.5 shadow-[inset_0_1.5px_3px_rgba(255,255,255,0.05)] transition-all duration-200">
        <CaseThumbnail imageUrl={item.case.imageUrl} name={item.case.name} size="lg" />
        <div
          className="absolute inset-0 -z-10 rounded-xl opacity-20 blur-md transition-opacity duration-300 group-hover:opacity-30"
          style={{ backgroundColor: typeColor }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="text-sm leading-snug font-extrabold tracking-wide text-stone-100"
          title={item.case.name}
        >
          {item.case.name}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span
            className="inline-flex rounded-md border px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase"
            style={{
              backgroundColor: colorWithAlpha(typeColor, 0.12),
              borderColor: colorWithAlpha(typeColor, 0.25),
              color: typeColor,
            }}
          >
            {getItemTypeLabel(item.itemType)}
          </span>
          {item.dopplerPhase && <DopplerBadge phase={item.dopplerPhase} />}
          {item.patternInfo?.fadePercentage !== undefined && (
            <FadeBadge percentage={item.patternInfo.fadePercentage} />
          )}
          {item.patternInfo?.blueGemTier && item.patternInfo.blueGemTier !== 'Normal' && (
            <BlueGemBadge tier={item.patternInfo.blueGemTier} />
          )}
          {item.patternInfo?.marbleFadeTier && item.patternInfo.marbleFadeTier !== 'Normal' && (
            <MarbleFadeBadge tier={item.patternInfo.marbleFadeTier} />
          )}
          {item.case.rarity ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-stone-400">
              <span
                className="size-1.5 rounded-full shadow-sm"
                style={{ backgroundColor: item.case.rarity.color }}
              />
              {item.case.rarity.name}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
