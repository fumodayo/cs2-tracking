/**
 * Shared Facebook CDN image extraction utilities.
 * Used by both client-side facebook-parser.ts and server-side extract/route.ts.
 */

export function isLikelyAvatarOrRedundant(url: string): boolean {
  const lower = url.toLowerCase();
  if (
    lower.includes("/rsrc.php") ||
    lower.includes("/emoji.php") ||
    lower.includes("favicon") ||
    lower.includes("/profile_grid/") ||
    lower.includes("/rsrc/")
  ) {
    return true;
  }
  if (
    /t\d+\.\d+-1(?:[/?]|$)/.test(lower) ||
    /t\d+\.\d+-\d+-1(?:[/?]|$)/.test(lower) ||
    /-\d+-1[/.]/.test(lower) ||
    /-\d+-1\?/.test(lower)
  ) {
    return true;
  }
  if (
    lower.includes("/cp0/") ||
    lower.includes("/c0.") ||
    /\/p\d+x\d+\//.test(lower) ||
    /\/p\d+x\d+$/i.test(lower)
  ) {
    return true;
  }
  if (lower.includes("/t5.") || lower.includes("/t15.")) {
    return true;
  }
  if (lower.includes("/sticker/") || lower.includes("/stickers/")) {
    return true;
  }
  return false;
}

export function cleanFbcdnUrl(url: string): string {
  return url.replace(/["'\\].*$/, "").replace(/\\\//g, "/").trim();
}

/**
 * Extracts post images from normalized Facebook HTML using regex patterns.
 * Optionally accepts seed images (e.g. from DOM-based extraction) to merge before dedup.
 */
export function extractPostImagesFromHtml(
  normalizedHtml: string,
  seedImages: string[] = [],
): string[] {
  const postImages = [...seedImages];

  // Extract attachment blocks for context-scoped searching
  const attachmentBlocks: string[] = [];
  const attachmentRegex = /\\?"attachments\\?"\s*:\s*\[([\s\S]*?)\]/gi;
  let attachmentMatch;
  while ((attachmentMatch = attachmentRegex.exec(normalizedHtml)) !== null) {
    if (attachmentMatch[1]) {
      const block = attachmentMatch[1];
      const isStoryAttachment =
        block.includes("StoryAttachment") || block.includes("subattachments");
      const isCommentAttachment = block.includes("CommentAttachment");

      if (isStoryAttachment && !isCommentAttachment) {
        attachmentBlocks.push(block);
      }
    }
  }

  // Highly specific post media references
  const specificRegexes = [
    /\\?"photo_image\\?":\s*\{\s*\\?"uri\\?":\s*\\?"(https:\/\/[^"]+)\\?"/gi,
    /\\?"accessibility_caption\\?":[^,]+,\\?"uri\\?":\s*\\?"(https:\/\/[^"]+)\\?"/gi,
    /\\?"preferred_thumbnail\\?":\s*\{\s*\\?"image\\?":\s*\{\s*\\?"uri\\?":\s*\\?"(https:\/\/[^"]+)\\?"/gi,
    /\\?"large_share_image\\?":\s*\{\s*\\?"uri\\?":\s*\\?"(https:\/\/[^"]+)\\?"/gi,
  ];

  // General Photo node patterns
  const genericPhotoRegexes = [
    /\\?"__typename\\?":\s*\\?"Photo\\?",[^}]*\\?"uri\\?":\s*\\?"(https:\/\/[^"]+)\\?"/gi,
    /\\?"__typename\\?":\s*\\?"Photo\\?",[^}]*\\?"image\\?":\s*\{\s*\\?"uri\\?":\s*\\?"(https:\/\/[^"]+)\\?"/gi,
    /\\?"image\\?":\s*\{\s*\\?"uri\\?":\s*\\?"(https:\/\/[^"]+)\\?"[^}]*\},[^}]*\\?"__typename\\?":\s*\\?"Photo\\?"/gi,
  ];

  specificRegexes.forEach((regex) => {
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(normalizedHtml)) !== null) {
      if (match[1]) {
        const cleaned = cleanFbcdnUrl(match[1]);
        if (!isLikelyAvatarOrRedundant(cleaned)) {
          postImages.push(cleaned);
        }
      }
    }
  });

  const contextsToSearch =
    attachmentBlocks.length > 0 ? attachmentBlocks : [normalizedHtml];
  contextsToSearch.forEach((context) => {
    genericPhotoRegexes.forEach((regex) => {
      let match;
      regex.lastIndex = 0;
      while ((match = regex.exec(context)) !== null) {
        if (match[1]) {
          const cleaned = cleanFbcdnUrl(match[1]);
          if (!isLikelyAvatarOrRedundant(cleaned)) {
            postImages.push(cleaned);
          }
        }
      }
    });
  });

  let uniqueImages = Array.from(new Set(postImages));

  // Fallback: broad fbcdn matching if no post-specific images were found
  if (uniqueImages.length === 0) {
    const fbcdnRegex = /https:\/\/[a-z0-9.-]+\.fbcdn\.net\/v\/[^\s"'>]+/gi;
    const allMatches = normalizedHtml.match(fbcdnRegex) || [];
    uniqueImages = Array.from(
      new Set(allMatches.map((url) => cleanFbcdnUrl(url))),
    ).filter((url) => !isLikelyAvatarOrRedundant(url));
  }

  return uniqueImages;
}
