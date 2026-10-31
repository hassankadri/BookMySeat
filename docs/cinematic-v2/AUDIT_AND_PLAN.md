# BookMySeat V2 — local audit and staged implementation plan

Audit date: 16 October 2026, Asia/Calcutta. Workspace: `D:\My Projects\BookMySeat-main new`. Branch verified: `feature/cinematic-ui-v2`. HEAD: `bffc0ba` (`Save BookMySeat UI before cinematic redesign`). The source of truth is the working copy, including pre-existing uncommitted changes. This phase creates audit artifacts only; implementation follows the user's staged prompts.

## 1. Baseline and boundaries

At entry Git reported modified `frontend/src/App.js` and `frontend/src/components/home/sections/Opening.jsx`, plus untracked `frontend/src/components/cinematic/`, `frontend/src/components/home/sections/opening-v2.css`, and `frontend/src/styles/`. Their existing implementation is retained. No application source, backend, dependency manifests, lockfiles, environment files, Docker, infrastructure, or GitHub configuration was edited. No Git write operation, commit, push, merge, PR, deployment, seed or migration was performed. A production build regenerated ignored `frontend/build` output and normal tool caches.

No applicable AGENTS.md was found in the workspace search or checked ancestor paths. No agents were delegated. Credentials were not read from `memory/test_credentials.md`; no authentication/email/payment submissions were made.

The source inventory parsed **153 JavaScript/JSX files**, with **0 syntax parse errors**, covering **26 browser routes**, **89 backend handler declarations**, **41 middleware/mount declarations**, **108 transport calls**, **28 socket-related calls**, **59 storage operations**, **547 hook bindings**, **130 effects**, **436 JSX event handlers**, **99 navigation/state handoff entries**, and **7 provider placements**. These are source occurrence counts, including unused/compatibility modules, not counts of unique working features. Backup `.bak` and `.before-*` files and build/dependency trees are excluded. Every source entry has a file/line reference; application source hashes are recorded.

Read [CONTRACT_INDEX.md](CONTRACT_INDEX.md) for routes, requests and storage; [SOURCE_INVENTORY.json](SOURCE_INVENTORY.json) for exact arguments and state/action/effect details; [FEATURE_PARITY.md](../../FEATURE_PARITY.md) for workflow-level mapping. Static extraction captures declarations; it does not resolve every dynamic URL or prove runtime reachability. Dynamic request targets are resolved below and in the parity ledger. Full transactional and role-based verification remains outstanding.

## 2. Existing frontend architecture

React 18, React Router, CRA/react-scripts with CRACO, Tailwind, scoped and global CSS, Framer Motion, Three.js, Axios, Socket.IO, Stripe React/JS SDKs, Radix primitives, Recharts, QR generation and html5-qrcode are already installed. No framework migration or new animation stack is justified. Keep existing package versions in this phase.

`index.js` renders StrictMode. `App.js` mounts `AuthProvider > BookingProvider > BrowserRouter`, a persistent Navbar, reading-progress indicator, route tree and Toaster. AuthProvider owns JWT session validation, login/OTP/reset/Google functions and cross-tab storage changes. BookingProvider owns in-memory movie/show/date/time/selectedSeats and merge/reset actions. Do not key or relocate either provider during visual navigation.

The route tree is currently keyed by pathname, except every `/admin` route shares the key `admin`. Top-level pages are eagerly imported. This preserves the nested admin shell but will remount most route trees on pathname changes. Query-only navigation does not change that key. A new transition wrapper must not add another remount layer or delay queue/checkout effects. Checkout mounts its own Stripe Elements; its lifetime must follow the actual checkout visit, never poster animation keys.

Booking creates its own `io(...)` connection. `services/socket.js` also defines an autoConnect:false singleton, but Booking does not import it. Retain the actual active connection rather than accidentally mounting both. `attachSeatEventRecovery` attaches to that connection and removes only its own listeners.

The homepage already has a substantial camera-driven Three.js hall. HallScene lazy-loads HallStage, observes visibility and document visibility, pauses the projection, and disposes its resources. Capability selection falls back for reduced motion, save-data, missing WebGL2 and low-core narrow devices. The current renderer targets a pixel budget but still loops while visible; it throttles quiet frames rather than fully stopping. The Godzilla projection is a DOM video mapped onto the screen plane. Preserve it.

