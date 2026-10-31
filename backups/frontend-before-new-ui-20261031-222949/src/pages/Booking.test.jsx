import React, { act } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookingProvider } from '../context/BookingContext';
import Booking from './Booking';
import { advance, click, deferred, render, settle } from '../test-support/render';
import { makeSocket } from '../test-support/socket';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('../components/SeatIntelligencePanel', () => () => null);
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: jest.fn(), success: jest.fn() } }));
const show = {
  _id: 'show-1', movie: { _id: 'movie-1', title: 'Fixture film', duration: 120 },
  theatre: { _id: 'venue-1', name: 'Fixture theatre' }, startTime: '2030-01-01T12:00:00Z',
  bookedSeats: [], pricing: [{ seatType: 'REGULAR', price: 250 }],
  screen: { name: 'Screen 1', seats: [1, 2, 3].map(n => ({ seatId: `A${n}`, row: 'A', column: n, number: n, type: 'REGULAR', isActive: true })) },
};
function Destination() { const location = useLocation(); return <pre data-testid="destination">{JSON.stringify(location)}</pre>; }
function tree(entry = '/booking/movie-1?show=show-1&theatre=venue-1') {
  return <BookingProvider><MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/booking/:id" element={<Booking />} />
    <Route path="/checkout" element={<Destination />} />
    <Route path="/movie/:id" element={<Destination />} />
  </Routes></MemoryRouter></BookingProvider>;
}
let socket;
const seat = (view, id = 'A1') => view.container.querySelector(`[data-testid="seat-${id}"]`);
beforeEach(() => {
  jest.useFakeTimers(); sessionStorage.clear(); localStorage.clear();
  useAuth.mockReturnValue({ token: 'access-test', isAuthenticated: true, loading: false });
  socket = makeSocket(); io.mockReturnValue(socket);
  jest.spyOn(axios, 'get').mockImplementation(url => Promise.resolve({ data: url.includes('/seat-locks/') ? { lockedSeats: [] } : { show } }));
  jest.spyOn(axios, 'post').mockImplementation((url, body) => Promise.resolve({ data: { lockId: 'lock-1', seats: body.seatIds, expiresAt: new Date(Date.now() + 60000).toISOString() } }));
  jest.spyOn(axios, 'delete').mockResolvedValue({ data: { success: true } });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('selection waits for hold success, retains exact payload and authoritative lock, and releases with a DELETE body', async () => {
  const pending = deferred(); axios.post.mockReturnValueOnce(pending.promise);
  const view = await render(tree());
  await click(seat(view));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/seat-locks/hold'), { showId: 'show-1', seatIds: ['A1'] }, { headers: { Authorization: 'Bearer access-test' } });
  expect(seat(view).getAttribute('aria-pressed')).toBe('false');
  const expiresAt = new Date(Date.now() + 60000).toISOString();
  pending.resolve({ data: { lockId: 'lock-1', seats: ['A1'], expiresAt } });
  await settle();
  expect(seat(view).getAttribute('aria-pressed')).toBe('true');
  expect(JSON.parse(sessionStorage.getItem('bookmyseat_seat_hold'))).toEqual({ showId: 'show-1', seatIds: ['A1'], lockId: 'lock-1', expiresAt });
  await click(seat(view));
  expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining('/api/seat-locks/release'), { data: { showId: 'show-1', seatIds: ['A1'], lockId: 'lock-1' }, headers: { Authorization: 'Bearer access-test' } });
  expect(sessionStorage.getItem('bookmyseat_seat_hold')).toBeNull();
  expect(seat(view).getAttribute('aria-pressed')).toBe('false');
});
test('409 seat conflict never becomes selected and refreshes authoritative holds', async () => {
  const error = { response: { status: 409, data: { message: 'Seat A1 is held by another customer.' } } };
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  axios.post.mockRejectedValue(error);
  const view = await render(tree());
  const before = axios.get.mock.calls.length;
  await click(seat(view));
  expect(log).toHaveBeenCalledWith('Hold seat error:', error);
  expect(toast.error).toHaveBeenCalledWith(error.response.data.message);
  expect(seat(view).getAttribute('aria-pressed')).toBe('false');
  expect(sessionStorage.getItem('bookmyseat_seat_hold')).toBeNull();
  expect(axios.get.mock.calls.length).toBeGreaterThan(before);
});
test('expiry clears restored selection and prevents proceeding with the expired lock', async () => {
  sessionStorage.setItem('bookmyseat_seat_hold', JSON.stringify({ showId: 'show-1', seatIds: ['A1'], lockId: 'lock-1', expiresAt: new Date(Date.now() + 1000).toISOString() }));
  const view = await render(tree());
  expect(seat(view).getAttribute('aria-pressed')).toBe('true');
  await advance(1100);
  expect(seat(view).getAttribute('aria-pressed')).toBe('false');
  expect(sessionStorage.getItem('bookmyseat_seat_hold')).toBeNull();
  expect(toast.error).toHaveBeenCalledWith('Your seat hold expired. Please select your seats again.');
  expect(sessionStorage.getItem('bookmyseat_checkout')).toBeNull();
});
test('socket updates affect only the current show and are cleaned up with room leave/disconnect', async () => {
  const view = await render(tree());
  await act(async () => socket.fire('seats:held', { showId: 'other', seatIds: ['A1'] }));
  expect(seat(view).disabled).toBe(false);
  await act(async () => socket.fire('seats:held', { showId: 'show-1', seatIds: ['A1'] }));
  expect(seat(view).disabled).toBe(true);
  await act(async () => socket.fire('seats:released', { showId: 'show-1', seatIds: ['A1'] }));
  expect(seat(view).disabled).toBe(false);
  await act(async () => socket.fire('seats:booked', { showId: 'show-1', seatIds: ['A1'] }));
  expect(seat(view).getAttribute('aria-label')).toContain('booked');
  await view.unmount();
  expect(socket.emit).toHaveBeenCalledWith('show:leave', { showId: 'show-1' });
  expect(socket.disconnect).toHaveBeenCalledTimes(1);
  for (const event of ['connect', 'seats:held', 'seats:released', 'seats:booked']) expect(socket.count(event)).toBe(0);
});
test('checkout handoff carries movie/show/seat/lock/expiry in both router state and refresh storage', async () => {
  const view = await render(tree());
  await click(seat(view));
  await click(view.container.querySelector('[data-testid="proceed-to-checkout"]'));
  const stored = JSON.parse(sessionStorage.getItem('bookmyseat_checkout'));
  expect(stored).toEqual({ movieId: 'movie-1', showId: 'show-1', seatIds: ['A1'], lockId: 'lock-1', expiresAt: expect.any(String), total: 250 });
  const destination = JSON.parse(view.container.querySelector('[data-testid="destination"]').textContent);
  expect(destination.pathname).toBe('/checkout');
  expect(destination.state).toEqual(stored);
});
test('direct booking link without a show returns to the same movie and cinema', async () => {
  const view = await render(tree('/booking/movie-1?theatre=venue-1'));
  const destination = JSON.parse(view.container.querySelector('[data-testid="destination"]').textContent);
  expect(destination.pathname + destination.search).toBe('/movie/movie-1?theatre=venue-1');
  expect(axios.post).not.toHaveBeenCalled();
});
test('release failure retains the selected hold and refreshes availability for recovery', async () => {
  const error = { response: { status: 503, data: { message: 'Release temporarily unavailable' } } };
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const view = await render(tree());
  await click(seat(view));
  const saved = sessionStorage.getItem('bookmyseat_seat_hold');
  axios.delete.mockRejectedValue(error);
  await click(seat(view));
  expect(log).toHaveBeenCalledWith('Release seat error:', error);
  expect(seat(view).getAttribute('aria-pressed')).toBe('true');
  expect(sessionStorage.getItem('bookmyseat_seat_hold')).toBe(saved);
  expect(toast.error).toHaveBeenCalledWith('Release temporarily unavailable');
});
test('reconnect snapshot invalidates a restored hold whose seat is now booked', async () => {
  sessionStorage.setItem('bookmyseat_seat_hold', JSON.stringify({ showId: 'show-1', seatIds: ['A1'], lockId: 'lock-1', expiresAt: new Date(Date.now() + 60000).toISOString() }));
  const view = await render(tree());
  expect(seat(view).getAttribute('aria-pressed')).toBe('true');
  axios.get.mockImplementation(url => Promise.resolve({ data: url.includes('/seat-locks/') ? { lockedSeats: [] } : { show: { ...show, bookedSeats: ['A1'] } } }));
  socket.emit.mockImplementation((event, payload, ack) => {
    if (event === 'show:join') ack(null, { success: true });
    if (event === 'show:replay') ack(null, { success: true, events: [], nextCursor: '0-0', mayHaveMore: false });
  });
  socket.connected = true;
  await act(async () => socket.fire('connect'));
  await settle();
  expect(seat(view).disabled).toBe(true);
  expect(seat(view).getAttribute('aria-pressed')).toBe('false');
  expect(sessionStorage.getItem('bookmyseat_seat_hold')).toBeNull();
  expect(toast.error).toHaveBeenCalledWith('Seat availability changed. Please choose your seats again.');
});
