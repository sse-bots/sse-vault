// RFC 6238 TOTP in pure TypeScript (Hermes has no Web Crypto HMAC).
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export interface TotpConfig {
  secret: string;
  digits: number;
  period: number;
  algorithm: "SHA1" | "SHA256" | "SHA512";
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
    const normalizedAlgo = algo === "SHA512" ? "SHA512" : algo === "SHA256" ? "SHA256" : "SHA1";
    const period = Number(p.period || 30);
    return {
      secret,
      digits: Number(p.digits) === 8 ? 8 : 6,
      period: period >= 10 && period <= 120 ? Math.floor(period) : 30,
      algorithm: normalizedAlgo,
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

export function hmac(hash: (m: Uint8Array) => Uint8Array, key: Uint8Array, msg: Uint8Array, block = 64): Uint8Array {
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
  const secretBytes = b32decode(cfg.secret);
  const mac =
    cfg.algorithm === "SHA512"
      ? hmac(sha512, secretBytes, msg, 128)
      : cfg.algorithm === "SHA256"
        ? hmac(sha256, secretBytes, msg, 64)
        : hmac(sha1, secretBytes, msg, 64);
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


// Pure TypeScript SHA-512 using BigInt (supported in React Native 0.76 Hermes)
const K512 = [
  0x428a2f98d728ae22n, 0x7137449123ef65cdn, 0xb5c0fbcfec4d3b2fn, 0xe9b5dba58189dbbcn,
  0x3956c25bf348b538n, 0x59f111f1b605d019n, 0x923f82a4af194f9bn, 0xab1c5ed5da6d8118n,
  0xd807aa98a3030242n, 0x12835b0145706fben, 0x243185be4ee4b28cn, 0x550c7dc3d5ffb4e2n,
  0x72be5d74f27b896fn, 0x80deb1fe3b1696b1n, 0x9bdc06a725c71235n, 0xc19bf174cf692694n,
  0xe49b69c19ef14ad2n, 0xefbe4786384f25e3n, 0x0fc19dc68b8cd5b5n, 0x240ca1cc77ac9c65n,
  0x2de92c6f592b0275n, 0x4a7484aa6ea6e483n, 0x5cb0a9dcbd41fbd4n, 0x76f988da831153b5n,
  0x983e5152ee66dfabn, 0xa831c66d2db43210n, 0xb00327c898fb213fn, 0xbf597fc7beef0ee4n,
  0xc6e00bf33da88fc2n, 0xd5a79147930aa725n, 0x06ca6351e003826fn, 0x142929670a0e6e70n,
  0x27b70a8546d22ffcn, 0x2e1b21385c26c926n, 0x4d2c6dfc5ac42aedn, 0x53380d139d95b3dfn,
  0x650a73548baf63den, 0x766a0abb3c77b2a8n, 0x81c2c92e47edaee6n, 0x92722c851482353bn,
  0xa2bfe8a14cf10364n, 0xa81a664bbc423001n, 0xc24b8b70d0f89791n, 0xc76c51a30654be30n,
  0xd192e819d6ef5218n, 0xd69906245565a910n, 0xf40e35855771202an, 0x106aa07032bbd1b8n,
  0x19a4c116b8d2d0c8n, 0x1e376c085141ab53n, 0x2748774cdf8eeb99n, 0x34b0bcb5e19b48a8n,
  0x391c0cb3c5c95a63n, 0x4ed8aa4ae3418acbn, 0x5b9cca4f7763e373n, 0x682e6ff3d6b2b8a3n,
  0x748f82ee5defb2fcn, 0x78a5636f43172f60n, 0x84c87814a1f0ab72n, 0x8cc702081a6439ecn,
  0x90befffa23631e28n, 0xa4506cebde82bde9n, 0xbef9a3f7b2c67915n, 0xc67178f2e372532bn,
  0xca273eceea26619cn, 0xd186b8c721c0c207n, 0xeada7dd6cde0eb1en, 0xf57d4f7fee6ed178n,
  0x06f067aa72176fban, 0x0a637dc5a2c898a6n, 0x113f9804bef90daen, 0x1b710b35131c471bn,
  0x28db77f523047d84n, 0x32caab7b40c72493n, 0x3c9ebe0a15c9bebcn, 0x431d67c49c100d4cn,
  0x4cc5d4becb3e42b6n, 0x597f299cfc657e2an, 0x5fcb6fab3ad6faecn, 0x6c44198c4a475817n,
];
const MASK64 = 0xffffffffffffffffn;
const rotr64 = (x: bigint, n: bigint) => ((x >> n) | ((x << (64n - n)) & MASK64)) & MASK64;

export function sha512(msg: Uint8Array): Uint8Array {
  const bitLen = BigInt(msg.length) * 8n;
  const padLen = ((msg.length + 17 + 127) >> 7) << 7;
  const buf = new Uint8Array(padLen);
  buf.set(msg);
  buf[msg.length] = 0x80;
  for (let i = 0; i < 8; i++) {
    buf[padLen - 1 - i] = Number((bitLen >> BigInt(i * 8)) & 0xffn);
  }
  const H = [
    0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
    0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n,
  ];
  const w = new Array<bigint>(80);
  for (let off = 0; off < padLen; off += 128) {
    for (let i = 0; i < 16; i++) {
      let v = 0n;
      for (let j = 0; j < 8; j++) v = (v << 8n) | BigInt(buf[off + i * 8 + j]);
      w[i] = v;
    }
    for (let i = 16; i < 80; i++) {
      const s0 = rotr64(w[i - 15], 1n) ^ rotr64(w[i - 15], 8n) ^ (w[i - 15] >> 7n);
      const s1 = rotr64(w[i - 2], 19n) ^ rotr64(w[i - 2], 61n) ^ (w[i - 2] >> 6n);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) & MASK64;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 80; i++) {
      const S1 = rotr64(e, 14n) ^ rotr64(e, 18n) ^ rotr64(e, 41n);
      const ch = (e & f) ^ (~e & MASK64 & g);
      const t1 = (h + S1 + ch + K512[i] + w[i]) & MASK64;
      const S0 = rotr64(a, 28n) ^ rotr64(a, 34n) ^ rotr64(a, 39n);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) & MASK64;
      h = g; g = f; f = e; e = (d + t1) & MASK64;
      d = c; c = b; b = a; a = (t1 + t2) & MASK64;
    }
    H[0] = (H[0] + a) & MASK64; H[1] = (H[1] + b) & MASK64;
    H[2] = (H[2] + c) & MASK64; H[3] = (H[3] + d) & MASK64;
    H[4] = (H[4] + e) & MASK64; H[5] = (H[5] + f) & MASK64;
    H[6] = (H[6] + g) & MASK64; H[7] = (H[7] + h) & MASK64;
  }
  const out = new Uint8Array(64);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      out[i * 8 + j] = Number((H[i] >> BigInt((7 - j) * 8)) & 0xffn);
    }
  }
  return out;
}
