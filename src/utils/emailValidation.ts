export const ALLOWED_EMAIL_DOMAINS = ['gmail.com', 'bugo.gov.ph'] as const;

export const ALLOWED_EMAIL_DOMAIN_MESSAGE =
  'Email / username must use @gmail.com or @bugo.gov.ph.';

export function normalizeAccountEmail(value: string | undefined | null): string {
  return String(value ?? '').trim().toLowerCase();
}

export function isAllowedAccountEmail(value: string | undefined | null): boolean {
  const normalized = normalizeAccountEmail(value);
  if (!normalized || /\s/.test(normalized)) return false;

  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0 || atIndex !== normalized.lastIndexOf('@')) return false;

  const localPart = normalized.slice(0, atIndex);
  const domainPart = normalized.slice(atIndex + 1);

  if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
    return false;
  }

  if (!/^[a-z0-9._+-]+$/i.test(localPart)) {
    return false;
  }

  return (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domainPart);
}
