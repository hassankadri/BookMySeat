
import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { LogOut, X } from "lucide-react";

// Loaded on demand by Navbar.jsx so Radix's dialog never sits in the main bundle.

const ring =
  "outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-black";

const MobileSheet = ({ open, onOpenChange, links, isActive, isAuthenticated, onLogout, logo, triggerRef }) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      {/* The overlay is what makes Radix lock page scrolling while the menu is open. */}
      <Dialog.Overlay className="fixed inset-0 z-[94] bg-black" />
      <Dialog.Content
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef?.current?.focus();
        }}
        className="fixed inset-0 z-[95] flex flex-col bg-black px-6 pb-8 pt-3 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      >
        <div className="flex h-16 items-center justify-between">
          <Dialog.Title className="sr-only">Menu</Dialog.Title>
          {logo}
          <Dialog.Close
            aria-label="Close menu"
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-line-strong text-paper ${ring}`}
          >
            <X className="h-5 w-5" strokeWidth={1.6} />
          </Dialog.Close>
        </div>

        <ul className="mt-8 flex flex-1 flex-col overflow-y-auto">
          {links.map((link, index) => (
            <motion.li
              key={link.to}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 + index * 0.05, duration: 0.5, ease: [0.2, 0.7, 0.1, 1] }}
            >
              <Link
                to={link.to}
                data-testid={`sheet-${link.id}`}
                onClick={() => onOpenChange(false)}
                aria-current={isActive(link) ? "page" : undefined}
                className={`block border-b border-line py-4 font-display text-[34px] font-semibold leading-none tracking-[-0.03em] [font-variation-settings:'wdth'_92,'opsz'_48] ${ring} ${
                  isActive(link) ? "text-paper" : "text-soft"
                }`}
              >
                {link.label}
              </Link>
            </motion.li>
          ))}
        </ul>

        <div className="pt-6">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onLogout();
              }}
              data-testid="sheet-logout"
              className={`flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line-strong text-[15px] font-semibold text-paper ${ring}`}
            >
              <LogOut className="h-4 w-4" strokeWidth={1.6} />
              Logout
            </button>
          ) : (
            <Link
              to="/auth"
              data-testid="sheet-login"
              onClick={() => onOpenChange(false)}
              className={`flex h-12 w-full items-center justify-center rounded-full bg-paper text-[15px] font-semibold text-ink ${ring}`}
            >
              Sign in or create an account
            </Link>
          )}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);

export default MobileSheet;
