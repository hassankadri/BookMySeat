import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import { click, render } from '../test-support/render';
jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
function Location() { const location = useLocation(); return <div id="bms-route-content" tabIndex={-1}>{location.pathname}</div>; }
beforeEach(() => {
  window.matchMedia = jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  useAuth.mockReturnValue({ user: null, isAuthenticated: false, logout: jest.fn() });
});
test('anonymous navigation exposes every public destination and opens the accessible index', async () => {
  const view = await render(<MemoryRouter><Navbar /><Location /></MemoryRouter>);
  ['/','/movies','/cinemas','/ai-search','/contact'].forEach(path => expect(view.container.querySelector(`nav a[href="${path}"]`)).not.toBeNull());
  await click(view.container.querySelector('[aria-label="Open navigation menu"]'));
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(document.activeElement.getAttribute('href')).toBe('/');
  await click(document.querySelector('[data-testid="sheet-nav-movies"]'));
  expect(view.container.querySelector('#bms-route-content').textContent).toBe('/movies');
});
test.each(['admin', 'partner'])('%s keeps account, bookings, workspace and logout access', async role => {
  const logout = jest.fn();
  useAuth.mockReturnValue({ user: { role, name: 'Fixture member' }, isAuthenticated: true, logout });
  const view = await render(<MemoryRouter><Navbar /><Location /></MemoryRouter>);
  expect(view.container.querySelector(`[href="/${role}"]`)).not.toBeNull();
  await click(view.container.querySelector('[aria-label="Open navigation menu"]'));
  expect(document.querySelector('[data-testid="sheet-nav-my-bookings"]')).not.toBeNull();
  expect(document.querySelector(`[data-testid="sheet-nav-${role}"]`)).not.toBeNull();
  await click(document.querySelector('[data-testid="sheet-logout"]'));
  expect(logout).toHaveBeenCalledTimes(1);
});
