import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CV Tailor — AI-Assisted CV Matching to Job Vacancies",
  description: "Upload your CV and job vacancy. Match keywords, review AI suggestions in an interactive checklist, and download a tailored ATS-friendly PDF.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-screen flex flex-col bg-slate-50 text-slate-900`}>
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white/70 py-6 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} CV Tailor. Powered by Google Gemini & Supabase.</p>
        </footer>
      </body>
    </html>
  );
}
