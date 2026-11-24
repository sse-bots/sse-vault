# SSE Vault Android APK (phone-friendly GitHub Actions build)

This project builds a signed Android APK in GitHub Actions. You can start a build
from a phone using the repository's **Actions → Build SSE Vault Android APK →
Run workflow** page, or publish a GitHub Release to trigger a build automatically.

The Android app is a Capacitor shell that loads the deployed Next.js website at
`https://sse-vault-amber.vercel.app`. Next.js API routes, Better Auth, MongoDB,
and encryption remain on the server; they are not copied into the APK.

## One-time setup: create a persistent Android signing key

A stable signing key is required so Android will accept later APKs as updates to
the installed app. Do this once and keep the key private. Never commit it or send
it to anyone.

On an Android phone, install Termux from its official F-Droid/GitHub distribution,
then run:

```bash
pkg update
pkg install openjdk-17 coreutils
keytool -genkeypair -v \
  -keystore sse-vault-release.jks \
  -alias sse-vault \
  -keyalg RSA -keysize 2048 -validity 10000
base64 sse-vault-release.jks | tr -d '\n'
```

`keytool` asks you to create a keystore password and key password. Save both
securely. The last command prints one long Base64 string. Add these four **Actions
repository secrets** in GitHub:

Repository → **Settings** → **Secrets and variables** → **Actions** → **New
repository secret**.

| Secret name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | The full Base64 output from the last command |
| `ANDROID_KEYSTORE_PASSWORD` | The keystore password you created |
| `ANDROID_KEY_ALIAS` | `sse-vault` |
| `ANDROID_KEY_PASSWORD` | The key password you created |

Keep a secure backup of `sse-vault-release.jks` and both passwords. If you lose
the signing key, Android will not allow an APK signed with a different key to
update the installed app; users would have to uninstall first, which may remove
app-local data.

## Build from an Android phone

1. Open `https://github.com/sse-bots/sse-vault/actions`.
2. Select **Build SSE Vault Android APK**.
3. Tap **Run workflow** and optionally enter a version such as `1.2.0`.
4. Wait for the workflow to finish successfully.
5. Open the completed run and download the `SSE-Vault-<run number>` artifact.
6. Extract the ZIP and install the APK. Android may ask you to allow installs
   from the browser or file manager you used to download it.

Publishing a GitHub Release also starts the same workflow automatically. The
workflow uses the release tag (for example `v1.2.0`) as the Android version name
and attaches the APK to that release. The workflow also creates an artifact for
manual builds. All builds use the same persistent signing key configured above.

## In-app update checker

The Android shell checks the latest public GitHub Release when it opens. If the
release version is newer than the installed Android version, it shows an update
notice with a button that opens the APK/release download in the Android browser.
The user must download the APK and approve Android's installation prompt. Android
does not permit this app to silently replace itself.

The update notice is part of the Next.js website, so deploy this repository's
website changes to Vercel for the notice to appear in the currently installed
remote-web app. The release APK must be attached before the download button can
retrieve it; if the release page opens before the workflow finishes, retry after
the workflow succeeds.

## Architecture and security notes

- `capacitor.config.ts` loads the live HTTPS deployment. This is intentional:
  static-exporting the Next.js app would remove server API routes and auth flows.
- The app requires an internet connection and uses the deployed Vercel backend.
- Do not put MongoDB, Better Auth, or vault-encryption secrets in Android assets
  or `NEXT_PUBLIC_*` variables.
- The update checker reads public release metadata only; it never reads vault
  contents or credentials.
- Test SSE Accounts sign-in/sign-out, OAuth redirects, session cookies, PIN lock,
  TOTP refresh, clipboard behavior, import/export, and recovery on a real device
  before relying on or distributing the APK.
- The initial Android shell does not add native biometric authentication or
  offline vault access.
