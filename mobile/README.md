# SSE Vault — native app (Expo / React Native)

A real native Android app (not a WebView) for your SSE Vault backend, with the same features as the website.

## Features
- **Sign in** with SSE Accounts (system browser), native 6-digit PIN pad, fingerprint/face unlock, auto-lock
- **Vault** grouped by app like the website: search, categories, favourites, per-app account lists, linked "Sign in with Google" accounts
- **Add / edit / delete** logins, strength meter, password generator, TOTP secrets, backup codes, notes
- **Authenticator** tab with live 2FA codes (SHA-1 / SHA-256)
- **Security check**: score, weak / reused passwords, missing 2FA, low backup codes, key re-encryption
- **Change PIN**, **Import** (CSV from Chrome/Bitwarden/1Password…, JSON backup) and **Export** (JSON / CSV)
- **Themes**: dark/light, 9 surfaces and 18 accent colours — same palette as the website
- **Offline access**: encrypted local copy (AES-256 + HMAC, key in the Android Keystore). Opens read-only without internet after a PIN check; 10 wrong PINs wipes it
- **Update notices**: checks GitHub Releases and offers the new APK
- Screenshots blocked, clipboard cleared after 30 s, secrets dropped from memory on lock

## Building
Run **Actions → Build SSE Vault native app (APK)**. Each run signs the APK, uploads it as an artifact
and publishes a GitHub Release (`v1.0.<run>`) — that release is what the in-app update notice reads.
The repository must be public for the app to read releases (set in `src/config.ts` → `GITHUB_REPO`).

## Backend changes (already in `src/`)
Bearer-token support in `lib/auth.ts`, `lib/vault-pin.ts`, `api/vault/pin`, and `?mobile=1` in the auth routes.
