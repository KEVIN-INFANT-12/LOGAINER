export type TelemetryCallback = (data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private subscribers: Set<TelemetryCallback> = new Set();
  private reconnectTimer: any = null;
  private isExplicitlyClosed = false;

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // Handled by Vite proxy or direct
    const wsUrl = `${protocol}//${host}/ws/telemetry`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected to LOGAINER telemetry stream');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.subscribers.forEach((cb) => cb(payload));
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      };

      this.ws.onclose = () => {
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WebSocket] Connection error:', err);
        this.ws?.close();
      };
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3500);
  }

  subscribe(callback: TelemetryCallback) {
    this.subscribers.add(callback);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }
    return () => {
      this.subscribers.delete(callback);
    };
  }

  send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  close() {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) this.ws.close();
  }
}

export const wsClient = new WebSocketClient();
