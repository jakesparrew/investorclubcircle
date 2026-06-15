import { describe, it, expect } from "vitest";
import {
  canAccess,
  check,
  tierRank,
  VISITOR,
  type AccessContext,
  type Role,
  type TierKey,
  type AccessRequirement,
} from "./access";

function ctx(partial: Partial<AccessContext>): AccessContext {
  return {
    role: "MEMBER",
    tier: "free",
    ownedProductIds: [],
    tags: [],
    ...partial,
  };
}

const ROLES: (Role | null)[] = [null, "MEMBER", "EXPERT", "ADMIN"];
const TIERS: TierKey[] = ["free", "basis", "premium"];

describe("tierRank", () => {
  it("orders free < basis < premium", () => {
    expect(tierRank("free")).toBeLessThan(tierRank("basis"));
    expect(tierRank("basis")).toBeLessThan(tierRank("premium"));
  });
});

describe("public / unconstrained requirements", () => {
  it("public:true allows everyone, including visitors", () => {
    for (const role of ROLES) {
      expect(check(ctx({ role }), { public: true })).toBe(true);
    }
    expect(check(VISITOR, { public: true })).toBe(true);
  });

  it("an empty requirement is open to everyone", () => {
    for (const role of ROLES) {
      expect(check(ctx({ role }), {})).toBe(true);
    }
  });

  it("public overrides other constraints", () => {
    expect(check(VISITOR, { public: true, minTier: "premium", roles: ["ADMIN"] })).toBe(true);
  });
});

describe("authentication gate", () => {
  it("visitors are denied any gated resource with authentication_required", () => {
    const reqs: AccessRequirement[] = [
      { minTier: "basis" },
      { roles: ["MEMBER"] },
      { ownsProduct: "prod_1" },
      { tags: ["vip"] },
    ];
    for (const req of reqs) {
      const res = canAccess(VISITOR, req);
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("authentication_required");
    }
  });
});

describe("minTier", () => {
  it("requires the tier or higher", () => {
    const req: AccessRequirement = { minTier: "basis" };
    expect(canAccess(ctx({ role: "MEMBER", tier: "free" }), req)).toEqual({
      ok: false,
      reason: "tier_required",
    });
    expect(check(ctx({ role: "MEMBER", tier: "basis" }), req)).toBe(true);
    expect(check(ctx({ role: "MEMBER", tier: "premium" }), req)).toBe(true);
  });

  it("premium requirement excludes basis", () => {
    expect(check(ctx({ tier: "basis" }), { minTier: "premium" })).toBe(false);
    expect(check(ctx({ tier: "premium" }), { minTier: "premium" })).toBe(true);
  });
});

describe("roles", () => {
  it("only listed roles pass", () => {
    const req: AccessRequirement = { roles: ["EXPERT"] };
    expect(canAccess(ctx({ role: "MEMBER" }), req)).toEqual({ ok: false, reason: "role_required" });
    expect(check(ctx({ role: "EXPERT" }), req)).toBe(true);
  });
});

describe("product ownership", () => {
  const req: AccessRequirement = { ownsProduct: "prod_course_1" };
  it("denies without ownership", () => {
    expect(canAccess(ctx({ role: "MEMBER" }), req)).toEqual({
      ok: false,
      reason: "product_required",
    });
  });
  it("allows with ownership", () => {
    expect(check(ctx({ role: "MEMBER", ownedProductIds: ["prod_course_1"] }), req)).toBe(true);
  });
});

describe("member tags", () => {
  it("requires all tags", () => {
    const req: AccessRequirement = { tags: ["vip", "earlybird"] };
    expect(check(ctx({ tags: ["vip"] }), req)).toBe(false);
    expect(canAccess(ctx({ tags: ["vip"] }), req).reason).toBe("tag_required");
    expect(check(ctx({ tags: ["vip", "earlybird"] }), req)).toBe(true);
  });
});

describe("admin override", () => {
  it("admins bypass tier, role, product and tag constraints", () => {
    const admin = ctx({ role: "ADMIN", tier: "free", ownedProductIds: [], tags: [] });
    expect(check(admin, { minTier: "premium" })).toBe(true);
    expect(check(admin, { roles: ["EXPERT"] })).toBe(true);
    expect(check(admin, { ownsProduct: "prod_x" })).toBe(true);
    expect(check(admin, { tags: ["vip"] })).toBe(true);
    expect(check(admin, { minTier: "premium", roles: ["EXPERT"], ownsProduct: "p", tags: ["t"] })).toBe(
      true,
    );
  });
});

describe("combined requirements", () => {
  it("must satisfy every constraint", () => {
    const req: AccessRequirement = { minTier: "basis", roles: ["MEMBER", "EXPERT"] };
    // right role, wrong tier
    expect(canAccess(ctx({ role: "MEMBER", tier: "free" }), req).reason).toBe("tier_required");
    // wrong role checked before tier
    expect(canAccess(ctx({ role: "MEMBER", tier: "free" }), { ...req, roles: ["EXPERT"] }).reason).toBe(
      "role_required",
    );
    // satisfies both
    expect(check(ctx({ role: "EXPERT", tier: "premium" }), req)).toBe(true);
  });
});

describe("exhaustive truth table (role × tier) for minTier:'basis'", () => {
  const req: AccessRequirement = { minTier: "basis" };
  it("matches the expected matrix", () => {
    for (const role of ROLES) {
      for (const tier of TIERS) {
        const res = canAccess(ctx({ role, tier }), req);
        let expected: boolean;
        if (role === null) expected = false; // visitor
        else if (role === "ADMIN") expected = true; // override
        else expected = tierRank(tier) >= tierRank("basis");
        expect(res.ok, `role=${role} tier=${tier}`).toBe(expected);
      }
    }
  });
});
