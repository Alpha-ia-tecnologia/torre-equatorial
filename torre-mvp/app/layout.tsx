import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Torre | Apuração de Investimentos",
  description: "Gestão, apuração e consolidação de desempenho da Torre de Investimentos.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
