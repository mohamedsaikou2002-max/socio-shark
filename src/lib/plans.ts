export const SUBSCRIPTION_PLANS = [
  { key: "single", name: "Single", price: 300, accountLimit: 1, description: "For one social account" },
  { key: "team", name: "Team", price: 500, accountLimit: 3, description: "For up to three social accounts" },
  { key: "agency", name: "Agency", price: 800, accountLimit: 5, description: "For up to five social accounts" },
] as const;

export type SubscriptionPlanKey = (typeof SUBSCRIPTION_PLANS)[number]["key"];
