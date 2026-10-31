// Read-only smoke checks against the existing local app. No sign-in or mutations.
const fs = require('fs');
const path = require('path');
const checks = [];
async function get(url, expected, validate) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const json = (response.headers.get('content-type') || '').includes('application/json');
    const data = json ? await response.json() : null;
    const valid = !validate || validate(data);
    checks.push({ url, expected, actual: response.status, status: response.status === expected && valid ? 'PASS' : 'FAIL', shapeValid: Boolean(valid), keys: data && typeof data === 'object' ? Object.keys(data) : [], counts: data ? Object.fromEntries(Object.entries(data).filter(([,v]) => Array.isArray(v)).map(([k,v]) => [k,v.length])) : {} });
    return data;
  } catch (error) {
    checks.push({ url, status: 'BLOCKED', error: error.cause?.code || error.message });
    return null;
  }
}
async function main() {
  const api = 'http://localhost:5000/api';
  await get('http://localhost:3000/', 200);
  await get(`${api}/`, 200, d => d?.status === 'ok');
  const [movies, theatres, shows] = await Promise.all([
    get(`${api}/movies`, 200, d => Array.isArray(d?.movies)),
    get(`${api}/theatres`, 200, d => Array.isArray(d?.theatres)),
    get(`${api}/shows?status=SCHEDULED`, 200, d => Array.isArray(d?.shows)),
  ]);
  const show = shows?.shows?.[0];
  const movieId = show?.movie?._id || movies?.movies?.[0]?._id;
  const theatreId = show?.theatre?._id || theatres?.theatres?.[0]?._id;
  if (movieId) await get(`${api}/movies/${encodeURIComponent(movieId)}`, 200, d => Boolean(d?.movie));
  if (theatreId) await get(`${api}/shows?theatre=${encodeURIComponent(theatreId)}&status=SCHEDULED`, 200, d => Array.isArray(d?.shows) && d.shows.every(s => String(s.theatre?._id || s.theatre) === String(theatreId)));
  if (show?._id) {
    await get(`${api}/shows/${show._id}`, 200, d => Boolean(d?.show?.screen));
    await get(`${api}/seat-locks/${show._id}`, 200, d => Array.isArray(d?.lockedSeats));
    await get(`${api}/queue/shows/${show._id}`, 200);
  }
  for (const endpoint of ['/auth/me', '/admin/stats', '/customer-bookings', '/partner/theatres']) await get(api + endpoint, 401);
  await get(`${api}/movies/favorites/list`, 404);
  const output = { scope: 'Unauthenticated localhost GET checks only. No payment, seat hold, queue join, contact, email or database mutation requested.', checks };
  fs.writeFileSync(path.join(__dirname, 'RUNTIME_CHECKS.json'), JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify(output, null, 2));
  if (checks.some(c => c.status !== 'PASS')) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
