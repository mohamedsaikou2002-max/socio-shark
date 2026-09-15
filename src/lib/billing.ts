export const MEMBERSHIP_PRICE = "$297";
export const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/bJeeVd8Wmc5t6GN8v943S02";

export function checkoutUrl(userId: string, email?: string | null) {
  const url = new URL(STRIPE_PAYMENT_LINK);
  url.searchParams.set("client_reference_id", userId);
  if (email) url.searchParams.set("prefilled_email", email);
  return url.toString();
}
