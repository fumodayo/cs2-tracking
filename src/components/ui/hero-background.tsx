interface HeroBackgroundProps {
  opacityClassName?: string;
  preload?: boolean;
}

export function HeroBackground({
  opacityClassName = 'opacity-40',
  preload = true,
}: HeroBackgroundProps) {
  return (
    <picture className={`absolute inset-0 block ${opacityClassName}`}>
      <source srcSet="/assets/dashboard-banner.avif" type="image/avif" />
      <source srcSet="/assets/dashboard-banner.webp" type="image/webp" />
      <img
        src="/assets/dashboard-banner.webp"
        alt=""
        className="h-full w-full object-cover object-center"
        decoding="async"
        fetchPriority={preload ? 'high' : 'auto'}
        loading={preload ? 'eager' : 'lazy'}
      />
    </picture>
  );
}
