
import React, { useRef } from "react";
import { Link } from "react-router-dom";
import {
  useReducedMotion,
  useTransform,
  motion,
} from "framer-motion";

import useScrollProgress from "../hooks/useScrollProgress";
import copy from "../copy";
import Button from "../primitives/Button";
import MaskText from "../primitives/MaskText";

// =====================================================
// ACCOUNT SECTION
// =====================================================

export const AccountSection = ({ isAuthenticated }) => {
  const a = copy.account;

  return (
    <section
      id="account"
      aria-labelledby="account-title"
      className="relative bg-ink px-5 pb-28 pt-32 md:px-8 lg:pb-40 lg:pt-48"
      data-testid="account-section"
    >
      <div className="mx-auto max-w-[1280px]">
        <MaskText
          id="account-title"
          text={
            isAuthenticated
              ? a.signedIn.heading
              : a.signedOut.heading
          }
          className="bms-display max-w-[16ch] text-[clamp(2.8rem,7vw,7.2rem)] md:max-w-[18ch]"
        />

        {isAuthenticated ? (
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button
              to="/my-bookings"
              size="lg"
              data-testid="account-bookings"
            >
              {a.signedIn.bookings}
            </Button>
          </div>
        ) : (
          <>
            <p className="mt-8 max-w-xl text-lg leading-relaxed text-soft">
              {a.signedOut.body}
            </p>

            <div className="mt-10">
              <Button
                to="/auth"
                size="lg"
                data-testid="account-signin"
              >
                {a.signedOut.action}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

// =====================================================
// FOOTER LINK
// =====================================================

const FooterLink = ({ to, children, ...rest }) => (
  <Link
    to={to}
    className="text-soft transition-colors hover:text-paper focus-visible:text-paper"
    {...rest}
  >
    {children}
  </Link>
);

// =====================================================
// SITE FOOTER
// =====================================================

export const SiteFooter = ({ isAuthenticated }) => {
  const reduce = useReducedMotion();
  const ref = useRef(null);

  const scrollYProgress = useScrollProgress(ref, {
    a: 1,
    b: 1,
  });

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    [reduce ? 0 : 60, 0]
  );

  const f = copy.footer;

  return (
    <footer
      ref={ref}
      className="relative overflow-hidden border-t border-line bg-ink pt-16"
      data-testid="site-footer"
    >
      <div className="px-5 md:px-8">
        <div className="mx-auto grid max-w-[1280px] gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="bms-head text-2xl">
              BookMySeat
            </p>

            <p className="mt-3 max-w-xs text-soft">
              {f.tagline}
            </p>
          </div>

          <nav
            aria-label={f.groups.explore}
            className="flex flex-col gap-3"
          >
            <p className="font-display font-semibold text-paper">
              {f.groups.explore}
            </p>

            <FooterLink to="/cinemas">
              {f.links.cinemas}
            </FooterLink>

            <FooterLink to="/movies">
              {f.links.movies}
            </FooterLink>

            <FooterLink to="/ai-search">
              {f.links.assistant}
            </FooterLink>
          </nav>

          <nav
            aria-label={f.groups.account}
            className="flex flex-col gap-3"
          >
            <p className="font-display font-semibold text-paper">
              {f.groups.account}
            </p>

            <FooterLink
              to={isAuthenticated ? "/my-bookings" : "/auth"}
            >
              {isAuthenticated
                ? f.links.myBookings
                : f.links.signIn}
            </FooterLink>
          </nav>

          <nav
            aria-label={f.groups.help}
            className="flex flex-col gap-3"
          >
            <p className="font-display font-semibold text-paper">
              {f.groups.help}
            </p>

            <FooterLink to="/contact">
              {f.links.contact}
            </FooterLink>
          </nav>
        </div>
      </div>

      <div className="mt-16 px-5 md:px-8">
        <p className="mx-auto max-w-[1280px] text-sm text-mute">
          {f.rights(new Date().getFullYear())}
        </p>
      </div>

      <motion.p
        aria-hidden="true"
        style={{ y }}
        className="bms-display select-none whitespace-nowrap pt-2 text-center text-[19vw] !leading-[0.8] !text-ink-3"
      >
        BookMySeat
      </motion.p>
    </footer>
  );
};
