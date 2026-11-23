export function getSseIssuerUrl(): string {
  const raw =
    process.env.SSE_ISSUER_URL ||
    process.env.NEXT_PUBLIC_SSE_ACCOUNTS_URL ||
    "https://sse-account.vercel.app";
  return raw.trim().replace(/\/+$/, "");
}

export function getPublicSseAccountsUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SSE_ACCOUNTS_URL ||
    process.env.SSE_ISSUER_URL ||
    "https://sse-account.vercel.app";
  return raw.trim().replace(/\/+$/, "");
}
