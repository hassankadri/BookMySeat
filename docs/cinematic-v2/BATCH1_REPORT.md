# BookMySeat V2 Batch 1 — implementation results

Date: 17 October 2026. Workspace: `D:\My Projects\BookMySeat-main new`. Branch: `feature/cinematic-ui-v2`.

## Implementation

The standard frontend test script now uses the already-installed `react-scripts test`. CRACO 5.9.0's Jest adapter calls `babelJest.createTransformer` on an incompatible export shape in installed Babel/Jest 27.5.1. React Scripts 5.0.1 already runs the existing tests correctly; bypassing only CRACO's test adapter is the smallest fix. Build/start still use CRACO. No dependency was installed, upgraded or removed; React/React DOM remain 18.3.1 and ESLint remains 9.39.4.

Jest keeps the existing `@/` alias and maps React Router 7.14.1 to its actual shipped CommonJS entries. Installed `react-router-dom` has a legacy main pointing to missing `dist/main.js`, while Jest 27 does not resolve its modern exports as the bundler does. Exact test-only mappings target `react-router-dom/dist/index.js` and `react-router/dist/development/dom-export.js`. Tests use the real router. Runtime imports and bundler configuration remain unchanged.

The ESLint 9 flat config checks meaningful JS, JSX and hook errors, identifies unused variables, sets correct browser/config/test globals, and excludes dependencies/builds/generated audit data. Unused bindings and exhaustive hook dependencies remain visible warnings; invalid hook calls and undefined identifiers are errors. An in-memory invalid sample confirms all three rule categories are active. No application file was edited to silence warnings.

The exact **25 changed files**, with CREATE/MODIFY, reasons, preservation boundaries and validation, are listed in `CHANGE_MANIFEST.md`. Original audit documents and the user's five existing source/style changes are preserved. `FEATURE_PARITY.md` now distinguishes new mocked regression evidence from unresolved end-to-end checks.

## Automated regression coverage

| Suite | Tests | Meaningful checks |
|---|---:|---|
| Existing schedule, quadrilateral, capability suites | 21 | All original tests retained and passing |
| `App.contract.test.jsx` | 9 | Real providers/router, no extra auth requests on navigation, token/role semantics, rejected-token cleanup, cross-tab logout, all 26 routes, nested admin persistence and fresh deep links |
| `VirtualQueueGate.test.jsx` | 9 | Admission header/token validation, required/expired admission, navigation persistence, singleton interceptor registration, page listener/timer cleanup and failure states |
| `Booking.test.jsx` | 8 | Exact hold/release payloads, only server-confirmed selection, conflict/release failure, expiry/restore, live events/cleanup, reconnect snapshot and checkout handoff |
| `seatEventRecovery.test.js` | 7 | Replay cursor, REST authority, snapshot races, timeout, cooldown, cleanup and reconnect invalidation |
| `BookingSuccess.test.jsx` | 16 | Pending, confirmed, failed, retry, expired, refund pending/refunded, review, cancelled, bounded polling/manual retry, abort and access failure; both server confirmation fields required |
| `Checkout.contract.test.jsx` | 6 | Session restoration, router precedence, malformed/missing storage, server quote/expiry, exact intent/release payloads and back link |
| `MovieDetails.contract.test.jsx` | 2 | Movie/theatre/time-scoped show selection, query/storage handoff and missing-cinema redirect |
| **Total** | **78** | **10 suites; 21 existing + 57 new; 0 failed, 0 skipped, 0 snapshots** |

Controller tests mock network/socket/Stripe boundaries and presentation animation, while exercising the existing logic. App route tests stub page boundaries but retain the real App, providers and router. Queue tests inspect/call real Axios interceptors; existing module-scoped interceptors intentionally survive page unmount, while per-page timers and listeners are cleaned up. These tests do not certify physical Stripe Elements behavior, actual animation lifecycle, real multi-client seats or backend correctness.

## Commands and observed results

Run frontend commands from `D:\My Projects\BookMySeat-main new\frontend`; run evidence scripts from the workspace root.

| Command | Actual result |
|---|---|
| `npm test -- --watchAll=false --runInBand --json --outputFile=../docs/cinematic-v2/BATCH1_TEST_RESULTS.json` | PASS — 10 suites/78 tests, original 21 retained, no skipped tests; 9.344 seconds in final recorded run |
| `npm run lint -- --format json --output-file ../docs/cinematic-v2/BATCH1_LINT_RESULTS.json` | PASS — exit 0, 0 errors, 7 pre-existing warnings; no introduced findings |
| `npm run build` | PASS — exit 0 with existing warnings; main bundle 541.46 kB gzip, same `main.29e5c56d.js` as Phase 0 |
| `node docs/cinematic-v2/verify-batch1.cjs` | PASS — correct branch; all 153 original source hashes unchanged; protected tracked diff empty; all 3 audit artifacts exist; lint rule probe effective |
| `node docs/cinematic-v2/batch1-smoke.cjs http://127.0.0.1:3010` | PASS — 41/41 checks: 15 original public/anonymous GET checks plus 26 SPA HTML fallbacks |
| `git status --short`, `git diff`, `git diff --name-only HEAD -- backend docker-compose.yml .github monitoring frontend/Dockerfile frontend/nginx.conf frontend/craco.config.js frontend/package-lock.json` | Read-only verification; no protected tracked differences |
| `git diff --check` | PASS — no whitespace errors in tracked diff |

