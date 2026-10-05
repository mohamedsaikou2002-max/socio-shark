ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_key text NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS account_limit integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_plan_key_check') THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_key_check
      CHECK (plan_key IN ('single', 'team', 'agency'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_account_limit_check') THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_account_limit_check
      CHECK (account_limit IN (1, 3, 5));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_uidx
  ON public.subscriptions(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
