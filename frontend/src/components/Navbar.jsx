
import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  LayoutGroup,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";

import { Menu } from "lucide-react";
import { useAuth } from "../context/AuthContext";

import {
  Avatar,
  triggerClass,
} from "./nav/AccountTrigger";

// =====================================================
// BOOKMYSEAT NAVBAR
// =====================================================
// Preserves:
// - Fixed 64px navbar
// - Transparent homepage navigation
// - Scroll-based background transitions
// - Framer Motion navigation indicators
// - Lazy-loaded account and mobile menus
// - Customer, admin and partner navigation
//
// Accessibility:
// - Standard Tab / Shift+Tab navigation
// - Left / Right / Up / Down arrow navigation
// - Home / End keyboard shortcuts
// - Visible keyboard focus
// - Skip-to-content functionality
// - Reduced-motion support
// =====================================================

const NAV_HEIGHT = 64;

// =====================================================
// LAZY-LOADED MENUS
// =====================================================

const withRetry = (load) => () =>
  load().catch(() =>
    new Promise((resolve) =>
      setTimeout(resolve, 700)
    ).then(load)
  );

const loadAccountMenu = withRetry(() =>
  import("./nav/AccountMenu")
);

const loadMobileSheet = withRetry(() =>
  import("./nav/MobileSheet")
);

const AccountMenu = lazy(loadAccountMenu);
const MobileSheet = lazy(loadMobileSheet);

const preload = (load) =>
  load().catch(() => {});

// =====================================================
// CHUNK ERROR BOUNDARY
// =====================================================

class ChunkBoundary extends React.Component {
  state = {
    failed: false,
  };

  static getDerivedStateFromError() {
    return {
      failed: true,
    };
  }

  componentDidCatch() {
    this.props.onFail?.();
  }

  render() {
    return this.state.failed
      ? this.props.fallback
      : this.props.children;
  }
}

// =====================================================
// NAVIGATION LINKS
// =====================================================

const CORE_LINKS = [
  {
    to: "/",
    label: "Home",
    id: "nav-home",
    exact: true,
  },
  {
    to: "/cinemas",
    label: "Cinemas",
    id: "nav-cinemas",
  },
  {
    to: "/ai-search",
    label: "Assistant",
    id: "nav-assistant",
  },
  {
    to: "/contact",
    label: "Contact Us",
    id: "nav-contact",
  },
];

const MEMBER_LINKS = [
  {
    to: "/my-bookings",
    label: "My Bookings",
    id: "nav-my-bookings",
  },
];

const ADMIN_LINK = {
  to: "/admin",
  label: "Admin",
  id: "nav-admin",
};

const PARTNER_LINK = {
  to: "/partner",
  label: "Partner Portal",
  id: "nav-partner",
};

// =====================================================
// ACCESSIBILITY STYLES
// =====================================================

const ring =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#D71935] focus-visible:ring-offset-2 focus-visible:ring-offset-black";

const idle = (fn) => {
  if (
    typeof window.requestIdleCallback === "function"
  ) {
    const id = window.requestIdleCallback(fn, {
      timeout: 2500,
    });

    return () =>
      window.cancelIdleCallback(id);
  }

  const id = window.setTimeout(fn, 1200);

  return () => window.clearTimeout(id);
};

// =====================================================
// LOGO
// =====================================================

const Logo = () => (
  <span className="flex items-center gap-2.5">
    <svg
      viewBox="0 0 32 32"
      className="h-7 w-7"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M3.5 12.5C7 7.2 11.4 4.8 16 4.8s9 2.4 12.5 7.7"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <path
        d="M9 27.2v-8.1a3.2 3.2 0 0 1 3.2-3.2h7.6a3.2 3.2 0 0 1 3.2 3.2v8.1"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <rect
        x="6.6"
        y="19.6"
        width="3.4"
        height="7.6"
        rx="1.7"
        fill="#fff"
      />

      <rect
        x="22"
        y="19.6"
        width="3.4"
        height="7.6"
        rx="1.7"
        fill="#fff"
      />

      <rect
        x="11.2"
        y="10.4"
        width="9.6"
        height="4.6"
        rx="2.3"
        fill="#fff"
      />
    </svg>

    <span className="font-display text-[21px] font-bold leading-none tracking-[-0.03em] text-paper [font-variation-settings:'wdth'_92,'opsz'_48]">
      BookMySeat
    </span>
  </span>
);

