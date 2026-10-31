# BookMySeat V2 change manifest

## Phase 0 — audit and implementation plan, 16 October 2026

Branch: `feature/cinematic-ui-v2`. Application source unchanged. Backend, environment, dependencies, Docker, infrastructure and GitHub unchanged. No files removed. No commits, pushes, merges, PRs or deployments.

Created:

- `FEATURE_PARITY.md` — 45 workflow entries with old behavior, proposed implementation, contracts and honest verification status.
- `CHANGE_MANIFEST.md` — this manifest.
- `docs/cinematic-v2/AUDIT_AND_PLAN.md` — architecture, findings, online technique research, art direction, staged plan and evidence.
- `docs/cinematic-v2/audit-source.cjs` — local static inventory generator using already-installed Babel dependencies; reads application files and writes only its reports.
- `docs/cinematic-v2/SOURCE_INVENTORY.json` — source hashes, imports, routes, HTTP requests, socket calls, storage, states, effects, action handlers, navigation and provider locations.
- `docs/cinematic-v2/CONTRACT_INDEX.md` — readable generated route/endpoint/middleware/request/storage index.
- `docs/cinematic-v2/probe-local.cjs` — localhost GET-only smoke checks; no credentials, seat/payment/queue/contact mutations.
- `docs/cinematic-v2/RUNTIME_CHECKS.json` — observed response codes, shapes and collection counts; no sensitive response bodies.

Generated side effects: production build regenerated ignored `frontend/build/` artifacts and normal build/test caches. No application/dependency source was changed by those checks.

Pre-existing user work preserved:

- Modified: `frontend/src/App.js`, `frontend/src/components/home/sections/Opening.jsx`.
- Untracked: `frontend/src/components/cinematic/CinematicUI.jsx`, `frontend/src/components/home/sections/opening-v2.css`, `frontend/src/styles/cinematic-v2.css`.

Checks: production build PASS with warnings; configured CRACO test command FAIL; direct React Scripts tests PASS (21/21); standalone lint FAIL (missing ESLint 9 configuration); static inventory PASS; read-only HTTP smoke PASS (15 checks); browser public discovery-to-auth flow PASS. Authenticated/financial/real-time conflict workflows remain UNVERIFIED. See audit for exact commands and limitations.

Next phase: await the user's staged implementation prompt; keep updating this manifest and FEATURE_PARITY after every authorized phase.

## Batch 1 — tooling repair and critical regression protection, 17 October 2026

Branch remains `feature/cinematic-ui-v2`. All changes are local. No runtime application source, backend logic, database, infrastructure, dependency version, lockfile, environment file or original test changed. No UI redesign. No commit, push, merge, reset, rebase, GitHub operation or deployment. The five pre-existing user changes listed above remain preserved. All 153 original audited JavaScript/JSX source hashes match; protected tracked Git diff is empty.

Paths below are relative to `D:\My Projects\BookMySeat-main new`. CREATE/MODIFY describes this batch, not Git's untracked status (the Phase 0 documents were already present but uncommitted).

Validation codes: **T** = standard test command, 10 suites/78 tests passed (21 existing + 57 new); **L** = ESLint, 0 errors/7 existing warnings; **B** = production build passed; **P** = source/protected-diff/artifact/lint-rule verification passed; **S** = read-only route/API smoke, detailed in the report. All mock/fixture code is test-only. Live payment, multi-client locking and role-specific end-to-end results are not inferred from T/S.

