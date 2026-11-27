// RFC 6238 TOTP in pure TypeScript (Hermes has no Web Crypto HMAC).
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export interface TotpConfig {
  secret: string;
  digits: number;
  period: number;
  algorithm: "SHA1" | "SHA256";
}

export function parseTotp(raw: string | null | undefined): TotpConfig | null {
  const t = (raw || "").trim();
  if (!t) return null;
  if (t.toLowerCase().startsWith("otpauth://")) {
    const q = t.split("?")[1] || "";
    const p: Record<string, string> = {};
    q.split("&").forEach((kv) => {
      const [k, v] = kv.split("=");
      if (k) p[k.toLowerCase()] = decodeURIComponent(v || "");
    });
    const secret = (p.secret || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
    if (!secret) return null;
    const algo = (p.algorithm || "SHA1").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (algo === "SHA512") return null; // not supported in-app
    const period = Number(p.period || 30);
    return {
      secret,
      digits: Number(p.digits) === 8 ? 8 : 6,
      period: period >= 10 && period <= 120 ? Math.floor(period) : 30,
      algorithm: algo === "SHA256" ? "SHA256" : "SHA1",
    };
  }
  const secret = t.toUpperCase().replace(/[^A-Z2-7]/g, "");
  if (secret.length < 8) return null;
  return { secret, digits: 6, period: 30, algorithm: "SHA1" };
}

function b32decode(s: string): Uint8Array {
  let bits = 0, val = 0;
  const out: number[] = [];
  for (const ch of s) {
    const i = B32.indexOf(ch);
    if (i < 0) continue;
    val = (val << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((val >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));
const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

function pad(msg: Uint8Array): Uint8Array {
  const len = msg.length;
  const total = (((len + 9 + 63) >> 6) << 6);
  const out = new Uint8Array(total);
  out.set(msg);
  out[len] = 0x80;
  const bitsHi = Math.floor((len * 8) / 0x100000000);
  const bitsLo = (len * 8) >>> 0;
  const dv = new DataView(out.buffer);
  dv.setUint32(total - 8, bitsHi);
  dv.setUint32(total - 4, bitsLo);
  return out;
}

function sha1(msg: Uint8Array): Uint8Array {
  const d = pad(msg);
  const dv = new DataView(d.buffer);
  let h0 = 0x67452301, h1 = 0xefcdab89 | 0, h2 = 0x98badcfe | 0, h3 = 0x10325476, h4 = 0xc3d2e1f0 | 0;
  const w = new Array<number>(80);
  for (let o = 0; o < d.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = h0, b = h1, c = h2, dd = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) { f = (b & c) | (~b & dd); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ dd; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & dd) | (c & dd); k = 0x8f1bbcdc | 0; }
      else { f = b ^ c ^ dd; k = 0xca62c1d6 | 0; }
      const t = (rotl(a, 5) + f + e + k + w[i]) | 0;
      e = dd; dd = c; c = rotl(b, 30); b = a; a = t;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + dd) | 0; h4 = (h4 + e) | 0;
  }
  const out = new Uint8Array(20);
  const odv = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => odv.setUint32(i * 4, h >>> 0));
  return out;
}

const K256 = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
];

export function sha256(msg: Uint8Array): Uint8Array {
  const d = pad(msg);
  const dv = new DataView(d.buffer);
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19].map((x) => x | 0);
  const w = new Array<number>(64);
  for (let o = 0; o < d.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4) | 0;
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, dd, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + (K256[i] | 0) + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) | 0;
      hh = g; g = f; f = e; e = (dd + t1) | 0; dd = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + dd) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  h.forEach((x, i) => odv.setUint32(i * 4, x >>> 0));
  return out;
}

export function hmac(hash: (m: Uint8Array) => Uint8Array, key: Uint8Array, msg: Uint8Array): Uint8Array {
  const block = 64;
  let k = key.length > block ? hash(key) : key;
  const kp = new Uint8Array(block);
  kp.set(k);
  const ipad = new Uint8Array(block + msg.length);
  const opad = new Uint8Array(block);
  for (let i = 0; i < block; i++) { ipad[i] = kp[i] ^ 0x36; opad[i] = kp[i] ^ 0x5c; }
  ipad.set(msg, block);
  const inner = hash(ipad);
  const outer = new Uint8Array(block + inner.length);
  outer.set(opad);
  outer.set(inner, block);
  return hash(outer);
}

export function generateTotp(cfg: TotpConfig, nowMs = Date.now()): string {
  const counter = Math.floor(nowMs / 1000 / cfg.period);
  const msg = new Uint8Array(8);
  const dv = new DataView(msg.buffer);
  dv.setUint32(0, Math.floor(counter / 0x100000000));
  dv.setUint32(4, counter >>> 0);
  const mac = hmac(cfg.algorithm === "SHA256" ? sha256 : sha1, b32decode(cfg.secret), msg);
  const off = mac[mac.length - 1] & 15;
  const bin =
    ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(bin % 10 ** cfg.digits).padStart(cfg.digits, "0");
}

export function secondsLeft(cfg: TotpConfig, nowMs = Date.now()): number {
  return cfg.period - (Math.floor(nowMs / 1000) % cfg.period);
}

export function formatCode(code: string): string {
  const mid = Math.ceil(code.length / 2);
  return `${code.slice(0, mid)} ${code.slice(mid)}`;
}

export function hmacSha256(key: Uint8Array, msg: Uint8Array): Uint8Array {
  return hmac(sha256, key, msg);
}
