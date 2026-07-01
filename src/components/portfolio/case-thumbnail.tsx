import { Package } from 'lucide-react';
import Image from 'next/image';
import { proxySteamUrl } from '@/utils/url';

type CaseThumbnailProps = {
  imageUrl?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeClassNames = {
  sm: 'size-10',
  md: 'size-14',
  lg: 'size-20',
};

const iconSizeClassNames = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-8',
};

export function CaseThumbnail({ imageUrl, name, size = 'md', className }: CaseThumbnailProps) {
  const displayUrl = imageUrl ? proxySteamUrl(imageUrl) : undefined;
  return (
    <div
      className={`${sizeClassNames[size]} grid shrink-0 place-items-center overflow-hidden rounded-md border border-stone-700 bg-stone-900 ${className ?? ''}`}
    >
      {displayUrl ? (
        <Image
          src={displayUrl}
          alt={name}
          width={96}
          height={96}
          unoptimized
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        <Package className={`${iconSizeClassNames[size]} text-stone-500`} aria-hidden="true" />
      )}
    </div>
  );
}
