<div align="center">

# 🎬 BookMySeat

### Reserve your seat. Skip the queue. Watch it your way.

**A full-stack MERN cinema booking platform with real seat inventory, real Stripe payments, and a real admin backend — not a boilerplate demo.**

<img src="https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1400&h=320&fit=crop" alt="BookMySeat" width="100%"/>

<br/><br/>

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.2-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.18-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.x-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com/)
[![Tailwind](https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![Repo size](https://img.shields.io/github/repo-size/hassankadri/BookMySeat?style=flat-square)
![Last commit](https://img.shields.io/github/last-commit/hassankadri/BookMySeat?style=flat-square)
![Stars](https://img.shields.io/github/stars/hassankadri/BookMySeat?style=flat-square)

</div>

<br/>

<table align="center">
<tr>
<td align="center" width="130"><b>19</b><br/><sub>Movies seeded</sub></td>
<td align="center" width="130"><b>13</b><br/><sub>API endpoints</sub></td>
<td align="center" width="130"><b>4</b><br/><sub>Core data models</sub></td>
<td align="center" width="130"><b>2</b><br/><sub>Auth tiers</sub></td>
<td align="center" width="130"><b>1-click</b><br/><sub>Admin seeding</sub></td>
</tr>
</table>

<br/>

## 🧭 Table of Contents

`Why This Project`  ·  `Feature Matrix`  ·  `Tech Stack`  ·  `Data Models`  ·  `How Booking Works`  ·  `Project Structure`  ·  `Quick Start`  ·  `Environment Variables`  ·  `API Reference`  ·  `Security`  ·  `Roadmap`  ·  `Contributing`  ·  `License`

<br/>

## 💡 Why This Project

Most tutorial booking apps stop at "list some movies and fake a checkout." **BookMySeat doesn't.**

| | |
|---|---|
| 💺 **Real seat inventory** | Every `Show` tracks its own `bookedSeats[]` array server-side, so two users can never double-book the same seat. |
| 💳 **Real payments** | Checkout runs through an actual **Stripe Checkout Session**, and a booking is only ever marked `completed` after the server independently verifies `payment_status: paid` with Stripe — never trusting the client. |
| 📧 **Real communication** | A fully designed, responsive HTML email — branded header, seat chips, booking reference, total paid — is generated and sent via Nodemailer on every successful booking. |
| 🔐 **Real access control** | Two distinct middleware tiers, `auth` and `adminAuth`, cleanly separate what a customer can do from what an admin can do. |
| 🌱 **Real bootstrapping** | The backend self-seeds an admin account and a 19-movie catalog with cast, trailers, and showtimes on first boot — the app is demo-ready in seconds. |

<br/>

## 🎛️ Feature Matrix

<table>
<tr>
<th align="left">Capability</th>
<th align="center">Guest</th>
<th align="center">User</th>
<th align="center">Admin</th>
</tr>
<tr><td>Browse movies & trending list</td><td align="center">✅</td><td align="center">✅</td><td align="center">✅</td></tr>
<tr><td>View movie details, cast & trailer</td><td align="center">✅</td><td align="center">✅</td><td align="center">✅</td></tr>
<tr><td>View showtimes & seat maps</td><td align="center">✅</td><td align="center">✅</td><td align="center">✅</td></tr>
<tr><td>Register / log in (JWT)</td><td align="center">—</td><td align="center">✅</td><td align="center">✅</td></tr>
<tr><td>Select seats & book via Stripe</td><td align="center">—</td><td align="center">✅</td><td align="center">✅</td></tr>
<tr><td>Receive HTML email confirmation</td><td align="center">—</td><td align="center">✅</td><td align="center">✅</td></tr>
<tr><td>Save movies to Favorites</td><td align="center">—</td><td align="center">✅</td><td align="center">✅</td></tr>
<tr><td>View personal booking history</td><td align="center">—</td><td align="center">✅</td><td align="center">✅</td></tr>
<tr><td>Create new shows</td><td align="center">—</td><td align="center">—</td><td align="center">✅</td></tr>
<tr><td>View platform-wide stats</td><td align="center">—</td><td align="center">—</td><td align="center">✅</td></tr>
<tr><td>Audit every booking on the platform</td><td align="center">—</td><td align="center">—</td><td align="center">✅</td></tr>
</table>

<br/>

## 🧰 Tech Stack

<table>
<tr><td valign="top" width="20%"><b>Frontend</b></td><td>

![React](https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=react&logoColor=black)
![React Router](https://img.shields.io/badge/React_Router_7-CA4245?style=flat-square&logo=reactrouter&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Radix UI](https://img.shields.io/badge/Radix_UI-161618?style=flat-square&logo=radixui&logoColor=white)
![Framer Motion](https://img.shields.io/badge/Framer_Motion-0055FF?style=flat-square&logo=framer&logoColor=white)
![Zustand](https://img.shields.io/badge/Zustand-433E38?style=flat-square)
![React Hook Form](https://img.shields.io/badge/React_Hook_Form-EC5990?style=flat-square&logo=reacthookform&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=flat-square&logo=zod&logoColor=white)
![Axios](https://img.shields.io/badge/Axios-5A29E4?style=flat-square&logo=axios&logoColor=white)

</td></tr>
<tr><td valign="top"><b>Backend</b></td><td>

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express_4-000000?style=flat-square&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Mongoose](https://img.shields.io/badge/Mongoose_8-880000?style=flat-square&logo=mongoose&logoColor=white)
![JWT](https://img.shields.io/badge/JSON_Web_Tokens-000000?style=flat-square&logo=jsonwebtokens&logoColor=white)
![bcrypt](https://img.shields.io/badge/bcrypt.js-338033?style=flat-square)

</td></tr>
<tr><td valign="top"><b>Integrations</b></td><td>

![Stripe](https://img.shields.io/badge/Stripe_Checkout-635BFF?style=flat-square&logo=stripe&logoColor=white)
![Nodemailer](https://img.shields.io/badge/Nodemailer-22B573?style=flat-square&logo=gmail&logoColor=white)

</td></tr>
<tr><td valign="top"><b>Tooling</b></td><td>

![CRACO](https://img.shields.io/badge/CRACO-09D3AC?style=flat-square)
![Nodemon](https://img.shields.io/badge/Nodemon-76D04B?style=flat-square&logo=nodemon&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-4B32C3?style=flat-square&logo=eslint&logoColor=white)

</td></tr>
</table>

<br/>

## 🗂️ Data Models

<details open>
<summary><b>👤 User</b></summary>
<br/>

| Field | Type | Notes |
|---|---|---|
| `name` | String | Required |
| `email` | String | Required, unique, lowercased |
| `password` | String | bcrypt-hashed, never returned by the API |
| `role` | Enum | `user` \| `admin` — default `user` |
| `favorites` | [ObjectId] | References to saved `Movie` documents |

</details>

<details open>
<summary><b>🎬 Movie</b></summary>
<br/>

| Field | Type | Notes |
|---|---|---|
| `title`, `description`, `genre`, `duration`, `rating` | String | Core listing info |
| `poster`, `banner`, `trailer` | String | Media URLs |
| `cast` | [{ name, role, image }] | Embedded cast list |
| `director`, `producer`, `releaseYear`, `releaseDate` | Mixed | Credits & release info |
| `avgRating` | Number | Default `4.5` |
| `trending`, `trendingRank` | Boolean, Number | Powers the Trending rail |

</details>

<details open>
<summary><b>🕒 Show</b></summary>
<br/>

| Field | Type | Notes |
|---|---|---|
| `movie` | ObjectId → Movie | The screened movie |
| `date`, `time`, `price` | Mixed | Showtime & ticket price |
| `theater` | { name, address } | Defaults to *BookMySeat Cinema* |
| `totalSeats` | Number | Default `90` |
| `bookedSeats` | [String] | Live seat-hold registry — the source of truth for availability |
| `createdBy` | ObjectId → User | Admin who created the show |

</details>

<details open>
<summary><b>🎟️ Booking</b></summary>
<br/>

| Field | Type | Notes |
|---|---|---|
| `user`, `show`, `movie` | ObjectId refs | Full booking context |
| `seats` | [String] | Selected seat codes |
| `totalAmount` | Number | Charged amount |
| `bookingReference` | String | Unique, human-shareable reference |
| `paymentStatus` | Enum | `pending` \| `completed` \| `failed` |
| `paymentId`, `sessionId` | String | Stripe payment/session identifiers |

</details>

<br/>

## ⚙️ How Booking Works

1. **Pick a seat** — the user selects a show and one or more seats from a live map built from `Show.bookedSeats`.
2. **Reserve & redirect** — `POST /api/bookings/checkout` creates a `pending` Booking and opens a Stripe Checkout Session; the user is redirected to Stripe.
3. **Pay** — the user completes payment on Stripe's hosted checkout page.
4. **Verify server-side** — Stripe redirects back with a `session_id`; the frontend calls `POST /api/bookings/verify-payment`, and the **server** — not the browser — asks Stripe to confirm `payment_status: paid`.
5. **Confirm & notify** — once verified, the Booking flips to `completed` and a fully styled HTML confirmation email is sent automatically.

> No booking is ever trusted as "paid" based on client-side state alone — the payment status always comes from a direct, authenticated call to Stripe's API.

<br/>

## 📁 Project Structure

```
BookMySeat/
├── backend/
│   ├── middleware/
│   │   └── auth.js              # auth (user) & adminAuth (role-gated) guards
│   ├── models/
│   │   ├── User.js
│   │   ├── Movie.js
│   │   ├── Show.js
│   │   └── Booking.js
│   ├── routes/
│   │   ├── auth.js               # register · login · me
│   │   ├── movies.js             # list · trending · details · favorites
│   │   ├── shows.js              # list · details · create (admin)
│   │   ├── bookings.js           # checkout · verify-payment · my-bookings
│   │   └── admin.js              # stats · bookings · shows
│   ├── utils/
│   │   ├── stripe.js             # Checkout Session creation & verification
│   │   ├── email.js              # Styled HTML booking-confirmation emails
│   │   └── seed.js               # Auto-seeds admin user + movie catalog
│   └── server.js
│
└── frontend/
    └── src/
        ├── components/Navbar.jsx
        ├── context/
        │   ├── AuthContext.jsx    # JWT session state
        │   └── BookingContext.jsx # Active seat-selection state
        └── pages/
            ├── Home.jsx · Movies.jsx · MovieDetails.jsx
            ├── Booking.jsx · BookingSuccess.jsx
            ├── MyBookings.jsx · Favorites.jsx · Auth.jsx · Contact.jsx
            └── admin/
                ├── Admin.jsx · AddShow.jsx
                └── ListShows.jsx · ListBookings.jsx
```

<br/>

## 🚀 Quick Start

<table>
<tr><td width="30%"><b>Requirement</b></td><td><b>Why</b></td></tr>
<tr><td>Node.js v18+</td><td>Runtime for frontend & backend</td></tr>
<tr><td>MongoDB</td><td>Local instance or MongoDB Atlas</td></tr>
<tr><td>Stripe API key</td><td>Test-mode key works out of the box</td></tr>
<tr><td>SMTP credentials</td><td>Sends booking confirmation emails</td></tr>
</table>

```bash
# 1. Clone
git clone https://github.com/hassankadri/BookMySeat.git
cd BookMySeat

# 2. Backend
cd backend
npm install
cp .env.example .env      # fill in values — see table below
npm run dev                # nodemon, auto-restarts on save

# 3. Frontend (new terminal)
cd ../frontend
npm install
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env
npm start
```

✅ Backend → `http://localhost:8001` (auto-seeds an admin account + MongoDB connection on first boot)
✅ Frontend → `http://localhost:3000`

<br/>

## 🔑 Environment Variables

<details>
<summary><b>backend/.env</b></summary>
<br/>

| Variable | Description |
|---|---|
| `PORT` | Express server port (default `8001`) |
| `MONGO_URL` | MongoDB connection string |
| `DB_NAME` | Database name |
| `JWT_SECRET` | Secret used to sign auth tokens |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Auto-seeded admin credentials |
| `STRIPE_API_KEY` | Stripe secret key |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_USER` / `MAIL_PASSWORD` / `MAIL_FROM` | SMTP settings for confirmation emails |
| `FRONTEND_URL` | Used to build Stripe success/cancel redirect URLs |
| `CORS_ORIGINS` | Allowed origin(s) for the API |

</details>

<details>
<summary><b>frontend/.env</b></summary>
<br/>

| Variable | Description |
|---|---|
| `REACT_APP_BACKEND_URL` | Base URL of the backend API |

</details>

<br/>

## 📡 API Reference

All routes are prefixed with `/api`. Protected routes expect `Authorization: Bearer <jwt_token>`.

<details>
<summary><b>🔐 Auth</b></summary>
<br/>

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | Create a new account |
| `POST` | `/auth/login` | — | Authenticate, receive a JWT |
| `GET` | `/auth/me` | User | Current user's profile |

</details>

<details>
<summary><b>🎬 Movies</b></summary>
<br/>

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/movies` | — | List all movies |
| `GET` | `/movies/trending` | — | List trending movies |
| `GET` | `/movies/:id` | — | Full movie details |
| `GET` | `/movies/favorites/list` | User | Current user's favorites |
| `POST` | `/movies/:id/favorite` | User | Toggle favorite status |

</details>

<details>
<summary><b>🕒 Shows</b></summary>
<br/>

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/shows` | — | List all shows |
| `GET` | `/shows/:id` | — | Show details + live seat map |
| `POST` | `/shows` | Admin | Create a new show |

</details>

<details>
<summary><b>🎟️ Bookings</b></summary>
<br/>

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/bookings/checkout` | User | Reserve seats, create a Stripe Checkout Session |
| `POST` | `/bookings/verify-payment` | User | Verify payment, finalize booking |
| `GET` | `/bookings/my-bookings` | User | Current user's bookings |

</details>

<details>
<summary><b>📊 Admin</b></summary>
<br/>

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/stats` | Admin | Platform-wide statistics |
| `GET` | `/admin/bookings` | Admin | View every booking |
| `GET` | `/admin/shows` | Admin | View every show |

</details>

<br/>

## 🛡️ Security

- 🔒 **Password hashing** with `bcryptjs` — plaintext passwords are never stored
- 🪪 **Stateless JWT auth** — no server-side session storage required
- 🛡️ **Two-tier authorization** — `auth` for users, `adminAuth` for role-gated admin routes
- ✅ **Server-verified payments** — bookings are confirmed only after Stripe verifies `payment_status: paid`
- 🗝️ **Environment-based secrets** — every credential lives in `.env`, never in source control

<br/>

## 🗺️ Roadmap

| Status | Item |
|---|---|
| ⏳ | Automated test suite (Jest + Supertest / React Testing Library) |
| ⏳ | Dockerized full-stack setup with `docker-compose` |
| ⏳ | Ratings & written reviews from verified ticket holders |
| ⏳ | Multi-city, multi-theater discovery & filtering |
| ⏳ | Seat-hold expiry (release seats if checkout is abandoned) |
| ⏳ | CI/CD pipeline with GitHub Actions |

<br/>

## 🤝 Contributing

```bash
git checkout -b feature/amazing-feature
git commit -m "Add amazing feature"
git push origin feature/amazing-feature
# then open a Pull Request
```

Issues and feature requests are always welcome.

<br/>

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

<br/>

---

<div align="center">

### 👤 Hassan Kadri

[![GitHub](https://img.shields.io/badge/GitHub-hassankadri-181717?style=for-the-badge&logo=github)](https://github.com/hassankadri)

**If BookMySeat helped or inspired you, consider leaving a ⭐**

</div>
