"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle } from "lucide-react"
import Navigation from "@/components/Navigation"
import { Button } from "@/components/ui/button"

export default function SuccessPage() {
  const [sessionId, setSessionId] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setSessionId(params.get("session_id") || "")
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navigation />

      <div className="pt-20 px-4 py-12">
        <div className="container mx-auto max-w-md text-center">
          <div className="mb-6">
            <CheckCircle className="w-24 h-24 text-green-400 mx-auto" />
          </div>

          <h1 className="text-4xl font-bold text-white mb-4">Payment Successful!</h1>
          <p className="text-xl text-gray-300 mb-2">
            Thank you for your subscription.
          </p>
          <p className="text-gray-400 mb-8">
            {sessionId && (
              <span className="text-sm">
                Session ID: <code className="bg-white/10 px-2 py-1 rounded">{sessionId}</code>
              </span>
            )}
          </p>

          <div className="space-y-4">
            <p className="text-gray-300">
              A confirmation email has been sent to your inbox with your billing details.
            </p>

            <div className="space-y-3">
              <Link href="/demo">
                <Button className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white">
                  Go to Dashboard
                </Button>
              </Link>

              <Link href="/pricing">
                <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
                  Back to Pricing
                </Button>
              </Link>
            </div>
          </div>

          <div className="mt-12 p-6 bg-white/5 border border-white/10 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-4">Next Steps</h2>
            <ul className="text-gray-300 text-sm space-y-2 text-left">
              <li>✅ Check your email for confirmation</li>
              <li>✅ Access your account immediately</li>
              <li>✅ Manage your subscription in settings</li>
              <li>✅ Contact support if you need help</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
