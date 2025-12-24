"use client"

import type React from "react"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import { motion } from "framer-motion"
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Github, Chrome, Check } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Navigation from "@/components/Navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["200 free chats", "Basic AI responses", "Standard support"],
    popular: false,
  },
  {
    name: "Pro",
    price: "$9.99",
    period: "month",
    features: ["Unlimited chats", "Advanced AI features", "Priority support", "Custom training"],
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$29.99",
    period: "month",
    features: ["Everything in Pro", "API access", "Custom integrations", "Dedicated support"],
    popular: false,
  },
]

function SignupPageContent() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState("Free")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const router = useRouter()

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords don't match")
      setIsLoading(false)
      return
    }

    if (!agreedToTerms) {
      setError("Please agree to the terms and conditions")
      setIsLoading(false)
      return
    }

    try {
      console.log('📤 Creating user account...')
      // First, create the user account
      const signupResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          plan: selectedPlan
        }),
      })

      if (!signupResponse.ok) {
        const data = await signupResponse.json()
        throw new Error(data.message || 'Signup failed')
      }

      console.log('✅ User account created, now signing in...')
      // Now sign in the user with NextAuth
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (!result?.ok) {
        throw new Error(result?.error || 'Failed to sign in after signup')
      }
      
      console.log('✅ Signed in successfully, redirecting to demo...')
      router.push('/demo')
    } catch (err: any) {
      console.error('❌ Signup error:', err)
      setError(err.message || "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialSignup = async (provider: string) => {
    setError("")
    setIsLoading(true)
    try {
      const result = await signIn(provider.toLowerCase(), {
        redirect: false,
        callbackUrl: "/demo",
      })

      if (result?.error) {
        setError(result.error || `${provider} signup failed`)
        setIsLoading(false)
        return
      }

      if (result?.ok) {
        router.push("/demo")
      }
    } catch (err: any) {
      console.error(`${provider} signup error:`, err)
      setError(`Failed to sign up with ${provider}`)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navigation />

      <div className="pt-20 px-4 py-12">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-8"
          >
            <h1 className="text-4xl font-bold text-white mb-4">Join G-One AI</h1>
            <p className="text-xl text-gray-300">Choose your plan and start your AI journey</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Plan Selection */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <h2 className="text-2xl font-bold text-white mb-6">Choose Your Plan</h2>
              <div className="space-y-4">
                {plans.map((plan) => (
                  <Card
                    key={plan.name}
                    className={`cursor-pointer transition-all duration-300 ${
                      selectedPlan === plan.name
                        ? "bg-purple-500/20 border-purple-500/50 backdrop-blur-sm"
                        : "bg-white/5 border-white/10 hover:bg-white/10 backdrop-blur-sm"
                    } ${plan.popular ? "ring-2 ring-purple-500/50" : ""}`}
                    onClick={() => setSelectedPlan(plan.name)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-white flex items-center">
                            {plan.name}
                            {plan.popular && (
                              <span className="ml-2 px-2 py-1 bg-purple-500 text-white text-xs rounded-full">
                                Popular
                              </span>
                            )}
                          </h3>
                          <p className="text-gray-300">
                            {plan.price}
                            <span className="text-sm">/{plan.period}</span>
                          </p>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            selectedPlan === plan.name ? "border-purple-500 bg-purple-500" : "border-gray-400"
                          }`}
                        >
                          {selectedPlan === plan.name && <Check className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                      <ul className="space-y-2">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-center text-gray-300 text-sm">
                            <Check className="w-4 h-4 text-green-400 mr-2 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>

            {/* Signup Form */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <Card className="bg-white/5 backdrop-blur-sm border border-white/10">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-white">Create Account</CardTitle>
                  <p className="text-gray-300">Get started with {selectedPlan} plan</p>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Social Signup Buttons */}
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full border-white/40 bg-white/5 text-white hover:bg-white/15 transition-colors disabled:opacity-50"
                      onClick={() => handleSocialSignup("Google")}
                      disabled={isLoading}
                    >
                      <Chrome className="w-4 h-4 mr-2" />
                      {isLoading ? "Signing up..." : "Sign up with Google"}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-white/40 bg-white/5 text-white hover:bg-white/15 transition-colors opacity-50 cursor-not-allowed"
                      disabled
                    >
                      <Github className="w-4 h-4 mr-2" />
                      Sign up with GitHub (Coming Soon)
                    </Button>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/20"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-slate-900 text-gray-400">Or sign up with email</span>
                    </div>
                  </div>

                  {/* Signup Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          className="pl-10 bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-purple-500"
                          placeholder="Enter your full name"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
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
                          onChange={handleInputChange}
                          className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-purple-500"
                          placeholder="Create a password"
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

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-purple-500"
                          placeholder="Confirm your password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="rounded border-white/20 bg-white/10 text-purple-600 focus:ring-purple-500 mt-1"
                      />
                      <label className="ml-2 text-sm text-gray-300">
                        I agree to the{" "}
                        <Link href="/terms" className="text-purple-400 hover:text-purple-300">
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link href="/privacy" className="text-purple-400 hover:text-purple-300">
                          Privacy Policy
                        </Link>
                      </label>
                    </div>

                    {error && (
                      <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                        <p className="text-red-300 text-sm">{error}</p>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
                    >
                      {isLoading ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Creating account...
                        </div>
                      ) : (
                        <div className="flex items-center">
                          Create Account
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </div>
                      )}
                    </Button>
                  </form>

                  <div className="text-center">
                    <p className="text-gray-400">
                      Already have an account?{" "}
                      <Link href="/auth/login" className="text-purple-400 hover:text-purple-300 font-medium">
                        Sign in
                      </Link>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center"><p className="text-white">Loading...</p></div>}>
      <SignupPageContent />
    </Suspense>
  )
}
