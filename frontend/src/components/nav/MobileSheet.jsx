
import React, {
  useRef,
} from "react";

import { Link } from "react-router-dom";

import {
  motion,
  useReducedMotion,
} from "framer-motion";

import * as Dialog from "@radix-ui/react-dialog";

import {
  LogOut,
  X,
} from "lucide-react";

// =====================================================
// BOOKMYSEAT — ACCESSIBLE MOBILE MENU
// =====================================================
//
// Preserves:
// - Radix Dialog
// - Existing design and typography
// - Animated navigation links
// - Authentication and logout
// - Admin and partner links
// - Lazy loading from Navbar.jsx
//
// Accessibility:
// - Automatic focus trapping via Radix
// - Escape closes the dialog
// - Focus returns to the menu trigger
// - Arrow-key navigation between links
// - Home / End keyboard shortcuts
// - Screen-reader descriptions
// - Reduced-motion support
// =====================================================

const ring =
  "outline-none focus-visible:ring-2 focus-visible:ring-[#D71935] focus-visible:ring-offset-2 focus-visible:ring-offset-black";

const MobileSheet = ({
  open,
  onOpenChange,
  links,
  isActive,
  isAuthenticated,
  onLogout,
  logo,
  triggerRef,
}) => {
  const reducedMotion = useReducedMotion();

  const firstLinkRef = useRef(null);
  const navigationRef = useRef(null);

  // ===================================================
  // KEYBOARD NAVIGATION
  // ===================================================
  //
  // Tab / Shift+Tab:
  // Standard dialog keyboard navigation.
  //
  // ArrowDown / ArrowRight:
  // Focus next navigation link.
  //
  // ArrowUp / ArrowLeft:
  // Focus previous navigation link.
  //
  // Home:
  // Focus first navigation link.
  //
  // End:
  // Focus last navigation link.
  //
  // Enter:
  // Open the focused link.
  //
  // Escape:
  // Handled automatically by Radix Dialog.
  // ===================================================

  const handleNavigationKeyDown = (event) => {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }

    const forward =
      event.key === "ArrowDown" ||
      event.key === "ArrowRight";

    const backward =
      event.key === "ArrowUp" ||
      event.key === "ArrowLeft";

    const first =
      event.key === "Home";

    const last =
      event.key === "End";

    if (
      !forward &&
      !backward &&
      !first &&
      !last
    ) {
      return;
    }

    const container = navigationRef.current;

    if (!container) return;

    const navigationLinks = Array.from(
      container.querySelectorAll(
        "a[data-bms-mobile-link]"
      )
    ).filter(
      (link) =>
        link.getClientRects().length > 0
    );

    if (!navigationLinks.length) return;

    const currentIndex =
      navigationLinks.indexOf(
        document.activeElement
      );

    // Only intercept arrow keys when a navigation
    // link is actually focused.
    if (currentIndex === -1) {
      return;
    }

    event.preventDefault();

    let nextIndex = currentIndex;

    if (first) {
      nextIndex = 0;
    } else if (last) {
      nextIndex = navigationLinks.length - 1;
    } else if (forward) {
      nextIndex =
        (currentIndex + 1) %
        navigationLinks.length;
    } else if (backward) {
      nextIndex =
        (
          currentIndex -
          1 +
          navigationLinks.length
        ) % navigationLinks.length;
    }

    navigationLinks[nextIndex]?.focus();
  };

  // ===================================================
  // FOCUS MANAGEMENT
  // ===================================================

  const handleOpenAutoFocus = (event) => {
    // Start keyboard navigation on the first link
    // instead of leaving focus on a decorative element.
    if (firstLinkRef.current) {
      event.preventDefault();

      firstLinkRef.current.focus();
    }
  };

  const handleCloseAutoFocus = (event) => {
    const trigger = triggerRef?.current;

    if (trigger) {
      event.preventDefault();
      trigger.focus();
    }
  };

  // ===================================================
  // ANIMATION PREFERENCES
  // ===================================================

  const itemInitial = reducedMotion
    ? false
    : {
        opacity: 0,
        x: -20,
      };

  const itemTransition = (index) =>
    reducedMotion
      ? {
          duration: 0,
        }
      : {
          delay: 0.05 + index * 0.05,
          duration: 0.5,
          ease: [0.2, 0.7, 0.1, 1],
        };

  const dialogAnimation = reducedMotion
    ? ""
    : "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0";

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <Dialog.Root
      open={open}
      onOpenChange={onOpenChange}
      modal
    >
      <Dialog.Portal>
        {/* BACKDROP */}

        <Dialog.Overlay
          className="fixed inset-0 z-[94] bg-black"
        />

        {/* MOBILE NAVIGATION PANEL */}

        <Dialog.Content
          onOpenAutoFocus={
            handleOpenAutoFocus
          }
          onCloseAutoFocus={
            handleCloseAutoFocus
          }
          className={`fixed inset-0 z-[95] flex flex-col bg-black px-6 pb-8 pt-3 outline-none ${dialogAnimation}`}
        >
          {/* SCREEN-READER INFORMATION */}

          <Dialog.Title className="sr-only">
            BookMySeat navigation menu
          </Dialog.Title>

          <Dialog.Description className="sr-only">
            Use Tab or the arrow keys to move through
            navigation links. Press Enter to open a
            page, or Escape to close the menu.
          </Dialog.Description>

          {/* HEADER */}

          <div className="flex h-16 shrink-0 items-center justify-between">
            <span aria-hidden="true">
              {logo}
            </span>

            <Dialog.Close
              aria-label="Close navigation menu"
              className={`flex h-11 w-11 items-center justify-center rounded-full border border-line-strong text-paper transition-colors hover:border-paper motion-reduce:transition-none ${ring}`}
            >
              <X
                className="h-5 w-5"
                strokeWidth={1.6}
                aria-hidden="true"
              />
            </Dialog.Close>
          </div>

          {/* NAVIGATION LINKS */}

          <nav
            ref={navigationRef}
            aria-label="Mobile navigation"
            onKeyDown={
              handleNavigationKeyDown
            }
            className="mt-8 min-h-0 flex-1 overflow-y-auto"
          >
            <ul className="flex flex-col">
              {links.map((link, index) => {
                const active = isActive(link);

                return (
                  <motion.li
                    key={link.to}
                    initial={itemInitial}
                    animate={{
                      opacity: 1,
                      x: 0,
                    }}
                    transition={itemTransition(index)}
                  >
                    <Link
                      ref={
                        index === 0
                          ? firstLinkRef
                          : undefined
                      }
                      to={link.to}
                      data-testid={`sheet-${link.id}`}
                      data-bms-mobile-link={
                        link.to
                      }
                      onClick={() =>
                        onOpenChange(false)
                      }
                      aria-current={
                        active
                          ? "page"
                          : undefined
                      }
                      className={`block border-b border-line py-4 font-display text-[34px] font-semibold leading-none tracking-[-0.03em] transition-colors motion-reduce:transition-none [font-variation-settings:'wdth'_92,'opsz'_48] ${ring} ${
                        active
                          ? "text-paper"
                          : "text-soft hover:text-paper focus-visible:text-paper"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </motion.li>
                );
              })}
            </ul>
          </nav>

          {/* ACCOUNT ACTIONS */}

          <div className="shrink-0 pt-6">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onLogout();
                }}
                data-testid="sheet-logout"
                className={`flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line-strong text-[15px] font-semibold text-paper transition-colors hover:border-paper motion-reduce:transition-none ${ring}`}
              >
                <LogOut
                  className="h-4 w-4"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />

                Logout
              </button>
            ) : (
              <Link
                to="/auth"
                data-testid="sheet-login"
                onClick={() =>
                  onOpenChange(false)
                }
                className={`flex h-12 w-full items-center justify-center rounded-full bg-paper text-[15px] font-semibold text-ink transition-colors motion-reduce:transition-none ${ring}`}
              >
                Sign in or create an account
              </Link>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default MobileSheet;
