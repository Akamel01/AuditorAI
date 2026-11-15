"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

const links = [
  { href: "/#method", label: "Method" },
  { href: "/projects", label: "Workspace" },
  { href: "/audit-trail", label: "Audit trail" },
  { href: "/dev/mission-control", label: "Mission Control" },
];

export function MobileNavMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      firstLinkRef.current?.focus();
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setOpen(false);
          toggleRef.current?.focus();
        }
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      toggleRef.current?.focus();
    }
  }, [open]);

  return (
    <>
      <nav className="ml-auto hidden flex-nowrap items-center gap-1 sm:flex">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-md px-2.5 py-1.5 text-[13.5px] text-muted no-underline transition-colors duration-150 hover:bg-sunken hover:text-text"
          >
            {link.label}
          </Link>
        ))}
        <span className="mx-1.5 h-4 w-px bg-hairline" />
        <ThemeToggle />
      </nav>

      <div className="ml-auto flex items-center gap-1 sm:hidden">
        <button
          ref={toggleRef}
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="mobile-nav-menu"
          data-testid="mobile-nav-toggle"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-text"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
        <ThemeToggle />
      </div>

      {open && (
        <div
          id="mobile-nav-menu"
          data-testid="mobile-nav-menu"
          className="absolute left-0 right-0 top-full z-50 border-b border-hairline bg-canvas sm:hidden"
        >
          <nav className="flex flex-col gap-1 px-5 py-3">
            {links.map((link, index) => (
              <Link
                key={link.href}
                href={link.href}
                ref={index === 0 ? firstLinkRef : undefined}
                onClick={() => setOpen(false)}
                className="block rounded-md px-2.5 py-1.5 text-[13.5px] text-muted no-underline transition-colors duration-150 hover:bg-sunken hover:text-text"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
