# SSE Vault — native app (Expo / React Native)

A real native Android app (not a WebView). It talks to the same SSE Vault backend
(`https://sse-vault-amber.vercel.app`) and signs in through SSE Accounts.

## What's in it
- Sign in with SSE Accounts (system browser + PKCE handled by your existing backend)
- Native 6-digit PIN pad, fingerprint/face unlock, auto-lock on background
- Vault list with search, categories, favourites; add / edit / delete
- Live TOTP authenticator tab (SHA-1/SHA-256, verified against RFC 6238 vectors)
- Backup codes (tap to copy + mark used), password generator, notes
- Screenshots blocked, clipboard auto-cleared after 30 s, secrets dropped from memory on lock

## Backend changes (already applied in `src/`)
The website only understood cookies. These small edits let the app use bearer tokens:
- `lib/auth.ts` — accepts `Authorization: Bearer <session>`
- `lib/vault-pin.ts` + `api/vault/pin` — accepts/returns an unlock token for `x-sse-client: native`
- `api/auth/login` + `callback/sse` — `?mobile=1` returns to `ssevault://auth?token=…`

**Deploy these to Vercel before using the app.** No change to the SSE Accounts OAuth client is needed.

## Build the APK
Same GitHub secrets as before. Run **Actions → Build SSE Vault native app (APK)**.
It uses package `com.sse.vault` and the same signing key, so it installs over the old WebView app.

## Run locally
```
cd mobile && npm install && npx expo install --fix
npx expo run:android
```
