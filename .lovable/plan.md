# Socio-Shark frontend integration

## Goal
Adapt the existing Socio-Shark interface to the customer flow described in the uploaded package, while leaving the current Lovable Cloud database, server functions, migrations, secrets, and API routes unchanged.

## What will change
- Restructure navigation around Dashboard, Billing, Accounts, Queue, Schedule, and Settings.
- Refine sign-in and account creation screens for the new customer journey, preserving existing email verification and Google sign-in.
- Add a $297/month billing screen using the existing Stripe payment link and current membership status.
- Add frontend-only account connection screens for Instagram and TikTok with clear empty, connected, expired, and three-account-limit states.
- Rework upload and review screens to visually support account selection, ZIP/media intake, queue ordering, caption review, and AI suggestions without importing the uploaded backend.
- Add industry-profile management presentation under Settings using local interactive state until matching cloud tables exist.
- Add polished loading, empty, locked, success, and error states throughout.
- Keep the established black-and-white Socio-Shark visual language and ensure mobile layouts are usable.

## Boundaries
- Do not copy or apply the uploaded migration, cloud functions, Stripe implementation, OAuth callbacks, scheduler, or secrets.
- Do not alter the existing database schema or current server behavior.
- Existing working capabilities remain connected; controls that depend only on the uploaded backend contract will be clearly presented as setup states rather than making broken requests.
- Preserve the existing seven-digit access-code path and account-based access behavior.

## Verification
- Check all changed screens at desktop and mobile widths.
- Verify sign-in/account creation, navigation, payment-link opening, and local UI interactions.
- Confirm the preview builds without errors and no backend files changed.

## Technical details
- Continue using TanStack Router and the existing design tokens/components.
- Add only frontend route/component/state files; no schema, API, server-function, or integration-client changes.
- Add unique page metadata for every new content route.
