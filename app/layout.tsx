import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { HydrationErrorSuppressor } from "@/components/HydrationErrorSuppressor"
import SmoothScroll from "@/components/SmoothScroll"

const inter = Inter({ subsets: ["latin"] })


export const dynamic = 'force-dynamic'

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
    <html lang="en" className="lenis">
      <body className={inter.className}>
        <HydrationErrorSuppressor />
        <SmoothScroll />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
