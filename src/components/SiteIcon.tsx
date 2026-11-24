"use client";

import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { getAppNameForDomain, getFaviconUrls } from "@/lib/domain";

const MONOGRAM_GRADIENTS = [
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-violet-500 to-purple-600",
  "from-rose-500 to-pink-600",
  "from-sky-500 to-indigo-600",
];

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function SiteIcon({
  domainOrUrl,
  label,
  size = "md",
  className = "",
}: {
  domainOrUrl: string;
  label?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const { primary, fallback, domain } = getFaviconUrls(domainOrUrl);
  const [stage, setStage] = useState<"primary" | "fallback" | "monogram">(
    primary ? "primary" : "monogram"
  );

  useEffect(() => {
    setStage(primary ? "primary" : "monogram");
  }, [primary, domain]);

  const sizeMap = {
    sm: { box: "h-8 w-8 rounded-xl", img: "h-5 w-5", text: "text-xs" },
    md: { box: "h-11 w-11 rounded-2xl", img: "h-6 w-6", text: "text-sm" },
    lg: { box: "h-14 w-14 rounded-2xl", img: "h-8 w-8", text: "text-base" },
    xl: { box: "h-16 w-16 rounded-3xl", img: "h-9 w-9", text: "text-lg" },
  }[size];

  const displayTitle = label || getAppNameForDomain(domain) || "Site";
  const initials = displayTitle
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "V";

  const gradient =
    MONOGRAM_GRADIENTS[hashString(domain || displayTitle) % MONOGRAM_GRADIENTS.length];

  if (!domain) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center border border-zinc-500/20 bg-zinc-500/10 text-zinc-400 ${sizeMap.box} ${className}`}
      >
        <Globe className={sizeMap.img} />
      </div>
    );
  }

  if (stage === "monogram") {
    return (
      <div
        className={`flex shrink-0 items-center justify-center bg-gradient-to-br font-extrabold text-white shadow-sm ${gradient} ${sizeMap.box} ${sizeMap.text} ${className}`}
      >
        {initials}
      </div>
    );
  }

  const src = stage === "primary" ? primary! : fallback!;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-black/10 bg-white shadow-sm dark:border-white/15 ${sizeMap.box} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${displayTitle} icon`}
        className={`${sizeMap.img} object-contain`}
        loading="lazy"
        onError={() => {
          if (stage === "primary" && fallback) {
            setStage("fallback");
          } else {
            setStage("monogram");
          }
        }}
      />
    </div>
  );
}
