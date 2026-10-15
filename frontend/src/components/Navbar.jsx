
import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutGroup, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Avatar, triggerClass } from "./nav/AccountTrigger";

// =====================================================
// BookMySeat navbar
//
//  * Exactly 64px tall, fixed, z-50 on every route. Other pages depend on that:
//    admin/Admin.jsx pins its sidebar at top-16 and many pages use pt-16 to pt-28.
//  * Transparent only on the homepage routes ("/" and "/booking-cancel"), and only
//    while the homepage's opening section (#bms-opening) is on screen. Solid everywhere else.
//  * Same links, auth behaviour and data-testid values as before, plus Cinemas and Assistant.
//  * The account menu and the mobile menu (Radix dropdown and dialog) load on demand, so they
//    stay out of the main bundle. They are preloaded when idle for the visitors who can use them.
//  * Self-contained: it does not import from components/home.
// =====================================================

const NAV_HEIGHT = 64;

// A failed download is retried once. React.lazy remembers a rejection forever and an uncaught one
// unmounts the whole app, so failures are also contained by ChunkBoundary below.
const withRetry = (load) => () => load().catch(() => new Promise((resolve) => setTimeout(resolve, 700)).then(load));
const loadAccountMenu = withRetry(() => import("./nav/AccountMenu"));
const loadMobileSheet = withRetry(() => import("./nav/MobileSheet"));
const AccountMenu = lazy(loadAccountMenu);
const MobileSheet = lazy(loadMobileSheet);
const preload = (load) => load().catch(() => {});

/**
 * If a menu's code cannot be downloaded (a flaky connection, or a new deploy that has replaced the
 * old files), show the fallback instead of blanking the page. The fallback reloads the page, which
 * fetches the current files.
 */
class ChunkBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFail?.();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const CORE_LINKS = [
  { to: "/", label: "Home", id: "nav-home", exact: true },
  { to: "/cinemas", label: "Cinemas", id: "nav-cinemas" },
  { to: "/ai-search", label: "Assistant", id: "nav-assistant" },
  { to: "/contact", label: "Contact Us", id: "nav-contact" },
];

const MEMBER_LINKS = [
  { to: "/favorites", label: "Favorites", id: "nav-favorites" },
  { to: "/my-bookings", label: "My Bookings", id: "nav-my-bookings" },
];

const ADMIN_LINK = { to: "/admin", label: "Admin", id: "nav-admin" };

const ring =
  "outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-black";

const idle = (fn) => {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fn, { timeout: 2500 });
    return () => window.cancelIdleCallback(id);
  }

  const id = window.setTimeout(fn, 1200);
  return () => window.clearTimeout(id);
};

