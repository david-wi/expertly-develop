import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConditionalWrapper } from "@/components/layout/conditional-wrapper";
import { SessionProvider } from "@/components/providers/session-provider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Expertly Define - Requirements Management",
  description: "Keep product requirements, code, tests, and delivery work connected over time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased bg-gray-50`}>
        <SessionProvider>
          <ConditionalWrapper>
            {children}
          </ConditionalWrapper>
        </SessionProvider>
      </body>
    </html>
  );
}
