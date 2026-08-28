import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaleThread",
  description: "Track your Messenger and Instagram sales conversations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-50 text-gray-900 antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
