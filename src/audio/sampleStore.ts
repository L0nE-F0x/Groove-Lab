/**
 * sampleStore — persistent storage for raw sample bytes in IndexedDB.
 *
 * Audio blobs are far too large for localStorage, so they live here keyed by
 * sample id. The Project JSON only keeps lightweight {@link Sample} metadata
 * plus the ids; the bytes are looked up from here on load.
 */
const DB_NAME = 'groovelab';
const STORE = 'samples';
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function putSampleBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).put(blob, id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getSampleBlob(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSampleBlob(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}
