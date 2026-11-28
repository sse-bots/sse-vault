import crypto from "crypto";
import { getAppBaseUrl } from "./auth";

export interface StoredWebAuthnCredential {
  credentialId: string;
  publicKeySpkiBase64: string;
  algorithm: number;
  label: string;
  createdAt: string;
}

export const WEBAUTHN_CHALLENGE_COOKIE = "sse_vault_webauthn_ch";

export function getRpIdFromRequest(req: Request): string {
  try {
    const host = new URL(req.url).hostname;
    if (host) return host;
  } catch {
    /* fallback */
  }
  try {
    return new URL(getAppBaseUrl()).hostname;
  } catch {
    return "localhost";
  }
}

export function getExpectedOriginFromRequest(req: Request): string {
  const originHeader = req.headers.get("origin");
  if (originHeader && /^https?:\/\//i.test(originHeader)) {
    return originHeader.replace(/\/+$/, "");
  }
  return getAppBaseUrl();
}

export function createWebAuthnChallenge(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function verifyWebAuthnAssertion(params: {
  credential: StoredWebAuthnCredential;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRpId: string;
  clientDataJSONBase64Url: string;
  authenticatorDataBase64Url: string;
  signatureBase64Url: string;
}): boolean {
  try {
    const clientDataBuf = Buffer.from(params.clientDataJSONBase64Url, "base64url");
    const clientData = JSON.parse(clientDataBuf.toString("utf8")) as {
      type?: string;
      challenge?: string;
      origin?: string;
    };

    if (clientData.type !== "webauthn.get") return false;
    if (clientData.challenge !== params.expectedChallenge) return false;
    if (
      !clientData.origin ||
      clientData.origin.replace(/\/+$/, "") !== params.expectedOrigin
    ) {
      return false;
    }

    const authData = Buffer.from(params.authenticatorDataBase64Url, "base64url");
    if (authData.length < 37) return false;

    const rpIdHash = authData.subarray(0, 32);
    const expectedRpIdHash = crypto
      .createHash("sha256")
      .update(params.expectedRpId, "utf8")
      .digest();
    if (!crypto.timingSafeEqual(rpIdHash, expectedRpIdHash)) return false;

    if ((authData[32] & 0x01) === 0) return false;

    const clientDataHash = crypto.createHash("sha256").update(clientDataBuf).digest();
    const signedData = Buffer.concat([authData, clientDataHash]);
    const signature = Buffer.from(params.signatureBase64Url, "base64url");

    const publicKey = crypto.createPublicKey({
      key: Buffer.from(params.credential.publicKeySpkiBase64, "base64"),
      format: "der",
      type: "spki",
    });

    return crypto.verify("sha256", signedData, publicKey, signature);
  } catch {
    return false;
  }
}
