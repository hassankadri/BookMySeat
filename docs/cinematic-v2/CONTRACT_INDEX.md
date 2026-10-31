# Source contract index

Generated with `node docs/cinematic-v2/audit-source.cjs`. This is a static index of the local source, not proof that integrations work. Mounted route prefixes must be read with router middleware below. Every entry has a source location. Full state initializers, effect dependencies, action handlers, imports, HTTP arguments and storage operations are in SOURCE_INVENTORY.json.

Parsed 153 application/backend JavaScript files; 0 parse errors.

## Browser routes

| Route | Element | Source |
|---|---|---|
| / | {<Home />} | frontend/src/App.js:142 |
| /movies | {<Movies />} | frontend/src/App.js:143 |
| /cinemas | {<Cinemas />} | frontend/src/App.js:144 |
| /movie/:id | {<MovieDetails />} | frontend/src/App.js:145 |
| /booking/:id | { <VirtualQueueGate> <Booking /> </VirtualQueueGate> } | frontend/src/App.js:148 |
| /checkout | {<Checkout />} | frontend/src/App.js:157 |
| /auth | {<Auth />} | frontend/src/App.js:158 |
| /my-bookings | {<MyBookings />} | frontend/src/App.js:159 |
| /booking-success | {<BookingSuccess />} | frontend/src/App.js:160 |
| /booking-cancel | {<Home />} | frontend/src/App.js:161 |
| /contact | {<Contact />} | frontend/src/App.js:162 |
| /ai-search | {<AiSearch />} | frontend/src/App.js:163 |
| /partner | {<PartnerHome />} | frontend/src/App.js:166 |
| /partner/new-show | {<PartnerShowtimeCreate />} | frontend/src/App.js:167 |
| /admin | {<Admin />} | frontend/src/App.js:173 |
| /admin/analytics | {<AdminAnalytics />} | frontend/src/App.js:174 |
| /admin/movies | {<AdminMovies />} | frontend/src/App.js:178 |
| /admin/theatres | {<AdminTheatres />} | frontend/src/App.js:182 |
| /admin/screens | {<AdminScreens />} | frontend/src/App.js:186 |
| /admin/add-show | {<AddShow />} | frontend/src/App.js:190 |
| /admin/shows | {<AdminShows />} | frontend/src/App.js:194 |
| /admin/pricing | {<AdminDynamicPricing />} | frontend/src/App.js:198 |
| /admin/risk | {<AdminRiskMonitoring />} | frontend/src/App.js:202 |
| /admin/users | {<AdminUsers />} | frontend/src/App.js:206 |
| /admin/bookings | {<AdminBookings />} | frontend/src/App.js:210 |
| /admin/scanner | {<TicketScanner />} | frontend/src/App.js:214 |

## Server route declarations

Local paths below include all handlers, including compatibility and preflight handlers. They are not all unique public endpoints. See mount table for prefixes and inherited guards.

