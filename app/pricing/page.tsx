"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Check, X, Star } from "lucide-react"
import Navigation from "@/components/Navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/hooks/useAuth"

const pricingPlans = [
  {
    name: "Starter",
    price: { monthly: 29, yearly: 290 },
    description: "Perfect for small businesses and startups",
    features: [
      "Up to 1,000 conversations/month",
      "Basic voice recognition",
      "Email support",
      "Standard response time",
      "Basic analytics",
      "5 integrations",
    ],
    limitations: ["No custom training", "Limited languages (5)", "No priority support"],
    popular: false,
    color: "from-gray-600 to-gray-700",
  },
  {
    name: "Professional",
    price: { monthly: 99, yearly: 990 },
    description: "Ideal for growing businesses",
    features: [
      "Up to 10,000 conversations/month",
      "Advanced voice recognition",
      "Priority email & chat support",
      "Fast response time (<200ms)",
      "Advanced analytics & insights",
      "25 integrations",
      "Custom training",
      "Multi-language support (20+)",
      "API access",
    ],
    limitations: ["No dedicated support", "Limited customization"],
    popular: true,
    color: "from-purple-600 to-cyan-600",
  },
  {
    name: "Enterprise",
    price: { monthly: "Custom", yearly: "Custom" },
    description: "For large organizations with specific needs",
    features: [
      "Unlimited conversations",
      "Premium voice recognition",
      "24/7 dedicated support",
      "Ultra-fast response (<100ms)",
      "Custom analytics dashboard",
      "Unlimited integrations",
      "Advanced custom training",
      "All languages supported (45+)",
      "Full API access",
      "On-premise deployment",
      "Custom SLA",
      "Dedicated account manager",
    ],
    limitations: [],
    popular: false,
    color: "from-amber-600 to-orange-600",
  },
]

