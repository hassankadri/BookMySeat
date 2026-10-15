
import React from "react";
import { Link } from "react-router-dom";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { LogOut, ShieldCheck, Ticket } from "lucide-react";
import { Avatar, triggerClass } from "./AccountTrigger";

// Loaded on demand by Navbar.jsx so Radix's dropdown
// never sits in the main bundle.

const menuItem =
  "flex w-full cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-soft outline-none transition-colors data-[highlighted]:bg-white/10 data-[highlighted]:text-paper";

/**
 * autoOpen lets a click that arrived before this
 * chunk loaded still open the menu.
 */
const AccountMenu = ({
  user,
  isAdmin,
  onLogout,
  autoOpen = false,
}) => (
  <Dropdown.Root modal={false} defaultOpen={autoOpen}>
    <Dropdown.Trigger asChild>
      <button
        type="button"
        data-testid="user-menu-button"
        aria-label="Open account menu"
        className={triggerClass}
      >
        <Avatar user={user} />
      </button>
    </Dropdown.Trigger>

    <Dropdown.Portal>
      <Dropdown.Content
        align="end"
        sideOffset={10}
        data-testid="user-menu-dropdown"
        className="z-[90] w-60 origin-top-right rounded-2xl border border-line bg-ink-2/95 p-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,.9)] backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        <div className="px-3 pb-2 pt-2">
          <p className="truncate font-display text-base font-semibold text-paper">
            {user?.name}
          </p>

          {user?.email && (
            <p className="truncate text-xs text-mute">
              {user.email}
            </p>
          )}
        </div>

        <Dropdown.Separator className="mx-1 my-1 h-px bg-line" />

        <Dropdown.Item asChild>
          <Link
            to="/my-bookings"
            className={menuItem}
            data-testid="dropdown-bookings"
          >
            <Ticket className="h-4 w-4" strokeWidth={1.6} />
            My Bookings
          </Link>
        </Dropdown.Item>

        {isAdmin && (
          <Dropdown.Item asChild>
            <Link
              to="/admin"
              className={menuItem}
              data-testid="dropdown-admin"
            >
              <ShieldCheck
                className="h-4 w-4"
                strokeWidth={1.6}
              />
              Admin
            </Link>
          </Dropdown.Item>
        )}

        <Dropdown.Separator className="mx-1 my-1 h-px bg-line" />

        <Dropdown.Item
          onSelect={onLogout}
          className={menuItem}
          data-testid="logout-button"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.6} />
          Logout
        </Dropdown.Item>
      </Dropdown.Content>
    </Dropdown.Portal>
  </Dropdown.Root>
);

export default AccountMenu;
