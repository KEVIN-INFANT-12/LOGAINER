/**
 * LOGAINER Dual-Layer Network & Backend Health Detector
 * Monitors:
 * 1. Browser network status (window online/offline events + navigator.onLine)
 * 2. Active backend reachability via lightweight /health heartbeat ping
 * 3. Supports offline simulation toggle for realistic field testing
 */

import { NetworkHealthState } from '../types';

export type NetworkListener = (state: NetworkHealthState) => void;

class NetworkService {
  private isOnlineState: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isBackendReachableState: boolean = true;
  private lastCheckedAt: string = new Date().toISOString();
  private latencyMs: number = 0;
  private pingInterval: any = null;
  private listeners: Set<NetworkListener> = new Set();
  private simulatedOffline: boolean = false;
  private consecutiveFailures: number = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleBrowserOnline.bind(this));
      window.addEventListener('offline', this.handleBrowserOffline.bind(this));
      this.startHeartbeat();
      // Initial ping check
      this.checkConnectivity();
    }
  }

  private handleBrowserOnline() {
    this.isOnlineState = true;
    this.checkConnectivity();
  }

  private handleBrowserOffline() {
    this.isOnlineState = false;
    this.isBackendReachableState = false;
    this.notifyListeners();
  }

  public startHeartbeat(intervalMs = 6000) {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      this.checkConnectivity();
    }, intervalMs);
  }

  public stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public async checkConnectivity(): Promise<NetworkHealthState> {
    if (this.simulatedOffline) {
      this.isOnlineState = false;
      this.isBackendReachableState = false;
      this.lastCheckedAt = new Date().toISOString();
      const state = this.getState();
      this.notifyListeners();
      return state;
    }

    if (!navigator.onLine) {
      this.isOnlineState = false;
      this.isBackendReachableState = false;
      this.lastCheckedAt = new Date().toISOString();
      const state = this.getState();
      this.notifyListeners();
      return state;
    }

    const start = performance.now();
    try {
      // Short-timeout probe to backend /health
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch('/health', {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store'
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        this.isOnlineState = true;
        this.isBackendReachableState = true;
        this.consecutiveFailures = 0;
        this.latencyMs = Math.round(performance.now() - start);
      } else {
        this.isBackendReachableState = false;
        this.consecutiveFailures++;
      }
    } catch {
      this.isBackendReachableState = false;
      this.consecutiveFailures++;
      // If 2+ consecutive heartbeats fail, consider overall network offline for the app
      if (this.consecutiveFailures >= 2) {
        this.isOnlineState = false;
      }
    }

    this.lastCheckedAt = new Date().toISOString();
    const state = this.getState();
    this.notifyListeners();
    return state;
  }

  public getState(): NetworkHealthState {
    return {
      isOnline: this.isOnlineState && this.isBackendReachableState && !this.simulatedOffline,
      isBackendReachable: this.isBackendReachableState && !this.simulatedOffline,
      lastCheckedAt: this.lastCheckedAt,
      latencyMs: this.latencyMs
    };
  }

  public isOnline(): boolean {
    return this.getState().isOnline;
  }

  public setSimulatedOffline(offline: boolean) {
    this.simulatedOffline = offline;
    this.checkConnectivity();
  }

  public isSimulatedOffline(): boolean {
    return this.simulatedOffline;
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    // Notify immediately with current state
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (e) {
        console.error('[NetworkService] Listener error:', e);
      }
    }
  }
}

export const networkService = new NetworkService();
