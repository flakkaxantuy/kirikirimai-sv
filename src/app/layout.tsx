import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "E-Permit Dashboard",
  description: "High-Risk Work Permit Digital Form & Dashboard",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${inter.className} min-h-screen bg-slate-100 flex flex-col items-center justify-start antialiased selection:bg-[#2B7A4B] selection:text-white`}>
        {/* Mobile width centered layout without phone frame decorations */}
        <div className="w-full min-h-screen bg-slate-50 flex flex-col shadow-sm">
          {children}
        </div>
      </body>
    </html>
  );
}
