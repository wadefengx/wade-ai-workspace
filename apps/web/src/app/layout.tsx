import type { Metadata } from "next";
import { Providers } from "./providers";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Wade AI Workspace",
  description: "Human, AI, knowledge, and memory in one workspace."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