const addOns = [
  {
    name: "Advanced Analytics",
    price: 19,
    description: "Detailed conversation insights and performance metrics",
  },
  {
    name: "Custom Voice Training",
    price: 49,
    description: "Train the AI with your specific vocabulary and tone",
  },
  {
    name: "Priority Support",
    price: 29,
    description: "24/7 priority support with dedicated team",
  },
]

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()

  useEffect(() => {
    // If user is not logged in and auth is done loading, they will need to login first
    // We'll handle this in the handleCheckout function
  }, [user, authLoading])

  const priceIds = {
    starter: {
      monthly: "price_1Qz1lrLYn8vJsZEi4dZ3vY5n", // Replace with real IDs
      yearly: "price_1Qz1lrLYn8vJsZEi4dZ3vY5o",
    },
    professional: {
      monthly: "price_1Qz1lsLYn8vJsZEi4dZ3vY5p",
      yearly: "price_1Qz1lsLYn8vJsZEi4dZ3vY5q",
    },
  }

  const handleCheckout = async (planName: string) => {
    // Check if user is logged in
    if (!user || !user.isLoggedIn) {
      // Redirect to login with return URL
      router.push(`/auth/login?redirect=/payment?plan=${planName}&period=${isYearly ? "yearly" : "monthly"}`)
      return
    }

    if (planName === "Enterprise") {
      router.push("/contact")
      return
    }

    // Redirect to payment page to show the working payment form
    const period = isYearly ? "yearly" : "monthly"
    router.push(`/payment?plan=${planName}&period=${period}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navigation />

      <div className="pt-20 px-4 py-12">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Choose the perfect plan for your business. All plans include our core AI features with no hidden fees.
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center space-x-4 mb-8">
              <span className={`text-lg ${!isYearly ? "text-white" : "text-gray-400"}`}>Monthly</span>
              <button
                onClick={() => setIsYearly(!isYearly)}
                className={`relative w-16 h-8 rounded-full transition-colors duration-300 ${
                  isYearly ? "bg-gradient-to-r from-purple-600 to-cyan-600" : "bg-gray-600"
                }`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform duration-300 ${
                    isYearly ? "translate-x-9" : "translate-x-1"
                  }`}
                />
              </button>
              <span className={`text-lg ${isYearly ? "text-white" : "text-gray-400"}`}>
                Yearly
                <span className="ml-2 text-sm bg-green-500/20 text-green-400 px-2 py-1 rounded-full">Save 20%</span>
              </span>
            </div>
          </motion.div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`relative ${plan.popular ? "scale-105" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center">
                      <Star className="w-4 h-4 mr-1" />
                      Most Popular
                    </div>
                  </div>
                )}

                <Card
                  className={`h-full ${
                    plan.popular
                      ? "bg-white/10 border-purple-500/50 shadow-2xl shadow-purple-500/20"
                      : "bg-white/5 border-white/10"
                  } backdrop-blur-sm hover:bg-white/15 transition-all duration-300`}
                >
                  <CardHeader className="text-center pb-4">
                    <CardTitle className="text-2xl font-bold text-white mb-2">{plan.name}</CardTitle>
                    <div className="mb-4">
                      <span className="text-4xl font-bold text-white">
                        {typeof plan.price.monthly === "number" ? "$" : ""}
                        {isYearly ? plan.price.yearly : plan.price.monthly}
                      </span>
                      {typeof plan.price.monthly === "number" && (
                        <span className="text-gray-400 ml-2">/{isYearly ? "year" : "month"}</span>
                      )}
                    </div>
                    <p className="text-gray-300">{plan.description}</p>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Features */}
                    <div className="space-y-3">
                      {plan.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-start space-x-3">
                          <Check className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-300 text-sm">{feature}</span>
                        </div>
                      ))}

                      {plan.limitations.map((limitation, limitIndex) => (
                        <div key={limitIndex} className="flex items-start space-x-3">
                          <X className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-400 text-sm line-through">{limitation}</span>
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={() => handleCheckout(plan.name)}
                      disabled={isLoading}
                      className={`w-full py-3 text-lg font-semibold transition-all ${
                        plan.popular
                          ? "bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
                          : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                      } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {isLoading ? "Processing..." : plan.name === "Enterprise" ? "Contact Sales" : "Get Started"}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Add-ons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-16"
          >
            <h2 className="text-3xl font-bold text-white text-center mb-8">Add-ons & Extensions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {addOns.map((addon, index) => (
                <Card
                  key={index}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">{addon.name}</h3>
                      <span className="text-2xl font-bold text-purple-400">${addon.price}/mo</span>
                    </div>
                    <p className="text-gray-300 text-sm mb-4">{addon.description}</p>
                    <Button
                      variant="outline"
                      className="w-full border-purple-500/50 text-purple-300 hover:bg-purple-500/10"
                    >
                      Add to Plan
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>

          {/* FAQ Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-16"
          >
            <h2 className="text-3xl font-bold text-white text-center mb-8">Frequently Asked Questions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {[
                {
                  question: "Can I change plans anytime?",
                  answer: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.",
                },
                {
                  question: "Is there a free trial?",
                  answer: "We offer a 14-day free trial for all plans. No credit card required to start.",
                },
                {
                  question: "What payment methods do you accept?",
                  answer: "We accept all major credit cards, PayPal, and bank transfers for Enterprise plans.",
                },
                {
                  question: "Do you offer refunds?",
                  answer: "Yes, we offer a 30-day money-back guarantee for all paid plans.",
                },
              ].map((faq, index) => (
                <Card key={index} className="bg-white/5 backdrop-blur-sm border border-white/10">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">{faq.question}</h3>
                    <p className="text-gray-300 text-sm">{faq.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-3xl blur-xl"></div>

              <div className="relative bg-gradient-to-r from-purple-900/50 to-cyan-900/50 backdrop-blur-sm border border-purple-500/30 rounded-3xl p-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-6 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  Ready to Get Started?
                </h2>
                <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                  Join thousands of businesses already using our conversational AI platform.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white px-8 py-4 rounded-full text-lg font-semibold"
                  >
                    Start Free Trial
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-2 border-purple-500/50 text-purple-300 hover:bg-purple-500/10 px-8 py-4 rounded-full text-lg font-semibold backdrop-blur-sm"
                  >
                    Contact Sales
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
