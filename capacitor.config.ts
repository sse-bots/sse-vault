import type { CapacitorConfig } from "@capacitor/cli";

/**
 * SSE Vault Android shell.
 *
 * The Next.js application has server-side API routes and Better Auth callbacks,
 * so the Android shell must load the deployed HTTPS application. Do not change
 * this to a static `out/` build: that would remove the server API routes.
 */
const config: CapacitorConfig = {
  appId: "com.sse.vault",
  appName: "SSE Vault",
  webDir: "out",
  server: {
    url: "https://sse-vault-amber.vercel.app",
    cleartext: false,
    allowNavigation: [
      "sse-vault-amber.vercel.app",
      "sse-account.vercel.app",
    ],
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
    },
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#09090b",
    },
  },
};

export default config;
