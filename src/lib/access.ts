/**
 * Central access-control primitive for the InvestorClub platform.
 *
 * Pure and dependency-free on purpose: every gating decision in the app flows
 * through `canAccess()`, so it must be exhaustively unit-testable without a
 * database or framework. The resolved DB state for the current principal is
 * passed in as an {@link AccessContext}; this module never reads the database.
 *
 * Access = role (what you may DO) + tier (access level) + product ownership
 *          + optional member tags.
 *
 * See docs/superpowers/specs/2026-06-15-platform-design.md §12.
 */

export type Role = "MEMBER" | "EXPERT" | "ADMIN";
export type TierKey = "free" | "basis" | "premium";

/** Ordered low → high; array index is the rank. */
export const TIER_ORDER: readonly TierKey[] = ["free", "basis", "premium"] as const;

export function tierRank(tier: TierKey): number {
  return TIER_ORDER.indexOf(tier);
}

/**
 * Resolved entitlement snapshot for the current principal.
 * `role === null` means an unauthenticated visitor.
 */
export interface AccessContext {
  role: Role | null;
  /** Active tier; "free" when there is no active/trialing membership. */
  tier: TierKey;
  ownedProductIds: readonly string[];
  tags: readonly string[];
}

/** Declarative requirement attached to any gated resource. */
export interface AccessRequirement {
  /** Open to everyone, including visitors. Overrides all other fields. */
  public?: boolean;
  /** Minimum tier (inclusive). `basis` ⇒ basis or premium. */
  minTier?: TierKey;
  /** Allowed roles. Empty/undefined ⇒ no role constraint. */
  roles?: readonly Role[];
  /** Requires a one-time purchase of this productId. */
  ownsProduct?: string;
  /** All listed member tags are required. */
  tags?: readonly string[];
}

export type DenyReason =
  | "authentication_required"
  | "role_required"
  | "tier_required"
  | "product_required"
  | "tag_required";

export interface AccessResult {
  ok: boolean;
  reason?: DenyReason;
}

const ALLOW: AccessResult = { ok: true };
function deny(reason: DenyReason): AccessResult {
  return { ok: false, reason };
}

export function isAuthenticated(ctx: AccessContext): boolean {
  return ctx.role !== null;
}

/** True when the requirement actually restricts anything. */
function hasConstraints(req: AccessRequirement): boolean {
  return (
    req.minTier !== undefined ||
    (req.roles !== undefined && req.roles.length > 0) ||
    req.ownsProduct !== undefined ||
    (req.tags !== undefined && req.tags.length > 0)
  );
}

/**
 * The one gate. All modules (spaces, posts, events, streams, courses) declare
 * an {@link AccessRequirement} and call this to decide visibility/action rights.
 */
export function canAccess(ctx: AccessContext, req: AccessRequirement): AccessResult {
  // 1. Explicitly public, or no constraints at all ⇒ open to everyone.
  if (req.public === true || !hasConstraints(req)) return ALLOW;

  // 2. The resource is gated ⇒ authentication is required.
  if (!isAuthenticated(ctx)) return deny("authentication_required");

  // 3. Admins override tier/product/tag/role checks.
  if (ctx.role === "ADMIN") return ALLOW;

  // 4. Role requirement.
  if (req.roles && req.roles.length > 0 && !req.roles.includes(ctx.role as Role)) {
    return deny("role_required");
  }

  // 5. Minimum tier.
  if (req.minTier && tierRank(ctx.tier) < tierRank(req.minTier)) {
    return deny("tier_required");
  }

  // 6. One-time product ownership.
  if (req.ownsProduct && !ctx.ownedProductIds.includes(req.ownsProduct)) {
    return deny("product_required");
  }

  // 7. Member tags (all required).
  if (req.tags && req.tags.length > 0 && req.tags.some((t) => !ctx.tags.includes(t))) {
    return deny("tag_required");
  }

  return ALLOW;
}

/** Convenience boolean wrapper. */
export function check(ctx: AccessContext, req: AccessRequirement): boolean {
  return canAccess(ctx, req).ok;
}

/** The default context for an unauthenticated visitor. */
export const VISITOR: AccessContext = {
  role: null,
  tier: "free",
  ownedProductIds: [],
  tags: [],
};
