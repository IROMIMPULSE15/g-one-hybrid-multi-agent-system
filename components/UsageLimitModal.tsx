"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Zap, Crown, Star, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface UsageLimitModalProps {
  isOpen: boolean
  onClose: () => void
  chatsUsed: number
  chatsLimit: number
  onUpgrade: (plan: string) => void
}

const upgradePlans = [
  {
    name: "Pro",
    price: "$9.99",
    period: "month",
    icon: Zap,
    color: "from-purple-600 to-cyan-600",
    features: [
      "Unlimited chats",
      "Advanced AI features",
      "Priority support",
      "Custom training",
      "Voice recognition",
      "Multiple languages",
    ],
    popular: true,
    savings: "Save 50% for first month",
  },
  {
    name: "Enterprise",
    price: "$29.99",
    period: "month",
    icon: Crown,
    color: "from-amber-600 to-orange-600",
    features: [
      "Everything in Pro",
      "API access",
      "Custom integrations",
      "Dedicated support",
      "White-label options",
      "Advanced analytics",
    ],
    popular: false,
    savings: "Best for teams",
  },
]

export default function UsageLimitModal({ isOpen, onClose, chatsUsed, chatsLimit, onUpgrade }: UsageLimitModalProps) {
  const [selectedPlan, setSelectedPlan] = useState("Pro")

  if (!isOpen) return null

  const usagePercentage = (chatsUsed / chatsLimit) * 100

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        >
          <Card className="bg-slate-900/95 backdrop-blur-sm border border-white/10">
            <CardHeader className="relative">
              <button
                onClick={onClose}
                className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="w-16 h-16 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <Star className="w-8 h-8 text-white" />
                </motion.div>

                <CardTitle className="text-3xl font-bold text-white mb-2">Chat Limit Reached!</CardTitle>
                <p className="text-gray-300 text-lg">
                  You've used {chatsUsed} out of {chatsLimit} free chats
                </p>

                {/* Usage Bar */}
                <div className="mt-4 w-full max-w-md mx-auto">
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Usage</span>
                    <span>{Math.round(usagePercentage)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${usagePercentage}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                      className="bg-gradient-to-r from-purple-600 to-cyan-600 h-3 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-8">
              {/* Upgrade Message */}
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-2">Unlock Unlimited Conversations</h3>
                <p className="text-gray-300">Upgrade to continue chatting with G-One AI and access advanced features</p>
              </div>

              {/* Plans */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {upgradePlans.map((plan) => (
                  <motion.div
                    key={plan.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="relative"
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                        <div className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                          Most Popular
                        </div>
                      </div>
                    )}

                    <Card
                      className={`cursor-pointer transition-all duration-300 ${
                        selectedPlan === plan.name
                          ? "bg-white/10 border-purple-500/50 shadow-lg shadow-purple-500/20"
                          : "bg-white/5 border-white/10 hover:bg-white/8"
                      } ${plan.popular ? "ring-2 ring-purple-500/30" : ""}`}
                      onClick={() => setSelectedPlan(plan.name)}
                    >
                      <CardContent className="p-6">
                        <div className="text-center mb-6">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${plan.color} p-3 mx-auto mb-4`}>
                            <plan.icon className="w-full h-full text-white" />
                          </div>
                          <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                          <div className="text-3xl font-bold text-white">
                            {plan.price}
                            <span className="text-lg text-gray-400">/{plan.period}</span>
                          </div>
                          <p className="text-purple-400 text-sm mt-1">{plan.savings}</p>
                        </div>

                        <ul className="space-y-3 mb-6">
                          {plan.features.map((feature, index) => (
                            <li key={index} className="flex items-center text-gray-300">
                              <div className="w-2 h-2 bg-green-400 rounded-full mr-3 flex-shrink-0" />
                              <span className="text-sm">{feature}</span>
                            </li>
                          ))}
                        </ul>

                        <Button
                          onClick={() => onUpgrade(plan.name)}
                          className={`w-full ${
                            selectedPlan === plan.name
                              ? `bg-gradient-to-r ${plan.color} hover:opacity-90`
                              : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                          }`}
                        >
                          {selectedPlan === plan.name ? (
                            <div className="flex items-center">
                              Upgrade to {plan.name}
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </div>
                          ) : (
                            `Select ${plan.name}`
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Benefits */}
              <div className="bg-gradient-to-r from-purple-900/30 to-cyan-900/30 rounded-xl p-6 border border-purple-500/20">
                <h4 className="text-lg font-semibold text-white mb-4 text-center">Why Upgrade?</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl mb-2">🚀</div>
                    <h5 className="font-semibold text-white">Unlimited Access</h5>
                    <p className="text-gray-300 text-sm">Chat as much as you want without limits</p>
                  </div>
                  <div>
                    <div className="text-2xl mb-2">🧠</div>
                    <h5 className="font-semibold text-white">Advanced AI</h5>
                    <p className="text-gray-300 text-sm">Access to latest AI models and features</p>
                  </div>
                  <div>
                    <div className="text-2xl mb-2">⚡</div>
                    <h5 className="font-semibold text-white">Priority Support</h5>
                    <p className="text-gray-300 text-sm">Get help when you need it most</p>
                  </div>
                </div>
              </div>

              {/* Alternative Options */}
              <div className="text-center space-y-4">
                <p className="text-gray-400 text-sm">
                  Not ready to upgrade?{" "}
                  <button onClick={onClose} className="text-purple-400 hover:text-purple-300 underline">
                    Continue with limited access
                  </button>
                </p>
                <p className="text-gray-500 text-xs">
                  Your free chat limit will reset in 24 hours, or you can upgrade anytime for unlimited access.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
