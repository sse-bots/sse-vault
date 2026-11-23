# SSE Vault — Encrypted TOTP & Backup Security Key Manager

A Next.js 15 + MongoDB + Better Auth personal security vault authenticated exclusively via **SSE Accounts** (`https://sse-account.vercel.app`).

## Features
- **SSE Accounts Single Sign-On (OAuth 2.1 / OIDC)** with PKCE and `client_secret_basic` (`authentication: "basic"`).
- **AES-256-GCM Encryption at Rest** for every password, TOTP secret, and backup security code.
- **Full Credential Storage:** Website URL, Email, Username (either or both), Password (with built-in generator), TOTP Secret (raw Base32 or `otpauth://` URI), and Backup Security Keys.
- **Live TOTP Authenticator:** Real-time RFC 6238 6-digit codes with 30-second countdown ring right on every vault card.
- **Zero-Storage `.txt` Recovery Code Importer:** Upload any `.txt` backup codes file (GitHub, Discord, Google, SSE Accounts, etc.) — parsed in memory, separated into individual codes, fed straight into encrypted server storage, and the `.txt` file itself is never uploaded or stored.
- **Click-to-Consume Security Keys (`-------`):** Click any unused security key to copy it and mark it used — immediately transforming it into exact-length dashes (`"-".repeat(code.length)`) persisted in MongoDB (with an optional Undo restore icon).
- **Nuxt UI Theme Customizer:** Full Light/Dark/System modes, 18 accent colours, 9 neutral surfaces, 11 fonts, and mobile-first floating dock.

## Setup
1. Register SSE Vault at `https://sse-account.vercel.app/admin/oauth-clients`:
   - Redirect URI: `https://<your-vault-domain>/api/auth/callback/sse`
   - Scopes: `openid`, `profile`, `email`, `offline_access`
2. Configure environment variables from `.env.example` in Vercel.
3. Deploy to Vercel and verify `https://<your-vault-domain>/api/health`.
