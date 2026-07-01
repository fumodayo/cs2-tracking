import React from 'react';

const DOPPLER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Ruby: {
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
  Sapphire: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  Emerald: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  'Black Pearl': {
    bg: 'bg-stone-500/15',
    text: 'text-stone-300',
    border: 'border-stone-500/30',
  },
  'Phase 1': {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/20',
  },
  'Phase 2': {
    bg: 'bg-pink-500/10',
    text: 'text-pink-400',
    border: 'border-pink-500/20',
  },
  'Phase 3': {
    bg: 'bg-teal-500/10',
    text: 'text-teal-400',
    border: 'border-teal-500/20',
  },
  'Phase 4': {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/20',
  },
};

export function DopplerBadge({ phase }: { phase: string }) {
  const colors = DOPPLER_COLORS[phase] || DOPPLER_COLORS['Phase 1'];
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {phase}
    </span>
  );
}

export function FadeBadge({ percentage }: { percentage: number }) {
  // Gradient from yellow->pink->purple based on %
  const hue = Math.round(60 - (percentage - 80) * 2.5); // 60(yellow) to ~10(red)
  return (
    <span className="inline-flex items-center gap-1 rounded border border-amber-500/35 bg-gradient-to-r from-amber-500/15 to-pink-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-700 dark:border-amber-500/20 dark:from-amber-500/10 dark:to-pink-500/10 dark:text-amber-300">
      <span
        className="size-1.5 animate-pulse rounded-full"
        style={{ backgroundColor: `hsl(${hue}, 80%, 55%)` }}
      />
      Fade {percentage.toFixed(1)}%
    </span>
  );
}

export function BlueGemBadge({ tier }: { tier: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-sky-500/20 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-sky-400 uppercase">
      💎 Blue Gem {tier}
    </span>
  );
}

export function MarbleFadeBadge({ tier }: { tier: string }) {
  if (tier === 'Normal') return null;
  return (
    <span className="inline-flex items-center gap-1 rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-red-400 uppercase">
      🔥 {tier}
    </span>
  );
}
