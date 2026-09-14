import { useCallback, useEffect, useState } from "react";

export const LICENSE_TOKEN_KEY = "socio_license_token";

// Cache the server's verdict briefly so we don't hit the API on every
// render, but never treat the mere presence of a localStorage value as
// proof of a license — it's always re-checked against the server.
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface LicenseState {
  loading: boolean;
  licensed: boolean;
  /** true when the verdict came from the offline/demo fallback */
  demo: boolean;
  refresh: () => void;
}

export function clearLicense() {
  try {
    localStorage.removeItem(LICENSE_TOKEN_KEY);
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("socio_license_check_"))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* storage blocked */
  }
}

export function useLicenseCheck(): LicenseState {
  const [state, setState] = useState({ loading: true, licensed: false, demo: false });
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const token = localStorage.getItem(LICENSE_TOKEN_KEY);
      if (!token) {
        if (!cancelled) setState({ loading: false, licensed: false, demo: false });
        return;
      }

      // Locally-issued demo token: no server to ask, unlock the UI so the
      // whole flow is explorable offline.
      if (token.startsWith("demo_")) {
        if (!cancelled) setState({ loading: false, licensed: true, demo: true });
        return;
      }

      const cacheKey = `socio_license_check_${token}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const { licensed, ts } = JSON.parse(cached);
          if (Date.now() - ts < CACHE_TTL_MS) {
            if (!cancelled) setState({ loading: false, licensed, demo: false });
            return;
          }
        } catch {
          sessionStorage.removeItem(cacheKey);
        }
      }

      try {
        const res = await fetch("/api/public/license-status", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const licensed = res.ok && data.licensed === true;

        sessionStorage.setItem(cacheKey, JSON.stringify({ licensed, ts: Date.now() }));
        if (!cancelled) setState({ loading: false, licensed, demo: false });
      } catch {
        // On network failure, fail closed (not licensed) rather than
        // silently unlocking premium features.
        if (!cancelled) setState({ loading: false, licensed: false, demo: false });
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { ...state, refresh };
}
