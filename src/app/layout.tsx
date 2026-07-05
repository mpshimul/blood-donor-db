import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";

const notoSansBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-bengali",
  display: "swap",
});

export const metadata: Metadata = {
  title: "রক্তদাতা ডাটাবেস",
  description: "রক্তদাতা খুঁজুন কয়েক সেকেন্ডেই",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" suppressHydrationWarning className={notoSansBengali.variable}>
      <body className={`${notoSansBengali.className} bg-gray-50 dark:bg-gray-900 min-h-screen flex flex-col transition-colors duration-300`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}