// =====================================================
// MAIN NAVBAR
// =====================================================

const Navbar = () => {
  const {
    user,
    logout,
    isAuthenticated,
  } = useAuth();

  const { pathname } = useLocation();
  const navigate = useNavigate();

  const reducedMotion = useReducedMotion();

  const isHome =
    pathname === "/" ||
    pathname === "/booking-cancel";

  const isAdmin =
    user?.role === "admin";

  const isPartner =
    user?.role === "partner";

  const [solid, setSolid] = useState(!isHome);
  const [hovered, setHovered] = useState(null);
  const [hasMain, setHasMain] = useState(false);

  const [sheet, setSheet] = useState(false);

  const [
    sheetWanted,
    setSheetWanted,
  ] = useState(false);

  const [
    accountWanted,
    setAccountWanted,
  ] = useState(false);

  const [
    menusBroken,
    setMenusBroken,
  ] = useState(false);

  const menuButton = useRef(null);

  // References desktop navigation links only.
  const desktopNavRef = useRef(null);

  // ===================================================
  // TRANSPARENT HOMEPAGE BEHAVIOR
  // ===================================================

  const { scrollY } = useScroll();

  const measure = useCallback(() => {
    if (!isHome) {
      setSolid(true);
      return;
    }

    const opening =
      document.getElementById("bms-opening");

    setSolid(
      opening
        ? opening.getBoundingClientRect().bottom <=
            NAV_HEIGHT
        : window.scrollY > 24
    );
  }, [isHome]);

  useMotionValueEvent(
    scrollY,
    "change",
    measure
  );

  useEffect(() => {
    measure();

    window.addEventListener(
      "resize",
      measure
    );

    return () =>
      window.removeEventListener(
        "resize",
        measure
      );
  }, [measure, pathname]);

  // ===================================================
  // CLOSE MOBILE MENU ON NAVIGATION
  // ===================================================

  useEffect(() => {
    setSheet(false);
    setHovered(null);

    const checkMain = () => {
      setHasMain(
        Boolean(
          document.getElementById(
            "main-content"
          )
        )
      );
    };

    checkMain();

    const frame =
      window.requestAnimationFrame(checkMain);

    return () =>
      window.cancelAnimationFrame(frame);
  }, [pathname]);

  // ===================================================
  // ACCESSIBLE SKIP LINK
  // ===================================================

  const skipToMain = useCallback((event) => {
    const main =
      document.getElementById("main-content");

    if (!main) return;

    event.preventDefault();

    if (!main.hasAttribute("tabindex")) {
      main.setAttribute("tabindex", "-1");
    }

    main.focus({
      preventScroll: true,
    });

    const top =
      window.scrollY +
      main.getBoundingClientRect().top -
      NAV_HEIGHT;

    window.scrollTo({
      top: Math.max(0, top),
      behavior: "auto",
    });
  }, []);

  // ===================================================
  // MENU PRELOADING
  // ===================================================

  useEffect(
    () =>
      idle(() => {
        if (isAuthenticated) {
          preload(loadAccountMenu);
        }

        if (
          window
            .matchMedia("(max-width: 1023px)")
            .matches
        ) {
          preload(loadMobileSheet);
        }
      }),
    [isAuthenticated]
  );

  // ===================================================
  // ACCOUNT ACTIONS
  // ===================================================

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const reloadPage = () =>
    window.location.reload();

  const toggleSheet = () => {
    if (menusBroken) {
      reloadPage();
      return;
    }

    setSheetWanted(true);

    setSheet((previous) => !previous);
  };

  // ===================================================
  // ACTIVE LINK CHECK
  // ===================================================

  const isActive = (link) => {
    if (
      link.to === "/cinemas" &&
      (
        pathname === "/movies" ||
        pathname.startsWith("/movie/")
      )
    ) {
      return true;
    }

    return link.exact
      ? pathname === link.to
      : pathname === link.to ||
          pathname.startsWith(
            `${link.to}/`
          );
  };

  // ===================================================
  // DESKTOP KEYBOARD ARROW NAVIGATION
  // ===================================================
  //
  // Tab moves into and out of the navbar normally.
  //
  // Once a navbar link is focused:
  //
  // ArrowRight / ArrowDown => Next link
  // ArrowLeft / ArrowUp   => Previous link
  // Home                  => First link
  // End                   => Last link
  // Enter                 => Opens focused link
  //
  // Hidden links are excluded automatically.
  // Keyboard focus wraps around at the ends.
  //
  // This only affects desktop navbar links.
  // ===================================================

  const handleDesktopKeyDown = useCallback(
    (event) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      const key = event.key;

      const forward =
        key === "ArrowRight" ||
        key === "ArrowDown";

      const backward =
        key === "ArrowLeft" ||
        key === "ArrowUp";

      const first =
        key === "Home";

      const last =
        key === "End";

      if (
        !forward &&
        !backward &&
        !first &&
        !last
      ) {
        return;
      }

      const container =
        desktopNavRef.current;

      if (!container) return;

      // Select only the real, visible desktop links.
      // Links hidden by Tailwind's responsive classes
      // do not have layout rectangles.
      const links = Array.from(
        container.querySelectorAll(
          "a[data-bms-desktop-nav]"
        )
      ).filter(
        (link) =>
          link.getClientRects().length > 0
      );

      if (!links.length) return;

      const currentIndex =
        links.indexOf(document.activeElement);

      // Do not hijack arrows while keyboard focus
      // is outside the desktop navigation links.
      if (currentIndex === -1) {
        return;
      }

      event.preventDefault();

      let nextIndex = currentIndex;

      if (first) {
        nextIndex = 0;
      } else if (last) {
        nextIndex = links.length - 1;
      } else if (forward) {
        nextIndex =
          (currentIndex + 1) %
          links.length;
      } else if (backward) {
        nextIndex =
          (
            currentIndex -
            1 +
            links.length
          ) % links.length;
      }

      const nextLink =
        links[nextIndex];

      if (!nextLink) return;

      // Transfer actual keyboard focus, not just
      // the visual hover animation.
      nextLink.focus();

      setHovered(
        nextLink.dataset.bmsDesktopNav
      );
    },
    []
  );

  // ===================================================
  // DESKTOP LINKS
  // ===================================================

  const desktopLinks = [
    ...CORE_LINKS.map((link) => ({
      ...link,
      xlOnly: false,
    })),

    ...(isAuthenticated
      ? MEMBER_LINKS.map((link) => ({
          ...link,
          xlOnly: true,
        }))
      : []),

    ...(isPartner
      ? [
          {
            ...PARTNER_LINK,
            xlOnly: false,
          },
        ]
      : []),

    ...(isAdmin
      ? [
          {
            ...ADMIN_LINK,
            xlOnly: true,
          },
        ]
      : []),
  ];

  // ===================================================
  // MOBILE LINKS
  // ===================================================

  const sheetLinks = [
    ...CORE_LINKS,

    ...(isAuthenticated
      ? MEMBER_LINKS
      : []),

    ...(isPartner
      ? [PARTNER_LINK]
      : []),

    ...(isAdmin
      ? [ADMIN_LINK]
      : []),
  ];

  const indicatorTransition = reducedMotion
    ? { duration: 0 }
    : {
        type: "spring",
        stiffness: 420,
        damping: 36,
      };

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <>
      {/* SKIP NAVIGATION */}

      {hasMain && (
        <a
          href="#main-content"
          onClick={skipToMain}
          className={`fixed left-4 top-3 z-[95] -translate-y-24 rounded-full bg-paper px-5 py-2.5 text-sm font-semibold text-ink transition-transform focus:translate-y-0 motion-reduce:transition-none ${ring}`}
        >
          Skip to content
        </a>
      )}

      {/* MAIN NAVIGATION */}

      <nav
        data-testid="main-navbar"
        aria-label="Primary navigation"
        className="fixed inset-x-0 top-0 z-50 box-border h-16"
      >
        {/* TRANSPARENT HOMEPAGE BACKGROUND */}

        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 to-transparent transition-opacity duration-300 motion-reduce:transition-none ${
            solid
              ? "opacity-0"
              : "opacity-100"
          }`}
        />

        {/* SOLID BACKGROUND */}

        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 border-b border-line bg-black/90 backdrop-blur-xl transition-opacity duration-300 motion-reduce:transition-none ${
            solid
              ? "opacity-100"
              : "opacity-0"
          }`}
        />

        <div className="relative mx-auto flex h-full max-w-[1400px] items-center justify-between px-5 lg:px-8">
          {/* LOGO */}

          <Link
            to="/"
            data-testid="logo-link"
            aria-label="BookMySeat home"
            className={`rounded-full ${ring}`}
          >
            <Logo />
          </Link>

          {/* DESKTOP NAVIGATION */}

          <LayoutGroup id="bms-nav">
            <ul
              ref={desktopNavRef}
              onKeyDown={
                handleDesktopKeyDown
              }
              className="relative hidden items-center gap-0.5 lg:flex"
              onMouseLeave={() =>
                setHovered(null)
              }
            >
              {desktopLinks.map((link) => (
                <li
                  key={link.to}
                  className={`relative ${
                    link.xlOnly
                      ? "hidden xl:block"
                      : ""
                  }`}
                >
                  <Link
                    to={link.to}
                    data-testid={link.id}
                    data-bms-desktop-nav={
                      link.to
                    }
                    onMouseEnter={() =>
                      setHovered(link.to)
                    }
                    onFocus={() =>
                      setHovered(link.to)
                    }
                    onBlur={() =>
                      setHovered(null)
                    }
                    aria-current={
                      isActive(link)
                        ? "page"
                        : undefined
                    }
                    className={`relative z-10 flex min-h-11 items-center rounded-full px-3.5 py-2 text-[15px] transition-colors duration-300 motion-reduce:transition-none ${ring} ${
                      isActive(link)
                        ? "text-paper"
                        : "text-soft hover:text-paper focus-visible:text-paper"
                    }`}
                  >
                    {link.label}
                  </Link>

                  {/* HOVER / KEYBOARD FOCUS INDICATOR */}

                  {hovered === link.to && (
                    <motion.span
                      aria-hidden="true"
                      layoutId={
                        reducedMotion
                          ? undefined
                          : "bms-nav-hover"
                      }
                      className="pointer-events-none absolute inset-0 z-0 rounded-full bg-white/10"
                      transition={
                        indicatorTransition
                      }
                    />
                  )}

                  {/* ACTIVE PAGE INDICATOR */}

                  {isActive(link) && (
                    <motion.span
                      aria-hidden="true"
                      layoutId={
                        reducedMotion
                          ? undefined
                          : "bms-nav-dot"
                      }
                      className="pointer-events-none absolute -bottom-0.5 left-1/2 z-10 h-1 w-1 -translate-x-1/2 rounded-full bg-paper"
                      transition={
                        indicatorTransition
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          </LayoutGroup>

          {/* ACCOUNT AND MOBILE CONTROLS */}

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <ChunkBoundary
                onFail={() =>
                  setMenusBroken(true)
                }
                fallback={
                  <button
                    type="button"
                    data-testid="user-menu-button"
                    aria-label="Reload to open the account menu"
                    onClick={reloadPage}
                    className={`${triggerClass} ${ring}`}
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
                      onClick={() =>
                        setAccountWanted(true)
                      }
                      className={`${triggerClass} ${ring}`}
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
                className={`hidden min-h-11 items-center rounded-full border border-line-strong px-5 text-sm font-semibold text-paper transition-colors hover:border-paper motion-reduce:transition-none min-[370px]:inline-flex ${ring}`}
              >
                Sign In
              </Link>
            )}

            {/* MOBILE MENU BUTTON */}

            <button
              ref={menuButton}
              type="button"
              aria-label={
                sheet
                  ? "Close navigation menu"
                  : "Open navigation menu"
              }
              aria-haspopup="dialog"
              aria-expanded={sheet}
              onClick={toggleSheet}
              onPointerEnter={() =>
                preload(loadMobileSheet)
              }
              onFocus={() =>
                preload(loadMobileSheet)
              }
              className={`flex h-11 w-11 items-center justify-center rounded-full border border-line-strong text-paper transition-colors hover:border-paper motion-reduce:transition-none lg:hidden ${ring}`}
            >
              <Menu
                className="h-5 w-5"
                strokeWidth={1.6}
                aria-hidden="true"
              />
            </button>

            {/* MOBILE SHEET */}

            {sheetWanted && (
              <ChunkBoundary
                onFail={() =>
                  setMenusBroken(true)
                }
                fallback={null}
              >
                <Suspense fallback={null}>
                  <MobileSheet
                    open={sheet}
                    onOpenChange={setSheet}
                    links={sheetLinks}
                    isActive={isActive}
                    isAuthenticated={
                      isAuthenticated
                    }
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
