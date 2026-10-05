# Stripe and Supabase access setup

The app grants access only after the Stripe webhook verifies a paid $300 USD one-time checkout from the configured Payment Link. A browser redirect or a client-side success flag never activates an account.

## Stripe

1. Create a one-time Stripe product/price for **$300 USD** and make a Payment Link for it. Copy both the Payment Link URL and its `plink_...` ID.
2. Set the Payment Link's post-payment redirect to `https://YOUR_APP_HOST/billing?checkout=success`.
3. Add a webhook endpoint at `https://YOUR_APP_HOST/api/stripe/webhook` and subscribe it to `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
4. Copy the webhook signing secret. Configure these app variables:
   - `VITE_STRIPE_PAYMENT_LINK_URL` — Payment Link URL (build-time/public)
   - `STRIPE_PAYMENT_LINK_ID` — matching `plink_...` ID
   - `STRIPE_WEBHOOK_SECRET` — endpoint's `whsec_...` secret

The webhook checks the event signature, account ID in `client_reference_id`, the exact Payment Link, paid status, one-time mode, amount, and currency. Failed, expired, or incomplete payments do not activate access.

## Supabase

1. Apply the migrations, including `20261005120000_stripe_paid_client_workspaces.sql`, before deploying the app.
2. Enable Google as an Auth provider. Add the production app origin to Supabase's allowed redirect URLs, and add Supabase's displayed Auth callback URL to the Google OAuth client. Email/password sign-in uses the same Supabase Auth user store.
3. Configure the server-only Supabase URL, publishable key, and service-role key. Never expose the service-role key as a `VITE_` variable.
4. Keep the `videos` and `product-images` buckets private. The migration applies per-user storage policies; the app issues expiring signed URLs for previews and provider uploads. Overall storage capacity and individual file limits still depend on the Supabase project plan.

## Meta Graph API

The Instagram Reels provider uses Meta Graph API v26.0. Set `META_ACCESS_TOKEN` and `INSTAGRAM_ACCOUNT_ID` in the app's protected settings. The connected Meta app/token must have Instagram publishing permission and belong to an eligible Instagram Professional account. `Test Meta keys` checks account read access; complete a controlled Reel publish to verify publishing permission and account eligibility.
