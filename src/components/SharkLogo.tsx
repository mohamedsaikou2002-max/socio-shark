export function SharkLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="currentColor" aria-hidden="true">
      <path d="M4 38c8-2 14-2 22 0 4-12 14-22 36-24-4 8-6 14-6 18 0 6 2 10 4 14-10 0-18 0-26-2-6 6-14 10-24 8 6-4 8-8 8-14 0-1-2-1-14 0z" />
      <circle cx="48" cy="22" r="2" fill="var(--background)" />
    </svg>
  );
}
