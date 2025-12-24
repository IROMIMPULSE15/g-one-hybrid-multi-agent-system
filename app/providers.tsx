"use client"

import { ReactNode } from "react"
import { SessionProvider } from "next-auth/react"
import { AuthProvider } from "@/hooks/useAuth"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <AuthProvider>{children}</AuthProvider>
    </SessionProvider>
  )
}
