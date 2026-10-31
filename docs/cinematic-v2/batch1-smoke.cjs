// GET-only recheck. Preserve Phase 0 artifacts and write a separate Batch 1 result.
const fs = require('fs');
const path = require('path');
const baseline = require('./RUNTIME_CHECKS.json');
const inventory = require('./SOURCE_INVENTORY.json');
const results = [];
const frontendOrigin = process.argv[2] || 'http://localhost:3000';
const target = new URL(frontendOrigin);
if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.protocol !== 'http:') throw new Error('Only a local HTTP frontend is allowed');
async function check(url, expected, html = false, keys = []) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const contentType = response.headers.get('content-type') || '';
    let shapeMatches = true;
    if (html) shapeMatches = contentType.includes('text/html') && (await response.text()).includes('id="root"');
    else if (keys.length) {
      const data = await response.json();
      shapeMatches = keys.every(key => Object.prototype.hasOwnProperty.call(data, key));
    }
    results.push({ url, expected, actual: response.status, shapeMatches, status: response.status === expected && shapeMatches ? 'PASS' : 'FAIL' });
  } catch (error) {
    results.push({ url, status: 'BLOCKED', error: error.cause?.code || error.message });
  }
}
async function main() {
  // Original public/anonymous checks only: never replay POST/DELETE operations.
  for (const entry of baseline.checks) await check(entry.url.replace('http://localhost:3000', frontendOrigin), entry.expected, false, entry.keys);
  const sampleMovie = baseline.checks.find(entry => /\/api\/movies\/[a-f\d]{24}$/.test(entry.url))?.url.split('/').pop();
  if (!sampleMovie) throw new Error('No audited movie ID available for deep-link checks');
  for (const route of inventory.routes) {
    const pathname = route.path.replace(':id', sampleMovie);
    await check(frontendOrigin + pathname, 200, true);
  }
  const report = { frontendOrigin, scope: '15 public/anonymous GET checks plus 26 SPA HTML fallback checks. HTML availability is not authenticated React workflow or production hosting certification. No credentials or mutation requests.', results };
  fs.writeFileSync(path.join(__dirname, 'BATCH1_SMOKE_RESULTS.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (results.some(result => result.status !== 'PASS')) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
