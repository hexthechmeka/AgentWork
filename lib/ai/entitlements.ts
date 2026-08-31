import type { UserType } from "@/app/(auth)/auth";

type Entitlements = {
  maxMessagesPerHour: number;
};

// Single-user private app: no reason to throttle. Kept as a very high cap
// rather than removing the check so the plumbing stays intact.
const NO_LIMIT = 1_000_000;

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  guest: {
    maxMessagesPerHour: NO_LIMIT,
  },
  regular: {
    maxMessagesPerHour: NO_LIMIT,
  },
};
