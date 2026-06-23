import type { Metadata } from "next";
import { ThemeProvider } from "@/lib/ThemeContext";
import "./globals.css"; // Ensure this points to your css file

export const metadata: Metadata = {
  title: "Dubbing Studio Pro",
  description: "Interactive voice acting application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* The body tag is mandatory here */}
      <body className="antialiased bg-gray-950 text-white">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
