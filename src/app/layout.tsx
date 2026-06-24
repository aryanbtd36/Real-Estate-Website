import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aura Estates | Trustworthy Property Discovery & Market Intelligence",
  description: "Discover verified properties, calculate affordability, and make informed real estate investments with Aura Estates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Aura Estates",
    "url": "https://auraestates.com",
    "logo": "https://auraestates.com/logo.png",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+91-522-AURA-EST",
      "contactType": "customer service",
      "areaServed": "IN",
      "availableLanguage": ["en", "hi"]
    },
    "sameAs": [
      "https://facebook.com/auraestates",
      "https://twitter.com/auraestates",
      "https://instagram.com/auraestates"
    ]
  };

  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white text-slate-900`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
