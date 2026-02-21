import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CogniFlow — AI Knowledge Agent",
  description: "Upload documents, ask questions, get insights powered by RAG + GPT-4o",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
