import React, { act } from 'react';
import axios from 'axios';
import App from './App';
import { click, render, settle } from './test-support/render';
jest.mock('./pages/Home', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('Home') }));
jest.mock('./pages/Movies', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('Movies') }));
jest.mock('./pages/Cinemas', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('Cinemas') }));
jest.mock('./pages/MovieDetails', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('MovieDetails') }));
jest.mock('./pages/Booking', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('Booking') }));
jest.mock('./pages/Checkout', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('Checkout') }));
jest.mock('./pages/Auth', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('Auth') }));
jest.mock('./pages/MyBookings', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('MyBookings') }));
jest.mock('./pages/BookingSuccess', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('BookingSuccess') }));
jest.mock('./pages/Contact', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('Contact') }));
jest.mock('./pages/AiSearch', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('AiSearch') }));
jest.mock('./pages/admin/Admin', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('admin/Admin') }));
jest.mock('./pages/admin/AdminMovies', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('admin/AdminMovies') }));
jest.mock('./pages/admin/AdminTheatres', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('admin/AdminTheatres') }));
jest.mock('./pages/admin/AdminScreens', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('admin/AdminScreens') }));
jest.mock('./pages/admin/AdminShows', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('admin/AdminShows') }));
jest.mock('./pages/admin/AdminUsers', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('admin/AdminUsers') }));
jest.mock('./pages/admin/AdminBookings', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('admin/AdminBookings') }));
jest.mock('./pages/admin/AdminAnalytics', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('admin/AdminAnalytics') }));
jest.mock('./pages/admin/AdminDynamicPricing', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('admin/AdminDynamicPricing') }));
jest.mock('./pages/admin/AdminRiskMonitoring', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('admin/AdminRiskMonitoring') }));
jest.mock('./pages/admin/AddShow', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('admin/AddShow') }));
jest.mock('./pages/admin/TicketScanner', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('admin/TicketScanner') }));
jest.mock('./pages/partner/PartnerDashboard', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('partner/PartnerDashboard') }));
jest.mock('./pages/partner/PartnerShowtimeCreate', () => ({ __esModule: true, default: require('./test-support/RouteProbe').makePage('partner/PartnerShowtimeCreate') }));
jest.mock('./components/Navbar', () => () => null);
jest.mock('./components/VirtualQueueGate', () => ({ __esModule: true, default: ({children}) => <section data-testid="queue-boundary">{children}</section> }));
jest.mock('react-hot-toast', () => ({ Toaster: () => null }));

function token(type = 'ACCESS', exp = Math.floor(Date.now()/1000) + 3600) {
  return btoa('{}') + '.' + btoa(JSON.stringify({ type, exp })) + '.signature';
}
function state(view) { return JSON.parse(view.container.querySelector('[data-testid="provider-state"]').textContent); }
async function go(path) {
  await act(async () => { window.history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); });
  await settle();
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  jest.spyOn(axios, 'get').mockResolvedValue({ data: { user: { _id: 'user-1', role: 'partner', name: 'Fixture account' } } });
});
afterEach(() => jest.restoreAllMocks());

