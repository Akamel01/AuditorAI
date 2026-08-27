import Link from "next/link";
import type { ReactNode } from "react";
import { MarkLogo } from "./icons";
import { ThemeToggle } from "./theme-toggle";

/*
 * App shell: quiet chrome around the work. The nav never fights the content;
 * the footer carries the professional charter in the formal voice.
 */
export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas">
        <div className={`mx-auto flex h-[58px] items-center gap-5 px-5 ${wide ? "max-w-[1200px]" : "max-w-[1080px]"}`}>
          <Link href="/" className="flex items-center gap-2.5 text-[15.5px] font-semibold tracking-[-0.01em] text-text no-underline">
            <MarkLogo size={21} />
            AuditorAI
          </Link>
          <nav className="ml-auto flex items-center gap-1">
            <Link
              href="/#method"
              className="rounded-md px-2.5 py-1.5 text-[13.5px] text-muted no-underline transition-colors duration-150 hover:bg-sunken hover:text-text"
            >
              Method
            </Link>
            <Link
              href="/projects"
              className="rounded-md px-2.5 py-1.5 text-[13.5px] text-muted no-underline transition-colors duration-150 hover:bg-sunken hover:text-text"
            >
              Workspace
            </Link>
            <Link
              href="/dev/mission-control"
              className="rounded-md px-2.5 py-1.5 text-[13.5px] text-muted no-underline transition-colors duration-150 hover:bg-sunken hover:text-text"
            >
              Mission Control
            </Link>
            <span className="mx-1.5 h-4 w-px bg-hairline" />
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className={`mx-auto w-full flex-1 px-5 ${wide ? "max-w-[1200px]" : "max-w-[1080px]"}`}>{children}</main>

      <footer className="mt-20 border-t border-hairline">
        <div className={`mx-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 px-5 py-4 font-mono text-[10.5px] uppercase tracking-[0.08em] text-faint ${wide ? "max-w-[1200px]" : "max-w-[1080px]"}`}>
          <span>AuditorAI · assists the audit process</span>
          <span>Evidence → reasoning → finding → professional decision</span>
        </div>
      </footer>
    </div>
  );
}
