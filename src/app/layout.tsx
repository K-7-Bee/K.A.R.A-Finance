import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KARA Finance",
  description: "Personal finance: see what you have, where it goes, and what you can safely spend.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
