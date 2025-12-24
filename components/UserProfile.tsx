"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { User, Settings, LogOut, Crown, Zap, BarChart3, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

interface UserData {
  id: string;
  name: string;
  email: string;
  plan: string;
  chatsUsed: number;
  chatsLimit: number;
}

export default function UserProfile() {
  const [isOpen, setIsOpen] = useState(false)
  const { data: session } = useSession()
  const router = useRouter()

  if (!session?.user) {
    return null
  }

  const user: UserData = {
    id: session.user.id || '',
    name: session.user.name || 'Unknown',
    email: session.user.email || '',
    plan: (session.user as any).plan || 'Free',
    chatsUsed: (session.user as any).chatsUsed || 0,
    chatsLimit: (session.user as any).chatsLimit || 200,
  }

  const handleLogout = async () => {
    setIsOpen(false)
    await signOut({ redirect: true, callbackUrl: '/auth/login' })
  }

  const handleProfileClick = () => {
    setIsOpen(false)
    router.push('/profile')
  }

  const usagePercentage = (user.chatsUsed / user.chatsLimit) * 100
  const planColor = user.plan === "Pro" ? "purple" : user.plan === "Enterprise" ? "amber" : "gray"
  const planIcon = user.plan === "Pro" ? Zap : user.plan === "Enterprise" ? Crown : BarChart3

  return (
    <div className="relative">
      <Button
        variant="ghost"
        className="flex items-center space-x-2 text-white hover:bg-white/10"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-full flex items-center justify-center">
          <User className="w-4 h-4 text-white" />
        </div>
        <span className="hidden md:block">{user.name}</span>
        <ChevronDown className="w-4 h-4" />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-full mt-2 w-80 z-50"
            >
              <Card className="bg-slate-900/95 backdrop-blur-sm border border-white/10 shadow-xl">
                <CardContent className="p-6 space-y-4">
                  {/* User Info */}
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{user.name}</h3>
                      <p className="text-gray-400 text-sm">{user.email}</p>
                    </div>
                  </div>

                  {/* Plan Badge */}
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex items-center space-x-2 px-3 py-1 bg-${planColor}-500/20 border border-${planColor}-500/50 rounded-full`}
                    >
                      {React.createElement(planIcon, { className: `w-4 h-4 text-${planColor}-400` })}
                      <span className={`text-${planColor}-300 text-sm font-medium`}>{user.plan} Plan</span>
                    </div>
                    {user.plan === "Free" && (
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
                      >
                        Upgrade
                      </Button>
                    )}
                  </div>

                  {/* Usage Stats */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Chats Used</span>
                      <span className="text-white">
                        {user.chatsUsed} / {user.chatsLimit === 50000 ? "∞" : user.chatsLimit}
                      </span>
                    </div>
                    {user.plan === "Free" && (
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-600 to-cyan-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                        />
                      </div>
                    )}
                    {user.plan === "Free" && usagePercentage > 80 && (
                      <p className="text-yellow-400 text-xs">
                        {usagePercentage >= 100
                          ? "Limit reached! Upgrade to continue."
                          : "Approaching limit. Consider upgrading."}
                      </p>
                    )}
                  </div>

                  {/* Menu Items */}
                  <div className="border-t border-white/10 pt-4 space-y-2">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10"
                      onClick={handleProfileClick}
                    >
                      <User className="w-4 h-4 mr-2" />
                      My Profile
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Account Settings
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-gray-300 hover:text-white hover:bg-white/10"
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Usage Analytics
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
