export type MemberRole = "owner" | "admin" | "member";

export interface TenantClaim {
  sub: string;
  workspace_id: string;
  role: MemberRole | null;
  email: string | null;
}

export function tenantClaimJson(claim: TenantClaim): string {
  return JSON.stringify({
    sub: claim.sub,
    workspace_id: claim.workspace_id,
    role: claim.role,
    email: claim.email,
  });
}
