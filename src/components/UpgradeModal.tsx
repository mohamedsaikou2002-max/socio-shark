import { Link } from "@tanstack/react-router";
import { Check, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SharkLogo } from "./SharkLogo";

export const STRIPE_PAYMENT_LINK = import.meta.env.VITE_STRIPE_PAYMENT_LINK as string | undefined;

const PERKS = [
  "Unlimited AI video generations",
  "Bulk product + ZIP import",
  "Auto-posting to TikTok & Instagram",
  "Saved prompt library and vibe presets",
];

export function UpgradeModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const hasLink = Boolean(STRIPE_PAYMENT_LINK);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <SharkLogo className="h-6 w-6 text-foreground" />
            <DialogTitle className="font-mono tracking-tight">Unlock Socio-Shark</DialogTitle>
          </div>
          <DialogDescription>
            One payment unlocks the full autonomous pipeline. After checkout you get a 6-digit
            activation code.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 py-2">
          {PERKS.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{p}</span>
            </li>
          ))}
        </ul>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <a
            href={hasLink ? STRIPE_PAYMENT_LINK : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!hasLink}
            onClick={(e) => {
              if (!hasLink) e.preventDefault();
            }}
            className={`inline-flex w-full items-center justify-center gap-2 bg-foreground px-4 py-2 font-mono text-sm text-background transition-opacity ${
              hasLink ? "hover:opacity-90" : "cursor-not-allowed opacity-50"
            }`}
          >
            Continue to checkout <ExternalLink className="h-4 w-4" />
          </a>
          {!hasLink && (
            <p className="w-full text-center text-xs text-muted-foreground">
              Checkout link not configured yet — you can still activate with a code below.
            </p>
          )}
          <Link
            to="/activate"
            onClick={() => onOpenChange(false)}
            className="inline-flex w-full items-center justify-center border border-border px-4 py-2 font-mono text-sm hover:bg-muted"
          >
            I already have a code
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
