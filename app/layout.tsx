import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pinoctular - Pino Log Viewer",
  description: "A lightweight Pino log viewer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
