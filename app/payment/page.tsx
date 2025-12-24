"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, Lock, CreditCard } from "lucide-react"
import Link from "next/link"
import Navigation from "@/components/Navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

function PaymentPageContent() {
  const searchParams = useSearchParams()
  const plan = searchParams.get("plan") || "Professional"
  const period = searchParams.get("period") || "monthly"

  const [formData, setFormData] = useState({
    email: "",
    cardName: "",
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    address: "",
    zipCode: "",
  })

  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "error">("idle")

  const planDetails = {
    Starter: { price: period === "yearly" ? 290 : 29, features: 5 },
    Professional: { price: period === "yearly" ? 990 : 99, features: 9 },
  }

  const currentPlan = planDetails[plan as keyof typeof planDetails] || planDetails.Professional

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    
    // Format card number
    if (name === "cardNumber") {
      const formatted = value.replace(/\s/g, "").replace(/(\d{4})/g, "$1 ").trim()
      setFormData(prev => ({ ...prev, [name]: formatted }))
      return
    }

    // Format expiry date
    if (name === "expiryDate") {
      const formatted = value.replace(/\D/g, "").slice(0, 4)
      if (formatted.length >= 2) {
        setFormData(prev => ({ ...prev, [name]: `${formatted.slice(0, 2)}/${formatted.slice(2)}` }))
      } else {
        setFormData(prev => ({ ...prev, [name]: formatted }))
      }
      return
    }

    // Limit CVV
    if (name === "cvv") {
      setFormData(prev => ({ ...prev, [name]: value.slice(0, 4) }))
      return
    }

    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)
    setPaymentStatus("processing")

    // Simulate payment processing
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Validate form
      if (!formData.email || !formData.cardName || !formData.cardNumber || !formData.expiryDate || !formData.cvv) {
        throw new Error("Please fill in all fields")
      }

      setPaymentStatus("success")
      setTimeout(() => {
        window.location.href = "/success"
      }, 1500)
    } catch (error: any) {
      setPaymentStatus("error")
      setTimeout(() => {
        setPaymentStatus("idle")
        setIsProcessing(false)
      }, 3000)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navigation />

      <div className="pt-20 px-4 py-12">
        <div className="container mx-auto max-w-5xl">
          <Link href="/pricing" className="inline-flex items-center text-purple-400 hover:text-purple-300 mb-8">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Pricing
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Payment Form */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="lg:col-span-2"
            >
              <Card className="bg-white/5 backdrop-blur-sm border border-white/10">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-white">Payment Details</CardTitle>
                  <p className="text-gray-400 text-sm mt-2">Enter your payment information securely</p>
                </CardHeader>

                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Email */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                      <Input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="bg-white/10 border-white/20 text-white placeholder-gray-500 focus:border-purple-500"
                        placeholder="you@example.com"
                        required
                      />
                    </div>

                    {/* Card Details Section */}
                    <div className="border-t border-white/10 pt-6">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <CreditCard className="w-5 h-5 mr-2 text-purple-400" />
                        Card Details
                      </h3>

                      <div className="space-y-4">
                        {/* Cardholder Name */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Cardholder Name</label>
                          <Input
                            type="text"
                            name="cardName"
                            value={formData.cardName}
                            onChange={handleInputChange}
                            className="bg-white/10 border-white/20 text-white placeholder-gray-500 focus:border-purple-500"
                            placeholder="John Doe"
                            required
                          />
                        </div>

                        {/* Card Number */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Card Number</label>
                          <Input
                            type="text"
                            name="cardNumber"
                            value={formData.cardNumber}
                            onChange={handleInputChange}
                            className="bg-white/10 border-white/20 text-white placeholder-gray-500 focus:border-purple-500 font-mono"
                            placeholder="4242 4242 4242 4242"
                            maxLength={19}
                            required
                          />
                          <p className="text-gray-500 text-xs mt-2">Use 4242 4242 4242 4242 for testing</p>
                        </div>

                        {/* Expiry & CVV */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Expiry Date</label>
                            <Input
                              type="text"
                              name="expiryDate"
                              value={formData.expiryDate}
                              onChange={handleInputChange}
                              className="bg-white/10 border-white/20 text-white placeholder-gray-500 focus:border-purple-500"
                              placeholder="MM/YY"
                              maxLength={5}
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">CVV</label>
                            <Input
                              type="text"
                              name="cvv"
                              value={formData.cvv}
                              onChange={handleInputChange}
                              className="bg-white/10 border-white/20 text-white placeholder-gray-500 focus:border-purple-500 font-mono"
                              placeholder="123"
                              maxLength={4}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Billing Address */}
                    <div className="border-t border-white/10 pt-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Billing Address</h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Street Address</label>
                          <Input
                            type="text"
                            name="address"
                            value={formData.address}
                            onChange={handleInputChange}
                            className="bg-white/10 border-white/20 text-white placeholder-gray-500 focus:border-purple-500"
                            placeholder="123 Main St"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">ZIP Code</label>
                          <Input
                            type="text"
                            name="zipCode"
                            value={formData.zipCode}
                            onChange={handleInputChange}
                            className="bg-white/10 border-white/20 text-white placeholder-gray-500 focus:border-purple-500"
                            placeholder="12345"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Status Messages */}
                    {paymentStatus === "error" && (
                      <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                        <p className="text-red-300 text-sm">Payment failed. Please check your details and try again.</p>
                      </div>
                    )}

                    {paymentStatus === "success" && (
                      <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
                        <p className="text-green-300 text-sm">Payment successful! Redirecting to success page...</p>
                      </div>
                    )}

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      disabled={isProcessing}
                      className="w-full py-3 text-lg font-semibold bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          Processing Payment...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <Lock className="w-5 h-5 mr-2" />
                          Pay ${currentPlan.price}
                        </div>
                      )}
                    </Button>

                    <p className="text-gray-500 text-xs text-center">
                      Your payment information is encrypted and secure
                    </p>
                  </form>
                </CardContent>
              </Card>
            </motion.div>

            {/* Order Summary */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <Card className="bg-white/5 backdrop-blur-sm border border-white/10 sticky top-24">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-white">Order Summary</CardTitle>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Plan Details */}
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Plan</span>
                      <span className="text-white font-semibold">{plan} Plan</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Billing</span>
                      <span className="text-white font-semibold capitalize">{period}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Free Trial</span>
                      <span className="text-green-400 font-semibold">14 days</span>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="border-t border-white/10 pt-6">
                    <h4 className="text-white font-semibold mb-3">Included Features</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="text-gray-400">✓ AI-powered conversations</li>
                      <li className="text-gray-400">✓ Advanced analytics</li>
                      <li className="text-gray-400">✓ Priority support</li>
                      <li className="text-gray-400">✓ API access</li>
                      <li className="text-gray-400">✓ Custom integrations</li>
                    </ul>
                  </div>

                  {/* Pricing */}
                  <div className="border-t border-white/10 pt-6">
                    <div className="flex justify-between mb-3">
                      <span className="text-gray-400">Subtotal</span>
                      <span className="text-white">${currentPlan.price}</span>
                    </div>
                    <div className="flex justify-between mb-4">
                      <span className="text-gray-400">Tax</span>
                      <span className="text-white">$0.00</span>
                    </div>
                    <div className="border-t border-white/10 pt-4 flex justify-between">
                      <span className="text-white font-bold">Total</span>
                      <span className="text-2xl font-bold text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text">
                        ${currentPlan.price}
                      </span>
                    </div>
                  </div>

                  {/* Security Badge */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                    <p className="text-gray-400 text-xs flex items-center justify-center">
                      <Lock className="w-3 h-3 mr-1" />
                      Secure payments by Stripe
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

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <PaymentPageContent />
    </Suspense>
  )
}