test('actual App providers retain session and booking state across Link navigation without another /me request', async () => {
  const access = token();
  localStorage.setItem('token', access);
  const view = await render(<App />);
  expect(state(view).user.role).toBe('partner');
  expect(axios.get).toHaveBeenCalledTimes(1);
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/auth/me'), { headers: { Authorization: `Bearer ${access}` } });
  await click(view.container.querySelector('[data-testid="remember-seat"]'));
  await click(view.container.querySelector('[data-testid="go-movies"]'));
  expect(state(view).bookingData.selectedSeats).toEqual(['A1']);
  expect(state(view).location).toBe('/movies?theatre=venue-1');
  expect(state(view).token).toBe(access);
  await go('/booking/movie-1?show=show-1&theatre=venue-1');
  expect(view.container.querySelector('[data-testid="queue-boundary"]')).not.toBeNull();
  expect(state(view).params).toEqual({ id: 'movie-1' });
  expect(state(view).bookingData.selectedSeats).toEqual(['A1']);
  expect(axios.get).toHaveBeenCalledTimes(1);
});
test.each([['malformed', 'bad-token'], ['expired', token('ACCESS', 1)], ['wrong token type', token('RESET')]])('existing auth rejects %s tokens without an authenticated request', async (_, saved) => {
  localStorage.setItem('token', saved);
  const view = await render(<App />);
  expect(state(view).token).toBeNull();
  expect(state(view).isAuthenticated).toBe(false);
  expect(localStorage.getItem('token')).toBeNull();
  expect(axios.get).not.toHaveBeenCalled();
});
test('cross-tab logout clears the session and does not recreate providers', async () => {
  localStorage.setItem('token', token());
  const view = await render(<App />);
  await click(view.container.querySelector('[data-testid="remember-seat"]'));
  localStorage.removeItem('token');
  await act(async () => window.dispatchEvent(new StorageEvent('storage', { key: 'token', newValue: null })));
  await settle();
  expect(state(view).user).toBeNull();
  expect(state(view).isAuthenticated).toBe(false);
  expect(state(view).bookingData.selectedSeats).toEqual(['A1']);
});
test('all 26 route contracts resolve to the correct page, including nested admin and partner routes', async () => {
  const view = await render(<App />);
  const paths = [
    ['/', 'Home'], ['/movies', 'Movies'], ['/cinemas', 'Cinemas'], ['/movie/movie-1', 'MovieDetails'],
    ['/booking/movie-1?show=show-1&theatre=venue-1', 'Booking'], ['/checkout', 'Checkout'], ['/auth', 'Auth'],
    ['/my-bookings', 'MyBookings'], ['/booking-success?bookingId=b1', 'BookingSuccess'], ['/booking-cancel', 'Home'],
    ['/contact', 'Contact'], ['/ai-search', 'AiSearch'], ['/partner', 'partner/PartnerDashboard'], ['/partner/new-show', 'partner/PartnerShowtimeCreate'],
    ['/admin', 'admin/Admin'],
    ...[['analytics','AdminAnalytics'],['movies','AdminMovies'],['theatres','AdminTheatres'],['screens','AdminScreens'],['add-show','AddShow'],['shows','AdminShows'],['pricing','AdminDynamicPricing'],['risk','AdminRiskMonitoring'],['users','AdminUsers'],['bookings','AdminBookings'],['scanner','TicketScanner']].map(([url, component]) => ['/admin/'+url, 'admin/'+component]),
  ];
  expect(paths).toHaveLength(26);
  for (const [path, page] of paths) {
    await go(path);
    expect(view.container.querySelector(`[data-page="${page}"]`)).not.toBeNull();
    if (path.startsWith('/admin/')) expect(view.container.querySelector('[data-page="admin/Admin"]')).not.toBeNull();
  }
});
test('admin shell instance persists between nested routes', async () => {
  window.history.replaceState({}, '', '/admin/movies');
  const view = await render(<App />);
  const shell = view.container.querySelector('[data-page="admin/Admin"]');
  await go('/admin/screens');
  expect(view.container.querySelector('[data-page="admin/Admin"]')).toBe(shell);
});
test('fresh deep-link mount keeps query parameters; in-memory booking state is not fabricated on refresh', async () => {
  window.history.replaceState({}, '', '/booking/movie-1?show=show-1&theatre=venue-1');
  const view = await render(<App />);
  expect(state(view).location).toBe('/booking/movie-1?show=show-1&theatre=venue-1');
  expect(state(view).bookingData.selectedSeats).toEqual([]);
  expect(state(view).params.id).toBe('movie-1');
});
test('an existing token rejected by /me clears the session instead of preserving a stale role', async () => {
  localStorage.setItem('token', token());
  axios.get.mockRejectedValue({ response: { status: 401 } });
  const view = await render(<App />);
  expect(state(view).user).toBeNull();
  expect(state(view).token).toBeNull();
  expect(state(view).isAuthenticated).toBe(false);
  expect(localStorage.getItem('token')).toBeNull();
});

