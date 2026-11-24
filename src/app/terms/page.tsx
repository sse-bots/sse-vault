import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export const metadata = {
  title: "Terms of Service — SSE Vault",
  description: "Terms of Service for using SSE Vault.",
};

export default function TermsOfServicePage() {
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
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="vault-text-primary text-2xl font-black">
              Terms of Service
            </h1>
            <p className="vault-text-muted mt-0.5 text-xs">
              Last updated: November 24, 2026 · SSE Vault (SSE World)
            </p>
          </div>
        </div>

        <section className="space-y-2 text-xs leading-relaxed sm:text-sm">
          <h2 className="vault-text-primary text-base font-extrabold">
            1. Acceptance of Terms
          </h2>
          <p className="vault-text-secondary">
            By signing in with SSE Accounts and using SSE Vault, you agree to
            these Terms of Service. SSE Vault is provided as a personal
            credential, TOTP authenticator, and recovery-key management utility
            within the SSE ecosystem.
          </p>
        </section>

        <section className="space-y-2 text-xs leading-relaxed sm:text-sm">
          <h2 className="vault-text-primary text-base font-extrabold">
            2. Account Security &amp; Backups
          </h2>
          <p className="vault-text-secondary">
            You are responsible for safeguarding your SSE Account credentials
            (we strongly recommend enabling Two-Step Verification on SSE
            Accounts) and keeping periodic offline backups of critical recovery
            codes and your deployment&apos;s{" "}
            <code>VAULT_ENCRYPTION_SECRET</code>.
          </p>
        </section>

        <section className="space-y-2 text-xs leading-relaxed sm:text-sm">
          <h2 className="vault-text-primary text-base font-extrabold">
            3. Acceptable Use
          </h2>
          <p className="vault-text-secondary">
            You agree to store only credentials and recovery keys that you are
            authorised to access, and not to attempt automated abuse, reverse
            engineering of other users&apos; sessions, or disruption of the
            service.
          </p>
        </section>

        <section className="space-y-2 text-xs leading-relaxed sm:text-sm">
          <h2 className="vault-text-primary text-base font-extrabold">
            4. Service Availability
          </h2>
          <p className="vault-text-secondary">
            SSE Vault is provided &ldquo;as is&rdquo; without warranty of
            uninterrupted availability. Use the built-in{" "}
            <strong>JSON Backup Export</strong> in Vault Settings regularly to
            keep an independent copy of your important TOTP secrets and recovery
            codes.
          </p>
        </section>
      </article>
    </div>
  );
}
