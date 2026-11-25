import type { BusMsg } from './types';

/**
 * One message bus for every VoxInk window.
 * - Same computer: BroadcastChannel (no server, zero latency, works offline).
 * - Other devices (phone remote, a second laptop driving the projector): a WebSocket relay on the server.
 * Messages carry an id, so a window that hears the same message on both paths acts on it once.
 */
type Wire = BusMsg & { _mid: string; _from: string };
export type Bus = { send: (m: BusMsg) => void; on: (h: (m: BusMsg) => void) => void; online: () => boolean };

export const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function createBus(role: string): Bus {
  const bc = new BroadcastChannel('voxink');
  const handlers = new Set<(m: BusMsg) => void>();
  const seen = new Set<string>();
  let ws: WebSocket | null = null;

  const deliver = (m: Wire) => {
    if (!m || !m._mid || seen.has(m._mid)) return;
    seen.add(m._mid);
    if (seen.size > 2000) seen.clear();
    handlers.forEach((h) => h(m));
  };
  bc.onmessage = (e) => deliver(e.data as Wire);

  const connect = () => {
    try {
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
      ws.onmessage = (e) => { try { deliver(JSON.parse(e.data)); } catch { /* ignore */ } };
      ws.onclose = () => { ws = null; setTimeout(connect, 3000); };
      ws.onerror = () => ws?.close();
    } catch { setTimeout(connect, 3000); }
  };
  connect();

  return {
    send(m) {
      const w = { ...m, _mid: rid(), _from: role } as Wire;
      seen.add(w._mid);
      bc.postMessage(w);
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(w));
    },
    on(h) { handlers.add(h); },
    online: () => ws?.readyState === WebSocket.OPEN,
  };
}
