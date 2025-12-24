"use client"

import { useState, useEffect, createContext, useContext, type ReactNode } from "react"

interface User {
  id: string
  name: string
  email: string
  plan: "Free" | "Pro" | "Enterprise"
  chatsUsed: number
  chatsLimit: number
  createdAt: string
  isLoggedIn: boolean
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signup: (name: string, email: string, password: string, plan: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  updateChatsUsed: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Verify user session with server
  const verifySession = async (userData: User) => {
    try {
      const response = await fetch(`/api/auth/user?email=${encodeURIComponent(userData.email)}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        console.log('Session verification failed, logging out')
        logout()
        return false
      }

      // Update user data from server
      const updatedUser = {
        ...userData,
        ...data.user,
        isLoggedIn: true
      }
      setUser(updatedUser)
      localStorage.setItem("g-one-user", JSON.stringify({
        ...updatedUser,
        timestamp: new Date().getTime()
      }))
      return true
    } catch (error) {
      console.error('Session verification error:', error)
      logout()
      return false
    }
  }

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true)
      try {
        // Check for existing session
        const savedUserData = localStorage.getItem("g-one-user")
        if (savedUserData) {
          try {
            const parsed = JSON.parse(savedUserData)
            const { timestamp, ...userData } = parsed

            // Check if session is expired (24 hours)
            const now = new Date().getTime()
            const sessionAge = now - (timestamp || 0)
            const SESSION_DURATION = 24 * 60 * 60 * 1000 // 24 hours

            if (sessionAge > SESSION_DURATION) {
              console.log('Session expired')
              logout()
            } else if (userData && userData.id && userData.email) {
              // Verify session with server
              await verifySession(userData)
            } else {
              logout()
            }
          } catch (error) {
            console.error("Error parsing saved user:", error)
            logout()
          }
        }
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [])

  const login = async (email: string, password: string) => {
    console.log('🔄 Starting login process in auth hook')
    setIsLoading(true)

    try {
      console.log('📤 Making login API request...')
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      console.log('📥 Received response:', {
        status: response.status,
        statusText: response.statusText
      })

      const data = await response.json()
      console.log('📦 Parsed response data:', {
        success: data.success,
        hasUser: !!data.user,
        error: data.error
      })

      if (!response.ok) {
        throw new Error(data.message || 'Login failed')
      }

      console.log('✅ Login successful, updating user state')
      const userData = { ...data.user, isLoggedIn: true }
      setUser(userData)
      localStorage.setItem("g-one-user", JSON.stringify({
        ...userData,
        timestamp: new Date().getTime()
      }))
      return { success: true }
    } catch (error: any) {
      console.error('❌ Login error in auth hook:', error)
      return { success: false, error: error.message }
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (name: string, email: string, password: string, plan: string) => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, plan }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Signup failed')
      }

      const userData = { ...data.user, isLoggedIn: true }
      setUser(userData)
      localStorage.setItem("g-one-user", JSON.stringify({
        ...userData,
        timestamp: new Date().getTime()
      }))
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("g-one-user")
    // Use Next.js router instead of window.location for better navigation
    window.location.href = '/auth/login'
  }

  const updateChatsUsed = () => {
    if (user) {
      const updatedUser = { ...user, chatsUsed: user.chatsUsed + 1 }
      setUser(updatedUser)
      localStorage.setItem("g-one-user", JSON.stringify({
        ...updatedUser,
        timestamp: new Date().getTime()
      }))
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateChatsUsed, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
