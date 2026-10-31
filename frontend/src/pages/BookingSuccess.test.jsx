import React from 'react';
import axios from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BookingSuccess from './BookingSuccess';
import { advance, button, click, deferred, render, settle } from '../test-support/render';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
// Isolate the existing authoritative gate from the legacy ticket's separate fetch.
jest.mock('./BookingSuccessOriginal', () => () => <div data-testid="verified-ticket">Verified ticket boundary</div>);
function tree(entry = '/booking-success?bookingId=booking-1') {
  return <MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/booking-success" element={<BookingSuccess />} />
    <Route path="/my-bookings" element={<div>Booking archive</div>} />
    <Route path="/auth" element={<div>Authentication</div>} />
  </Routes></MemoryRouter>;
}
beforeEach(() => {
  jest.useFakeTimers();
  useAuth.mockReturnValue({ token: 'access-test', isAuthenticated: true, loading: false });
  jest.spyOn(axios, 'get').mockResolvedValue({ data: { bookingStatus: 'PENDING_PAYMENT', paymentState: 'AWAITING_WEBHOOK', retryAfterSeconds: 3 } });
  jest.spyOn(axios, 'post').mockRejectedValue(new Error('No mutations allowed in recovery tests'));
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('pending stays pending through timers and resumes polling without any charge request', async () => {
  const view = await render(tree());
  expect(view.container.textContent).toContain('waiting for the server');
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/payments/recovery/booking-1'), expect.objectContaining({ headers: { Authorization: 'Bearer access-test' }, timeout: 12000 }));
  await advance(3000);
  expect(axios.get).toHaveBeenCalledTimes(2);
  expect(view.container.querySelector('[data-testid="verified-ticket"]')).toBeNull();
  expect(axios.post).not.toHaveBeenCalled();
});
test.each([
  ['PAYMENT_FAILED', 'Payment not completed.'],
  ['PAYMENT_RETRY_AVAILABLE', 'Payment needs attention.'],
  ['EXPIRED', 'Reservation expired.'],
  ['REFUND_PENDING', 'Refund being processed.'],
  ['REFUNDED', 'Booking refunded.'],
  ['REVIEW_REQUIRED', 'Payment needs review.'],
  ['CANCELLED', 'Booking cancelled.'],
])('renders authoritative %s without issuing a ticket or scheduling another automatic check', async (paymentState, heading) => {
  axios.get.mockResolvedValue({ data: { paymentState, bookingStatus: 'PENDING_PAYMENT' } });
  const view = await render(tree());
  expect(view.container.querySelector('h1').textContent).toBe(heading);
  expect(view.container.querySelector('[data-testid="verified-ticket"]')).toBeNull();
  await advance(30000);
  expect(axios.get).toHaveBeenCalledTimes(1);
  expect(axios.post).not.toHaveBeenCalled();
});
test.each([
  ['PENDING_PAYMENT', 'CONFIRMED'],
  ['CONFIRMED', 'AWAITING_WEBHOOK'],
  ['PENDING_PAYMENT', 'PAYMENT_PENDING'],
])('does not confirm from mismatched booking/payment state %s / %s or redirect state', async (bookingStatus, paymentState) => {
  axios.get.mockResolvedValue({ data: { bookingStatus, paymentState } });
  const view = await render(tree({ pathname: '/booking-success', search: '?bookingId=booking-1', state: { success: true, processing: false } }));
  expect(view.container.querySelector('[data-testid="verified-ticket"]')).toBeNull();
  await advance(2500);
  expect(view.container.querySelector('[data-testid="verified-ticket"]')).toBeNull();
});
test('renders the ticket boundary only when both server states are CONFIRMED', async () => {
  axios.get.mockResolvedValue({ data: { bookingStatus: 'CONFIRMED', paymentState: 'CONFIRMED', bookingCode: 'BMS-TEST' } });
  const view = await render(tree());
  expect(view.container.querySelector('[data-testid="verified-ticket"]')).not.toBeNull();
  await advance(30000);
  expect(axios.get).toHaveBeenCalledTimes(1);
});
test('bounded polling becomes delayed and manual recheck never initiates payment', async () => {
  const view = await render(tree());
  for (let i = 0; i < 23; i += 1) await advance(3000);
  expect(view.container.querySelector('h1').textContent).toBe('Confirmation is taking longer.');
  expect(axios.get).toHaveBeenCalledTimes(24);
  await advance(30000);
  expect(axios.get).toHaveBeenCalledTimes(24);
  await click(button(view.container, 'Check again'));
  expect(axios.get).toHaveBeenCalledTimes(25);
  expect(axios.post).not.toHaveBeenCalled();
});
test('deep-link requires bookingId and never guesses confirmation from a legacy session parameter', async () => {
  const view = await render(tree('/booking-success?session_id=old-checkout'));
  expect(view.container.textContent).toContain('Booking archive');
  expect(axios.get).not.toHaveBeenCalled();
});
test('unmount aborts recovery and ignores the late response', async () => {
  const pending = deferred();
  axios.get.mockReturnValue(pending.promise);
  const view = await render(tree());
  const signal = axios.get.mock.calls[0][1].signal;
  await view.unmount();
  expect(signal.aborted).toBe(true);
  pending.resolve({ data: { bookingStatus: 'CONFIRMED', paymentState: 'CONFIRMED' } });
  await settle();
  await advance(30000);
  expect(axios.get).toHaveBeenCalledTimes(1);
});
test('an inaccessible booking fails without polling indefinitely or issuing a ticket', async () => {
  axios.get.mockRejectedValue({ response: { status: 404 } });
  const view = await render(tree());
  expect(view.container.textContent).toContain('This booking was not found in your account.');
  await advance(30000);
  expect(axios.get).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector('[data-testid="verified-ticket"]')).toBeNull();
});
