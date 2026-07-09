import { formatDateTime } from '@/utils/format';
import { formatRelative } from '@/utils/date';
import i18n from 'i18next';
import {
  isLikelyAvatarOrRedundant,
  cleanFbcdnUrl,
  extractPostImagesFromHtml,
} from './facebook-image-extractor';

export interface FacebookExtractedData {
  text: string;
  author: string;
  imageUrls: string[];
  postTime: string;
  authorUrl: string;
  postUrl: string;
  steamUrl: string;
}

export function extractSteamUrl(text: string): string | null {
  const fullLinkMatch = text.match(
    /https?:\/\/steamcommunity\.com\/(?:id|profiles)\/[a-zA-Z0-9_-]+/i
  );
  if (fullLinkMatch) {
    const base = fullLinkMatch[0];
    return base.endsWith('/inventory') || base.endsWith('/inventory/')
      ? base
      : `${base.replace(/\/$/, '')}/inventory/`;
  }

  const idMatch = text.match(/(?:\/id\/|id\/)([a-zA-Z0-9_-]+)/i);
  if (idMatch && idMatch[1]) {
    return `https://steamcommunity.com/id/${idMatch[1]}/inventory/`;
  }

  const profileMatch = text.match(/(?:\/profiles\/|profiles\/)([0-9]+)/i);
  if (profileMatch && profileMatch[1]) {
    return `https://steamcommunity.com/profiles/${profileMatch[1]}/inventory/`;
  }

  return null;
}

export function unescapeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/\\u003C/g, '<')
    .replace(/\\u003E/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\u0022/g, '"')
    .replace(/\\u0027/g, "'");
}

export function buildChatGptPrompt(text: string, imageUrls: string[]): string {
  const imagesSection =
    imageUrls.length > 0
      ? imageUrls
          .map((url, i) =>
            i18n.t('facebookParser.imageNumber', {
              index: i + 1,
              url,
              interpolation: { escapeValue: false },
            })
          )
          .join('\n')
      : i18n.t('facebookParser.noDirectImageLink');

  return i18n.t('facebookParser.chatGptPrompt', {
    text,
    imagesSection,
    interpolation: { escapeValue: false },
  });
}

