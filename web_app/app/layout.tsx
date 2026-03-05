import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { StoreHydration } from "@/components/store-hydration";
import { ThemeProvider } from "@/components/theme-provider";
import { BottomNav } from "@/components/ui/bottom-nav";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "SubsControl – Zarządzaj subskrypcjami",
  description: "Aplikacja do zarządzania subskrypcjami: Netflix, Spotify, HBO i inne. Śledź wydatki, otrzymuj powiadomienia o płatnościach.",
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning – klasa `dark` dodawana przez JS po stronie klienta
    <html lang="pl" className={inter.variable} suppressHydrationWarning>
      <body className="antialiased bg-gray-50 dark:bg-gray-950 min-h-screen font-[var(--font-inter),Inter,system-ui,sans-serif]">
        <ThemeProvider>
          <StoreHydration />
          {children}
          <BottomNav />
          {/* Sonner – powiadomienia toast */}
          <Toaster
            position="top-center"
            richColors
            expand={false}
            closeButton
            toastOptions={{
              style: { borderRadius: "12px" },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}

