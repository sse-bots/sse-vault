import jsQR from "jsqr";

export interface DecodedTotpQr {
  raw: string;
  secretOrUri: string;
  issuer?: string;
  account?: string;
}

export function extractTotpFromQrText(raw: string): DecodedTotpQr | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;

  if (trimmed.toLowerCase().startsWith("otpauth://totp/")) {
    try {
      const u = new URL(trimmed);
      const secret = (u.searchParams.get("secret") || "")
        .toUpperCase()
        .replace(/[^A-Z2-7]/g, "");
      if (secret.length < 8) return null;

      const labelPart = decodeURIComponent(u.pathname.replace(/^\/+/, ""));
      const parts = labelPart.split(":");
      const issuer =
        (u.searchParams.get("issuer") || "").trim() ||
        (parts.length > 1 ? parts[0].trim() : "");
      const account =
        parts.length > 1 ? parts.slice(1).join(":").trim() : labelPart.trim();

      return {
        raw: trimmed,
        secretOrUri: trimmed,
        issuer: issuer || undefined,
        account: account || undefined,
      };
    } catch {
      return null;
    }
  }

  const cleaned = trimmed.toUpperCase().replace(/[^A-Z2-7]/g, "");
  if (cleaned.length >= 16) {
    return { raw: trimmed, secretOrUri: cleaned };
  }
  return null;
}

export async function decodeQrFromImageFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    const win = window as unknown as {
      BarcodeDetector?: new (opts: { formats: string[] }) => {
        detect: (img: ImageBitmap) => Promise<Array<{ rawValue?: string }>>;
      };
    };
    if (typeof win.BarcodeDetector === "function") {
      try {
        const detector = new win.BarcodeDetector({ formats: ["qr_code"] });
        const found = await detector.detect(bitmap);
        const val = found.find((f) => f.rawValue)?.rawValue;
        if (val) return val;
      } catch {
        /* fallback */
      }
    }

    const maxDim = 1200;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const decoded = jsQR(imgData.data, width, height, {
      inversionAttempts: "attemptBoth",
    });
    return decoded?.data || null;
  } finally {
    bitmap.close();
  }
}
