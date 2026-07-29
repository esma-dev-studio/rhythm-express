import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "リズム・エクスプレス";
const description =
  "音楽に合わせてビート列車で3つの世界を旅する、子ども向けWebリズムゲーム";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

function firstForwardedValue(value: string | null): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}

function configuredOrigin(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      return new URL(configured);
    } catch {
      // Ignore an invalid optional override and use the local fallback.
    }
  }
  return new URL("http://localhost:3000");
}

function requestOrigin(requestHeaders: Headers): URL {
  const host =
    firstForwardedValue(requestHeaders.get("x-forwarded-host")) ??
    firstForwardedValue(requestHeaders.get("host"));
  const forwardedProto = firstForwardedValue(
    requestHeaders.get("x-forwarded-proto"),
  );
  const protocol =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : host?.startsWith("localhost") || host?.startsWith("127.0.0.1")
        ? "http"
        : "https";

  if (host && !/[\/\\\s]/.test(host)) {
    try {
      return new URL(protocol + "://" + host);
    } catch {
      // Fall through to the configured or local origin.
    }
  }
  return configuredOrigin();
}

export async function generateMetadata(): Promise<Metadata> {
  const origin = requestOrigin(await headers());
  const socialImage = new URL("/og.png", origin).toString();

  return {
    metadataBase: origin,
    title,
    description,
    applicationName: title,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      url: "/",
      locale: "ja_JP",
      siteName: title,
      title,
      description,
      images: [{ url: socialImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /></head>
      <body>{children}</body>
    </html>
  );
}