| Method | Local path | Middleware | Source |
|---|---|---|---|
| GET | / |  | backend/routes/adminAnalytics.js:1367 |
| POST | /ai-insights |  | backend/routes/adminAnalytics.js:1415 |
| GET | /stats |  | backend/routes/adminCore.js:193 |
| GET | /users |  | backend/routes/adminCore.js:340 |
| PATCH | /users/:id/role |  | backend/routes/adminCore.js:456 |
| GET | /bookings |  | backend/routes/adminCore.js:570 |
| POST | /bookings/:id/cancel |  | backend/routes/adminCore.js:708 |
| POST | /bookings/:id/refund |  | backend/routes/adminCore.js:842 |
| GET | /shows |  | backend/routes/adminCore.js:1150 |
| GET | /movies |  | backend/routes/adminCore.js:1251 |
| GET | /theatres |  | backend/routes/adminCore.js:1291 |
| GET | /screens |  | backend/routes/adminCore.js:1333 |
| GET | / |  | backend/routes/adminDynamicPricing.js:162 |
| GET | /:showId |  | backend/routes/adminDynamicPricing.js:228 |
| PUT | /:showId |  | backend/routes/adminDynamicPricing.js:270 |
| GET | /partners |  | backend/routes/adminPartnerAssignments.js:28 |
| GET | /theatres |  | backend/routes/adminPartnerAssignments.js:57 |
| PATCH | /users/:userId |  | backend/routes/adminPartnerAssignments.js:91 |
| PATCH | /theatres/:theatreId |  | backend/routes/adminPartnerAssignments.js:198 |
| GET | / |  | backend/routes/adminRisk.js:97 |
| POST | /assistant |  | backend/routes/ai.js:3457 |
| POST | /search |  | backend/routes/ai.js:3939 |
| POST | /register | otpSendLimiter, [ body("name") .trim() .isLength({ min: 2, max: 80, }) .withMessage( "Name must be between 2 and 80 characters." ), body("email") .trim() .isEmail() .withMessage( "Valid email is required." ) .normalizeEmail(), body("password") .isString() .isLength({ min: 8, max: 128, }) .withMessage( "Password must be between 8 and 128 characters." ), ] | backend/routes/auth.js:470 |
| POST | /verify-email | otpVerifyLimiter, [ body("email") .trim() .isEmail() .normalizeEmail(), body("otp") .isString() .matches( /^\d{6}$/ ), ] | backend/routes/auth.js:697 |
| POST | /resend-verification | otpSendLimiter, [ body("email") .trim() .isEmail() .normalizeEmail(), ] | backend/routes/auth.js:881 |
| POST | /forgot-password | otpSendLimiter, [ body("email") .trim() .isEmail() .normalizeEmail(), ] | backend/routes/auth.js:1036 |
| POST | /verify-reset-otp | otpVerifyLimiter, [ body("email") .trim() .isEmail() .normalizeEmail(), body("otp") .isString() .matches( /^\d{6}$/ ), ] | backend/routes/auth.js:1175 |
| POST | /reset-password | otpVerifyLimiter, [ body("resetToken") .isString() .notEmpty(), body("password") .isString() .isLength({ min: 8, max: 128, }) .withMessage( "Password must be between 8 and 128 characters." ), ] | backend/routes/auth.js:1348 |
| POST | /google | googleLimiter, [ body("credential") .isString() .notEmpty() .withMessage( "Google credential is required." ), ] | backend/routes/auth.js:1510 |
| POST | /login | loginLimiter, [ body("email") .trim() .isEmail() .normalizeEmail(), body("password") .isString() .isLength({ min: 1, max: 128, }), ] | backend/routes/auth.js:1706 |
| GET | /me | auth | backend/routes/auth.js:1833 |
| POST | /checkout |  | backend/routes/bookings.js:25 |
| POST | /checkout | auth | backend/routes/bookingsLegacyCompat.js:208 |
| POST | /verify-payment | auth | backend/routes/bookingsLegacyCompat.js:470 |
| GET | /my-bookings | auth | backend/routes/bookingsLegacyCompat.js:936 |
| POST | / | contactRateLimit, [ body("fullName") .trim() .isLength({ min: 2, max: 80, }) .withMessage( "Please enter your name." ), body("email") .trim() .isEmail() .normalizeEmail() .withMessage( "Please enter a valid email." ), body("phone") .optional({ checkFalsy: true, }) .trim() .isLength({ max: 25, }), body("subject") .trim() .isLength({ min: 2, max: 100, }) .withMessage( "Please select a subject." ), body("message") .trim() .isLength({ min: 5, max: 3000, }) .withMessage( "Message must be between 5 and 3000 characters." ), ] | backend/routes/contact.js:80 |
| GET | / | auth | backend/routes/customerBookings.js:339 |
| POST | /:id/refund-request | auth | backend/routes/customerBookings.js:390 |
| POST | /:id/cancel | auth | backend/routes/customerBookings.js:560 |
| POST | /admin/refund-requests/:id/approve | auth, adminAuth | backend/routes/customerBookings.js:679 |
| GET | / |  | backend/routes/movies.js:119 |
| GET | /admin/all | auth, adminAuth | backend/routes/movies.js:158 |
| POST | / | auth, adminAuth | backend/routes/movies.js:169 |
| PUT | /:id | auth, adminAuth | backend/routes/movies.js:209 |
| DELETE | /:id | auth, adminAuth | backend/routes/movies.js:261 |
| GET | /:id |  | backend/routes/movies.js:289 |
| GET | /screens |  | backend/routes/partnerOperations.js:102 |
| PATCH | /screens/:screenId |  | backend/routes/partnerOperations.js:142 |
| GET | /shows |  | backend/routes/partnerOperations.js:236 |
| POST | /shows |  | backend/routes/partnerOperations.js:284 |
| GET | /bookings |  | backend/routes/partnerOperations.js:629 |
| GET | / |  | backend/routes/partnerTheatres.js:49 |
| GET | /:theatreId/screens/:screenId | requireOwnedTheatre | backend/routes/partnerTheatres.js:85 |
| GET | /:theatreId | requireOwnedTheatre | backend/routes/partnerTheatres.js:175 |
| PATCH | /:theatreId | requireOwnedTheatre | backend/routes/partnerTheatres.js:191 |
| POST | /create-intent | auth, paymentIntentAbuseGuard, observePaymentRisk | backend/routes/payments.js:76 |
| GET | /recovery/:bookingId | auth | backend/routes/payments.js:227 |
| POST | /create-intent | auth | backend/routes/paymentsCore.js:63 |
| GET | / |  | backend/routes/screens.js:39 |
| GET | /:id |  | backend/routes/screens.js:86 |
| POST | / | adminAuth | backend/routes/screens.js:131 |
| POST | /:id/layout | adminAuth | backend/routes/screens.js:243 |
| PUT | /:id | adminAuth | backend/routes/screens.js:367 |
| DELETE | /:id | adminAuth | backend/routes/screens.js:429 |
| GET | /:showId | auth | backend/routes/seatIntelligence.js:34 |
| POST | /hold | auth, seatHoldFraudGuard, observeSeatHoldRisk | backend/routes/seatLocks.js:59 |
| DELETE | /release | auth | backend/routes/seatLocks.js:271 |
| GET | /:showId |  | backend/routes/seatLocks.js:339 |
| GET | / |  | backend/routes/shows.js:422 |
| GET | /:id |  | backend/routes/shows.js:680 |
| POST | / | adminAuth | backend/routes/shows.js:780 |
| PUT | /:id | adminAuth | backend/routes/shows.js:947 |
| DELETE | /:id | adminAuth | backend/routes/shows.js:1154 |
| POST | / |  | backend/routes/stripeWebhook.js:608 |
| GET | / |  | backend/routes/theatres.js:111 |
| GET | /:id |  | backend/routes/theatres.js:182 |
| POST | / | adminAuth | backend/routes/theatres.js:250 |
| PUT | /:id | adminAuth | backend/routes/theatres.js:366 |
| DELETE | /:id | adminAuth | backend/routes/theatres.js:486 |
| POST | /verify | adminAuth | backend/routes/tickets.js:154 |
| POST | /check-in | adminAuth | backend/routes/tickets.js:278 |
| GET | /shows/:showId |  | backend/routes/virtualQueue.js:37 |
| POST | /shows/:showId/join | auth, handleJoin | backend/routes/virtualQueue.js:167 |
| POST | /shows/:showId/status | auth, handleJoin | backend/routes/virtualQueue.js:173 |
| POST | /shows/:showId/leave | auth | backend/routes/virtualQueue.js:184 |
| PATCH | /admin/shows/:showId | auth, adminAuth | backend/routes/virtualQueue.js:240 |
| GET | /api/ |  | backend/server.js:364 |
| GET | /api/metrics | metricsHandler | backend/server.js:383 |
| POST | /api/seat-locks/hold | auth, requireQueueAdmission | backend/server.js:430 |

