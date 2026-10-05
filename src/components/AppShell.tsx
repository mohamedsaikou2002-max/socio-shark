import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { SharkLogo } from "./SharkLogo";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth, signOut } from "@/hooks/useAuth";

const NAV = [
  { to: "/", label: "Library" },
  { to: "/products", label: "Media Library" },
  { to: "/upload", label: "Upload" },
  { to: "/queue", label: "Review Queue" },
  { to: "/scheduled", label: "Scheduled" },
  { to: "/posted", label: "Posted" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppShell() {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            <SharkLogo className="w-7 h-7 text-foreground" />
            <span className="font-mono tracking-tight font-bold text-base sm:text-lg">SOCIO-SHARK</span>
          </Link>
          {user && (
            <nav className="hidden lg:flex items-center gap-1">
              {NAV.map((n) => {
                const isCurrent = pathname === n.to;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      isCurrent
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          )}
          <div className="flex items-center gap-2 shrink-0">
            {loading ? null : user ? (
              <button
                onClick={() => signOut()}
                className="border border-border px-3 py-1.5 font-mono text-xs hover:bg-muted"
              >
                Sign out
              </button>
            ) : (
              <Link
                to="/auth"
                className="bg-foreground px-3 py-1.5 font-mono text-xs text-background hover:opacity-90"
              >
                Sign in
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>
        {user && (
          <nav className="lg:hidden flex overflow-x-auto px-4 pb-2 gap-1 border-t border-border">
            {NAV.map((n) => {
              const isCurrent = pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1 text-xs rounded-md whitespace-nowrap ${isCurrent ? "bg-foreground text-background" : "text-muted-foreground"}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-xs font-mono text-muted-foreground flex flex-wrap gap-2 justify-between">
          <span>SOCIO-SHARK // v1</span>
          <span>content library and queue</span>
        </div>
      </footer>
    </div>
  );
}
