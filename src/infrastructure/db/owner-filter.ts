/**
 * Generates the owner filter for MongoDB queries based on ownerId.
 * If the ownerId is "guest", it checks for either "guest" or fields where ownerId doesn't exist.
 */
export function getOwnerFilter(ownerId: string) {
  if (ownerId === 'guest') {
    return {
      $or: [{ ownerId: 'guest' }, { ownerId: { $exists: false } }],
    };
  }
  return { ownerId };
}
