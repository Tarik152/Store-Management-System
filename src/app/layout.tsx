import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "StorePulse — AI Store Management",
  description:
    "Inventory, coupons, losses and AI-powered expiry notifications for your store.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${space.variable} ${mono.variable}`}>
      <body className="ambient">
        <AppShell>{children}</AppShell>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#12141a",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "#f4f5f7",
              borderRadius: "14px",
            },
          }}
        />
      </body>
    </html>
  );
}
