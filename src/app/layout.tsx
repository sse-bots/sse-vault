import type { Metadata } from "next";
import "./globals.css";
import { VaultProvider } from "@/components/VaultContext";
import { VaultShell } from "@/components/VaultShell";

export const metadata: Metadata = {
  title: "SSE Vault — Password, TOTP & Security Key Manager",
  description:
    "Domain-grouped encrypted vault for website logins, live TOTP authenticators, and single-use backup security keys powered by SSE Accounts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <VaultProvider>
          <VaultShell>{children}</VaultShell>
        </VaultProvider>
      </body>
    </html>
  );
}
