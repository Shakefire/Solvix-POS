import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solvix POS - Point of Sales System",
  description: "Desktop Point of Sales System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
