/**
 * LOGAINER Native IndexedDB Storage Engine
 * Provides resilient, structured persistent storage for:
 * - Driver trip details, routes, turn-by-turn steps, safe halts
 * - Field officer offline incident reports
 * - Binary photo & video Blobs (avoiding Base64 / localStorage)
 * - ConvLSTM ML risk predictions & weather cache with timestamps
 * - Offline queued driver actions with idempotent client IDs
 */

import {
  DriverTripCache,
  OfflineIncidentReport,
  QueuedDriverAction,
  CachedPredictionData
} from '../types';

const DB_NAME = 'LOGAINER_OFFLINE_DB';
const DB_VERSION = 1;

export interface MediaBlobRecord {
  blob_key: string;
  blob: Blob;
  mime_type: string;
  name: string;
  size_bytes: number;
  created_at: string;
  user_id: string;
}

export interface GeneralCacheRecord {
  cache_key: string;
  data: any;
  cached_at: string;
  expires_at: string;
  user_id?: string;
}

class IndexedDBManager {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported in this environment.'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Driver Trip Cache
        if (!db.objectStoreNames.contains('trip_cache')) {
          const store = db.createObjectStore('trip_cache', { keyPath: 'trip.trip_id' });
          store.createIndex('user_id', 'user_id', { unique: false });
          store.createIndex('cached_at', 'cached_at', { unique: false });
        }

