/**
 *
 * Tạo filter owner cho truy vấn MongoDB dựa trên ownerId.
 * Nếu ownerId là "guest", kiểm tra cả "guest" hoặc các field chưa có ownerId.
 *
 */
export function getOwnerFilter(ownerId: string) {
  if (ownerId === 'guest') {
    return {
      $or: [{ ownerId: 'guest' }, { ownerId: { $exists: false } }],
    };
  }
  return { ownerId };
}
