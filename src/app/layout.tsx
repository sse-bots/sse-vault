import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthContext";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "SSE Vault — Encrypted TOTP & Security Key Manager",
  description:
    "Store encrypted website logins, live TOTP authenticators, and single-use backup security keys protected by SSE Accounts SSO.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" data-primary="green" data-neutral="slate">
      <body className="min-h-screen bg-[#07090e] text-slate-100 antialiased">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
