/**
 * Browser-local persistence for expense receipts and bills using IndexedDB.
 * Handles large image files gracefully by compressing/downscaling before storage,
 * avoiding the 5MB localStorage quota limitations.
 */

const DB_NAME = 'finch_receipts_db';
const DB_VERSION = 1;
const STORE_NAME = 'receipts';

export interface StoredReceipt {
  expenseId: string;
  dataUrl: string; // Base64 or Blob URL data
  name: string;
  size: number; // In bytes
  type: string; // MIME type
  createdAt: string;
}

/**
 * Open or initialize the IndexedDB instance.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'expenseId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Resize and compress high-resolution photos (e.g. 12MP phone camera shots)
 * into high-quality, lightweight images (max 1600px width/height, ~150-300KB JPEG).
 */
export async function optimizeReceiptImage(file: File): Promise<{ dataUrl: string; size: number; name: string; type: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1600;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width > height) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          } else {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to original dataUrl if canvas fails
          const rawData = e.target?.result as string;
          resolve({
            dataUrl: rawData,
            size: file.size,
            name: file.name,
            type: file.type || 'image/jpeg',
          });
          return;
        }

        // Draw image on white background (in case of transparent PNG converted to JPEG)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to JPEG with 0.82 quality for optimal text legibility and small footprint
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        // Estimate byte size from base64 string
        const approxSize = Math.round((optimizedDataUrl.length * 3) / 4);

        resolve({
          dataUrl: optimizedDataUrl,
          size: approxSize,
          name: file.name.replace(/\.[^/.]+$/, '') + '.jpg',
          type: 'image/jpeg',
        });
      };

      img.onerror = () => {
        reject(new Error('Failed to decode image file.'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file from device.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Save a receipt image associated with an expense ID.
 */
export async function saveReceipt(expenseId: string, receiptData: { dataUrl: string; name: string; size: number; type: string }): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record: StoredReceipt = {
      expenseId,
      dataUrl: receiptData.dataUrl,
      name: receiptData.name,
      size: receiptData.size,
      type: receiptData.type,
      createdAt: new Date().toISOString(),
    };

    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a receipt by its expense ID.
 */
export async function getReceipt(expenseId: string): Promise<StoredReceipt | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(expenseId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Could not read receipt from IndexedDB:', err);
    return null;
  }
}

/**
 * Get all stored receipts as a map of expenseId -> StoredReceipt.
 */
export async function getAllReceipts(): Promise<Map<string, StoredReceipt>> {
  const map = new Map<string, StoredReceipt>();
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          map.set(cursor.key as string, cursor.value);
          cursor.continue();
        } else {
          resolve(map);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Could not load all receipts from IndexedDB:', err);
    return map;
  }
}

/**
 * Delete a receipt by expense ID.
 */
export async function deleteReceipt(expenseId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(expenseId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Could not delete receipt from IndexedDB:', err);
  }
}
