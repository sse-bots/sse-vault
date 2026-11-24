# SSE Vault Android app

This repository uses Next.js server routes for Better Auth, vault APIs, PIN
operations, and encrypted-record handling. Those server routes must remain
hosted on Vercel; a static export copied into an APK would not contain them.

The Capacitor Android shell therefore loads the existing HTTPS deployment:
`https://sse-vault-amber.vercel.app`.

## Build prerequisites

- Node.js 20 or newer
- Android Studio with Android SDK Platform and Build Tools installed
- JDK 17 (use the JDK recommended by the installed Android Gradle Plugin)

## First-time setup

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio, wait for Gradle sync, then use **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

For a command-line debug build after Android Studio/SDK setup:

```bash
cd android
./gradlew assembleDebug
```

The debug APK is normally written to:
`android/app/build/outputs/apk/debug/app-debug.apk`.

## Updating the app

The website remains the source of the user interface and server behavior. Deploy
website changes to Vercel as usual. For native-shell/configuration changes, run:

```bash
npx cap sync android
```

## Security and release checks

- Keep Vercel, MongoDB, Better Auth, and vault-encryption secrets on the server.
  Never put `.env` secrets in the Android project or APK.
- Keep HTTPS enabled; cleartext traffic and mixed content are disabled.
- Verify the complete SSE Accounts sign-in/sign-out flow on a physical Android
device. OAuth provider redirects and session-cookie behavior must be tested in
the Android WebView before distributing the APK.
- Verify app resume, session expiry, clipboard behavior, TOTP refresh, PIN lock,
  import/export, and recovery flows on-device.
- This initial shell does not claim native biometric integration or offline
  vault access. Those require separate implementation and security review.
- Before public distribution, configure a release signing key and test a signed
  release build. Never commit the signing key or its passwords.

## Important architecture note

`capacitor.config.ts` intentionally points to the deployed web app. This is a
remote-web Capacitor shell, not a bundled offline frontend. The app depends on
network access and the Vercel deployment. This preserves Next.js API routes and
Better Auth callbacks without moving secrets or database access onto the phone.
