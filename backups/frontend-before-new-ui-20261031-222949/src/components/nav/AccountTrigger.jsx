
import React from "react";

// The avatar button's look, shared by the instant placeholder in Navbar.jsx and the real
// Radix menu in AccountMenu.jsx. Deliberately free of Radix imports so the dropdown stays
// out of the main bundle.

const ring =
  "outline-none focus-visible:ring-2 focus-visible:ring-paper focus-visible:ring-offset-2 focus-visible:ring-offset-black";

export const triggerClass = `group flex h-10 items-center gap-2.5 rounded-full border border-line-strong py-1 pl-1 pr-3 text-sm text-paper transition-colors hover:border-paper data-[state=open]:border-paper lg:pr-4 ${ring}`;

export const Avatar = ({ user }) => {
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();
  return (
    <>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-paper font-display text-sm font-bold text-ink">
        {initial}
      </span>
      <span className="hidden max-w-[110px] truncate lg:block">{user?.name}</span>
    </>
  );
};
