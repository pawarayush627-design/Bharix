import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bharix AI — Think beyond",
  description: "A thoughtful AI workspace for ideas, writing, research, and code.",
  applicationName: "Bharix AI",
  icons: { icon: "/logo.svg" },
};
export const viewport: Viewport = { themeColor: "#edf5ff", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
