import React from 'react';
import axios from 'axios';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import VirtualQueueGate from './VirtualQueueGate';
import { advance, click, render, settle } from '../test-support/render';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
const key = 'bms:queue:admission:show-1';
const request = axios.interceptors.request.handlers.find(Boolean).fulfilled;
const reject = axios.interceptors.response.handlers.find(Boolean).rejected;
const counts = () => [axios.interceptors.request.handlers.filter(Boolean).length, axios.interceptors.response.handlers.filter(Boolean).length];
const admission = () => ({ success: true, enabled: true, state: 'ADMITTED', admissionToken: 'admit-test', admittedUntil: new Date(Date.now() + 60000).toISOString() });
function tree() {
  return <MemoryRouter initialEntries={['/booking/movie-1?show=show-1&theatre=venue-1']}>
    <Link to="/booking/movie-1?show=show-1&theatre=venue-2">Change query</Link>
    <Routes><Route path="/booking/:id" element={<VirtualQueueGate><div data-testid="seats">Real seat controller boundary</div></VirtualQueueGate>} /></Routes>
  </MemoryRouter>;
}
beforeEach(() => {
  jest.useFakeTimers();
  sessionStorage.clear(); localStorage.clear();
  useAuth.mockReturnValue({ token: 'access-test', isAuthenticated: true, loading: false });
  jest.spyOn(axios, 'get').mockResolvedValue({ data: { success: true, enabled: true } });
  jest.spyOn(axios, 'post').mockResolvedValue({ data: admission() });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('adds admission only to seat-hold POST, including serialized bodies and AxiosHeaders', () => {
  sessionStorage.setItem(key, JSON.stringify({ token: 'admit-test', expiresAt: new Date(Date.now() + 60000).toISOString() }));
  const headers = new axios.AxiosHeaders();
  const held = request({ method: 'POST', url: '/api/seat-locks/hold', data: JSON.stringify({ showId: 'show-1', seatIds: ['A1'] }), headers });
  expect(held.headers.get('X-Queue-Admission')).toBe('admit-test');
  const plain = request({ method: 'post', url: '/api/seat-locks/hold', data: { showId: 'show-1' } });
  expect(plain.headers['X-Queue-Admission']).toBe('admit-test');
  for (const url of ['/api/payments/create-intent', '/api/contact', '/api/seat-locks/release']) {
    expect(request({ method: 'post', url, data: { showId: 'show-1' } }).headers).toBeUndefined();
  }
  expect(request({ method: 'get', url: '/api/seat-locks/hold', data: { showId: 'show-1' } }).headers).toBeUndefined();
});
test.each(['invalid-json', JSON.stringify({ token: 'old', expiresAt: '2000-01-01T00:00:00Z' }), JSON.stringify({ token: 'missing-expiry' })])('does not attach unusable admission: %s', saved => {
  sessionStorage.setItem(key, saved);
  expect(request({ method: 'post', url: '/api/seat-locks/hold', data: { showId: 'show-1' } }).headers).toBeUndefined();
});
test('admission-required response removes the matching token, dispatches recovery and still rejects', async () => {
  sessionStorage.setItem(key, 'old');
  const listener = jest.fn();
  window.addEventListener('bms:queue-admission-required', listener);
  const error = { response: { data: { code: 'QUEUE_ADMISSION_REQUIRED' } }, config: { data: JSON.stringify({ showId: 'show-1' }) } };
  try {
    await expect(reject(error)).rejects.toBe(error);
    expect(sessionStorage.getItem(key)).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toEqual({ showId: 'show-1' });
  } finally { window.removeEventListener('bms:queue-admission-required', listener); }
});
test('admitted state survives a same-show query navigation without duplicate interceptors or admission requests', async () => {
  const initial = counts();
  const view = await render(tree());
  expect(view.container.querySelector('[data-testid="seats"]')).not.toBeNull();
  expect(JSON.parse(sessionStorage.getItem(key))).toMatchObject({ token: 'admit-test' });
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/queue/shows/show-1/status'), {}, expect.objectContaining({ headers: { Authorization: 'Bearer access-test' } }));
  await click(view.container.querySelector('a'));
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(counts()).toEqual(initial);
  await view.unmount();
  await advance(30000);
  expect(axios.post).toHaveBeenCalledTimes(1);
  // Interceptors are module singletons, intentionally not ejected on page exit.
  // Page timers/listeners are cleaned up; remounting does not register another pair.
  window.dispatchEvent(new CustomEvent('bms:queue-admission-required', { detail: { showId: 'show-1' } }));
  await settle();
  expect(axios.get).toHaveBeenCalledTimes(1);
  await render(tree());
  expect(counts()).toEqual(initial);
});
test('expired admission hides the seat boundary and rechecks the server', async () => {
  axios.post.mockResolvedValueOnce({ data: { ...admission(), admittedUntil: new Date(Date.now() + 1000).toISOString() } })
    .mockResolvedValue({ data: { success: true, enabled: true, state: 'WAITING', position: 2, peopleAhead: 1 } });
  const view = await render(tree());
  expect(view.container.querySelector('[data-testid="seats"]')).not.toBeNull();
  await advance(1100);
  expect(view.container.querySelector('[data-testid="seats"]')).toBeNull();
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(axios.post).toHaveBeenCalledTimes(2);
});
test('configuration failure fails closed rather than rendering bookable seats', async () => {
  axios.get.mockRejectedValue(new Error('configuration unavailable'));
  const view = await render(tree());
  expect(view.container.querySelector('[data-testid="seats"]')).toBeNull();
  expect(view.container.textContent).toContain('configuration unavailable');
  expect(axios.post).not.toHaveBeenCalled();
});
test('disabled queue removes stale admission and opens the seat boundary', async () => {
  sessionStorage.setItem(key, 'stale');
  axios.get.mockResolvedValue({ data: { success: true, enabled: false } });
  const view = await render(tree());
  expect(view.container.querySelector('[data-testid="seats"]')).not.toBeNull();
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(axios.post).not.toHaveBeenCalled();
});
