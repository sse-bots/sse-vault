import Link from "next/link";
import { ArrowLeft, Scale, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — SSE Vault",
  description:
    "How SSE Vault encrypts credentials, handles zero-storage .txt imports, and protects your privacy.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/"
        className="vault-text-muted inline-flex items-center gap-1.5 text-xs font-bold hover:text-amber-500"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to SSE Vault
      </Link>

      <article className="vault-card space-y-6 rounded-3xl p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h1 className="vault-text-primary text-2xl font-black">
              Privacy Policy
            </h1>
            <p className="vault-text-muted mt-0.5 text-xs">
              Last updated: November 24, 2026 · SSE Vault (SSE World)
            </p>
          </div>
        </div>

        <div className="vault-inset flex items-start gap-2.5 rounded-2xl p-4 text-xs">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <p className="vault-text-secondary leading-relaxed">
            <strong>Zero-Storage File Guarantee:</strong> When you upload a{" "}
            <code>.txt</code> backup codes file, it is read exclusively in your
            browser&apos;s memory to extract individual security codes. The raw{" "}
            <code>.txt</code> file is never uploaded, logged, or stored on our
            servers.
          </p>
        </div>

        <section className="space-y-2 text-xs leading-relaxed sm:text-sm">
          <h2 className="vault-text-primary text-base font-extrabold">
            1. Information We Store
          </h2>
          <p className="vault-text-secondary">
            When you sign in via <strong>SSE Accounts</strong> (OAuth 2.1 /
            OIDC), SSE Vault stores your basic SSE identity profile (name,
            email, avatar, and user ID) solely to isolate your personal vault
            entries. Inside your vault, we store only the website URLs, login
            identifiers (email/username or OAuth provider), and encrypted
            secrets you explicitly save.
          </p>
        </section>

        <section className="space-y-2 text-xs leading-relaxed sm:text-sm">
          <h2 className="vault-text-primary text-base font-extrabold">
            2. Encryption &amp; Key Recovery
          </h2>
          <p className="vault-text-secondary">
            Passwords, TOTP secrets, individual recovery codes, and notes are
            encrypted server-side using authenticated{" "}
            <strong>AES-256-GCM</strong> encryption before being written to
            MongoDB. To protect against accidental lockout when a deployment
            encryption secret is rotated, records may store a per-document{" "}
            <code>hexcode</code> fallback key (controlled via{" "}
            <code>VAULT_STORE_HEXCODE_IN_DB</code>) that is only used if the
            primary server secret fails to decode an entry.
          </p>
        </section>

        <section className="space-y-2 text-xs leading-relaxed sm:text-sm">
          <h2 className="vault-text-primary text-base font-extrabold">
            3. Website Icons (Favicons)
          </h2>
          <p className="vault-text-secondary">
            To render recognisable app logos (such as Google, GitHub, or
            Discord), your browser requests public favicon images by root domain
            name only (never sending full URLs, paths, emails, passwords, or
            secrets).
          </p>
        </section>

        <section className="space-y-2 text-xs leading-relaxed sm:text-sm">
          <h2 className="vault-text-primary text-base font-extrabold">
            4. Data Ownership, Export &amp; Deletion
          </h2>
          <p className="vault-text-secondary">
            Every vault entry belongs exclusively to your authenticated SSE
            Account (`ownerUserId`). You can export your entire vault at any
            time from <strong>Settings → Export JSON Backup</strong>, or
            permanently delete individual entries immediately with zero soft
            retention.
          </p>
        </section>
      </article>
    </div>
  );
}
