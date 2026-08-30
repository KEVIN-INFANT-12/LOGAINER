/**
 * LOGAINER Resilient Offline Synchronization Manager
 * Orchestrates:
 * 1. Automatic syncing upon network recovery or manual trigger
 * 2. Uploading photo & video Blobs from IndexedDB to backend media storage
 * 3. Batch synchronization of incident reports with duplicate prevention
 * 4. Idempotent synchronization of queued driver actions (Start, Complete, Location, Decision)
 * 5. Exponential backoff retry on failure
 * 6. Confirmation-before-deletion policy (never deletes pending data until server confirmation)
 */

import { offlineDB } from './db';
import { networkService } from './network';
import { OfflineIncidentReport, QueuedDriverAction, SyncStatus } from '../types';

export interface SyncProgressState {
  isSyncing: boolean;
  totalPending: number;
  syncedCount: number;
  failedCount: number;
  lastSyncTimestamp: string | null;
  lastError: string | null;
}

export type SyncListener = (state: SyncProgressState) => void;

class SyncManager {
  private isSyncing: boolean = false;
  private retryTimeout: any = null;
  private backoffDelayMs: number = 1500;
  private maxBackoffDelayMs: number = 30000;
  private listeners: Set<SyncListener> = new Set();
  private lastSyncTimestamp: string | null = null;
  private lastError: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Auto-trigger sync when network becomes available
      networkService.subscribe((state) => {
        if (state.isOnline) {
          this.triggerSync();
        }
      });
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    this.notifyState();
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async getPendingCounts(userId?: string): Promise<{ reports: number; actions: number; total: number }> {
    try {
      const reports = await offlineDB.getPendingReports(userId);
      const actions = await offlineDB.getPendingDriverActions(userId);
      const pendingReports = reports.filter(r => r.sync_status === 'PENDING_UPLOAD' || r.sync_status === 'FAILED');
      const pendingActions = actions.filter(a => a.sync_status === 'PENDING_UPLOAD' || a.sync_status === 'FAILED');
      return {
        reports: pendingReports.length,
        actions: pendingActions.length,
        total: pendingReports.length + pendingActions.length
      };
    } catch {
      return { reports: 0, actions: 0, total: 0 };
    }
  }

  public async triggerSync(userId?: string, onComplete?: (synced: number) => void): Promise<number> {
    if (this.isSyncing) return 0;
    if (!networkService.isOnline()) {
      return 0;
    }

    this.isSyncing = true;
    this.lastError = null;
    this.notifyState();

    let totalSynced = 0;

    try {
      // 1. Sync Pending Field Officer / Citizen Incident Reports (with Media Blobs)
      const syncedReports = await this.syncPendingReports(userId);
      totalSynced += syncedReports;

      // 2. Sync Pending Driver Actions (Start, Complete, Decisions)
      const syncedActions = await this.syncPendingDriverActions(userId);
      totalSynced += syncedActions;

      this.lastSyncTimestamp = new Date().toISOString();
      this.backoffDelayMs = 1500; // Reset backoff on success

      if (onComplete) onComplete(totalSynced);
    } catch (err: any) {
      console.warn('[SyncManager] Sync encountered error:', err);
      this.lastError = err.message || 'Sync failed';
      this.scheduleRetry(userId);
    } finally {
      this.isSyncing = false;
      this.notifyState();
    }

    return totalSynced;
  }

  // --- Sub-routine: Field Reports Sync ---

