function b64urlToBuf(b64url: string): ArrayBuffer {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function bufToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export async function isPlatformBiometricsSupported(): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !window.PublicKeyCredential ||
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !==
      "function"
  ) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function registerWebBiometricPasskey(label = "This Device") {
  const optRes = await fetch("/api/vault/webauthn/register", {
    credentials: "include",
    cache: "no-store",
  });
  const opt = await optRes.json();
  if (!optRes.ok) {
    throw new Error(opt.error || "Could not start biometric setup.");
  }

  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: b64urlToBuf(opt.challenge),
      rp: { id: opt.rpId, name: opt.rpName || "SSE Vault" },
      user: {
        id: b64urlToBuf(opt.user.id),
        name: opt.user.name,
        displayName: opt.user.displayName,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      excludeCredentials: (opt.excludeCredentialIds || []).map(
        (id: string) => ({
          type: "public-key" as const,
          id: b64urlToBuf(id),
        })
      ),
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error("Biometric setup was cancelled.");

  const resp = cred.response as AuthenticatorAttestationResponse & {
    getPublicKey?: () => ArrayBuffer | null;
    getPublicKeyAlgorithm?: () => number;
  };
  const spki =
    typeof resp.getPublicKey === "function" ? resp.getPublicKey() : null;
  if (!spki) {
    throw new Error("Your browser does not expose WebAuthn public keys.");
  }
  const algorithm =
    typeof resp.getPublicKeyAlgorithm === "function"
      ? resp.getPublicKeyAlgorithm()
      : -7;

  const saveRes = await fetch("/api/vault/webauthn/register", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      credentialId: cred.id,
      publicKeySpkiBase64: bufToB64(spki),
      algorithm,
      label,
    }),
  });
  const saved = await saveRes.json();
  if (!saveRes.ok) throw new Error(saved.error || "Could not save passkey.");
  return saved;
}

export async function unlockWithWebBiometrics() {
  const optRes = await fetch("/api/vault/webauthn/authenticate", {
    credentials: "include",
    cache: "no-store",
  });
  const opt = await optRes.json();
  if (!optRes.ok || !opt.available) {
    throw new Error("Biometric unlock is not enabled on this account.");
  }

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: b64urlToBuf(opt.challenge),
      rpId: opt.rpId,
      allowCredentials: (opt.allowCredentialIds || []).map((id: string) => ({
        type: "public-key" as const,
        id: b64urlToBuf(id),
      })),
      userVerification: "required",
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error("Biometric verification cancelled.");
  const resp = assertion.response as AuthenticatorAssertionResponse;

  const verRes = await fetch("/api/vault/webauthn/authenticate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      credentialId: assertion.id,
      clientDataJSON: bufToB64url(resp.clientDataJSON),
      authenticatorData: bufToB64url(resp.authenticatorData),
      signature: bufToB64url(resp.signature),
    }),
  });
  const verified = await verRes.json();
  if (!verRes.ok) throw new Error(verified.error || "Biometric verification failed.");
  return verified;
}
