export async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<TResult>,
): Promise<TResult[]> {
  const results: TResult[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

export function parseJsonObject(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    const startIndex = value.indexOf("{");
    const endIndex = value.lastIndexOf("}");
    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return null;
    }

    try {
      return JSON.parse(value.slice(startIndex, endIndex + 1));
    } catch {
      return null;
    }
  }
}
