import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { HydrationErrorSuppressor } from "@/components/HydrationErrorSuppressor"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CIA Agent - AI Intelligence Platform",
  description:
    "Advanced AI-powered intelligence assistant for modern businesses. Secure, reliable, and built for professional use.",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <HydrationErrorSuppressor />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
