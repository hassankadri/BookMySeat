import React from 'react';
import axios from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MovieDetails from './MovieDetails';
import { click, render } from '../test-support/render';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { error: jest.fn() } }));
function Destination() { const location = useLocation(); return <pre data-testid="destination">{location.pathname + location.search}</pre>; }
function tree(entry) {
  return <MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/movie/:id" element={<MovieDetails />} />
    <Route path="/booking/:id" element={<Destination />} />
    <Route path="/cinemas" element={<Destination />} />
  </Routes></MemoryRouter>;
}
beforeEach(() => { localStorage.clear(); });
afterEach(() => jest.restoreAllMocks());
test('deep link filters foreign/past sessions and passes the selected movie/show/theatre to booking', async () => {
  const movie = { _id: 'movie-1', title: 'Fixture film', genre: 'Drama', duration: 120 };
  const current = { _id: 'show-1', movie, theatre: { _id: 'venue-1', name: 'Fixture venue' }, screen: { name: 'Screen 1' }, status: 'SCHEDULED', startTime: new Date(Date.now() + 86400000).toISOString(), price: 250 };
  const shows = [current, { ...current, _id: 'foreign', theatre: { _id: 'other' } }, { ...current, _id: 'past', startTime: '2000-01-01T00:00:00Z' }, { ...current, _id: 'wrong-film', movie: { _id: 'other-film' } }];
  jest.spyOn(axios, 'get').mockImplementation(url => Promise.resolve({ data: url.includes('/movies/') ? { movie } : { shows } }));
  localStorage.setItem('bookmyseat_theatre', 'stale-venue');
  const view = await render(tree('/movie/movie-1?theatre=venue-1'));
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/shows'), expect.objectContaining({ params: { movie: 'movie-1', theatre: 'venue-1', status: 'SCHEDULED' } }));
  const sessions = [...view.container.querySelectorAll('button')].filter(b => b.textContent.includes('Starts at'));
  expect(sessions).toHaveLength(1);
  await click(sessions[0]);
  expect(view.container.querySelector('[data-testid="destination"]').textContent).toBe('/booking/movie-1?show=show-1&theatre=venue-1');
  expect(localStorage.getItem('bookmyseat_show')).toBe('show-1');
  expect(localStorage.getItem('bookmyseat_theatre')).toBe('venue-1');
});
test('a fresh movie deep link without a cinema requires theatre selection', async () => {
  jest.spyOn(axios, 'get');
  const view = await render(tree('/movie/movie-1'));
  expect(view.container.querySelector('[data-testid="destination"]').textContent).toBe('/cinemas');
  expect(axios.get).not.toHaveBeenCalled();
});
