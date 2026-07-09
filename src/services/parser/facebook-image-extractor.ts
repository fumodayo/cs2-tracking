/**
 *
 * Tiện ích trích xuất ảnh Facebook CDN dùng chung.
 * Được dùng bởi cả facebook-parser.ts phía client và extract/route.ts phía server.
 *
 */

export function isLikelyAvatarOrRedundant(url: string): boolean {
  const lower = url.toLowerCase();
  if (
    lower.includes('/rsrc.php') ||
    lower.includes('/emoji.php') ||
    lower.includes('favicon') ||
    lower.includes('/profile_grid/') ||
    lower.includes('/rsrc/')
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
    lower.includes('/cp0/') ||
    lower.includes('/c0.') ||
    /\/p\d+x\d+\//.test(lower) ||
    /\/p\d+x\d+$/i.test(lower)
  ) {
    return true;
  }
  if (lower.includes('/t5.') || lower.includes('/t15.')) {
    return true;
  }
  if (lower.includes('/sticker/') || lower.includes('/stickers/')) {
    return true;
  }
  return false;
}

export function cleanFbcdnUrl(url: string): string {
  return url
    .replace(/["'\\].*$/, '')
    .replace(/\\\//g, '/')
    .trim();
}

/**
 *
 * Trích xuất ảnh bài viết từ HTML Facebook đã chuẩn hóa bằng các mẫu regex.
 * Có thể nhận ảnh seed (ví dụ từ trích xuất theo DOM) để gộp trước khi khử trùng.
 *
 */
export function extractPostImagesFromHtml(
  normalizedHtml: string,
  seedImages: string[] = []
): string[] {
  const postImages = [...seedImages];

  // Trích block attachment để tìm kiếm trong phạm vi ngữ cảnh
  const attachmentBlocks: string[] = [];
  const attachmentRegex = /\\?"attachments\\?"\s*:\s*\[([\s\S]*?)\]/gi;
  let attachmentMatch;
  while ((attachmentMatch = attachmentRegex.exec(normalizedHtml)) !== null) {
    if (attachmentMatch[1]) {
      const block = attachmentMatch[1];
      const isStoryAttachment =
        block.includes('StoryAttachment') || block.includes('subattachments');
      const isCommentAttachment = block.includes('CommentAttachment');

      if (isStoryAttachment && !isCommentAttachment) {
        attachmentBlocks.push(block);
      }
    }
  }

  // Tham chiếu media bài viết rất cụ thể
  const specificRegexes = [
    /\\?"photo_image\\?":\s*\{\s*\\?"uri\\?":\s*\\?"(https:\/\/[^"]+)\\?"/gi,
    /\\?"accessibility_caption\\?":[^,]+,\\?"uri\\?":\s*\\?"(https:\/\/[^"]+)\\?"/gi,
    /\\?"preferred_thumbnail\\?":\s*\{\s*\\?"image\\?":\s*\{\s*\\?"uri\\?":\s*\\?"(https:\/\/[^"]+)\\?"/gi,
    /\\?"large_share_image\\?":\s*\{\s*\\?"uri\\?":\s*\\?"(https:\/\/[^"]+)\\?"/gi,
  ];

  // Mẫu node Photo chung
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

  const contextsToSearch = attachmentBlocks.length > 0 ? attachmentBlocks : [normalizedHtml];
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

  // Dự phòng: khớp fbcdn rộng nếu không tìm thấy ảnh riêng của bài viết
  if (uniqueImages.length === 0) {
    const fbcdnRegex = /https:\/\/[a-z0-9.-]+\.fbcdn\.net\/v\/[^\s"'>]+/gi;
    const allMatches = normalizedHtml.match(fbcdnRegex) || [];
    uniqueImages = Array.from(new Set(allMatches.map((url) => cleanFbcdnUrl(url)))).filter(
      (url) => !isLikelyAvatarOrRedundant(url)
    );
  }

  return uniqueImages;
}
