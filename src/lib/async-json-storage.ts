type StoredEntry<T> = {
  value: T;
  updatedAt: number;
};

const DB_NAME = 'cs2t_async_json_storage';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

let dbPromise: Promise<IDBDatabase> | null = null;

function canUseIndexedDb(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDatabase(): Promise<IDBDatabase> {
  if (!canUseIndexedDb()) {
    return Promise.reject(new Error('indexedDBUnavailable'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('indexedDBOpenFailed'));
    request.onblocked = () => reject(new Error('indexedDBOpenBlocked'));
  });

  return dbPromise;
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  return openDatabase().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = run(store);
        let result: T | undefined;

        if (request) {
          request.onsuccess = () => {
            result = request.result;
          };
          request.onerror = () => reject(request.error ?? new Error('indexedDBRequestFailed'));
        }

        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () =>
          reject(transaction.error ?? new Error('indexedDBTransactionFailed'));
        transaction.onabort = () =>
          reject(transaction.error ?? new Error('indexedDBTransactionAborted'));
      })
  );
}

export async function readAsyncJson<T>(key: string): Promise<T | null> {
  if (!canUseIndexedDb()) return null;

  const entry = await runTransaction<StoredEntry<T> | undefined>('readonly', (store) =>
    store.get(key)
  );
  return entry?.value ?? null;
}

export async function writeAsyncJson<T>(key: string, value: T): Promise<void> {
  if (!canUseIndexedDb()) return;

  await runTransaction('readwrite', (store) =>
    store.put(
      {
        value,
        updatedAt: Date.now(),
      } satisfies StoredEntry<T>,
      key
    )
  );
}

export async function deleteAsyncJson(key: string): Promise<void> {
  if (!canUseIndexedDb()) return;

  await runTransaction('readwrite', (store) => store.delete(key));
}
