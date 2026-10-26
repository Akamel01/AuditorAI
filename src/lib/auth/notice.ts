export function authNoticeText(): string {
  return "sign-in is not configured";
}

export function providerNoticeText(_provider: string): string {
  return "this sign-in provider is not configured";
}

export function tenantStoreNoticeText(): string {
  return "sign-in requires the tenant store";
}

export function noInvitationNoticeText(): string {
  return "no invitation for this email";
}

export function invitationPendingNoticeText(): string {
  return "check your email to accept the invitation";
}
