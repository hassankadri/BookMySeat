import React, { useEffect } from 'react';
import { MemoryRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { animate, useReducedMotion } from 'framer-motion';
import RouteScene from './RouteScene';
import { historyDirection, routeTreatment } from './navigation';
import { click, render, advance } from '../../test-support/render';

jest.mock('framer-motion', () => ({
  ...require('../../test-support/motion'),
  animate: jest.fn(() => ({ stop: jest.fn() })),
  useReducedMotion: jest.fn(() => false),
}));
const mount = jest.fn();
const dispose = jest.fn();
function Page() {
  const location = useLocation();
  useEffect(() => { mount(); return dispose; }, []);
  return <><h1>{location.pathname}</h1><p>{location.search}</p><div id="anchor">Anchor</div></>;
}
function tree(initial = '/') {
  return <MemoryRouter initialEntries={[initial]}>
    <nav>{['/', '/movies', '/movies?theatre=real-id', '/movies#anchor', '/cinemas', '/checkout', '/booking/film?show=show-1', '/admin/movies', '/admin/screens', '/partner'].map(path => <Link key={path} to={path}>{path}</Link>)}</nav>
    <RouteScene><Routes><Route path="*" element={<Page />} /></Routes></RouteScene>
  </MemoryRouter>;
}
async function go(view, href) { await click(view.container.querySelector(`a[href="${href}"]`)); }
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  useReducedMotion.mockReturnValue(false);
  // CRA resets mock implementations before every test, including factories.
  animate.mockImplementation(() => ({ stop: jest.fn() }));
});
afterEach(() => jest.useRealTimers());

test('initial visits do not animate; public navigation is immediate and does not duplicate the route tree', async () => {
  const view = await render(tree());
  expect(animate).not.toHaveBeenCalled();
  await go(view, '/movies');
  expect(view.container.querySelector('h1').textContent).toBe('/movies');
  expect(view.container.querySelectorAll('h1')).toHaveLength(1);
  expect(mount).toHaveBeenCalledTimes(1);
  expect(dispose).not.toHaveBeenCalled();
  expect(animate).toHaveBeenCalledTimes(2);
  expect(view.container.querySelector('[data-phase="spatial"]')).not.toBeNull();
  await advance(20);
  expect(document.activeElement).toBe(view.container.querySelector('h1'));
});
test('rapid navigation stops old animation controllers; unmount cancels the latest controllers', async () => {
  const view = await render(tree());
  await go(view, '/movies');
  const oldControls = animate.mock.results.map(result => result.value);
  await go(view, '/cinemas');
  oldControls.forEach(control => expect(control.stop).toHaveBeenCalledTimes(1));
  expect(view.container.querySelector('h1').textContent).toBe('/cinemas');
  const latest = animate.mock.results.slice(2).map(result => result.value);
  await view.unmount();
  latest.forEach(control => expect(control.stop).toHaveBeenCalledTimes(1));
});
test.each(['/checkout', '/booking/film?show=show-1', '/admin/movies', '/partner'])('sensitive %s navigation bypasses all animation in both directions', async path => {
  const view = await render(tree());
  await go(view, path);
  expect(animate).not.toHaveBeenCalled();
  await go(view, '/cinemas');
  expect(animate).not.toHaveBeenCalled();
  expect(view.container.querySelector('#bms-route-content').style.transform).toBe('');
});
test('query/hash changes preserve the existing page instance and do not restart cinematic motion', async () => {
  const view = await render(tree('/movies'));
  await go(view, '/movies?theatre=real-id');
  expect(view.container.querySelector('p').textContent).toBe('?theatre=real-id');
  await go(view, '/movies#anchor');
  await advance(20);
  expect(document.activeElement.id).toBe('anchor');
  expect(animate).not.toHaveBeenCalled();
  expect(mount).toHaveBeenCalledTimes(1);
});
test('reduced motion disables decorative controllers without blocking navigation', async () => {
  useReducedMotion.mockReturnValue(true);
  const view = await render(tree());
  await go(view, '/movies');
  expect(animate).not.toHaveBeenCalled();
  expect(view.container.querySelector('h1').textContent).toBe('/movies');
});
test('known history indices distinguish Back and Forward; unknown history uses deterministic forward', () => {
  expect(historyDirection(8, 7, 'POP')).toBe(-1);
  expect(historyDirection(7, 8, 'POP')).toBe(1);
  expect(historyDirection(undefined, undefined, 'POP')).toBe(1);
  expect(historyDirection(8, 7, 'PUSH')).toBe(1);
});
test('payment/recovery, tickets/refunds and operational routes retain the no-motion policy', () => {
  ['/booking-success', '/booking-cancel', '/my-bookings', '/admin/scanner', '/partner/new-show'].forEach(path => expect(routeTreatment(path)).toBe('none'));
  ['/auth', '/ai-search', '/contact'].forEach(path => expect(routeTreatment(path)).toBe('quiet'));
});
