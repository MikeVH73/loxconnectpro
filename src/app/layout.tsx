import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "./AuthProvider";
import { Toaster } from "react-hot-toast";
import type { ReactNode } from "react";
import { metadata } from "./metadata";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-mono",
});

export { metadata };

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <Toaster position="top-right" />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
