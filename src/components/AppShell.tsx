import { useState } from "react";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { SharkLogo } from "./SharkLogo";
import { ThemeToggle } from "./ThemeToggle";
import { UpgradeModal } from "./UpgradeModal";
import { useLicenseCheck } from "@/hooks/useLicenseCheck";

const NAV = [
  { to: "/", label: "Library" },
  { to: "/products", label: "Products" },
  { to: "/pipeline", label: "Pipeline" },
  { to: "/media-prep", label: "Media Prep" },
  { to: "/upload", label: "Upload" },
  { to: "/queue", label: "Review Queue" },
  { to: "/scheduled", label: "Scheduled" },
  { to: "/posted", label: "Posted" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppShell() {
  const { pathname } = useLocation();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const license = useLicenseCheck();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <SharkLogo className="w-7 h-7 text-foreground" />
            <span className="font-mono tracking-tight font-bold text-base sm:text-lg">SOCIO-SHARK</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-1">
            {NAV.map((n) => {
              const active = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            {license.loading ? null : license.licensed ? (
              <span className="hidden sm:inline-flex items-center border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                {license.demo ? "demo pass" : "licensed"}
              </span>
            ) : (
              <button
                onClick={() => setUpgradeOpen(true)}
                className="bg-foreground px-3 py-1.5 font-mono text-xs text-background hover:opacity-90"
              >
                Unlock
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
        <nav className="lg:hidden flex overflow-x-auto px-4 pb-2 gap-1 border-t border-border">
          {NAV.map((n) => {
            const active = pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`px-3 py-1 text-xs rounded-md whitespace-nowrap ${active ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-xs font-mono text-muted-foreground flex flex-wrap gap-2 justify-between">
          <span>SOCIO-SHARK // v1</span>
          <Link to="/activate" className="hover:text-foreground">
            activate
          </Link>
          <span>autonomous social ops</span>
        </div>
      </footer>
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
