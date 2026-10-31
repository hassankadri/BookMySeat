import React from 'react';
import axios from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useStripe } from '@stripe/react-stripe-js';
import Checkout from './Checkout';
import { advance, button, click, render } from '../test-support/render';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@stripe/stripe-js', () => ({ loadStripe: jest.fn().mockResolvedValue(null) }));
jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }) => <section data-testid="stripe-boundary">{children}</section>,
  CardNumberElement: () => <div>Stripe number boundary</div>,
  CardExpiryElement: () => <div>Stripe expiry boundary</div>,
  CardCvcElement: () => <div>Stripe CVC boundary</div>,
  useStripe: jest.fn(),
  useElements: () => ({ getElement: () => null }),
}));
jest.mock('react-hot-toast', () => ({ __esModule: true, default: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }) }));
const checkoutState = () => ({ movieId: 'movie-1', showId: 'show-1', seatIds: ['A1'], lockId: 'lock-1', expiresAt: new Date(Date.now() + 60000).toISOString(), total: 999999 });
function Destination() { const location = useLocation(); return <pre data-testid="destination">{location.pathname + location.search}</pre>; }
function tree(entry = '/checkout') {
  return <MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/checkout" element={<Checkout />} />
    <Route path="/booking/:id" element={<Destination />} />
    <Route path="/auth" element={<Destination />} />
  </Routes></MemoryRouter>;
}
beforeEach(() => {
  jest.useFakeTimers(); sessionStorage.clear();
  useAuth.mockReturnValue({ token: 'access-test', isAuthenticated: true, loading: false });
  useStripe.mockReturnValue({ confirmCardPayment: jest.fn() });
  jest.spyOn(axios, 'post').mockResolvedValue({ data: { bookingId: 'booking-1', clientSecret: 'fixture-secret', amount: 321, currency: 'INR', lockExpiresAt: new Date(Date.now() + 60000).toISOString() } });
  jest.spyOn(axios, 'get').mockResolvedValue({ data: { show: { _id: 'show-1', movie: { _id: 'movie-1', title: 'Fixture film' }, theatre: { _id: 'venue-1', name: 'Fixture theatre' }, screen: { name: 'Screen 1' }, startTime: '2030-01-01T12:00:00Z' } } });
  jest.spyOn(axios, 'delete').mockResolvedValue({ data: { success: true } });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('refresh restores checkout storage, requests the exact lock and displays server price instead of client total', async () => {
  sessionStorage.setItem('bookmyseat_checkout', JSON.stringify(checkoutState()));
  const view = await render(tree());
  await advance(1);
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/payments/create-intent'), { showId: 'show-1', seatIds: ['A1'], lockId: 'lock-1' }, { headers: { Authorization: 'Bearer access-test' } });
  expect(view.container.textContent).toContain('₹321');
  expect(view.container.textContent).not.toContain('9,99,999');
  expect(useStripe().confirmCardPayment).not.toHaveBeenCalled();
});
test('router handoff takes precedence over stale refresh storage and is persisted', async () => {
  sessionStorage.setItem('bookmyseat_checkout', JSON.stringify({ ...checkoutState(), showId: 'stale-show' }));
  const state = checkoutState();
  await render(tree({ pathname: '/checkout', state }));
  await advance(1);
  expect(axios.post.mock.calls[0][1].showId).toBe('show-1');
  expect(JSON.parse(sessionStorage.getItem('bookmyseat_checkout'))).toEqual(state);
});
test.each([null, 'malformed-json'])('missing or corrupt checkout storage cannot initialize payment (%s)', async saved => {
  if (saved) sessionStorage.setItem('bookmyseat_checkout', saved);
  const view = await render(tree());
  await advance(1);
  expect(view.container.textContent).toContain('No active checkout');
  expect(axios.post).not.toHaveBeenCalled();
});
test('server lock expiry removes payment form and stored checkout without confirming a charge', async () => {
  sessionStorage.setItem('bookmyseat_checkout', JSON.stringify(checkoutState()));
  axios.post.mockResolvedValue({ data: { bookingId: 'booking-1', clientSecret: 'fixture-secret', amount: 321, lockExpiresAt: new Date(Date.now() + 1000).toISOString() } });
  const view = await render(tree());
  await advance(1);
  expect(view.container.querySelector('[data-testid="stripe-boundary"]')).not.toBeNull();
  await advance(1100);
  expect(view.container.querySelector('[data-testid="stripe-boundary"]')).toBeNull();
  expect(sessionStorage.getItem('bookmyseat_checkout')).toBeNull();
  expect(useStripe().confirmCardPayment).not.toHaveBeenCalled();
});
test('back-to-seats releases the exact hold and preserves movie/show/theatre deep link', async () => {
  sessionStorage.setItem('bookmyseat_checkout', JSON.stringify(checkoutState()));
  const view = await render(tree());
  await advance(1);
  await click(button(view.container, 'Back to seats'));
  expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining('/api/seat-locks/release'), { headers: { Authorization: 'Bearer access-test' }, data: { showId: 'show-1', seatIds: ['A1'], lockId: 'lock-1' } });
  expect(view.container.querySelector('[data-testid="destination"]').textContent).toBe('/booking/movie-1?show=show-1&theatre=venue-1');
  expect(useStripe().confirmCardPayment).not.toHaveBeenCalled();
});
