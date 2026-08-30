import { Incident, OfflineIncidentReport } from '../types';
import { offlineDB } from './db';
import { syncManager } from './syncManager';

const OFFLINE_QUEUE_KEY = 'logainer_offline_incident_queue';

export class OfflineSyncService {
  /**
   * Synchronous accessor for UI components (cached in memory / localStorage fallback)
   */
  static getQueuedIncidents(): Incident[] {
    try {
      const data = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Queues an incident in both IndexedDB (primary persistent store) and local memory
   */
  static queueIncident(incident: Incident, userId = 'field-officer-default'): void {
    incident.offline_synced = false;
    
    // 1. Update lightweight localStorage queue for instant synchronous counters
    const queue = this.getQueuedIncidents();
    queue.push(incident);
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // quota or private mode protection
    }

    // 2. Persist to native IndexedDB store (primary persistent structured storage)
    const offlineReport: OfflineIncidentReport = {
      client_report_id: incident.id,
      user_id: userId,
      type: incident.category,
      category: incident.category,
      severity: incident.severity,
      title: incident.title,
      description: incident.description,
      latitude: incident.lat,
      longitude: incident.lng,
      state: incident.state,
      district: incident.district,
      reporter_name: incident.reporter_name,
      reporter_role: incident.reporter_role,
      passable_by: incident.passable_by,
      timestamp: incident.created_at || new Date().toISOString(),
      created_at: incident.created_at || new Date().toISOString(),
      media: [],
      photo_url: incident.photo_url,
      sync_status: 'PENDING_UPLOAD',
      retry_count: 0
    };

    offlineDB.savePendingReport(offlineReport).catch(err => {
      console.warn('[OfflineSyncService] Failed to write to IndexedDB:', err);
    });
  }

  static clearSynced(ids: string[]): void {
    const queue = this.getQueuedIncidents();
    const remaining = queue.filter(item => !ids.includes(item.id));
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    } catch {}
  }

  /**
   * Dispatches synchronization via SyncManager
   */
  static async syncWithServer(onSyncSuccess?: (count: number) => void): Promise<number> {
    const syncedCount = await syncManager.triggerSync(undefined, (count) => {
      // Clear any synced IDs from local queue
      const queue = this.getQueuedIncidents();
      if (queue.length > 0) {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
      }
      if (onSyncSuccess) onSyncSuccess(count);
    });

    return syncedCount;
  }
}