| Exact path | Action | Reason | Existing behavior preserved | Validation |
|---|---|---|---|---|
| `frontend/package.json` | MODIFY | Route test script directly through installed React Scripts; add lint script and Jest alias/router mappings for installed Jest 27/package exports | Existing runner/dependencies, CRACO build/start and runtime routing unchanged | T, L, B |
| `frontend/eslint.config.cjs` | CREATE | ESLint 9 flat configuration for JS/JSX, React, hooks, browser/Node/Jest globals and generated-output exclusions | Reports existing warnings without broad source cleanup; correctness errors enabled | L, P invalid-hooks/undefined/unused rule probe |
| `frontend/src/setupTests.js` | CREATE | Text encoder/browser shims, deterministic test API/key fixtures and motion boundary | Runtime environment and application unchanged; no real service calls | T, L |
| `frontend/src/test-support/render.js` | CREATE | React 18 render/act, interaction, deferred-promise, timer and cleanup helpers | Real components/controllers run in jsdom | T, L |
| `frontend/src/test-support/motion.js` | CREATE | Stable presentation-only motion boundary | Business state and effects remain real in controller tests; animation performance not claimed | T, L |
| `frontend/src/test-support/socket.js` | CREATE | Controlled Socket.IO event/ack double | Runtime socket implementation/protocol untouched | T, L |
| `frontend/src/test-support/RouteProbe.jsx` | CREATE | Observe real provider/router state at page boundaries | Real App/providers/router under test; role UI not replaced at runtime | T, L |
| `frontend/src/App.contract.test.jsx` | CREATE | 9 auth/provider/route tests including all 26 paths | Provider order, auth semantics, nested shell and route/query contracts | T, L |
| `frontend/src/components/VirtualQueueGate.test.jsx` | CREATE | 9 admission/interceptor/lifecycle tests | Queue tokens, header/events and module singleton interceptor lifetime | T, L |
| `frontend/src/pages/Booking.test.jsx` | CREATE | 8 hold/release/conflict/expiry/socket/handoff tests | Server-confirmed selection, request payloads, cleanup, authoritative snapshot and storage | T, L |
| `frontend/src/utils/seatEventRecovery.test.js` | CREATE | 7 replay/snapshot race/reconnect/cleanup tests | Existing recovery algorithm and event protocol | T, L |
| `frontend/src/pages/BookingSuccess.test.jsx` | CREATE | 16 authoritative recovery and polling tests | Both server confirmation fields required; historical return gap stays visible | T, L |
| `frontend/src/pages/Checkout.contract.test.jsx` | CREATE | 6 restore/quote/expiry/navigation tests | Exact intent/release payloads, server price/expiry, Stripe boundary untouched in runtime | T, L |
| `frontend/src/pages/MovieDetails.contract.test.jsx` | CREATE | 2 theatre/movie/show selection tests | Existing filtering, storage and route/query contract | T, L |
| `docs/cinematic-v2/verify-batch1.cjs` | CREATE | Repeatable read-only source hash, protected Git diff, artifact and lint-rule checks | Original audit artifacts read only; writes separate evidence | P |
| `docs/cinematic-v2/batch1-smoke.cjs` | CREATE | GET-only original HTTP checks plus all route HTML fallbacks; optional local frontend origin | No credentials, mutation or protected service configuration changes | S |
| `docs/cinematic-v2/BATCH1_TEST_RESULTS.json` | CREATE | Actual final Jest JSON evidence | Original 21 tests included; no skipped tests/snapshot substitutions | T, result totals inspected |
| `docs/cinematic-v2/BATCH1_LINT_RESULTS.json` | CREATE | Actual final ESLint JSON evidence | No warnings suppressed through source edits | L, totals inspected |
| `docs/cinematic-v2/BATCH1_LINT_BASELINE.json` | CREATE | Final-rule findings restricted to unchanged original source | Distinguishes 7 original warnings from 0 introduced findings | L, original source hashes checked |
| `docs/cinematic-v2/BATCH1_PROTECTION_CHECKS.json` | CREATE | Actual preservation, artifact and lint-rule probe results | Original source and audit reports unchanged | P |
| `docs/cinematic-v2/BATCH1_SMOKE_INITIAL.json` | CREATE | Preserve initial wrong-service smoke results on port 3000 | No alteration of the other local app; failed checks not hidden | S, wrong target identified as Clawbit AI |
| `docs/cinematic-v2/BATCH1_SMOKE_RESULTS.json` | CREATE | Final GET-only smoke results for actual BookMySeat target | Original Phase 0 runtime artifact preserved | S, see report for final counts/environment |
| `docs/cinematic-v2/BATCH1_REPORT.md` | CREATE | Commands, results, coverage boundaries, warnings, readiness and limitations | Historical findings and unresolved gaps remain explicit | Checked against JSON evidence and Git/source verification |
| `FEATURE_PARITY.md` | MODIFY | Append Batch 1 evidence against workflow IDs | All 45 original workflows and end-to-end release gate retained | Checked against T/B/L/P/S evidence |
| `CHANGE_MANIFEST.md` | MODIFY | Append this exact per-file change record | Phase 0 manifest and original user-change record retained | File list compared with local changes |

Generated side effects: ignored `frontend/build/` output and normal test/build caches regenerated. A temporary dev-server port/host override was process-local; no `.env` or infrastructure edits. The temporary server was stopped after 41/41 final smoke checks passed. The original audit scripts and artifacts are preserved. See `docs/cinematic-v2/BATCH1_REPORT.md` for complete results, failed attempts and remaining verification boundaries. Ready for controlled Batch 2; no redesign started.
