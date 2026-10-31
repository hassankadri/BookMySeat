// Transport double only; the production recovery function and Booking handlers run.
export function makeSocket({ connected = false } = {}) {
  const listeners = new Map();
  const socket = {
    connected,
    on: jest.fn((event, fn) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return socket;
    }),
    off: jest.fn((event, fn) => { listeners.get(event)?.delete(fn); return socket; }),
    emit: jest.fn(),
    timeout: jest.fn(() => socket),
    disconnect: jest.fn(() => { socket.connected = false; }),
    fire(event, payload) { for (const fn of [...(listeners.get(event) || [])]) fn(payload); },
    count(event) { return listeners.get(event)?.size || 0; },
  };
  return socket;
}
