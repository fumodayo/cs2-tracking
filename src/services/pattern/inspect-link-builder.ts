export function buildInspectLink(
  template: string,
  steamId64: string,
  assetId: string,
  itemCertificate?: string,
): string {
  let link = template
    .replace("%owner_steamid%", steamId64)
    .replace("%assetid%", assetId);

  if (itemCertificate) {
    link = link.replace(/%propid(:\d+)?%/g, itemCertificate);
  } else {
    link = link.replace(/%propid(:\d+)?%/g, assetId);
  }

  return link;
}
