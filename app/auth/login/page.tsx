"use client"

import type React from "react"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { motion } from "framer-motion"
import { Eye, EyeOff, Mail, Lock, ArrowRight, Github, Chrome } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Navigation from "@/components/Navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

function LoginPageContent() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get("redirect") || "/demo"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🔄 Starting form submission');
    setError("")
    setIsLoading(true)

    try {
      console.log('📤 Calling NextAuth signIn with email:', formData.email);
      // Use NextAuth signIn with Credentials provider
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      console.log('📥 SignIn result:', {
        ok: result?.ok,
        error: result?.error
      });

      if (!result?.ok) {
        throw new Error(result?.error || 'Failed to login')
      }
      
      console.log('✅ Login successful, redirecting to:', redirectUrl);
      router.push(redirectUrl)
    } catch (err: any) {
      console.error('❌ Login form error:', err)
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSocialLogin = async (provider: string) => {
    setError("")
    setIsLoading(true)
    try {
      const result = await signIn(provider.toLowerCase(), {
        redirect: false,
        callbackUrl: redirectUrl,
      })

      if (result?.error) {
        setError(result.error || `${provider} login failed`)
        setIsLoading(false)
        return
      }

      if (result?.ok) {
        router.push(redirectUrl)
      }
    } catch (err: any) {
      console.error(`${provider} login error:`, err)
      setError(`Failed to login with ${provider}`)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navigation />

      <div className="pt-20 px-4 py-12">
        <div className="container mx-auto max-w-md">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <Card className="bg-white/5 backdrop-blur-sm border border-white/10">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold text-white mb-2">Welcome Back</CardTitle>
                <p className="text-gray-300">Sign in to your G-One AI account</p>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Social Login Buttons */}
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full border-white/40 bg-white/5 text-white hover:bg-white/15 transition-colors disabled:opacity-50"
                    onClick={() => handleSocialLogin("Google")}
                    disabled={isLoading}
                  >
                    <Chrome className="w-4 h-4 mr-2" />
                    {isLoading ? "Signing in..." : "Continue with Google"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-white/40 bg-white/5 text-white hover:bg-white/15 transition-colors opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <Github className="w-4 h-4 mr-2" />
                    Continue with GitHub (Coming Soon)
                  </Button>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/20"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-slate-900 text-gray-400">Or continue with email</span>
                  </div>
                </div>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                      <p className="text-red-300 text-sm">{error}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="pl-10 bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-purple-500"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-purple-500"
                        placeholder="Enter your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="rounded border-white/20 bg-white/10 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="ml-2 text-sm text-gray-300">Remember me</span>
                    </label>
                    <Link href="/auth/forgot-password" className="text-sm text-purple-400 hover:text-purple-300">
                      Forgot password?
                    </Link>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
                  >
                    {isLoading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Signing in...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        Sign In
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </div>
                    )}
                  </Button>
                </form>

                <div className="text-center">
                  <p className="text-gray-400">
                    Don't have an account?{" "}
                    <Link href="/auth/signup" className="text-purple-400 hover:text-purple-300 font-medium">
                      Sign up
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Features Preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="mt-8 text-center"
            >
              <p className="text-gray-400 text-sm mb-4">Sign in to unlock:</p>
              <div className="flex justify-center space-x-6 text-sm">
                <div className="text-purple-400">✓ Unlimited chats</div>
                <div className="text-cyan-400">✓ Advanced AI features</div>
                <div className="text-green-400">✓ Priority support</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center"><p className="text-white">Loading...</p></div>}>
      <LoginPageContent />
    </Suspense>
  )
}