## Router mounts and middleware

| Path | Middleware / child router | Source |
|---|---|---|
| /risk | "/risk", require("./adminRisk") | backend/routes/admin.js:12 |
| /partner-assignments | "/partner-assignments", require("./adminPartnerAssignments") | backend/routes/admin.js:24 |
| (same prefix) | require("./adminCore") | backend/routes/admin.js:37 |
| (same prefix) | auth, adminAuth | backend/routes/adminAnalytics.js:19 |
| (same prefix) | auth, adminAuth | backend/routes/adminCore.js:46 |
| (same prefix) | auth, adminAuth | backend/routes/adminDynamicPricing.js:13 |
| (same prefix) | auth, adminAuth | backend/routes/adminPartnerAssignments.js:21 |
| (same prefix) | auth, adminAuth | backend/routes/adminRisk.js:80 |
| (same prefix) | ( req, res, next ) => { res.setHeader( "Cache-Control", "no-store, no-cache, must-revalidate, private" ); res.setHeader( "Pragma", "no-cache" ); next(); } | backend/routes/auth.js:91 |
| (same prefix) | require("./bookingsLegacyCompat") | backend/routes/bookings.js:51 |
| (same prefix) | auth, partnerAuth | backend/routes/partnerTheatres.js:21 |
| /:theatreId | "/:theatreId", requireOwnedTheatre, partnerOperations | backend/routes/partnerTheatres.js:397 |
| (same prefix) | require("./paymentsCore") | backend/routes/payments.js:386 |
| (same prefix) | (req, res, next) => { const requestId = req.get("X-Request-Id") \|\| crypto.randomUUID(); req.requestId = requestId; res.setHeader( "X-Request-Id", requestId ); next(); } | backend/server.js:194 |
| (same prefix) | metricsMiddleware | backend/server.js:213 |
| (same prefix) | helmet({ crossOriginResourcePolicy: { policy: "cross-origin", }, hsts: isProduction ? undefined : false, }) | backend/server.js:219 |
| (same prefix) | cors({ origin: (origin, callback) => { if (!origin) { return callback(null, true); } if ( allowedOriginSet.has( normalizeOrigin(origin) ) ) { return callback(null, true); } const error = new Error("CORS_ORIGIN_BLOCKED"); error.status = 403;… | backend/server.js:235 |
| /api/webhooks/stripe | "/api/webhooks/stripe", express.raw({ type: "application/json", limit: "1mb", }), stripeWebhookRoutes | backend/server.js:302 |
| /api | "/api", apiLimiter | backend/server.js:333 |
| (same prefix) | express.json({ limit: "1mb", strict: true, }) | backend/server.js:339 |
| (same prefix) | express.urlencoded({ extended: false, limit: "1mb", parameterLimit: 100, }) | backend/server.js:346 |
| /api/auth | "/api/auth", authRoutes | backend/server.js:392 |
| /api/movies | "/api/movies", movieRoutes | backend/server.js:393 |
| /api/theatres | "/api/theatres", theatreRoutes | backend/server.js:394 |
| /api/screens | "/api/screens", screenRoutes | backend/server.js:395 |
| /api/shows | "/api/shows", showRoutes | backend/server.js:396 |
| /api/queue | "/api/queue", virtualQueueRoutes | backend/server.js:411 |
| /api/seat-locks | "/api/seat-locks", seatLockRoutes | backend/server.js:436 |
| /api/payments | "/api/payments", paymentRoutes | backend/server.js:445 |
| /api/bookings | "/api/bookings", bookingRoutes | backend/server.js:450 |
| /api/admin | "/api/admin", adminRoutes | backend/server.js:459 |
| /api/admin/pricing | "/api/admin/pricing", adminDynamicPricingRoutes | backend/server.js:464 |
| /api/tickets | "/api/tickets", ticketRoutes | backend/server.js:473 |
| /api/contact | "/api/contact", contactRoutes | backend/server.js:478 |
| /api/admin/analytics | "/api/admin/analytics", adminAnalyticsRoutes | backend/server.js:487 |
| /api/customer-bookings | "/api/customer-bookings", customerBookingRoutes | backend/server.js:496 |
| /api/ai | "/api/ai", aiRoutes | backend/server.js:505 |
| /api/seat-intelligence | "/api/seat-intelligence", seatIntelligenceRoutes | backend/server.js:507 |
| /api/partner/theatres | "/api/partner/theatres", partnerTheatreRoutes | backend/server.js:516 |
| (same prefix) | (req, res) => { return res.status(404).json({ error: "API route not found.", requestId: req.requestId, }); } | backend/server.js:525 |
| (same prefix) | (err, req, res, next) => { console.error( `[${req.requestId}]`, err.stack \|\| err ); if ( err.message === "CORS_ORIGIN_BLOCKED" ) { return res.status(403).json({ error: "This origin is not allowed.", requestId: req.requestId, }); } if ( err.… | backend/server.js:536 |

## Frontend requests

| Call | URL / argument | Source |
|---|---|---|
| axios.get | `${apiUrl.replace(/\/+$/, "")}/api/seat-intelligence/${encodeURIComponent(showId)}` | frontend/src/components/SeatIntelligencePanel.jsx:100 |
| stripe.confirmPayment | { elements, confirmParams: { return_url: `${window.location.origin}/my-bookings`, }, /** * Normal cards stay on this page. * * Stripe only redirects when the payment * method actually requires it, such as 3DS. */ redirect: "if_required", } | frontend/src/components/StripePaymentForm.jsx:46 |
| axios.post | `${QUEUE_API}/${showId}/status` | frontend/src/components/VirtualQueueGate.jsx:303 |
| axios.get | `${QUEUE_API}/${showId}` | frontend/src/components/VirtualQueueGate.jsx:408 |
| axios.post | `${QUEUE_API}/${showId}/leave` | frontend/src/components/VirtualQueueGate.jsx:604 |
| axios.get | `${API}/api/queue/shows/${showId}` | frontend/src/components/admin/ShowQueueControls.jsx:89 |
| axios.patch | `${API}/api/queue/admin/shows/${showId}` | frontend/src/components/admin/ShowQueueControls.jsx:293 |
| axios.get | `${API_URL}/api/shows` | frontend/src/components/home/useHomeData.js:184 |
| axios.get | `${API_URL}/api/movies` | frontend/src/components/home/useHomeData.js:190 |
| axios.get | `${API_URL}/api/theatres` | frontend/src/components/home/useHomeData.js:196 |
| axios.get | `${API_URL}/api/movies` | frontend/src/components/home/useHomeData.js:198 |
| axios.get | `${API_URL}/api/movies/favorites/list` | frontend/src/components/home/useHomeData.js:325 |
| axios.post | `${API_URL}/api/movies/${movieId}/favorite` | frontend/src/components/home/useHomeData.js:382 |
| axios.get | `${API_URL}/api/auth/me` | frontend/src/context/AuthContext.jsx:341 |
| axios.post | `${API_URL}/api/auth/login` | frontend/src/context/AuthContext.jsx:441 |
| axios.post | `${API_URL}/api/auth/google` | frontend/src/context/AuthContext.jsx:499 |
| axios.post | `${API_URL}/api/auth/register` | frontend/src/context/AuthContext.jsx:549 |
| axios.post | `${API_URL}/api/auth/verify-email` | frontend/src/context/AuthContext.jsx:600 |
| axios.post | `${API_URL}/api/auth/resend-verification` | frontend/src/context/AuthContext.jsx:639 |
| axios.post | `${API_URL}/api/auth/forgot-password` | frontend/src/context/AuthContext.jsx:685 |
| axios.post | `${API_URL}/api/auth/verify-reset-otp` | frontend/src/context/AuthContext.jsx:728 |
| axios.post | `${API_URL}/api/auth/reset-password` | frontend/src/context/AuthContext.jsx:768 |
| axios.get | `${API_URL}/api/theatres` | frontend/src/pages/AiSearch.jsx:233 |
| axios.post | `${API_URL}/api/ai/assistant` | frontend/src/pages/AiSearch.jsx:384 |
| axios.get | `${API_URL}/api/shows/${showId}` | frontend/src/pages/Booking.jsx:298 |
| axios.get | `${API_URL}/api/seat-locks/${showId}` | frontend/src/pages/Booking.jsx:381 |
| axios.post | `${API_URL}/api/seat-locks/hold` | frontend/src/pages/Booking.jsx:775 |
| axios.delete | `${API_URL}/api/seat-locks/release` | frontend/src/pages/Booking.jsx:858 |
| axios.delete | `${API_URL}/api/seat-locks/release` | frontend/src/pages/Booking.jsx:1065 |
| axios.post | `${API_URL}/api/seat-locks/hold` | frontend/src/pages/Booking.jsx:1753 |
| axios.get | `${API_URL}/api/payments/recovery/${encodeURIComponent( bookingId )}` | frontend/src/pages/BookingSuccess.jsx:298 |
| axios.get | `${API_URL}/api/bookings/my-bookings` | frontend/src/pages/BookingSuccessOriginal.jsx:222 |
| stripe.confirmCardPayment | clientSecret | frontend/src/pages/Checkout.jsx:263 |
| axios.get | `${API_URL}/api/shows/${showId}` | frontend/src/pages/Checkout.jsx:301 |
| axios.post | `${API_URL}/api/payments/create-intent` | frontend/src/pages/Checkout.jsx:882 |
| axios.get | `${API_URL}/api/shows/${checkout.showId}` | frontend/src/pages/Checkout.jsx:896 |
| axios.delete | `${API_URL}/api/seat-locks/release` | frontend/src/pages/Checkout.jsx:989 |
| axios.get | endpoint | frontend/src/pages/Cinemas.jsx:238 |
| axios.post | `${API_URL}/api/contact` | frontend/src/pages/Contact.jsx:147 |
| axios.get | `${base}/api${path}` | frontend/src/pages/MovieDetails.jsx:126 |
| axios.get | endpoint | frontend/src/pages/Movies.jsx:109 |
| axios.get | `${API_URL}/api/customer-bookings` | frontend/src/pages/MyBookings.jsx:227 |
| axios.post | url | frontend/src/pages/MyBookings.jsx:299 |
| axios.get | `${API}/api/movies/admin/all` | frontend/src/pages/admin/AddShow.jsx:158 |
| axios.get | `${API}/api/admin/theatres` | frontend/src/pages/admin/AddShow.jsx:159 |
| axios.get | `${API}/api/screens` | frontend/src/pages/admin/AddShow.jsx:208 |
| axios.get | `${API}/api/screens/${id}` | frontend/src/pages/admin/AddShow.jsx:257 |
| axios.post | `${API}/api/shows` | frontend/src/pages/admin/AddShow.jsx:457 |
| axios.get | `${API_URL}/api/admin/stats` | frontend/src/pages/admin/Admin.jsx:379 |
| axios.post | `${API_URL}/api/admin/analytics/ai-insights` | frontend/src/pages/admin/AdminAnalytics.jsx:100 |
| axios.get | `${API_URL}/api/admin/analytics` | frontend/src/pages/admin/AdminAnalytics.jsx:236 |
| axios.get | `${API_URL}/api/admin/bookings` | frontend/src/pages/admin/AdminBookings.jsx:180 |
| axios.post | path | frontend/src/pages/admin/AdminBookings.jsx:425 |
| axios.get | ENDPOINT | frontend/src/pages/admin/AdminDynamicPricing.jsx:171 |
| axios.get | `${ENDPOINT}/${encodeURIComponent(showId)}` | frontend/src/pages/admin/AdminDynamicPricing.jsx:205 |
| axios.put | `${ENDPOINT}/${encodeURIComponent(selectedId)}` | frontend/src/pages/admin/AdminDynamicPricing.jsx:365 |
| axios.put | `${API}/api/movies/${movie._id}` | frontend/src/pages/admin/AdminMovies.jsx:104 |
| axios.post | `${API}/api/movies` | frontend/src/pages/admin/AdminMovies.jsx:105 |
| axios.get | `${API}/api/movies/admin/all` | frontend/src/pages/admin/AdminMovies.jsx:190 |
| axios.put | `${API}/api/movies/${movie._id}` | frontend/src/pages/admin/AdminMovies.jsx:257 |
| axios.delete | `${API}/api/movies/${movie._id}` | frontend/src/pages/admin/AdminMovies.jsx:258 |
| axios.get | `${API_URL}/api/admin/${type}` | frontend/src/pages/admin/AdminResourceList.jsx:86 |
| axios.get | ENDPOINT | frontend/src/pages/admin/AdminRiskMonitoring.jsx:100 |
| axios.put | `${API}/api/screens/${screen._id}` | frontend/src/pages/admin/AdminScreens.jsx:234 |
| axios.post | `${API}/api/screens` | frontend/src/pages/admin/AdminScreens.jsx:235 |
| axios.get | `${API}/api/admin/screens` | frontend/src/pages/admin/AdminScreens.jsx:373 |
| axios.get | `${API}/api/admin/theatres` | frontend/src/pages/admin/AdminScreens.jsx:374 |
| axios.get | `${API}/api/screens/${focused._id}` | frontend/src/pages/admin/AdminScreens.jsx:444 |
| axios.get | `${API}/api/screens/${screen._id}` | frontend/src/pages/admin/AdminScreens.jsx:466 |
| axios.delete | `${API}/api/screens/${screen._id}` | frontend/src/pages/admin/AdminScreens.jsx:484 |
| axios.put | `${API}/api/screens/${screen._id}` | frontend/src/pages/admin/AdminScreens.jsx:485 |
| axios.get | `${API}/api/screens/${id}` | frontend/src/pages/admin/AdminShows.jsx:321 |
| axios.put | `${API}/api/shows/${show._id}` | frontend/src/pages/admin/AdminShows.jsx:703 |
| axios.post | `${API}/api/shows` | frontend/src/pages/admin/AdminShows.jsx:709 |
| axios.get | `${API}/api/admin/shows` | frontend/src/pages/admin/AdminShows.jsx:1331 |
| axios.get | `${API}/api/movies/admin/all` | frontend/src/pages/admin/AdminShows.jsx:1341 |
| axios.get | `${API}/api/admin/theatres` | frontend/src/pages/admin/AdminShows.jsx:1346 |
| axios.get | `${API}/api/admin/screens` | frontend/src/pages/admin/AdminShows.jsx:1351 |
| axios.delete | `${API}/api/shows/${show._id}` | frontend/src/pages/admin/AdminShows.jsx:1641 |
| axios.put | `${API}/api/theatres/${theatre._id}` | frontend/src/pages/admin/AdminTheatres.jsx:112 |
| axios.post | `${API}/api/theatres` | frontend/src/pages/admin/AdminTheatres.jsx:113 |
| axios.get | `${API}/api/admin/theatres` | frontend/src/pages/admin/AdminTheatres.jsx:199 |
| axios.delete | `${API}/api/theatres/${venue._id}` | frontend/src/pages/admin/AdminTheatres.jsx:257 |
| axios.put | `${API}/api/theatres/${venue._id}` | frontend/src/pages/admin/AdminTheatres.jsx:258 |
| axios.get | `${API_URL}/api/admin/users` | frontend/src/pages/admin/AdminUsers.jsx:165 |
| axios.get | `${PARTNER_API}/partners` | frontend/src/pages/admin/AdminUsers.jsx:237 |
| axios.get | `${PARTNER_API}/theatres` | frontend/src/pages/admin/AdminUsers.jsx:241 |
| axios.patch | `${API_URL}/api/admin/users/${userId}/role` | frontend/src/pages/admin/AdminUsers.jsx:372 |
| axios.patch | `${PARTNER_API}/users/${targetUser._id}` | frontend/src/pages/admin/AdminUsers.jsx:438 |
| axios.patch | `${PARTNER_API}/theatres/${theatre._id}` | frontend/src/pages/admin/AdminUsers.jsx:516 |
| axios.get | `${API_URL}/api/admin/bookings` | frontend/src/pages/admin/ListBookings.jsx:21 |
| axios.get | `${API_URL}/api/admin/shows` | frontend/src/pages/admin/ListShows.jsx:21 |
| axios.post | `${API}/api/tickets/verify` | frontend/src/pages/admin/TicketScanner.jsx:264 |
| axios.post | `${API}/api/tickets/check-in` | frontend/src/pages/admin/TicketScanner.jsx:579 |
| axios.get | API | frontend/src/pages/partner/PartnerDashboard.jsx:395 |
| axios.get | `${API}/${theatreId}/${tab}` | frontend/src/pages/partner/PartnerDashboard.jsx:568 |
| axios.patch | `${API}/${selected._id}` | frontend/src/pages/partner/PartnerDashboard.jsx:728 |
| axios.patch | `${API}/${selectedId}/screens/${screenId}` | frontend/src/pages/partner/PartnerDashboard.jsx:821 |
| axios.get | `${API_URL}/api/movies` | frontend/src/pages/partner/PartnerShowtimeCreate.jsx:298 |
| axios.get | PARTNER_API | frontend/src/pages/partner/PartnerShowtimeCreate.jsx:308 |
| axios.get | `${PARTNER_API}/${form.theatreId}/screens` | frontend/src/pages/partner/PartnerShowtimeCreate.jsx:402 |
| axios.get | `${PARTNER_API}/${form.theatreId}/screens/${form.screenId}` | frontend/src/pages/partner/PartnerShowtimeCreate.jsx:496 |
| axios.post | `${PARTNER_API}/${form.theatreId}/shows` | frontend/src/pages/partner/PartnerShowtimeCreate.jsx:750 |
| axios.get | `${apiUrl}/api/shows/${showId}` | frontend/src/utils/seatEventRecovery.js:151 |

## Persistent storage operations

| Operation | Key | Source |
|---|---|---|
| sessionStorage.removeItem | admissionKey(showId) | frontend/src/components/VirtualQueueGate.jsx:57 |
| sessionStorage.setItem | admissionKey(showId) | frontend/src/components/VirtualQueueGate.jsx:63 |
| sessionStorage.getItem | admissionKey(showId) | frontend/src/components/VirtualQueueGate.jsx:77 |
| localStorage.getItem | "bookmyseat_show" | frontend/src/components/VirtualQueueGate.jsx:267 |
| sessionStorage.getItem | "bms-cinematic-opt-in" | frontend/src/components/home/sections/Opening.jsx:420 |
| sessionStorage.setItem | "bms-cinematic-opt-in" | frontend/src/components/home/sections/Opening.jsx:563 |
| localStorage.getItem | key | frontend/src/components/home/useHomeData.js:29 |
| localStorage.setItem | key | frontend/src/components/home/useHomeData.js:37 |
| localStorage.getItem | TOKEN_KEY | frontend/src/context/AuthContext.jsx:174 |
| localStorage.removeItem | TOKEN_KEY | frontend/src/context/AuthContext.jsx:183 |
| localStorage.removeItem | TOKEN_KEY | frontend/src/context/AuthContext.jsx:247 |
| localStorage.setItem | TOKEN_KEY | frontend/src/context/AuthContext.jsx:279 |
| localStorage.getItem | "bookmyseat_theatre" | frontend/src/pages/AiSearch.jsx:68 |
| localStorage.getItem | "bookmyseat_theatre_name" | frontend/src/pages/AiSearch.jsx:69 |
| localStorage.getItem | "bookmyseat_city" | frontend/src/pages/AiSearch.jsx:70 |
| sessionStorage.getItem | chatKey | frontend/src/pages/AiSearch.jsx:262 |
| sessionStorage.setItem | chatKey | frontend/src/pages/AiSearch.jsx:297 |
| localStorage.setItem | "bookmyseat_theatre" | frontend/src/pages/AiSearch.jsx:324 |
| localStorage.setItem | "bookmyseat_theatre_name" | frontend/src/pages/AiSearch.jsx:325 |
| localStorage.setItem | "bookmyseat_city" | frontend/src/pages/AiSearch.jsx:326 |
| localStorage.removeItem | "bookmyseat_theatre" | frontend/src/pages/AiSearch.jsx:338 |
| localStorage.removeItem | "bookmyseat_theatre_name" | frontend/src/pages/AiSearch.jsx:339 |
| localStorage.removeItem | "bookmyseat_city" | frontend/src/pages/AiSearch.jsx:340 |
| localStorage.setItem | "bookmyseat_show" | frontend/src/pages/AiSearch.jsx:357 |
| localStorage.setItem | "bookmyseat_theatre" | frontend/src/pages/AiSearch.jsx:358 |
| localStorage.setItem | "bookmyseat_theatre_name" | frontend/src/pages/AiSearch.jsx:359 |
| localStorage.setItem | "bookmyseat_city" | frontend/src/pages/AiSearch.jsx:360 |
| sessionStorage.removeItem | chatKey | frontend/src/pages/AiSearch.jsx:431 |
| localStorage.getItem | "bookmyseat_show" | frontend/src/pages/Booking.jsx:166 |
| localStorage.getItem | "bookmyseat_theatre" | frontend/src/pages/Booking.jsx:170 |
| sessionStorage.getItem | HOLD_KEY | frontend/src/pages/Booking.jsx:218 |
| sessionStorage.removeItem | HOLD_KEY | frontend/src/pages/Booking.jsx:230 |
| sessionStorage.removeItem | HOLD_KEY | frontend/src/pages/Booking.jsx:245 |
| sessionStorage.removeItem | HOLD_KEY | frontend/src/pages/Booking.jsx:256 |
| sessionStorage.setItem | HOLD_KEY | frontend/src/pages/Booking.jsx:260 |
| axios.get(`${API_URL}/api/shows/${showId}`).then(({data})=>{if(!live)return;constnextShow=data?.show;if(!nextShow){thrownewError("Shownotfound.");}constloadedId=nextShow.movie?._id\|\|nextShow.movie;if(movieId&&String(loadedId)!==String(movieId)){thrownewError("Selectedshowdoesnotbelongtothismovie.");}setShow(nextShow);setBookedSeats(normalizeIds(nextShow.bookedSeats));localStorage.setItem("bookmyseat_show",String(nextShow._id));if(nextShow.theatre?._id){localStorage.setItem("bookmyseat_theatre",String(nextShow.theatre._id));}if(nextShow.theatre?.name){localStorage.setItem("bookmyseat_theatre_name",nextShow.theatre.name);}}).catch((error)=>{if(!live)return;console.error("Loadbookingshow:",error);setFailed(error.response?.data?.message\|\|error.message\|\|"Couldnotloadthisshow.");}).finally | () => { if (live) setLoading(false); } | frontend/src/pages/Booking.jsx:298 |
| axios.get(`${API_URL}/api/shows/${showId}`).then(({data})=>{if(!live)return;constnextShow=data?.show;if(!nextShow){thrownewError("Shownotfound.");}constloadedId=nextShow.movie?._id\|\|nextShow.movie;if(movieId&&String(loadedId)!==String(movieId)){thrownewError("Selectedshowdoesnotbelongtothismovie.");}setShow(nextShow);setBookedSeats(normalizeIds(nextShow.bookedSeats));localStorage.setItem("bookmyseat_show",String(nextShow._id));if(nextShow.theatre?._id){localStorage.setItem("bookmyseat_theatre",String(nextShow.theatre._id));}if(nextShow.theatre?.name){localStorage.setItem("bookmyseat_theatre_name",nextShow.theatre.name);}}).catch | (error) => { if (!live) return; console.error("Load booking show:", error); setFailed( error.response?.data?.message \|\| error.message \|\| "Could not load this show." ); } | frontend/src/pages/Booking.jsx:298 |
| localStorage.setItem | "bookmyseat_show" | frontend/src/pages/Booking.jsx:327 |
| localStorage.setItem | "bookmyseat_theatre" | frontend/src/pages/Booking.jsx:333 |
| localStorage.setItem | "bookmyseat_theatre_name" | frontend/src/pages/Booking.jsx:340 |
| sessionStorage.removeItem | HOLD_KEY | frontend/src/pages/Booking.jsx:487 |
| sessionStorage.removeItem | HOLD_KEY | frontend/src/pages/Booking.jsx:550 |
| sessionStorage.removeItem | HOLD_KEY | frontend/src/pages/Booking.jsx:891 |
| sessionStorage.removeItem | HOLD_KEY | frontend/src/pages/Booking.jsx:1091 |
| sessionStorage.setItem | CHECKOUT_KEY | frontend/src/pages/Booking.jsx:1136 |
| sessionStorage.removeItem | CHECKOUT_KEY | frontend/src/pages/Checkout.jsx:205 |
| sessionStorage.getItem | CHECKOUT_KEY | frontend/src/pages/Checkout.jsx:827 |
| sessionStorage.setItem | CHECKOUT_KEY | frontend/src/pages/Checkout.jsx:836 |
| sessionStorage.removeItem | CHECKOUT_KEY | frontend/src/pages/Checkout.jsx:966 |
| sessionStorage.removeItem | CHECKOUT_KEY | frontend/src/pages/Checkout.jsx:1009 |
| localStorage.setItem | "bookmyseat_theatre" | frontend/src/pages/Cinemas.jsx:421 |
| localStorage.setItem | "bookmyseat_theatre_name" | frontend/src/pages/Cinemas.jsx:426 |
| localStorage.setItem | "bookmyseat_city" | frontend/src/pages/Cinemas.jsx:431 |
| window.localStorage.getItem | key | frontend/src/pages/MovieDetails.jsx:32 |
| window.localStorage.setItem | key | frontend/src/pages/MovieDetails.jsx:40 |
| window.localStorage.getItem | key | frontend/src/pages/Movies.jsx:30 |
| window.localStorage.setItem | key | frontend/src/pages/Movies.jsx:38 |
| sessionStorage.getItem | cursorKey | frontend/src/utils/seatEventRecovery.js:65 |
| sessionStorage.setItem | cursorKey | frontend/src/utils/seatEventRecovery.js:74 |
