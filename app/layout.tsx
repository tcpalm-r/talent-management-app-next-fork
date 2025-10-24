import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Talent Management App",
  description: "9-Box Talent Assessment and Management Platform",
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