Existing UI families include `components/ui/*`, `components/home/primitives/*`, `components/cinematic/CinematicUI.jsx`, adminTheme, BookingCinema, CheckoutCinema, home.css, legacy-sections.css, red-preview.css and cinematic-v2.css. Consolidation should be incremental and scoped. Avoid a late global override sheet that changes every form or seat control.

Legacy/unwired candidates include `BookingSuccessOriginal.jsx`, `StripePaymentForm.jsx`, `admin/ListShows.jsx`, `admin/ListBookings.jsx`, `admin/AdminResourceList.jsx`, and the standalone socket singleton. Their presence alone does not establish a working route. Preserve until import/reachability and historical compatibility checks are complete; no cleanup deletion in this audit.

## 3. Routes, state and data contracts

The 26 exact paths are listed in the contract index. The journey is `/` → `/cinemas` or directly selected `/movies?theatre=…&city=…` → `/movie/:id?theatre=…` → `/booking/:movieId?show=…&theatre=…` → `/checkout` → `/booking-success?bookingId=…` → `/my-bookings`. Authentication lives at `/auth`. `/booking-cancel` currently renders Home. `/ai-search` and `/contact` remain separate routes. Admin has a stable `/admin` shell and 11 children. Partners use `/partner` and `/partner/new-show`. No wildcard route currently exists.

Public movie/show/theatre reads have different envelope shapes: `{movies}`, `{shows}`, `{theatres}`, single movie `{movie}`, single show `{success,show}`. Cinema/film pages include compatibility handling and API-base fallbacks. Do not simplify to a universal response shape without verified adapters. Rendering bookable sessions must use actual scheduled show IDs, active venue/screen status and India Standard Time. A preview asset is not proof of a scheduled movie.

State that must survive visual changes:

- `token` in localStorage, JWT ACCESS/expiry validation, `/api/auth/me`, role checks, cross-tab login/logout. Authentication logic is protected by the directive.
- `bookmyseat_city`, `bookmyseat_theatre`, `bookmyseat_theatre_name`, `bookmyseat_show`: finder/assistant/movie/show handoff. URL parameters must retain precedence where currently implemented.
- `bookmyseat_seat_hold` and `bookmyseat_checkout` in sessionStorage: selected IDs, lockId and authoritative expiry. Checkout can recover from router state or sessionStorage; the display total is not authoritative pricing.
- `bms:queue:admission:<showId>`: admission token and expiry. Global Axios interceptors attach `X-Queue-Admission` to hold requests and emit `bms:queue-admission-required` on rejection. Lazy-loading QueueGate changes interceptor registration timing; retain an explicit stable registration boundary if splitting it.
- `bookmyseat_seat_event_cursor:<showId>`: best-effort replay cursor. Replay cannot establish present availability; REST snapshots and current holds remain authoritative.
- Assistant session history and theatre scope, homepage intro/session state, admin filters and unsaved forms. Full per-file bindings/effect dependencies and storage key expressions are recorded in SOURCE_INVENTORY.json.

Critical backend boundaries:

