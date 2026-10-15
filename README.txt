BookMySeat / Phase 2 / Batch 1: Homepage + Navigation

COMPLETE REPLACEMENT FILES
1. frontend/src/pages/Home.jsx
2. frontend/src/components/Navbar.jsx
3. frontend/src/styles/cinema.css (new file)

The ZIP deliberately contains no .env, credentials, node_modules,
package.json changes, backend changes or unrelated pages.

INSTALL ON WINDOWS (PowerShell)
1. Keep a backup copy of your existing frontend/src/pages/Home.jsx
   and frontend/src/components/Navbar.jsx.
2. Open PowerShell in your BookMySeat-main new project root.
3. Download BookMySeat-phase2-batch1.zip and copy it to your project root.
4. Run:
     Expand-Archive -LiteralPath .\BookMySeat-phase2-batch1.zip -DestinationPath . -Force
5. Your existing frontend/src/pages/Home.jsx and
   frontend/src/components/Navbar.jsx will be replaced.
   The new frontend/src/styles/cinema.css will be created.
6. If using Docker, rebuild just the frontend:
     docker compose up -d --build frontend
7. Open http://localhost:3000 and check desktop and mobile views.

WHAT'S PRESERVED
- React Router routes (no App.js changes)
- Existing showtime and coming-soon movie API calls
- Authentication context and its logout behavior
- Movie detail links with theatre query parameter
- Existing checkout, booking, admin and AI pages

REVIEW CHECKLIST
- Header links work when logged in and logged out
- Mobile menu opens, closes, and navigates
- Movie poster links open the appropriate movie details
- Hero links go to /cinemas and /movies
- Coming soon, trailers and AI search open real routes
- Logout works and returns to the homepage
- Browser console is free of runtime exceptions
- Responsive layouts work and no horizontal overflow appears

Production build: Passed using the source archive's node_modules in a Linux
validation workspace, with .env excluded. The CRA/CRACO tool prints a
pre-existing 'Cannot find ESLint loader' warning, but compilation succeeded.

NOTE: These files only implement batch 1. The booking flow will get its
separate steps in a later batch after its state-handling logic is audited.
