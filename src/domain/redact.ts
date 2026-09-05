const DATABASE_URL_PATTERN = /postgres(?:ql)?:\/\/[^\s"'\\]+/gi;
const USERINFO_IN_URL_PATTERN = /:\/\/([^:/@]+):([^@]+)@/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const SK_KEY_PATTERN = /\bsk-[A-Za-z0-9_-]{10,}/g;
const API_KEY_ASSIGNMENT_PATTERN = /\b([A-Za-z][A-Za-z0-9_]*API_KEY)=([^\s"']+)/gi;

export function redactSecrets(value: string): string {
  return value
    .replace(DATABASE_URL_PATTERN, "[redacted-database-url]")
    .replace(USERINFO_IN_URL_PATTERN, "://$1:***@")
    .replace(BEARER_PATTERN, "Bearer [redacted-bearer-token]")
    .replace(SK_KEY_PATTERN, "[redacted-secret-key]")
    .replace(API_KEY_ASSIGNMENT_PATTERN, "$1=[redacted]");
}