export function parseFacebookHtmlSource(htmlSource: string): FacebookExtractedData {
  const normalizedHtml = htmlSource
    .replace(/\\u0026/gi, '&')
    .replace(/\\u003d/gi, '=')
    .replace(/\\u003f/gi, '?')
    .replace(/\\\//g, '/');

  const parser = new DOMParser();
  const doc = parser.parseFromString(normalizedHtml, 'text/html');

  // Trích xuất theo DOM (chỉ client, tìm tag <img> liên kết tới ảnh bài viết)
  const domImages: string[] = [];
  const imageElements = doc.querySelectorAll('img');
  imageElements.forEach((img) => {
    const src = img.getAttribute('src');
    if (!src || !src.includes('fbcdn.net')) return;
    if (isLikelyAvatarOrRedundant(src)) return;

    let parent = img.parentElement;
    let isPostImage = false;
    while (parent && parent.tagName !== 'BODY') {
      if (parent.tagName === 'A') {
        const href = parent.getAttribute('href') || '';
        if (
          href.includes('/photo') ||
          href.includes('fbid=') ||
          href.includes('/permalink/') ||
          href.includes('/posts/')
        ) {
          isPostImage = true;
        }
        break;
      }
      parent = parent.parentElement;
    }

    if (isPostImage) {
      domImages.push(cleanFbcdnUrl(src));
    }
  });

  // Trích xuất bằng regex + khử trùng + fallback, dùng chung với route extract phía server
  const uniqueImages = extractPostImagesFromHtml(normalizedHtml, domImages);

  const decodeUnicode = (str: string): string => {
    if (!str) return '';
    try {
      return str
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, grp) => String.fromCharCode(parseInt(grp, 16)))
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"');
    } catch {
      return str;
    }
  };

  const formatExtractedDate = (input: string | number): string => {
    try {
      const dateObj = new Date(input);
      if (isNaN(dateObj.getTime())) return String(input);
      const absolute = formatDateTime(dateObj.toISOString());
      const relative = formatRelative(dateObj);
      return relative ? `${relative} (${absolute})` : absolute;
    } catch {
      return String(input);
    }
  };

  const descMeta =
    doc.querySelector('meta[property="og:description"]') ||
    doc.querySelector('meta[name="description"]');
  let extractedText = '';
  if (descMeta) {
    extractedText = descMeta.getAttribute('content') || '';
  }
  extractedText = unescapeHtmlEntities(extractedText);

  if (!extractedText.trim()) {
    const matchText =
      normalizedHtml.match(/"message":\s*{"text":\s*"([^"]+)"}/) ||
      normalizedHtml.match(/\\?"message\\?":\s*\{\s*\\?"text\\?":\s*"([^"]+)"\s*\}/);
    if (matchText) {
      extractedText = matchText[1];
    }
  }
  extractedText = decodeUnicode(extractedText);

  let author = '';
  const actorRegexes = [
    /\\?"actors\\?":\s*\[\s*\{\s*\\?"__typename\\?":\s*\\?"User\\?",\s*\\?"id\\?":\s*\\?"\d+\\?",\s*\\?"name\\?":\s*\\?"([^"]+)\\?"/i,
    /\\?"actor\\?":\s*\{\s*\\?"__typename\\?":\s*\\?"User\\?",\s*\\?"id\\?":\s*\\?"\d+\\?",\s*\\?"name\\?":\s*\\?"([^"]+)\\?"/i,
    /\\?"name\\?":\s*\\?"([^"]+)\\?",\s*\\?"__typename\\?":\s*\\?"User\\?"/i,
    /\\?"__typename\\?":\s*\\?"User\\?",\s*\\?"id\\?":\s*\\?"\d+\\?",\s*\\?"name\\?":\s*\\?"([^"]+)\\?"/i,
  ];

  for (const regex of actorRegexes) {
    const match = normalizedHtml.match(regex);
    if (match && match[1]) {
      author = decodeUnicode(match[1]);
      break;
    }
  }

  if (!author) {
    const titleMeta =
      doc.querySelector('meta[property="og:title"]') ||
      doc.querySelector('meta[name="twitter:title"]') ||
      doc.querySelector('title');
    if (titleMeta) {
      const rawTitle = titleMeta.getAttribute('content') || titleMeta.textContent || '';
      const cleanTitle = rawTitle
        .replace(/\| Facebook/i, '')
        .replace(/- Posts/i, '')
        .replace(/VN-CS:GO Chợ Dời \|/i, '')
        .trim();
      if (cleanTitle && cleanTitle !== 'Facebook') {
        author = decodeUnicode(cleanTitle);
      }
    }
  }

  if (!author) {
    author = i18n.t('facebookParser.unknownAuthor');
  }

  let postTime = '';
  const timeMeta =
    doc.querySelector('meta[property="article:published_time"]') ||
    doc.querySelector('meta[property="article:modified_time"]') ||
    doc.querySelector('meta[property="og:updated_time"]') ||
    doc.querySelector('meta[itemprop="datePublished"]');
  if (timeMeta) {
    const content = timeMeta.getAttribute('content');
    if (content) {
      postTime = formatExtractedDate(content);
    }
  }

  if (!postTime) {
    const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of Array.from(jsonLdScripts)) {
      try {
        const json = JSON.parse(script.textContent || '{}');
        const dateString = json.datePublished || json.dateCreated || json.dateModified;
        if (dateString) {
          postTime = formatExtractedDate(dateString);
          break;
        }
      } catch {
        // continue
      }
    }
  }

  if (!postTime) {
    const creationTimeRegexes = [
      /\\?"creation_time\\?":\s*(\d+)/i,
      /\\?"publish_time\\?":\s*(\d+)/i,
    ];
    for (const regex of creationTimeRegexes) {
      const match = normalizedHtml.match(regex);
      if (match && match[1]) {
        const ts = parseInt(match[1], 10);
        if (ts > 1000000000 && ts < 2000000000) {
          postTime = formatExtractedDate(ts * 1000);
          break;
        }
      }
    }
  }

  let authorUrl = '';
  const allLinks = doc.querySelectorAll('a');
  for (const a of Array.from(allLinks)) {
    const textContent = a.textContent?.trim();
    if (textContent && textContent === author) {
      const href = a.getAttribute('href') || '';
      if (href && !href.startsWith('#')) {
        authorUrl = href.startsWith('http')
          ? href
          : `https://www.facebook.com${href.startsWith('/') ? '' : '/'}${href}`;
        break;
      }
    }
  }

  let postUrl = '';
  const ogUrlMeta =
    doc.querySelector('meta[property="og:url"]') || doc.querySelector('link[rel="canonical"]');
  if (ogUrlMeta) {
    postUrl = ogUrlMeta.getAttribute('content') || ogUrlMeta.getAttribute('href') || '';
  }

  if (!postUrl) {
    for (const a of Array.from(allLinks)) {
      const href = a.getAttribute('href') || '';
      if (href.includes('/permalink/') || href.includes('/posts/')) {
        postUrl = href.startsWith('http')
          ? href
          : `https://www.facebook.com${href.startsWith('/') ? '' : '/'}${href}`;
        break;
      }
    }
  }

  const steamUrl = extractSteamUrl(extractedText) || '';

  return {
    text: extractedText,
    author,
    imageUrls: uniqueImages,
    postTime,
    authorUrl,
    postUrl,
    steamUrl,
  };
}