The standard test command initially encountered the Windows sandbox's native realpath EPERM restriction and was rerun with execution approval. Initial added tests exposed the Jest/router entry resolution issue; the test-only mappings resolved it. These are resolved execution/tooling failures, not hidden skipped tests. The final passing command uses the repaired standard npm script, with JSON output added solely for evidence.

The first smoke run targeted the audit's former frontend on port 3000: 15 response-code/envelope checks passed, but all 26 React root/fallback checks failed. GET inspection identified another app, Clawbit AI, at that origin. The initial results are preserved in `BATCH1_SMOKE_INITIAL.json`; they are not BookMySeat regressions. Port 3001 was also occupied, so the attempted dev startup exited without replacing its service. A temporary BookMySeat server was started with process-only `PORT=3010`, `HOST=127.0.0.1`, `BROWSER=none` and `npm start`. It compiled with the existing warnings. Final smoke checks on that origin and the existing API on port 5000 passed 41/41. The temporary server was stopped after validation; the other services were left untouched.

HTTP checks assert expected status/envelope keys and that all route URLs return HTML containing the React root. The original unsupported favorites endpoint still returns its expected 404; that passing contract check does not mean favorites work. Anonymous protected endpoints still reject with 401. These checks do not execute a browser workflow, certify production-host fallback/CORS, or prove authenticated page authorization.

## Existing warnings

ESLint reports 7 warnings in unchanged source:

| File and line | Warning |
|---|---|
| `frontend/src/pages/admin/AddShow.jsx:16` | Unused `easing` |
| `frontend/src/pages/admin/AddShow.jsx:191` | Effect missing `loadInitial` dependency |
| `frontend/src/pages/admin/AdminAnalytics.jsx:286` | Conditional `trend` expression may change useMemo dependencies |
| `frontend/src/pages/admin/AdminDynamicPricing.jsx:8` | Unused `SlidersHorizontal` |
| `frontend/src/pages/admin/AdminUsers.jsx:20` | Unused `UserRoundCog` |
| `frontend/src/pages/admin/ListBookings.jsx:17` | Effect missing `fetchBookings` dependency |
| `frontend/src/pages/admin/ListShows.jsx:17` | Effect missing `fetchShows` dependency |

The baseline artifact is the final config's findings restricted to original files whose hashes match the Phase 0 inventory. No unrelated hook refactor was made.

Production build retains CRACO's missing eslint-loader warning, Node `fs.F_OK` deprecation, older Browserslist data, ambiguous Tailwind duration classes, upstream html5-qrcode missing source maps and large-bundle guidance. Standalone lint provides the usable check; this batch does not upgrade the build chain to remove those existing warnings. Dev startup additionally reports webpack-dev-server middleware deprecations.

## Preservation and limitations

Backend source, auth, payment, queue, Socket.IO and recovery runtime logic remain untouched. All 153 originally inventoried source files match their recorded hashes. No database/Redis/Stripe changes, migrations, seeds, real booking/hold/payment/refund requests, customer notifications or authenticated service mutations were performed. All such requests in automated tests use dedicated doubles. Environment files, infrastructure and dependency lockfile remain unchanged.

All work is local. No commit, push, merge, reset, rebase, PR, GitHub write or deployment occurred. Ignored build/cache outputs were regenerated normally.

Unsupported favorites endpoints, historical session-only checkout return, trailer wheel interception and bundle size remain documented and unchanged. Real payment end-to-end testing is BLOCKED pending a verified safe environment. Real multi-client contention, live queue admission/reconnect, role-specific end-to-end permissions, email delivery, ticket/refund flows, browser visual/accessibility/mobile/performance behavior remain UNVERIFIED. A passing mock or HTTP fallback check is not an end-to-end certification.

## Batch 2 readiness

**Ready for the controlled Batch 2 implementation.** Batch 1's tooling, test, build, source-preservation and safe smoke criteria are satisfied, with no unresolved Batch 1 execution blocker. The explicit end-to-end gaps above remain release gates for the full V2 project. No Batch 2 visual or navigation change has been started.