const Logo = () => (
  <span className="flex items-center gap-2.5">
    <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" aria-hidden="true">
      <path d="M3.5 12.5C7 7.2 11.4 4.8 16 4.8s9 2.4 12.5 7.7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M9 27.2v-8.1a3.2 3.2 0 0 1 3.2-3.2h7.6a3.2 3.2 0 0 1 3.2 3.2v8.1" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <rect x="6.6" y="19.6" width="3.4" height="7.6" rx="1.7" fill="#fff" />
      <rect x="22" y="19.6" width="3.4" height="7.6" rx="1.7" fill="#fff" />
      <rect x="11.2" y="10.4" width="9.6" height="4.6" rx="2.3" fill="#fff" />
    </svg>

    <span className="font-display text-[21px] font-bold leading-none tracking-[-0.03em] text-paper [font-variation-settings:'wdth'_92,'opsz'_48]">
      BookMySeat
    </span>
  </span>
);

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const isHome = pathname === "/" || pathname === "/booking-cancel";
  const isAdmin = user?.role === "admin";

  const [solid, setSolid] = useState(!isHome);
  const [hovered, setHovered] = useState(null);
  const [hasMain, setHasMain] = useState(false);

  // Menus load on demand. A click that arrives before its chunk does is remembered and honoured.
  const [sheet, setSheet] = useState(false);
  const [sheetWanted, setSheetWanted] = useState(false);
  const [accountWanted, setAccountWanted] = useState(false);
  const [menusBroken, setMenusBroken] = useState(false);
  const menuButton = useRef(null);

  // Transparent while the homepage opening is still on screen, solid otherwise.
  const { scrollY } = useScroll();

  const measure = useCallback(() => {
    if (!isHome) {
      setSolid(true);
      return;
    }

    const opening = document.getElementById("bms-opening");

    setSolid(
      opening
        ? opening.getBoundingClientRect().bottom <= NAV_HEIGHT
        : window.scrollY > 24
    );
  }, [isHome]);

  useMotionValueEvent(scrollY, "change", measure);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);

    return () => window.removeEventListener("resize", measure);
  }, [measure, pathname]);

  // Close the mobile menu on navigation.
  useEffect(() => {
    setSheet(false);
    setHasMain(Boolean(document.getElementById("main-content")));
  }, [pathname]);

  // Warm up only what this visitor can use.
  useEffect(
    () =>
      idle(() => {
        if (isAuthenticated) preload(loadAccountMenu);

        if (window.matchMedia("(max-width: 1023px)").matches) {
          preload(loadMobileSheet);
        }
      }),
    [isAuthenticated]
  );

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const reloadPage = () => window.location.reload();

  const openSheet = () => {
    if (menusBroken) {
      reloadPage();
      return;
    }

    setSheetWanted(true);
    setSheet(true);
  };

  const isActive = (link) => {
    if (
      link.to === "/cinemas" &&
      (pathname === "/movies" || pathname.startsWith("/movie/"))
    ) {
      return true;
    }

    return link.exact
      ? pathname === link.to
      : pathname === link.to || pathname.startsWith(`${link.to}/`);
  };

  const desktopLinks = [
    ...CORE_LINKS.map((link) => ({ ...link, xlOnly: false })),
    ...(isAuthenticated
      ? MEMBER_LINKS.map((link) => ({ ...link, xlOnly: true }))
      : []),
    ...(isAdmin ? [{ ...ADMIN_LINK, xlOnly: true }] : []),
  ];

  const sheetLinks = [
    ...CORE_LINKS,
    ...(isAuthenticated ? MEMBER_LINKS : []),
    ...(isAdmin ? [ADMIN_LINK] : []),
  ];

  return (
    <>
      {hasMain && (
        <a
          href="#main-content"
          className="fixed left-4 top-3 z-[95] -translate-y-24 rounded-full bg-paper px-5 py-2.5 text-sm font-semibold text-ink transition-transform focus:translate-y-0 focus:outline-none"
        >
          Skip to content
        </a>
      )}

      <nav
        data-testid="main-navbar"
        aria-label="Main"
        className="fixed inset-x-0 top-0 z-50 box-border h-16"
      >
        {/* Transparent and solid navbar backgrounds */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 ${
            solid ? "opacity-0" : "opacity-100"
          }`}
        />

        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 border-b border-line bg-black/90 backdrop-blur-xl transition-opacity duration-300 ${
            solid ? "opacity-100" : "opacity-0"
          }`}
        />

        <div className="relative mx-auto flex h-full max-w-[1400px] items-center justify-between px-5 lg:px-8">
          <Link
            to="/"
            data-testid="logo-link"
            aria-label="BookMySeat home"
            className={`rounded-full ${ring}`}
          >
            <Logo />
          </Link>

          <LayoutGroup id="bms-nav">
            <ul
              className="relative hidden items-center gap-0.5 lg:flex"
              onMouseLeave={() => setHovered(null)}
            >
              {desktopLinks.map((link) => (
                <li
                  key={link.to}
                  className={`relative ${link.xlOnly ? "hidden xl:block" : ""}`}
                >
                  <Link
                    to={link.to}
                    data-testid={link.id}
                    onMouseEnter={() => setHovered(link.to)}
                    onFocus={() => setHovered(link.to)}
                    onBlur={() => setHovered(null)}
                    aria-current={isActive(link) ? "page" : undefined}
                    className={`relative z-10 block rounded-full px-3.5 py-2 text-[15px] transition-colors duration-300 ${ring} ${
                      isActive(link)
                        ? "text-paper"
                        : "text-soft hover:text-paper"
                    }`}
                  >
                    {link.label}
                  </Link>

                  {hovered === link.to && (
                    <motion.span
                      layoutId="bms-nav-hover"
                      className="absolute inset-0 z-0 rounded-full bg-white/10"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 36,
                      }}
                    />
                  )}

                  {isActive(link) && (
                    <motion.span
                      layoutId="bms-nav-dot"
                      className="absolute -bottom-0.5 left-1/2 z-10 h-1 w-1 -translate-x-1/2 rounded-full bg-paper"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 36,
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>
          </LayoutGroup>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <ChunkBoundary
                onFail={() => setMenusBroken(true)}
                fallback={
                  <button
                    type="button"
                    data-testid="user-menu-button"
                    aria-label="Reload to open the account menu"
                    onClick={reloadPage}
                    className={triggerClass}
                  >
                    <Avatar user={user} />
                  </button>
                }
              >
                <Suspense
                  fallback={
                    <button
                      type="button"
                      data-testid="user-menu-button"
                      aria-label="Open account menu"
                      onClick={() => setAccountWanted(true)}
                      className={triggerClass}
                    >
                      <Avatar user={user} />
                    </button>
                  }
                >
                  <AccountMenu
                    user={user}
                    isAdmin={isAdmin}
                    onLogout={handleLogout}
                    autoOpen={accountWanted}
                  />
                </Suspense>
              </ChunkBoundary>
            ) : (
              <Link
                to="/auth"
                data-testid="login-button"
                className={`hidden h-10 items-center rounded-full border border-line-strong px-5 text-sm font-semibold text-paper transition-colors hover:border-paper min-[370px]:inline-flex ${ring}`}
              >
                Sign In
              </Link>
            )}

            <button
              ref={menuButton}
              type="button"
              aria-label="Open menu"
              aria-haspopup="dialog"
              aria-expanded={sheet}
              onClick={openSheet}
              onPointerEnter={() => preload(loadMobileSheet)}
              className={`flex h-10 w-10 items-center justify-center rounded-full border border-line-strong text-paper transition-colors hover:border-paper lg:hidden ${ring}`}
            >
              <Menu className="h-5 w-5" strokeWidth={1.6} />
            </button>

            {sheetWanted && (
              <ChunkBoundary
                onFail={() => setMenusBroken(true)}
                fallback={null}
              >
                <Suspense fallback={null}>
                  <MobileSheet
                    open={sheet}
                    onOpenChange={setSheet}
                    links={sheetLinks}
                    isActive={isActive}
                    isAuthenticated={isAuthenticated}
                    onLogout={handleLogout}
                    logo={<Logo />}
                    triggerRef={menuButton}
                  />
                </Suspense>
              </ChunkBoundary>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;
