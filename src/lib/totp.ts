/**
 * Client-side RFC 6238 TOTP generator using native Web Crypto API (zero external libs).
 * Supports raw Base32 secrets OR full `otpauth://totp/...` URIs.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export interface ParsedTotpConfig {
  secret: string;
  digits: number;
  period: number;
  algorithm: "SHA-1" | "SHA-256" | "SHA-512";
  issuer: string | null;
  label: string | null;
}

export function parseTotpInput(raw: string): ParsedTotpConfig | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;

  if (trimmed.toLowerCase().startsWith("otpauth://")) {
    try {
      const url = new URL(trimmed);
      const secret = (url.searchParams.get("secret") || "")
        .toUpperCase()
        .replace(/[^A-Z2-7]/g, "");
      if (!secret) return null;

      const digitsParam = Number(url.searchParams.get("digits") || 6);
      const digits = digitsParam === 8 ? 8 : 6;
      const periodParam = Number(url.searchParams.get("period") || 30);
      const period =
        Number.isFinite(periodParam) && periodParam >= 10 && periodParam <= 120
          ? Math.floor(periodParam)
          : 30;
      const algoRaw = (url.searchParams.get("algorithm") || "SHA1")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      const algorithm: "SHA-1" | "SHA-256" | "SHA-512" =
        algoRaw === "SHA256"
          ? "SHA-256"
          : algoRaw === "SHA512"
            ? "SHA-512"
            : "SHA-1";

      const issuer = url.searchParams.get("issuer") || null;
      const label = decodeURIComponent(url.pathname.replace(/^\/+/, "")) || null;

      return { secret, digits, period, algorithm, issuer, label };
    } catch {
      return null;
    }
  }

  const secret = trimmed.toUpperCase().replace(/[^A-Z2-7]/g, "");
  if (secret.length < 8) return null;

  return {
    secret,
    digits: 6,
    period: 30,
    algorithm: "SHA-1",
    issuer: null,
    label: null,
  };
}

function base32ToBytes(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

export async function generateTotpCode(
  rawSecretOrUri: string,
  nowMs = Date.now()
): Promise<{ code: string; remaining: number; period: number } | null> {
  if (typeof window === "undefined" || !window.crypto?.subtle) return null;
  const cfg = parseTotpInput(rawSecretOrUri);
  if (!cfg) return null;

  const keyBytes = base32ToBytes(cfg.secret);
  if (keyBytes.length === 0) return null;

  const epochSec = Math.floor(nowMs / 1000);
  const counter = Math.floor(epochSec / cfg.period);
  const remaining = cfg.period - (epochSec % cfg.period);

  const counterBuf = new ArrayBuffer(8);
  const view = new DataView(counterBuf);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  view.setUint32(0, high, false);
  view.setUint32(4, low, false);

  try {
    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyBytes.buffer as ArrayBuffer,
      { name: "HMAC", hash: cfg.algorithm },
      false,
      ["sign"]
    );
    const sig = new Uint8Array(
      await window.crypto.subtle.sign("HMAC", cryptoKey, counterBuf)
    );
    const offset = sig[sig.length - 1] & 0x0f;
    const binary =
      ((sig[offset] & 0x7f) << 24) |
      ((sig[offset + 1] & 0xff) << 16) |
      ((sig[offset + 2] & 0xff) << 8) |
      (sig[offset + 3] & 0xff);

    const mod = Math.pow(10, cfg.digits);
    const code = String(binary % mod).padStart(cfg.digits, "0");
    return { code, remaining, period: cfg.period };
  } catch {
    return null;
  }
}
