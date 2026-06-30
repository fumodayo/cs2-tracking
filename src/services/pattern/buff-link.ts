export function getBuffLink(marketHashName: string): string {
  return `https://buff.163.com/market/csgo#tab=selling&page_num=1&search=${encodeURIComponent(
    marketHashName,
  )}`;
}
