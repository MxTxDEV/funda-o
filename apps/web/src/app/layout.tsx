import "@fontsource-variable/inter";
import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: { default: "Virtual Company", template: "%s · Virtual Company" },
  description: "Centro de comando da Virtual Company — empresa operada por funcionários virtuais.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#090c11", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
