import { describe, expect, it } from 'vitest';
import { isSafeUrl } from './url';

describe('isSafeUrl', () => {
  it('allows known HTTPS image hosts', () => {
    expect(isSafeUrl('https://community.cloudflare.steamstatic.com/economy/image/example')).toBe(
      true
    );
    expect(isSafeUrl('https://scontent.fhan5-1.fna.fbcdn.net/image.jpg')).toBe(true);
  });

  it('rejects unsafe protocols and broad social hosts', () => {
    expect(isSafeUrl('http://community.cloudflare.steamstatic.com/economy/image/example')).toBe(
      false
    );
    expect(isSafeUrl('https://facebook.com/profile')).toBe(false);
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects URLs with credentials or explicit ports', () => {
    expect(isSafeUrl('https://user:pass@community.cloudflare.steamstatic.com/image.png')).toBe(
      false
    );
    expect(isSafeUrl('https://community.cloudflare.steamstatic.com:8443/image.png')).toBe(false);
  });
});
