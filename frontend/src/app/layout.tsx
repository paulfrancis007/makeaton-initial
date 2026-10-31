import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brightloop - Subscription Management",
  description: "Subscription Management System for Admin, Staff and Customers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased flex flex-col">{children}</body>
    </html>
  );
}
