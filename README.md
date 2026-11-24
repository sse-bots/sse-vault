# SSE Vault v2 — Domain-Grouped Password, TOTP & Security Key Manager

A bespoke Obsidian-Carbon & Warm-Ivory security vault built with Next.js 15, MongoDB, and Better Auth (authenticated via **SSE Accounts** OAuth 2.1 / OIDC).

## Highlights
- **Distinct Vault UI:** Sticky top command bar with Spotlight Search (`⌘K`), Privacy Blur Curtain, Dark/Light mode toggle, and native mobile tab bar.
- **Automatic Website Icons:** Enter any URL (`google.com`, `github.com`, `discord.com`) to auto-fetch its real favicon with multi-tier fallback.
- **Google Password Manager-Style App Grouping & Strict Domain Locking:**
  - Entering `accounts.google.com` or `mail.google.com` automatically segregates the account inside the **Google (`google.com`)** app vault (or creates it if new).
  - Clicking an app opens its dedicated page (`/vault/github.com`, `/vault/google.com`) where **only that domain's URLs are allowed** (enforced both client-side and server-side).
- **Zero-Storage `.txt` Recovery Key Importer:** Parses backup codes in memory — the `.txt` file is never stored.
- **Click-to-Consume Security Keys:** Tap any code to copy it and mask it permanently as exact-length dashes (`-------`), with Undo restore.
- **Live 2FA Authenticator Wall (`/vault/authenticator`) & Security Check (`/vault/health`):** Real-time 6-digit TOTP codes, weak/reused password detection, low backup key alerts, and JSON backup export.