        // 2. Pending Driver Actions Queue
        if (!db.objectStoreNames.contains('pending_actions')) {
          const store = db.createObjectStore('pending_actions', { keyPath: 'client_action_id' });
          store.createIndex('user_id', 'user_id', { unique: false });
          store.createIndex('sync_status', 'sync_status', { unique: false });
          store.createIndex('trip_id', 'trip_id', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 3. Pending Field Officer / Citizen Incident Reports
        if (!db.objectStoreNames.contains('pending_reports')) {
          const store = db.createObjectStore('pending_reports', { keyPath: 'client_report_id' });
          store.createIndex('user_id', 'user_id', { unique: false });
          store.createIndex('sync_status', 'sync_status', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
        }

        // 4. Binary Media Blobs (Photos / Videos)
        if (!db.objectStoreNames.contains('media_blobs')) {
          const store = db.createObjectStore('media_blobs', { keyPath: 'blob_key' });
          store.createIndex('user_id', 'user_id', { unique: false });
          store.createIndex('created_at', 'created_at', { unique: false });
        }

        // 5. ML Risk Prediction & Weather Cache
        if (!db.objectStoreNames.contains('prediction_cache')) {
          const store = db.createObjectStore('prediction_cache', { keyPath: 'key' });
          store.createIndex('user_id', 'user_id', { unique: false });
          store.createIndex('cached_at', 'cached_at', { unique: false });
          store.createIndex('expires_at', 'expires_at', { unique: false });
        }

        // 6. General Platform Cache (Hubs, Nodes, Chokepoints)
        if (!db.objectStoreNames.contains('general_cache')) {
          const store = db.createObjectStore('general_cache', { keyPath: 'cache_key' });
          store.createIndex('cached_at', 'cached_at', { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB'));
      };
    });

    return this.dbPromise;
  }

  // --- Generic Store Helpers ---

  private async performTx<T>(
    storeName: string,
    mode: IDBTransactionMode,
    callback: (store: IDBObjectStore) => IDBRequest | Promise<T> | void
  ): Promise<T> {
    const db = await this.getDB();
    return new Promise<T>((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);

        let result: any;
        const request = callback(store);

        if (request && 'onsuccess' in request) {
          request.onsuccess = () => {
            result = request.result;
          };
          request.onerror = () => {
            reject(request.error);
          };
        }

        tx.oncomplete = () => {
          resolve(result);
        };
        tx.onerror = () => {
          reject(tx.error);
        };
        tx.onabort = () => {
          reject(tx.error || new Error('Transaction aborted'));
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  // ==========================================
  // 1. DRIVER TRIP CACHE
  // ==========================================

  async saveTripCache(cache: DriverTripCache): Promise<void> {
    await this.performTx('trip_cache', 'readwrite', (store) => {
      store.put(cache);
    });
  }

  async getTripCache(tripId: string, userId?: string): Promise<DriverTripCache | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('trip_cache', 'readonly');
      const store = tx.objectStore('trip_cache');
      const req = store.get(tripId);

      req.onsuccess = () => {
        const item: DriverTripCache | undefined = req.result;
        if (!item) {
          resolve(null);
          return;
        }
        if (userId && item.user_id && item.user_id !== userId) {
          // Security isolation: User cannot access another user's cached trip
          resolve(null);
          return;
        }
        resolve(item);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getAllCachedTrips(userId?: string): Promise<DriverTripCache[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('trip_cache', 'readonly');
      const store = tx.objectStore('trip_cache');
      const req = store.getAll();

      req.onsuccess = () => {
        let items: DriverTripCache[] = req.result || [];
        if (userId) {
          items = items.filter(t => !t.user_id || t.user_id === userId);
        }
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getActiveDriverTrip(userId: string): Promise<DriverTripCache | null> {
    const trips = await this.getAllCachedTrips(userId);
    if (!trips || trips.length === 0) return null;
    // Return latest cached trip for this user that is not completed
    const active = trips.find(t => t.trip.status !== 'COMPLETED');
    return active || trips[0];
  }

  // ==========================================
  // 2. DRIVER ACTIONS QUEUE (OFFLINE MUTATIONS)
  // ==========================================

  async queueDriverAction(action: QueuedDriverAction): Promise<void> {
    await this.performTx('pending_actions', 'readwrite', (store) => {
      store.put(action);
    });
  }

  async getPendingDriverActions(userId?: string): Promise<QueuedDriverAction[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_actions', 'readonly');
      const store = tx.objectStore('pending_actions');
      const req = store.getAll();

      req.onsuccess = () => {
        let items: QueuedDriverAction[] = req.result || [];
        if (userId) {
          items = items.filter(a => a.user_id === userId);
        }
        items = items.filter(a => a.sync_status === 'PENDING_UPLOAD' || a.sync_status === 'FAILED');
        // Sort chronologically by timestamp
        items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async updateDriverActionStatus(
    clientActionId: string,
    status: QueuedDriverAction['sync_status'],
    lastError?: string
  ): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_actions', 'readwrite');
      const store = tx.objectStore('pending_actions');
      const req = store.get(clientActionId);

      req.onsuccess = () => {
        const item: QueuedDriverAction = req.result;
        if (item) {
          item.sync_status = status;
          if (lastError) item.last_error = lastError;
          if (status === 'FAILED') item.retry_count = (item.retry_count || 0) + 1;
          store.put(item);
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async removeDriverAction(clientActionId: string): Promise<void> {
    await this.performTx('pending_actions', 'readwrite', (store) => {
      store.delete(clientActionId);
    });
  }

  // ==========================================
  // 3. FIELD OFFICER INCIDENT REPORTS
  // ==========================================

  async savePendingReport(report: OfflineIncidentReport): Promise<void> {
    await this.performTx('pending_reports', 'readwrite', (store) => {
      store.put(report);
    });
  }

  async getPendingReports(userId?: string): Promise<OfflineIncidentReport[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_reports', 'readonly');
      const store = tx.objectStore('pending_reports');
      const req = store.getAll();

      req.onsuccess = () => {
        let items: OfflineIncidentReport[] = req.result || [];
        if (userId) {
          items = items.filter(r => r.user_id === userId);
        }
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async updateReportSyncStatus(
    clientReportId: string,
    status: OfflineIncidentReport['sync_status'],
    serverId?: string,
    lastError?: string
  ): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_reports', 'readwrite');
      const store = tx.objectStore('pending_reports');
      const req = store.get(clientReportId);

      req.onsuccess = () => {
        const item: OfflineIncidentReport = req.result;
        if (item) {
          item.sync_status = status;
          if (serverId) item.server_id = serverId;
          if (lastError) item.last_error = lastError;
          if (status === 'SYNCED') item.uploaded_at = new Date().toISOString();
          if (status === 'FAILED') item.retry_count = (item.retry_count || 0) + 1;
          store.put(item);
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async removeReport(clientReportId: string): Promise<void> {
    await this.performTx('pending_reports', 'readwrite', (store) => {
      store.delete(clientReportId);
    });
  }

  // ==========================================
  // 4. BINARY MEDIA BLOBS (PHOTOS & VIDEOS)
  // ==========================================

  async saveMediaBlob(blobRecord: MediaBlobRecord): Promise<void> {
    await this.performTx('media_blobs', 'readwrite', (store) => {
      store.put(blobRecord);
    });
  }

  async getMediaBlob(blobKey: string): Promise<MediaBlobRecord | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media_blobs', 'readonly');
      const store = tx.objectStore('media_blobs');
      const req = store.get(blobKey);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteMediaBlob(blobKey: string): Promise<void> {
    await this.performTx('media_blobs', 'readwrite', (store) => {
      store.delete(blobKey);
    });
  }

  // ==========================================
  // 5. ML RISK PREDICTIONS & WEATHER CACHE
  // ==========================================

  async savePredictionCache(cacheItem: CachedPredictionData): Promise<void> {
    await this.performTx('prediction_cache', 'readwrite', (store) => {
      store.put(cacheItem);
    });
  }

  async getPredictionCache(key: string): Promise<CachedPredictionData | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('prediction_cache', 'readonly');
      const store = tx.objectStore('prediction_cache');
      const req = store.get(key);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllPredictionCache(): Promise<CachedPredictionData[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('prediction_cache', 'readonly');
      const store = tx.objectStore('prediction_cache');
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // ==========================================
  // 6. GENERAL APP DATA CACHE (Hubs, Chokepoints, Districts)
  // ==========================================

  async saveGeneralCache(key: string, data: any, ttlMinutes = 60 * 24, userId?: string): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    const record: GeneralCacheRecord = {
      cache_key: key,
      data,
      cached_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      user_id: userId
    };

    await this.performTx('general_cache', 'readwrite', (store) => {
      store.put(record);
    });
  }

  async getGeneralCache<T = any>(key: string): Promise<{ data: T; cached_at: string; expires_at: string; is_stale: boolean } | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('general_cache', 'readonly');
      const store = tx.objectStore('general_cache');
      const req = store.get(key);

      req.onsuccess = () => {
        const rec: GeneralCacheRecord | undefined = req.result;
        if (!rec) {
          resolve(null);
          return;
        }
        const isStale = new Date().toISOString() > rec.expires_at;
        resolve({
          data: rec.data as T,
          cached_at: rec.cached_at,
          expires_at: rec.expires_at,
          is_stale: isStale
        });
      };
      req.onerror = () => reject(req.error);
    });
  }

  // ==========================================
  // 7. SECURITY & USER ISOLATION / LOGOUT PURGE
  // ==========================================

  /**
   * On user logout: Purge user-specific cache (trips, predictions)
   * while preserving pending unsynced offline records without leaking private data.
   */
  async clearUserSessionData(userId: string): Promise<void> {
    const db = await this.getDB();
    
    // Clear trip cache for this user
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('trip_cache', 'readwrite');
      const store = tx.objectStore('trip_cache');
      const req = store.getAll();

      req.onsuccess = () => {
        const items: DriverTripCache[] = req.result || [];
        for (const item of items) {
          if (!item.user_id || item.user_id === userId) {
            store.delete(item.trip.trip_id);
          }
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });

    // Clear prediction cache for this user
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('prediction_cache', 'readwrite');
      const store = tx.objectStore('prediction_cache');
      const req = store.getAll();

      req.onsuccess = () => {
        const items: CachedPredictionData[] = req.result || [];
        for (const item of items) {
          if (item.user_id === userId) {
            store.delete(item.key);
          }
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Complete database purge (for testing or hard reset)
   */
  async purgeAll(): Promise<void> {
    const db = await this.getDB();
    const storeNames = Array.from(db.objectStoreNames);
    const tx = db.transaction(storeNames, 'readwrite');
    for (const name of storeNames) {
      tx.objectStore(name).clear();
    }
    await new Promise((resolve) => {
      tx.oncomplete = () => resolve(undefined);
    });
  }
}

export const offlineDB = new IndexedDBManager();