| Operation | Request / response and invariant |
|---|---|
| Hold | POST `/api/seat-locks/hold` with bearer token, queue admission where enabled, `{showId,seatIds}`. Returns `lockId`, `seats`, `expiresAt`, `expiresIn`. Keep conflict errors, max 10, active-seat/category handling and server ownership checks. |
| Release | DELETE `/api/seat-locks/release` with body `{showId,seatIds,lockId}` and bearer token. Do not convert this to query parameters or optimistic authoritative availability. |
| Availability | GET `/api/shows/:id` for screen/bookedSeats and `/api/seat-locks/:showId` for lockedSeats. Preserve periodic refresh, reconnect reconciliation and expiry cleanup. |
| Socket rooms/replay | `show:join` accepts showId payload and ACK; server emits `show:joined`; `show:leave` cleans room; `show:replay` takes `{showId,after,limit}` with ACK, cooldown and pagination. `seats:held` includes seatIds/expiry; released/booked events update live state. Exact calls in inventory. |
| Queue | Public GET config, authenticated POST join/status/leave. UI uses status polling; server join and status share entry logic. Admission token expiry and queue-required recovery must work after history/refresh. |
| Payment | POST `/api/payments/create-intent` `{showId,seatIds,lockId}`. Backend fraud guards/mutex/core validate and reuse/create intent. Response amount/currency/seats/expiry are authoritative. Stripe Elements owns sensitive card fields. No payment action from animation completion. |
| Confirmation | GET `/api/payments/recovery/:bookingId`; render confirmed only for BOTH CONFIRMED bookingStatus and paymentState. Preserve AWAITING_WEBHOOK, PAYMENT_PENDING, PAYMENT_FAILED, PAYMENT_RETRY_AVAILABLE, CANCELLED, EXPIRED, REFUND_PENDING, REFUNDED, REVIEW_REQUIRED and delayed/error/manual retry UI. |
| Customer refunds | Paid cancellation uses refund-request; unpaid uses cancel. Keep backend eligibility and requested-review state. Customer request is not an immediate refund. |
| Staff refund/check-in | Distinct cancel, manual refund and approve-refund routes; verify ticket before check-in; used/cancelled/refunded QR must not admit. Never exercise money movement during visual QA. |
| Partner authorization | `/api/partner/theatres/:theatreId` subtree inherits partner authentication and owned-theatre guard. Screen editing, booking visibility and show creation must stay scoped. |
| Dynamic pricing | Admin policy endpoints and `dynamicPricingService` determine quotes; preserve category rules, policy values, server total and INR units. No frontend pricing simulation. |

Models inventoried: User, Movie, Theatre, Screen, Show, Booking, BookedSeat, Refund, DynamicPricingPolicy and NotificationLog. Redis services include seat locks, event stream/replay, virtual queue, expiry and notification workers. Stripe webhook mounting precedes JSON body parsing and owns confirmation. These are read-only boundaries. Endpoint duplicates in the index represent real preflight/compatibility chains, not permission to remove one.

## 4. Existing findings and risks

**A. Favorites has no complete functional contract.** `components/home/useHomeData.js:325` calls GET `/api/movies/favorites/list`, and line 382 posts `/api/movies/:id/favorite`. `backend/routes/movies.js` has no corresponding handlers; runtime GET returned 404. `Home.jsx` does not pass `favIds` or `onToggleFavorite` to Programme, even though Programme renders the heart control. Backend-dependent resolution would require explicitly authorized authenticated favorite persistence/read routes; frontend-only work can make the unavailable state honest, but cannot claim persistence. Do not implement backend changes in V2 without permission.

**B. Legacy checkout is intentionally retired.** `backend/routes/bookings.js:25` returns 410 `LEGACY_CHECKOUT_RETIRED` before the old checkout implementation. Historical verification remains at `bookingsLegacyCompat.js:470`, and history at line 936. Current `BookingSuccess.jsx:212` reads only `bookingId`; no active frontend call to `/verify-payment` was found. Preserve the backend boundary; investigate historical redirect URL/session inputs in a safe test environment before claiming complete historical frontend parity. Do not reactivate the insecure legacy purchase path.

**C. Standard test and lint commands are not healthy.** `npm test -- --watchAll=false --runInBand` reaches `TypeError: babelJest.createTransformer is not a function` after the sandbox filesystem restriction is removed. The installed CRACO 5 / react-scripts 5 toolchain needs a small, deliberate frontend tooling repair. Direct React Scripts runs all existing tests successfully. ESLint 9 cannot find `eslint.config.(js|mjs|cjs)`; no lint script is defined. Build's CRACO warning says it cannot find eslint-loader, so a successful build must not be reported as clean lint.

**D. Route payload and animation lifetimes are fragile.** `App.js:136` keys the route tree; top-level pages are all eagerly imported. `App.js:127` resets scroll on pathname changes, including browser history. Preserve true back/forward restoration during the shell phase and test checkout/queue state explicitly. No route-level cinematic transition currently joins these pages.

