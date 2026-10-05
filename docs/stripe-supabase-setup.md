# Stripe and Supabase access setup

Socio-Shark offers three monthly subscriptions: $300 for 1 connected social account, $500 for 3, or $800 for 5. The app grants access only after the Stripe webhook verifies the first paid subscription checkout. A browser redirect or client-side success flag never activates an account.

## Stripe

1. Create three monthly recurring prices in Stripe: **$300 USD/month**, **$500 USD/month**, and **$800 USD/month**. Create a Payment Link for each and copy each URL and `plink_...` ID.
2. Set each Payment Link's post-payment redirect to `https://YOUR_APP_HOST/billing?checkout=success`.
3. Add a webhook endpoint at `https://YOUR_APP_HOST/api/stripe/webhook` and subscribe it to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, and `customer.subscription.deleted`.
4. Configure `VITE_STRIPE_PAYMENT_LINK_URL_1`, `_3`, and `_5` with the public URLs; configure `STRIPE_PAYMENT_LINK_ID_1`, `_3`, and `_5` with their matching IDs. Set `STRIPE_WEBHOOK_SECRET` to the endpoint's `whsec_...` secret and `STRIPE_SECRET_KEY` to a server-only Stripe secret key so the webhook can verify the subscription's active status and billing period.

The webhook checks the event signature, account ID in `client_reference_id`, exact configured Payment Link, subscription mode, first invoice amount, currency, and active status from Stripe. It stores the plan and account limit in Supabase. Subscription update and cancellation events keep access in sync with Stripe. Failed, canceled, or incomplete subscriptions do not activate access.

## Supabase

1. Apply the migrations, including `20261005120000_stripe_paid_client_workspaces.sql` and `20261006120000_recurring_subscription_plans.sql`, before deploying the app.
2. Enable Google as an Auth provider. Add the production app origin to Supabase's allowed redirect URLs, and add Supabase's displayed Auth callback URL to the Google OAuth client. Email/password sign-in uses the same Supabase Auth user store.
3. Configure the server-only Supabase URL, publishable key, and service-role key. Never expose the service-role key as a `VITE_` variable.
4. Keep the `videos` and `product-images` buckets private. The migration applies per-user storage policies; the app issues expiring signed URLs for previews and provider uploads. Overall storage capacity and individual file limits still depend on the Supabase project plan.

## Meta Graph API

The Instagram Reels provider uses Meta Graph API v26.0. Set `META_ACCESS_TOKEN` and `INSTAGRAM_ACCOUNT_ID` in the app's protected settings. The connected Meta app/token must have Instagram publishing permission and belong to an eligible Instagram Professional account. `Test Meta keys` checks account read access; complete a controlled Reel publish to verify publishing permission and account eligibility.