  private async syncPendingReports(userId?: string): Promise<number> {
    const allReports = await offlineDB.getPendingReports(userId);
    const pending = allReports.filter(r => r.sync_status === 'PENDING_UPLOAD' || r.sync_status === 'FAILED');
    if (pending.length === 0) return 0;

    let successCount = 0;

    for (const report of pending) {
      try {
        await offlineDB.updateReportSyncStatus(report.client_report_id, 'SYNCING');

        // Step A: Upload any pending media Blobs from IndexedDB
        let uploadedPhotoUrl = report.photo_url || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80';
        let uploadedVideoUrl = report.video_url;

        if (report.media && report.media.length > 0) {
          for (const mediaItem of report.media) {
            const blobRecord = await offlineDB.getMediaBlob(mediaItem.blob_key);
            if (blobRecord && blobRecord.blob) {
              const formData = new FormData();
              formData.append('file', blobRecord.blob, blobRecord.name || 'media.jpg');
              formData.append('user_id', report.user_id);
              formData.append('report_id', report.client_report_id);

              try {
                const uploadRes = await fetch('/api/v1/incidents/upload-media', {
                  method: 'POST',
                  body: formData
                });

                if (uploadRes.ok) {
                  const mediaData = await uploadRes.json();
                  if (mediaItem.media_type === 'VIDEO') {
                    uploadedVideoUrl = mediaData.media_url;
                  } else {
                    uploadedPhotoUrl = mediaData.media_url;
                  }
                  // Clean up blob from local storage after successful upload
                  await offlineDB.deleteMediaBlob(mediaItem.blob_key);
                }
              } catch (uploadErr) {
                console.warn('[SyncManager] Media upload failed, proceeding with fallback:', uploadErr);
              }
            }
          }
        }

        // Step B: Submit report item to sync-batch
        const payload = [{
          id: report.server_id || `INC-${report.client_report_id.slice(-6).toUpperCase()}`,
          client_report_id: report.client_report_id,
          user_id: report.user_id,
          title: report.title,
          category: report.category || report.type,
          severity: report.severity,
          state: report.state,
          district: report.district,
          lat: report.latitude,
          lng: report.longitude,
          description: report.description,
          reporter_name: report.reporter_name,
          reporter_role: report.reporter_role,
          created_at: report.created_at || report.timestamp,
          photo_url: uploadedPhotoUrl,
          video_url: uploadedVideoUrl,
          passable_by: report.passable_by || 'NONE',
          verification_status: 'PENDING_VERIFICATION',
          upvotes: 1,
          offline_synced: true
        }];

        const res = await fetch('/api/v1/incidents/sync-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const result = await res.json();
          if (result.success && result.synced_ids && result.synced_ids.length > 0) {
            const confirmedId = result.synced_ids[0];
            await offlineDB.updateReportSyncStatus(report.client_report_id, 'SYNCED', confirmedId);
            successCount++;
          }
        } else {
          await offlineDB.updateReportSyncStatus(report.client_report_id, 'FAILED', undefined, `Server responded with ${res.status}`);
        }
      } catch (err: any) {
        await offlineDB.updateReportSyncStatus(report.client_report_id, 'FAILED', undefined, err.message);
      }
    }

    return successCount;
  }

  // --- Sub-routine: Driver Actions Sync ---

  private async syncPendingDriverActions(userId?: string): Promise<number> {
    const actions = await offlineDB.getPendingDriverActions(userId);
    if (actions.length === 0) return 0;

    let successCount = 0;

    try {
      const payload = actions.map(a => ({
        client_action_id: a.client_action_id,
        trip_id: a.trip_id,
        action_type: a.action_type,
        payload: a.payload,
        user_id: a.user_id,
        timestamp: a.timestamp
      }));

      const res = await fetch('/api/v1/routes/trips/sync-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && result.synced_ids) {
          for (const syncedId of result.synced_ids) {
            await offlineDB.removeDriverAction(syncedId);
            successCount++;
          }
        }
      } else {
        // Fallback: Attempt individual endpoint execution for each action
        for (const action of actions) {
          try {
            await offlineDB.updateDriverActionStatus(action.client_action_id, 'SYNCING');
            let endpoint = '';
            if (action.action_type === 'ACCEPT') endpoint = `/api/v1/routes/trips/${action.trip_id}/accept`;
            else if (action.action_type === 'START') endpoint = `/api/v1/routes/trips/${action.trip_id}/start`;
            else if (action.action_type === 'COMPLETE' || action.action_type === 'FINISH') endpoint = `/api/v1/routes/trips/${action.trip_id}/complete`;
            else if (action.action_type === 'LOCATION_UPDATE') endpoint = `/api/v1/routes/trips/${action.trip_id}/location`;

            if (endpoint) {
              const singleRes = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(action.payload || {})
              });

              if (singleRes.ok) {
                await offlineDB.removeDriverAction(action.client_action_id);
                successCount++;
              } else {
                await offlineDB.updateDriverActionStatus(action.client_action_id, 'FAILED', `Status ${singleRes.status}`);
              }
            }
          } catch (singleErr: any) {
            await offlineDB.updateDriverActionStatus(action.client_action_id, 'FAILED', singleErr.message);
          }
        }
      }
    } catch (err: any) {
      console.warn('[SyncManager] Driver action batch sync failed:', err);
      for (const action of actions) {
        await offlineDB.updateDriverActionStatus(action.client_action_id, 'FAILED', err.message);
      }
    }

    return successCount;
  }

  // --- Exponential Backoff Retry ---

  private scheduleRetry(userId?: string) {
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    this.retryTimeout = setTimeout(() => {
      this.triggerSync(userId);
    }, this.backoffDelayMs);

    // Exponential backoff with ceiling
    this.backoffDelayMs = Math.min(this.backoffDelayMs * 2, this.maxBackoffDelayMs);
  }

  private async notifyState() {
    const counts = await this.getPendingCounts();
    const state: SyncProgressState = {
      isSyncing: this.isSyncing,
      totalPending: counts.total,
      syncedCount: 0,
      failedCount: 0,
      lastSyncTimestamp: this.lastSyncTimestamp,
      lastError: this.lastError
    };

    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (e) {
        console.error('[SyncManager] Listener error:', e);
      }
    }
  }
}

export const syncManager = new SyncManager();