**E. Existing trailer wheel interception conflicts with the new no-scroll-jacking requirement.** `Programme.jsx:141–260` captures wheel input inside the rightmost 20% and calls preventDefault. Replace with explicit next/previous/picker and optional deliberate drag, keeping touch/keyboard parity. This is a proposed frontend behavior change for the authorized homepage phase.

**F. Media/network/motion budgets need measured work.** Programme uses `preload="auto"` for active and next trailers; play state begins true even when reduced-motion is requested. Hall mode handles reduced motion, but the trailer reel needs separate review. Godzilla MP4 is 9,467,370 bytes; Xbot.glb 2,930,032 bytes. Existing optimized clips range roughly 4–10 MB. Do not fetch every clip up front. HallStage continuously schedules frames while visible, including ~46 ms quiet draws; its DPR lower bound of 1 can exceed its pixel budget on large canvases. Neither code inspection nor successful rendering proves 60 FPS.

**G. CSS/typography overlap and current art direction.** Homepage imports three legacy style sheets plus the new global cinematic tokens and opening styles. The baseline screenshot shows a large 3D hall and useful finder but a rectangular framing treatment, prominent conventional nav and many rounded controls. Continue from this real local implementation; do not replace it with a static black/red template. Inspect typography loads, global selectors and portal styles before consolidation.

**H. Existing artificial refresh delay.** `MyBookings.jsx:257` imposes a 650 ms minimum refresh duration. In its authorized phase, remove artificial waiting while keeping real pending feedback. Do not let animations gate booking actions.

**I. Runtime provenance and test limits.** Existing localhost services were already running; they were not restarted. Browser/API checks prove observed service behavior but do not establish that every server process loaded this exact working-copy revision. No authenticated role tests, financial operations, email delivery, camera access or 60 FPS measurements were performed.

## 5. Research and original creative direction

Research completed before defining this direction. These are technique references, not layouts to copy. Text/case-study research is distinguished from hands-on visual/performance testing of those sites; no claim that their runtime was profiled.

