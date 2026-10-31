import axios from 'axios';
import { attachSeatEventRecovery } from './seatEventRecovery';
import { makeSocket } from '../test-support/socket';
import { advance, deferred, settle } from '../test-support/render';

describe('production seat-event recovery with a controlled transport', () => {
  let socket, snapshot, refresh, detach;
  beforeEach(() => {
    sessionStorage.clear();
    jest.useFakeTimers();
    socket = makeSocket();
    snapshot = jest.fn();
    refresh = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(axios, 'get').mockResolvedValue({ data: { show: { bookedSeats: ['A2'] } } });
    socket.emit.mockImplementation((event, payload, ack) => {
      if (event === 'show:join') ack(null, { success: true });
      if (event === 'show:replay') ack(null, { success: true, events: [{ seatIds: ['A1'] }], nextCursor: '10-0', mayHaveMore: false });
    });
    detach = attachSeatEventRecovery({ socket, showId: 'show-1', apiUrl: '/backend', onBookedSnapshot: snapshot, refreshLockedSeats: refresh });
  });
  afterEach(() => { detach(); jest.restoreAllMocks(); jest.useRealTimers(); });
  async function connect() { socket.connected = true; socket.fire('connect'); await settle(); }

  test('joins, replays the stored cursor, then uses REST rather than historical events as present truth', async () => {
    sessionStorage.setItem('bookmyseat_seat_event_cursor:show-1', '9-0');
    await connect();
    expect(socket.emit).toHaveBeenCalledWith('show:join', { showId: 'show-1' }, expect.any(Function));
    expect(socket.emit).toHaveBeenCalledWith('show:replay', { showId: 'show-1', after: '9-0', limit: 100 }, expect.any(Function));
    expect(axios.get).toHaveBeenCalledWith('/backend/api/shows/show-1', { timeout: 12000 });
    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(snapshot).toHaveBeenCalledWith(['A2']);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('bookmyseat_seat_event_cursor:show-1')).toBe('10-0');
  });
  test('retries a snapshot when a same-show live event arrives during the request', async () => {
    const pending = deferred();
    axios.get.mockReturnValueOnce(pending.promise);
    await connect();
    socket.fire('seats:booked', { showId: 'show-1', seatIds: ['A2'] });
    pending.resolve({ data: { show: { bookedSeats: ['STALE'] } } });
    await settle();
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(snapshot.mock.calls).toEqual([[['A2']]]);
  });
  test('ignores other-show events when deciding snapshot freshness', async () => {
    const pending = deferred();
    axios.get.mockReturnValueOnce(pending.promise);
    await connect();
    socket.fire('seats:booked', { showId: 'another-show', seatIds: ['A9'] });
    pending.resolve({ data: { show: { bookedSeats: ['A3'] } } });
    await settle();
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(snapshot).toHaveBeenCalledWith(['A3']);
  });
  test('replay timeout still reconciles REST and current holds', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    socket.emit.mockImplementation((event, payload, ack) => event === 'show:join' ? ack(null, { success: true }) : ack(new Error('timeout')));
    await connect();
    expect(warning).toHaveBeenCalled();
    expect(snapshot).toHaveBeenCalledWith(['A2']);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  test('limits replay to two pages and respects the cooldown', async () => {
    socket.emit.mockImplementation((event, payload, ack) => ack(null, event === 'show:join' ? { success: true } : { success: true, events: [{}], nextCursor: '11-0', mayHaveMore: true }));
    await connect();
    expect(axios.get).not.toHaveBeenCalled();
    await advance(1100);
    expect(socket.emit.mock.calls.filter(([event]) => event === 'show:replay')).toHaveLength(2);
    expect(snapshot).toHaveBeenCalledWith(['A2']);
  });
  test('cleanup removes only its subscriptions and rejects a late REST result', async () => {
    const unrelated = jest.fn();
    socket.on('seats:booked', unrelated);
    const pending = deferred();
    axios.get.mockReturnValueOnce(pending.promise);
    await connect();
    detach();
    pending.resolve({ data: { show: { bookedSeats: ['LATE'] } } });
    await settle();
    expect(snapshot).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(socket.count('connect')).toBe(0);
    expect(socket.count('seats:held')).toBe(0);
    expect(socket.count('seats:released')).toBe(0);
    expect(socket.count('seats:booked')).toBe(1);
    socket.fire('seats:booked', {});
    expect(unrelated).toHaveBeenCalledTimes(1);
  });
  test('a reconnect invalidates the previous in-flight snapshot', async () => {
    const old = deferred();
    axios.get.mockReturnValueOnce(old.promise);
    await connect();
    await connect();
    old.resolve({ data: { show: { bookedSeats: ['OLD'] } } });
    await settle();
    expect(snapshot.mock.calls).toEqual([[['A2']]]);
  });
});
