# SSE Vault v3 — Domain-Grouped Password, OAuth, TOTP & Security Key Manager

A mobile-first Obsidian-Carbon & Warm-Ivory security vault built with Next.js 15, MongoDB, and Better Auth authenticated exclusively through **SSE Accounts** (`https://sse-account.vercel.app`).

## Features
- **OAuth & Standard Password Modes:** Store standard logins (email, username, password) OR email-only OAuth sign-ins (Google, GitHub, Discord, Microsoft, Apple, SSE Accounts, or Custom) with provider icons.
- **Toggle Checkboxes for TOTP & Security Keys:** Cleanly opt into TOTP 2FA, Backup Security Keys (zero-storage `.txt` parser), and Passkey status per entry.
- **Auto Website Icons & Strict App Folders:** Entering any URL fetches its real favicon and segregates accounts under their root domain (`/vault/github.com`, `/vault/google.com`) with strict domain locking.
- **Click-to-Consume Security Keys:** Tap any unused code to copy it (with optional 30-second clipboard auto-clear) and mask it permanently as exact-length dashes (`-------`), with Undo restore.
- **Conditional Secret-Rotation Key Recovery (`hexcode`):** Decodes normally using `VAULT_ENCRYPTION_SECRET`; ONLY if the secret changes and fails to decode an entry, SSE Vault falls back to the entry's saved `hexcode` (or lets you paste an old 64-char hex key in `/vault/settings`) and offers 1-click re-encryption to the new secret.
- **Live 2FA Wall, Security Audit, Password/Passphrase Generator, Privacy Policy & Terms of Service.**
