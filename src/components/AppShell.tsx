import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { SharkLogo } from "./SharkLogo";

const NAV = [
  { to: "/", label: "Library" },
  { to: "/products", label: "Products" },
  { to: "/media-prep", label: "Media Prep" },
  { to: "/upload", label: "Upload" },
  { to: "/queue", label: "Review Queue" },
  { to: "/scheduled", label: "Scheduled" },
  { to: "/posted", label: "Posted" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <SharkLogo className="w-7 h-7 text-foreground" />
            <span className="font-mono tracking-tight font-bold text-lg">SOCIO-SHARK</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
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
        </div>
        <nav className="md:hidden flex overflow-x-auto px-4 pb-2 gap-1 border-t border-border">
          {NAV.map((n) => {
            const active = pathname === n.to;
            return (
              <Link key={n.to} to={n.to} className={`px-3 py-1 text-xs rounded-md whitespace-nowrap ${active ? "bg-foreground text-background" : "text-muted-foreground"}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs font-mono text-muted-foreground flex justify-between">
          <span>SOCIO-SHARK // v1</span>
          <span>autonomous social ops</span>
        </div>
      </footer>
    </div>
  );
}
