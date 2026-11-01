import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "One Last Note | Farewell Notebook",
  description: "A customizable farewell notebook for your next chapter.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
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