- [14islands — Cartier 365](https://www.14islands.com/work/cartier365): the studio documents a chapter-based 2024/2025 yearbook with an intro organized around a recurring theme, across many articles and languages. Takeaway for BookMySeat: a consistent transition grammar can connect separate page compositions without turning booking into one scrolling page.
- [Lusion](https://lusion.co/): its studio describes combining 3D storytelling, motion and development. [CSS Design Awards' 2023 winners](https://www.cssdesignawards.com/blog/2023-website-of-the-year-winners/394/) lists Lusion v3 as Best Agency Site. Takeaway: concentrate authored spatial craft in the foyer, and preserve semantic DOM actions above it. No claim that a particular shader or camera implementation was inspected.
- [Siena Film Foundation](https://www.siena.film/): a film-led archive pairs individual works with credits and film metadata. Takeaway: use film identity, production credits and screening context to structure the detail page; do not copy its layout or require device rotation.
- [Radix Dialog](https://www.radix-ui.com/primitives/docs/components/dialog): modal focus management, Escape handling, titles/descriptions. Reuse already-installed primitives for menus/dialogs while retaining domain behavior.
- [Motion reduced motion](https://motion.dev/docs/react-use-reduced-motion) and [MotionConfig](https://www.motion.dev/docs/react-motion-config): apply a user preference policy and explicitly control video/parallax as well as transforms. Continue using installed `framer-motion` imports; no package migration implied by current docs.
- [Three.js rendering on demand](https://threejs.org/manual/pages/rendering-on-demand.html): only render when the scene needs it where feasible. Preserve deliberate active camera movement, stop offscreen work, and profile quiet scenes.

**Direction: a continuous cinema visit, from foyer to admission.** Charcoal architectural surfaces, off-white editorial type, crimson #D71935 as a wayfinding/action color, restrained warm projection light. Spatial reveals explain movement between rooms; operational screens remain precise and stable. Use the existing Bricolage/Instrument Sans typography as the first candidate after verifying loaded weights and readability; choose a consistent display/text pair, not new typefaces on every route. No meaningless particles, colored glow frames or stock dashboard styling.

| Surface | Composition and useful interaction | Mobile / reduced-motion alternative |
|---|---|---|
| Home | Authored architectural foyer; finder immediately accessible; short optional camera chapters; Godzilla screen retained | Poster/CSS hall with finder first; no scroll capture; direct chapter links |
| Cinemas | Venue directory with strong photography and city index; selection changes genuine availability | Stacked locations, clear city filter, full-width touch selection |
| Movies | Editorial programme: large film names, alternating poster scale, compact real screening metadata | Search/filter first; compact film rows with explicit Details & tickets |
| Film | Asymmetric dossier; poster becomes visual anchor; date rail and sessions occupy a distinct programme area | Film identity then date/session controls; no hover-only information |
| Booking / queue | Auditorium hierarchy and server states; stable seat map, focused summary, actionable queue status | Touch navigation, readable legend, accessible seat list/map controls; no camera movement |
| Checkout / result | Calm admission-ticket composition, persistent price/expiry/errors; clear pending vs confirmed | Single-column form and summary; no transform of Stripe Elements |
| My bookings | Ticket archive grouped/filterable by true status; QR appears only when valid | Full-width ticket and explicit actions; manageable dialogs |
| Assistant / support | Concierge conversation / editorial support desk, each with a distinct information hierarchy | Keyboard-friendly input, visible pending/errors and touch targets |
| Admin / partner | Shared operational shell, task-specific data layouts and forms; scanner gets dedicated space | Responsive tables/details and drawers; negligible decorative motion |

## 6. Implementation sequence and acceptance gates

The user requested staged prompts. Phase 0 is this audit. The following phases are proposed and require the corresponding next prompt; they are not claimed implemented. At every stage update FEATURE_PARITY and CHANGE_MANIFEST, list every changed/created/removed file, run available checks and fix new regressions before dependent work.

1. **Frontend baseline repair and test harness.** Repair the frontend test/lint entry points with the smallest compatible configuration change; no blind package upgrades. Establish meaningful tests for queue admission, seat reconciliation and payment outcome rendering before changing their presentation. Keep test fixtures in tests, never runtime data. Gate: standard build/test/lint usable, failures triaged, protected backend files unchanged, F01–F45 mapped.
2. **Persistent shell, tokens and navigation.** Consolidate opt-in tokens/primitives; retain providers; split heavy admin/scanner/chart/editorial route imports where safe. Use Framer Motion as the sole route transition owner. Keep one active route/controller tree; animate an editorial visual surface and poster proxy rather than keeping duplicate transactional pages alive. Determine direction from navigation type/history; handle POP, direct links, query changes, focus and scroll restoration. Do not introduce GSAP or View Transitions simultaneously. Gate: every original URL reachable; back/forward/query/refresh correct; no extra auth fetch, queue join or PaymentIntent caused by animation; keyboard menus verified.
3. **Foyer and discovery.** Refine existing hall/lighting, preserve Godzilla, add explicit low-motion/video controls, remove wheel capture, control asset preload. Rebuild cinema directory and film programme around real data and theatre-first filtering. Gate: public journey plus empty/loading/error/retry, actual media fallback, touch and reduced-motion passes; measured frame/network budget before escalating visual complexity.
4. **Film dossier and showtime continuity.** Shared poster identity across discovery/details; real date/session selection and trailer controls, upcoming/no-show handling, existing search params/storage maintained. Gate: selected movie/theatre/show IDs survive all entry paths, no false scheduled data, dates validated in IST.
5. **Queue and seating presentation.** Retain hold/release/replay/expiry controller behavior; upgrade map/category/legend/summary and accessible keyboard/touch controls. Gate: two clients compete for one seat; hold expiry, refresh, disconnect/reconnect, event-during-snapshot, queued admission expiry and recommendation conflict all pass against the real test backend. No payment yet.
6. **Checkout, confirmation and ticket archive.** Preserve Elements, backend totals, lock ID/expiry, payment retry/double-submit guards and authoritative recovery. Change presentation only; investigate legacy historical return gap without reactivating retired checkout. Gate: verified Stripe test environment, test decline/3DS/pending/webhook delay/review/refund states, refresh/back/deep-link behavior; ticket valid/invalid/used cases. Never run actual charges for visual tests.
7. **Account, concierge and support.** Restyle auth without changing authentication logic; complete assistant context/history and support error states. Gate: registration/reset/resend/Google on appropriate test credentials/provider setup; no synthetic recommendation or email-delivery success claims. Resolve favorites scope explicitly.
8. **Administration and partner operations.** Convert each existing operational route and all CRUD/policy/refund/assignment/scanner actions to the shared visual system. Preserve data ownership and permissions. Gate: admin/customer/partner role matrix, unowned theatre denial, scheduling overlap, screen layouts, pricing caps, ticket reuse and refund-review semantics verified on disposable test records.
9. **Final verification and performance pass.** Cross-route regression, responsive layouts at 360/390/768/1280/1440 widths, keyboard/zoom/reduced motion, missing images/video/context loss, stale session and offline cases. Record real production-profile traces, route bytes, LCP/CLS/INP where measurable, long tasks and frame distributions on named hardware. Gate: no new failures, every parity row has explicit evidence or user-accepted limitation, protected-file diff clean, final visual review delivered. Local only; no deploy or Git writes.

Suggested measurable targets, **not results**: 60 FPS during intended desktop camera/route movement (roughly 16.7 ms frame budget), no avoidable long tasks over 50 ms during input, CLS below 0.1, LCP within 2.5 s on the defined test profile, INP at or below 200 ms when measured with enough interaction data. Establish a reproducible profile first; do not promise those values from a build report. Reduce initial route JS through actual chunk analysis before assigning a realistic byte budget.

## 7. Verification performed

| Check | Result | Evidence / limit |
|---|---|---|
| Local access/branch/changes | PASS | Correct local path and feature branch; entry diff documented; original uncommitted files retained; final SHA-256 comparison found no changes in all 153 indexed source files; protected-path Git diff empty |
| Static parse/inventory | PASS | 153 JS/JSX files; 0 parse errors; full generated source index |
| Production build | PASS with warnings | `npm run build`, exit 0; main JS **541.46 kB gzip**, main CSS **39.03 kB gzip**, large async chunk **160.54 kB gzip**. This is output size, not runtime FPS or load time. |
| Build diagnostics | WARN | CRACO missing eslint-loader; old caniuse-lite dataset; ambiguous Tailwind duration utilities; missing html5-qrcode upstream TypeScript source maps; large bundle warning. No dependency updates performed. |
| Configured test command | FAIL | `npm test -- --watchAll=false --runInBand`: initial sandbox EPERM, approved retry reaches `babelJest.createTransformer is not a function`; no tests executed through this command |
| Existing tests via direct installed runner | PASS | `node node_modules/react-scripts/scripts/test.js --watchAll=false --runInBand`: **3 suites, 21 tests**, exit 0; schedule, quad mapping, capabilities. Initial sandbox EPERM required approved retry. Does not cover transactions. |
| Lint | FAIL | `npm exec --no -- eslint src`: ESLint 9.39.4 cannot locate flat configuration. No lint script in package.json. |
| Read-only localhost API smoke | PASS, limited | **15 checks** in RUNTIME_CHECKS.json: public data shapes, theatre filter, show/screen, current holds, queue configuration, four anonymous 401 guards, favorites 404 confirmation. No mutations submitted. |
| Browser customer entry | PASS, limited | Home finder → theatre-scoped Movies → The Odyssey details → real screening → `/auth`, with login notice. No seats held or payment initiated. |
| Browser visual observation | PASS, limited | Homepage screenshot inspected: hall/finder/navigation render. No claim of responsive, accessibility or FPS completion. |
| Authenticated role/queue/seat/payment/refund/scanner/email/AI tests | UNVERIFIED / BLOCKED for dependent credentials/setup | Need appropriate test accounts, Stripe test environment/webhook availability, email/Google/AI provider setup and camera access as applicable. No secrets requested in chat. |

The audit is a concrete starting point, not certification of full feature parity or completion of the redesign. The next authorized stage should address the tooling baseline and persistent shell before transactional presentation changes.
