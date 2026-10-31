// Shared route policy. Sensitive workflows bypass motion on BOTH sides of a visit.
export const SCENE_EASE = [0.22, 1, 0.36, 1];
export const NAV_LINKS = [
  { to: '/', label: 'Home', id: 'nav-home', number: '01' },
  { to: '/movies', label: 'Movies', id: 'nav-movies', number: '02' },
  { to: '/cinemas', label: 'Cinemas', id: 'nav-cinemas', number: '03' },
  { to: '/ai-search', label: 'Assistant', id: 'nav-assistant', number: '04' },
  { to: '/contact', label: 'Contact Us', id: 'nav-contact', number: '05' },
];
export function routeTreatment(path) {
  if (/^\/(booking(?:\/|-|$)|checkout(?:\/|$)|my-bookings(?:\/|$)|admin(?:\/|$)|partner(?:\/|$))/.test(path)) return 'none';
  if (path === '/' || path === '/cinemas' || path === '/movies' || path.startsWith('/movie/')) return 'spatial';
  return 'quiet';
}
export function routeLabel(path) {
  if (path.startsWith('/movie/')) return 'The film';
  if (path.startsWith('/admin')) return 'Administration';
  if (path.startsWith('/partner')) return 'Partner workspace';
  return NAV_LINKS.find(link => link.to === path)?.label || ({ '/auth': 'Your account', '/my-bookings': 'My bookings', '/checkout': 'Checkout', '/booking-success': 'Booking status' }[path]) || 'BookMySeat';
}
export function historyDirection(previousIndex, nextIndex, action) {
  // React Router's own per-tab history indices, not guessed route ranks or timestamps.
  if (action === 'POP' && Number.isInteger(previousIndex) && Number.isInteger(nextIndex) && previousIndex !== nextIndex) return nextIndex < previousIndex ? -1 : 1;
  return 1;
}
export function isNavActive(to, path) {
  return to === '/movies' ? path === '/movies' || path.startsWith('/movie/') : to === path || (to !== '/' && path.startsWith(to + '/'));
}

// Standard Tab navigation plus the existing optional arrow/Home/End shortcuts.
export function moveNavFocus(event) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
  if (!delta && !['Home', 'End'].includes(event.key)) return;
  const links = [...event.currentTarget.querySelectorAll('a[data-nav-link]')].filter(link => link.getClientRects().length);
  const current = links.indexOf(document.activeElement);
  if (current < 0 || !links.length) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : (current + delta + links.length) % links.length;
  links[next].focus();
}
