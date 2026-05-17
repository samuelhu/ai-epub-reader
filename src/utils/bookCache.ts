import ePub, { Book } from 'epubjs';

const MAX_CACHE_SIZE = 8;

interface CacheEntry {
  book: Book;
  fingerprint: number;
  id: number;
}

const cache = new Map<number, CacheEntry>();
const accessOrder: number[] = [];

function computeFingerprint(buffer: ArrayBuffer): number {
  const view = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 256));
  let hash = 0;
  for (let i = 0; i < view.length; i++) {
    hash = ((hash << 5) - hash + view[i]) | 0;
  }
  return hash;
}

function touchEntry(bookId: number): void {
  const idx = accessOrder.indexOf(bookId);
  if (idx !== -1) accessOrder.splice(idx, 1);
  accessOrder.push(bookId);
}

function evictOldest(): void {
  const oldest = accessOrder.shift();
  if (oldest !== undefined) {
    const entry = cache.get(oldest);
    if (entry) {
      entry.book.destroy();
      cache.delete(oldest);
    }
  }
}

export async function getCachedBook(bookId: number, arrayBuffer: ArrayBuffer): Promise<Book> {
  const fingerprint = computeFingerprint(arrayBuffer);
  const entry = cache.get(bookId);

  if (entry) {
    if (entry.fingerprint === fingerprint) {
      touchEntry(bookId);
      return entry.book;
    }
    // File changed, invalidate cache
    entry.book.destroy();
    cache.delete(bookId);
    const idx = accessOrder.indexOf(bookId);
    if (idx !== -1) accessOrder.splice(idx, 1);
  }

  if (cache.size >= MAX_CACHE_SIZE) {
    evictOldest();
  }

  const book = ePub(arrayBuffer);
  await book.ready;
  cache.set(bookId, { book, fingerprint, id: bookId });
  touchEntry(bookId);
  return book;
}

export function invalidateBookCache(bookId: number): void {
  const entry = cache.get(bookId);
  if (entry) {
    entry.book.destroy();
    cache.delete(bookId);
    const idx = accessOrder.indexOf(bookId);
    if (idx !== -1) accessOrder.splice(idx, 1);
  }
}
