"use client"

import { useState, useRef, useEffect, useCallback, Suspense, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Mic, MicOff, Send, Bot, User, Info, Lock, Search, AlertCircle,
  Stethoscope, BookOpen, Image as ImageIcon, Upload, X,
  Sparkles, Brain, Loader2, Trash2, Settings
} from "lucide-react"
import dynamic from "next/dynamic"
import Navigation from "@/components/Navigation"
import Text from "@/components/Text"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import UsageLimitModal from "@/components/UsageLimitModal"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Optimized dynamic imports with loading states
const Canvas = dynamic(() => import("@react-three/fiber").then((mod) => ({ default: mod.Canvas })), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gradient-to-br from-purple-900/20 to-cyan-900/20 animate-pulse" />
})

const Environment = dynamic(() => import("@react-three/drei").then((mod) => ({ default: mod.Environment })), {
  ssr: false,
})

const OrbitControls = dynamic(() => import("@react-three/drei").then((mod) => ({ default: mod.OrbitControls })), {
  ssr: false,
})

const WaveVisualization = dynamic(() => import("@/components/3d/WaveVisualization"), {
  ssr: false,
})

// Constants
const PLANS = {
  FREE: "Free",
  PRO: "Pro",
  PREMIUM: "Premium"
} as const

const MESSAGE_TYPES = {
  USER: "user",
  ASSISTANT: "assistant"
} as const

const MODES = {
  AUTO: 'auto',
  DEEPSEARCH: 'deepsearch',
  WIKIPEDIA: 'wikipedia',
  MEDICAL: 'medical',
  IMAGE: 'image',
  TEXT_TO_IMAGE: 'text-to-image'
} as const

// Enhanced extension options with RAG and Text-to-Image
const extensionOptions = [
  {
    id: 'wikipedia',
    title: "Wikipedia Search",
    description: "Search using scraped data",
    prefix: "wikipedia",
    icon: <BookOpen className="w-6 h-6 text-blue-400 group-hover:text-blue-300" />,
    requiresPaid: true,
    color: "blue"
  },
  {
    id: 'deepsearch',
    title: "Deep Search",
    description: "Provides precise answers",
    prefix: "deep search",
    icon: <Search className="w-6 h-6 text-green-400 group-hover:text-green-300" />,
    requiresPaid: true,
    color: "green"
  },
  {
    id: 'medical',
    title: "Medical Search",
    description: "Health-related information",
    prefix: "medical information about",
    icon: <Stethoscope className="w-6 h-6 text-red-400 group-hover:text-red-300" />,
    requiresPaid: true,
    color: "red"
  },
  {
    id: 'image-analysis',
    title: "Image Processing",
    description: "Analyze and process images",
    prefix: "image analysis",
    icon: <ImageIcon className="w-6 h-6 text-purple-400 group-hover:text-purple-300" />,
    requiresPaid: true,
    color: "purple"
  },
  {
    id: 'text-to-image',
    title: "Text to Image",
    description: "Generate images from text",
    prefix: "generate image",
    icon: <Sparkles className="w-6 h-6 text-pink-400 group-hover:text-pink-300" />,
    requiresPaid: true,
    color: "pink"
  },
]

// Types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

interface Message {
  id: string
  type: "user" | "assistant"
  content: string
  timestamp: Date
  imageUrl?: string
  generatedImageUrl?: string
  reasoning?: string
  mode?: string
}

export default function DemoPage() {
  // State management - grouped by concern
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState("")
  const [speechSupported, setSpeechSupported] = useState(false)
  const [speechError, setSpeechError] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showUsageModal, setShowUsageModal] = useState(false)
  const [searchMode, setSearchMode] = useState<string | null>(null)
  const [selectedMode, setSelectedMode] = useState<keyof typeof MODES>('AUTO')
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [thinkingTime, setThinkingTime] = useState<number | null>(null)

  const { data: session, status } = useSession()
  const router = useRouter()

  // Convert session to user object for compatibility
  const user = session?.user ? {
    id: (session.user as any).id || '',
    name: session.user.name || 'Guest',
    email: session.user.email || '',
    plan: (session.user as any).plan || 'Free',
    chatsUsed: (session.user as any).chatsUsed || 0,
    chatsLimit: (session.user as any).chatsLimit || 200,
    createdAt: new Date().toISOString(),
    isLoggedIn: true
  } : null

  const isLoading = status === 'loading'
  const updateChatsUsed = () => {
    // This will be handled by NextAuth session updates
  }

  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Memoized values
  const canUseExtension = useMemo(() => {
    if (!user) return false
    return user.plan !== PLANS.FREE
  }, [user])

  const userPlanBadge = useMemo(() => {
    if (!user) return null

    const badges = {
      [PLANS.FREE]: { bg: "bg-gray-500/20", text: "text-gray-300", label: "General Chat Only" },
      [PLANS.PRO]: { bg: "bg-purple-500/20", text: "text-purple-300", label: "All Extensions Unlocked" },
      [PLANS.PREMIUM]: { bg: "bg-amber-500/20", text: "text-amber-300", label: "All Extensions Unlocked" }
    }

    return badges[user.plan as keyof typeof badges] || badges[PLANS.FREE]
  }, [user])

  // Speech recognition setup
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      setSpeechSupported(!!SpeechRecognition)
      if (!SpeechRecognition) {
        setSpeechError("Speech recognition not supported in this browser")
      }
    }
  }, [])

  // Audio monitoring
  const startAudioMonitoring = useCallback(async () => {
    try {
      if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
        throw new Error("Audio recording is not supported in this environment")
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      mediaStreamRef.current = stream

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)

      source.connect(analyserRef.current)
      analyserRef.current.fftSize = 256

      const bufferLength = analyserRef.current.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const updateAudioLevel = () => {
        if (analyserRef.current && isRecording) {
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / bufferLength
          setAudioLevel(average)
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel)
        }
      }

      updateAudioLevel()
    } catch (error) {
      console.error("Error starting audio monitoring:", error)
      setSpeechError("Failed to access microphone. Please check your permissions.")
      setIsRecording(false)
    }
  }, [isRecording])

  const stopAudioMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setAudioLevel(0)
  }, [])

  // Extension handling
  const handleExtensionClick = useCallback((prefix: string) => {
    if (!canUseExtension) {
      setShowUpgradePrompt(true)
      return
    }

    setSearchMode(prefix)
    const targetMode = prefix.startsWith('wikipedia') ? 'WIKIPEDIA' :
      prefix.startsWith('deep') ? 'DEEPSEARCH' :
        prefix.startsWith('medical') ? 'MEDICAL' :
          prefix.startsWith('image analysis') ? 'IMAGE' :
            prefix.startsWith('generate') ? 'TEXT_TO_IMAGE' : 'AUTO'
    setSelectedMode((prev) => (prev === targetMode ? 'AUTO' : (targetMode as keyof typeof MODES)))
    setInputText("")

    // Open file picker for image processing
    if (prefix.startsWith('image analysis') && fileInputRef.current) {
      fileInputRef.current.click()
    } else if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [canUseExtension])

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setSpeechError("Image too large. Please select an image under 5MB.")
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string)
      }
      reader.onerror = () => {
        setSpeechError("Failed to read image file")
      }
      reader.readAsDataURL(file)
    }
  }, [])

  // Message sending with improved error handling
  const sendMessage = useCallback(
    async (message: string, imageData?: string) => {
      if (!message.trim() && !imageData) return

      const userMessage: Message = {
        id: `${Date.now()}-user`,
        type: MESSAGE_TYPES.USER,
        content: message,
        timestamp: new Date(),
        imageUrl: imageData,
      }

      setMessages((prev) => [...prev, userMessage])
      setIsProcessing(true)
      setSpeechError("")
      setThinkingTime(null) // Clear previous thinking time

      // Start tracking thinking time
      const startTime = Date.now()

      try {
        const bodyPayload: any = { message }
        if (selectedMode && selectedMode !== 'AUTO') bodyPayload.mode = selectedMode.toLowerCase()
        if (imageData) bodyPayload.image = imageData

        const response = await fetch("/api/voice-assistant", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(bodyPayload),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Server error: ${response.status}`)
        }

        const data = await response.json()

        // Calculate thinking time
        const endTime = Date.now()
        const thinkTime = ((endTime - startTime) / 1000).toFixed(2)
        setThinkingTime(parseFloat(thinkTime))

        const assistantMessage: Message = {
          id: `${Date.now()}-assistant`,
          type: MESSAGE_TYPES.ASSISTANT,
          content: data.response,
          timestamp: new Date(),
          generatedImageUrl: data.imageUrl,
          reasoning: data.reasoning,
          mode: data.mode
        }

        setMessages((prev) => [...prev, assistantMessage])

        // Clean markdown for text-to-speech
        const cleanTextForSpeech = (text: string): string => {
          return text
            // Remove markdown headers (# ## ###)
            .replace(/^#{1,6}\s+/gm, '')
            // Remove markdown bold/italic (**text** or *text*)
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            // Remove markdown code blocks (```code```)
            .replace(/```[\s\S]*?```/g, '')
            // Remove inline code (`code`)
            .replace(/`([^`]+)`/g, '$1')
            // Remove markdown links ([text](url))
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            // Remove horizontal rules (--- or ===)
            .replace(/^[-=]{3,}$/gm, '')
            // Remove bullet points (- or *)
            .replace(/^[-*]\s+/gm, '')
            // Remove numbered lists (1. 2. etc)
            .replace(/^\d+\.\s+/gm, '')
            // Remove extra whitespace
            .replace(/\s+/g, ' ')
            .trim()
        }

        // Text-to-speech with error handling and markdown cleaning
        if ("speechSynthesis" in window && !data.imageUrl) {
          try {
            // Stop any ongoing speech first
            speechSynthesis.cancel()

            const cleanedText = cleanTextForSpeech(data.response)
            const utterance = new SpeechSynthesisUtterance(cleanedText)
            utterance.rate = 0.9
            utterance.pitch = 1

            // Track speaking state
            utterance.onstart = () => setIsSpeaking(true)
            utterance.onend = () => setIsSpeaking(false)
            utterance.onerror = () => setIsSpeaking(false)

            speechSynthesis.speak(utterance)
          } catch (ttsError) {
            console.error("Text-to-speech error:", ttsError)
            setIsSpeaking(false)
          }
        }
      } catch (error) {
        console.error("Error sending message:", error)
        const errorMessage: Message = {
          id: `${Date.now()}-error`,
          type: MESSAGE_TYPES.ASSISTANT,
          content: error instanceof Error
            ? `I apologize, but I encountered an error: ${error.message}. Please try again.`
            : "I'm having trouble processing your request right now. Please try again.",
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
        setSpeechError(error instanceof Error ? error.message : "Unknown error occurred")
      } finally {
        setIsProcessing(false)
        setSearchMode(null)
        setUploadedImage(null)
      }
    },
    [selectedMode],
  )

  const handleSendText = useCallback(() => {
    if (inputText.trim() || uploadedImage) {
      const message = searchMode ? `${searchMode} ${inputText}` : inputText
      sendMessage(message, uploadedImage || undefined)
      setInputText("")
      setSearchMode(null)
    }
  }, [inputText, uploadedImage, searchMode, sendMessage])

  // Voice recording
  const toggleRecording = useCallback(async () => {
    if (typeof window === "undefined") {
      setSpeechError("Speech recognition is not available in this environment")
      return
    }

    if (!speechSupported) {
      setSpeechError("Speech recognition not supported in this browser")
      return
    }

    if (!navigator?.mediaDevices?.getUserMedia) {
      setSpeechError("Microphone access is not supported in this browser")
      return
    }

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      stopAudioMonitoring()
      setIsRecording(false)
      setIsListening(false)
    } else {
      setSpeechError("")

      try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        const recognition = new SpeechRecognition()

        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = "en-US"

        recognition.onstart = () => {
          setIsListening(true)
          setSpeechError("")
        }

        recognition.onend = () => {
          setIsListening(false)
          setIsRecording(false)
        }

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let finalTranscript = ""

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i]
            if (result.isFinal) {
              finalTranscript += result[0].transcript
            }
          }

          if (finalTranscript) {
            const message = searchMode ? `${searchMode} ${finalTranscript}` : finalTranscript
            sendMessage(message)
          }
        }

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          if (event.error === "aborted") return

          const errorMessages: Record<string, string> = {
            "not-allowed": "Microphone access denied. Please allow microphone access and try again.",
            "no-speech": "No speech detected. Please try speaking again.",
            "network": "Network error. Please check your connection and try again.",
          }

          setSpeechError(errorMessages[event.error] || `Speech recognition error: ${event.error}`)
          setIsRecording(false)
          setIsListening(false)
        }

        recognitionRef.current = recognition

        await startAudioMonitoring()
        if (mediaStreamRef.current) {
          recognition.start()
          setIsRecording(true)
        }
      } catch (error) {
        console.error("Failed to start speech recognition:", error)
        setSpeechError("Failed to start speech recognition")
        setIsRecording(false)
        setIsListening(false)
      }
    }
  }, [isRecording, speechSupported, searchMode, sendMessage, startAudioMonitoring, stopAudioMonitoring])

  const stopSpeech = useCallback(() => {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }, [])

  const clearConversation = useCallback(() => {
    if (window.confirm("Are you sure you want to clear the conversation?")) {
      setMessages([])
      setSpeechError("")
      setSearchMode(null)
      setUploadedImage(null)
      setSelectedMode('AUTO')

      if (isRecording && recognitionRef.current) {
        recognitionRef.current.stop()
      }

      // Stop any ongoing speech
      stopSpeech()
    }
  }, [isRecording, stopSpeech])

  const returnToGeneralChat = useCallback(() => {
    setSearchMode(null)
    setSelectedMode('AUTO')
    setUploadedImage(null)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const handleUpgrade = useCallback((plan: string = "Professional") => {
    setShowUsageModal(false)
    setShowUpgradePrompt(false)

    // If user is logged in, go directly to payment gateway
    if (user && user.isLoggedIn) {
      window.location.href = `/payment?plan=${plan}&period=monthly`
    } else {
      // If not logged in, redirect to login with return URL to payment
      window.location.href = `/auth/login?redirect=/payment?plan=${plan}&period=monthly`
    }
  }, [user])



  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      stopAudioMonitoring()
      stopSpeech()
    }
  }, [stopAudioMonitoring, stopSpeech])

  // Loading state
  if (isLoading) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
      </div>
    )
  }

  // Unauthenticated state
  if (!user) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Navigation />
        <div className="pt-20 px-4 py-12">
          <div className="container mx-auto max-w-2xl text-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-white mb-4">
                <Text>Sign In Required</Text>
              </h1>
              <p className="text-xl text-gray-300 mb-8">
                <Text>Please sign in to access the G-One AI Demo and start your conversation with our advanced AI assistant.</Text>
              </p>
              <div className="space-y-4">
                <Link href="/auth/login">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white px-8 py-4 rounded-full text-lg font-semibold mr-4"
                  >
                    <Text>Sign In</Text>
                  </Button>
                </Link>
                <Link href="/auth/signup">
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-2 border-purple-500/50 text-purple-300 hover:bg-purple-500/10 px-8 py-4 rounded-full text-lg font-semibold backdrop-blur-sm"
                  >
                    <Text>Create Account</Text>
                  </Button>
                </Link>
              </div>
              <p className="text-gray-400 text-sm mt-6">
                <Text>General chat with RAG + CoT is always free! Upgrade for premium extensions.</Text>
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    )
  }

  // Main application
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Upgrade Prompt Modal */}
      <AnimatePresence>
        {showUpgradePrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowUpgradePrompt(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-500/50 rounded-2xl p-8 max-w-md w-full"
            >
              <h3 className="text-2xl font-bold text-white mb-4"><Text>Upgrade Required</Text></h3>
              <p className="text-gray-300 mb-6">
                <Text>This is a premium extension. Upgrade to Pro or Premium to unlock all advanced features including Wikipedia Search, Deep Search, Medical Search, Image Processing, and Text-to-Image generation.</Text>
              </p>
              <div className="flex space-x-4">
                <Button
                  onClick={() => handleUpgrade("Pro")}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
                >
                  <Text>Upgrade Now</Text>
                </Button>
                <Button
                  onClick={() => setShowUpgradePrompt(false)}
                  variant="outline"
                  className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  <Text>Maybe Later</Text>
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <UsageLimitModal
        isOpen={showUsageModal}
        onClose={() => setShowUsageModal(false)}
        chatsUsed={user?.chatsUsed || 0}
        chatsLimit={user?.chatsLimit || 200}
        onUpgrade={handleUpgrade}
      />

      {/* 3D Background */}
      <div className="fixed inset-0 z-0 opacity-30 pointer-events-none">
        <Canvas camera={{ position: [0, 2, 8], fov: 60 }}>
          <Suspense fallback={null}>
            <Environment preset="night" />
            <WaveVisualization isActive={isRecording || isProcessing} audioLevel={audioLevel} />
            <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
          </Suspense>
        </Canvas>
      </div>

      <div className="relative z-10">
        <Navigation />
        <div className="pt-20 px-4 py-6">
          <div className="container mx-auto max-w-7xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center mb-6"
            >
              <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
                <Text>G-One AI Assistant</Text>
              </h1>
              <p className="text-lg text-gray-300 max-w-3xl mx-auto">
                <Text>General chat with RAG + Chain-of-Thought reasoning is always free! Upgrade for premium extensions.</Text>
              </p>

              {user && userPlanBadge && (
                <div className="mt-4 p-3 bg-white/5 border border-white/10 rounded-lg max-w-md mx-auto backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 text-sm">
                      <Text>Plan:</Text> <Text>{user.plan}</Text>
                    </span>
                    <span className={`text-sm px-3 py-1 rounded-full font-semibold ${userPlanBadge.bg} ${userPlanBadge.text}`}>
                      <Text>{userPlanBadge.label}</Text>
                    </span>
                  </div>
                </div>
              )}
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Extensions Sidebar */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="space-y-4"
              >
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <Text>Premium Extensions</Text>
                  {!canUseExtension && <Lock className="w-4 h-4 ml-2 text-yellow-400" />}
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {extensionOptions.map((option) => (
                    <motion.div
                      key={option.id}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="group relative"
                    >
                      <Button
                        onClick={() => handleExtensionClick(option.prefix)}
                        disabled={isProcessing}
                        className={`flex flex-col items-center justify-center p-4 h-full w-full bg-white/5 border border-white/10 hover:bg-white/10 backdrop-blur-sm rounded-xl transition-all duration-300 group-hover:shadow-lg group-hover:shadow-${option.color}-500/30 shadow-md hover:border-${option.color}-400/50 min-h-[120px] ${searchMode === option.prefix ? `border-${option.color}-500 bg-${option.color}-500/10` : ""
                          } ${!canUseExtension ? "opacity-60" : ""}`}
                        title={option.title}
                      >
                        {!canUseExtension && (
                          <div className="absolute top-2 right-2">
                            <Lock className="w-4 h-4 text-yellow-400" />
                          </div>
                        )}
                        <div className="mb-3 flex items-center justify-center">
                          {option.icon}
                        </div>
                        <span className="text-white text-sm font-medium tracking-wide text-center">{option.title}</span>
                        <p className="text-gray-400 text-xs mt-2 text-center leading-tight">
                          {option.description}
                        </p>
                      </Button>
                    </motion.div>
                  ))}
                </div>
                {!canUseExtension && (
                  <Button
                    onClick={() => handleUpgrade("Professional")}
                    className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 py-3"
                  >
                    <Text>Unlock Extensions</Text>
                  </Button>
                )}
              </motion.div>

              {/* Chat Area */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="lg:col-span-3"
              >
                <Card className="bg-white/5 backdrop-blur-sm border border-white/10 h-full">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-white flex items-center justify-between">
                      <span className="flex items-center">
                        <Text>AI Conversation</Text>
                        {selectedMode === 'AUTO' ? (
                          <span className="ml-3 text-sm px-3 py-1 rounded-full bg-green-500/20 text-green-300 border border-green-500/50 flex items-center">
                            <Brain className="w-3 h-3 mr-1" />
                            <Text>Free - RAG + CoT</Text>
                          </span>
                        ) : (
                          <span className="ml-3 text-sm px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/50">
                            <Text>Premium Mode</Text>
                          </span>
                        )}
                      </span>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`text-gray-400 hover:text-white ${selectedMode === 'AUTO' ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={returnToGeneralChat}
                          disabled={selectedMode === 'AUTO'}
                          title="Return to General Chat"
                        >
                          <Bot className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-400 hover:text-red-400"
                          onClick={clearConversation}
                          title="Clear conversation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Chat Messages */}
                    <div
                      className="bg-black/20 rounded-lg p-6 min-h-[600px] max-h-[600px] overflow-y-auto backdrop-blur-sm scroll-smooth overscroll-contain"
                      style={{ overscrollBehavior: 'contain' }}
                      onWheel={(e) => e.stopPropagation()}
                    >
                      <div className="space-y-4">
                        {messages.length === 0 && (
                          <div className="text-center text-gray-400 py-16">
                            <Bot className="w-16 h-16 mx-auto mb-6 opacity-50" />
                            <p className="text-xl mb-2"><Text>Start a conversation with G-One AI</Text></p>
                            <p className="text-sm mt-2 flex items-center justify-center">
                              <Brain className="w-4 h-4 mr-2 text-purple-400" />
                              <Text>General chat includes RAG + Chain-of-Thought reasoning - completely free!</Text>
                            </p>
                            <p className="text-xs mt-4 text-purple-400"><Text>Use premium extensions for specialized searches</Text></p>
                          </div>
                        )}

                        <AnimatePresence>
                          {messages.map((message) => (
                            <motion.div
                              key={message.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                              transition={{ duration: 0.3 }}
                              className={`flex ${message.type === MESSAGE_TYPES.USER ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`flex items-start space-x-3 max-w-[85%] ${message.type === MESSAGE_TYPES.USER ? "flex-row-reverse space-x-reverse" : ""
                                  }`}
                              >
                                <div
                                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${message.type === MESSAGE_TYPES.USER
                                    ? "bg-gradient-to-r from-purple-600 to-cyan-600"
                                    : "bg-gradient-to-r from-gray-600 to-gray-700"
                                    }`}
                                >
                                  {message.type === MESSAGE_TYPES.USER ? (
                                    <User className="w-5 h-5 text-white" />
                                  ) : (
                                    <Bot className="w-5 h-5 text-white" />
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <div
                                    className={`px-5 py-3 rounded-lg ${message.type === MESSAGE_TYPES.USER
                                      ? "bg-gradient-to-r from-purple-600 to-cyan-600 text-white"
                                      : "bg-gray-700/80 text-white backdrop-blur-sm"
                                      }`}
                                  >
                                    {/* User uploaded image */}
                                    {message.imageUrl && (
                                      <img
                                        src={message.imageUrl}
                                        alt="Uploaded"
                                        className="max-w-xs rounded-lg mb-2 border border-white/20"
                                        loading="lazy"
                                      />
                                    )}

                                    {/* AI reasoning (Chain-of-Thought) */}
                                    {message.reasoning && (
                                      <div className="mb-3 p-3 bg-black/30 rounded-lg border border-purple-500/30">
                                        <div className="flex items-center mb-2">
                                          <Brain className="w-4 h-4 text-purple-400 mr-2" />
                                          <span className="text-xs text-purple-300 font-semibold"><Text>Reasoning Process</Text></span>
                                        </div>
                                        <p className="text-sm text-gray-300 italic">{message.reasoning}</p>
                                      </div>
                                    )}

                                    {/* AI generated image */}
                                    {message.generatedImageUrl && (
                                      <div className="mb-3">
                                        <img
                                          src={message.generatedImageUrl}
                                          alt="Generated"
                                          className="max-w-md rounded-lg border border-purple-500/50 shadow-lg shadow-purple-500/20"
                                          loading="lazy"
                                        />
                                      </div>
                                    )}

                                    {/* Message content with markdown rendering */}
                                    <div className="prose prose-invert prose-sm max-w-none">
                                      <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                          h1: ({ node, ...props }) => <h1 className="text-2xl font-bold text-white mb-3 mt-4" {...props} />,
                                          h2: ({ node, ...props }) => <h2 className="text-xl font-bold text-white mb-2 mt-3" {...props} />,
                                          h3: ({ node, ...props }) => <h3 className="text-lg font-semibold text-white mb-2 mt-2" {...props} />,
                                          p: ({ node, ...props }) => <p className="text-base leading-relaxed mb-2 text-gray-100" {...props} />,
                                          ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1 mb-3 ml-2" {...props} />,
                                          ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-1 mb-3 ml-2" {...props} />,
                                          li: ({ node, ...props }) => <li className="text-base text-gray-100 leading-relaxed" {...props} />,
                                          strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
                                          em: ({ node, ...props }) => <em className="italic text-gray-200" {...props} />,
                                          code: ({ node, inline, ...props }: any) =>
                                            inline ? (
                                              <code className="bg-black/30 px-1.5 py-0.5 rounded text-sm text-cyan-300 font-mono" {...props} />
                                            ) : (
                                              <code className="block bg-black/40 p-3 rounded-lg text-sm text-cyan-300 font-mono overflow-x-auto my-2" {...props} />
                                            ),
                                          blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-purple-500 pl-4 italic text-gray-300 my-2" {...props} />,
                                          a: ({ node, ...props }) => <a className="text-cyan-400 hover:text-cyan-300 underline" target="_blank" rel="noopener noreferrer" {...props} />,
                                        }}
                                      >
                                        {message.content}
                                      </ReactMarkdown>
                                    </div>

                                    {/* Mode indicator */}
                                    {message.mode && message.type === MESSAGE_TYPES.ASSISTANT && (
                                      <div className="mt-2 flex items-center space-x-2">
                                        <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                          {message.mode}
                                        </span>
                                      </div>
                                    )}

                                    <p className="text-xs opacity-70 mt-2">
                                      {(message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp)).toLocaleTimeString()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>

                        {/* Processing indicator */}
                        {isProcessing && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex justify-start"
                          >
                            <div className="flex items-start space-x-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-gray-600 to-gray-700 flex items-center justify-center">
                                <Bot className="w-5 h-5 text-white" />
                              </div>
                              <div className="bg-gray-700/80 text-white px-5 py-3 rounded-lg backdrop-blur-sm">
                                <div className="flex space-x-2">
                                  <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                                  <div
                                    className="w-2 h-2 bg-white rounded-full animate-bounce"
                                    style={{ animationDelay: "0.1s" }}
                                  ></div>
                                  <div
                                    className="w-2 h-2 bg-white rounded-full animate-bounce"
                                    style={{ animationDelay: "0.2s" }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* Thinking time indicator */}
                        {thinkingTime !== null && !isProcessing && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-center"
                          >
                            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-500/20 border border-purple-500/50 rounded-full">
                              <Brain className="w-4 h-4 text-purple-400" />
                              <span className="text-purple-300 text-sm">
                                <Text>Thinking time: {thinkingTime}s</Text>
                              </span>
                            </div>
                          </motion.div>
                        )}

                        {/* Listening indicator */}
                        {isListening && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center"
                          >
                            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-full">
                              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                              <span className="text-green-300 text-sm"><Text>Listening...</Text></span>
                            </div>
                          </motion.div>
                        )}

                        {/* Speaking indicator */}
                        {isSpeaking && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center"
                          >
                            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-500/20 border border-blue-500/50 rounded-full">
                              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                              <span className="text-blue-300 text-sm"><Text>Speaking...</Text></span>
                            </div>
                          </motion.div>
                        )}

                        {/* Error display */}
                        {speechError && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center"
                          >
                            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-full">
                              <AlertCircle className="w-4 h-4 text-red-400" />
                              <span className="text-red-300 text-sm">{speechError}</span>
                            </div>
                          </motion.div>
                        )}

                        <div ref={messagesEndRef} />
                      </div>

                      {/* Audio visualization */}
                      {isRecording && isListening && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center justify-center space-x-1 mt-6"
                        >
                          {[...Array(20)].map((_, i) => (
                            <motion.div
                              key={i}
                              className="w-1 bg-gradient-to-t from-purple-500 to-cyan-500 rounded-full"
                              animate={{
                                height: [4, Math.max(4, (audioLevel / 255) * 40 + Math.random() * 10), 4],
                              }}
                              transition={{
                                duration: 0.3,
                                repeat: Number.POSITIVE_INFINITY,
                                delay: i * 0.05,
                              }}
                            />
                          ))}
                        </motion.div>
                      )}
                    </div>

                    {/* Input Area */}
                    <div className="space-y-4">
                      {/* Image Preview */}
                      <AnimatePresence>
                        {uploadedImage && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="relative inline-block"
                          >
                            <img
                              src={uploadedImage}
                              alt="Preview"
                              className="max-h-32 rounded-lg border-2 border-purple-500/50 shadow-lg shadow-purple-500/20"
                            />
                            <Button
                              onClick={() => setUploadedImage(null)}
                              size="sm"
                              variant="ghost"
                              className="absolute -top-2 -right-2 bg-red-500/90 hover:bg-red-600 text-white rounded-full p-1 h-6 w-6 shadow-lg"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Text Input */}
                      <div className="flex space-x-2">
                        <Input
                          ref={inputRef}
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault()
                              handleSendText()
                            }
                          }}
                          placeholder={
                            searchMode
                              ? `Enter your ${searchMode} query...`
                              : "Type your message... (General chat with RAG + CoT is always free!)"
                          }
                          className="flex-1 bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-purple-500 text-base py-6 rounded-xl"
                          disabled={isProcessing}
                          aria-label="Message input"
                        />
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          aria-label="Upload image"
                        />
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isProcessing || selectedMode !== 'IMAGE'}
                          className="bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/50 px-4"
                          title="Upload image"
                        >
                          <Upload className="w-5 h-5" />
                        </Button>
                        <Button
                          onClick={handleSendText}
                          disabled={(!inputText.trim() && !uploadedImage) || isProcessing}
                          className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Send message"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Send className="w-5 h-5" />
                          )}
                        </Button>
                      </div>

                      {/* Voice Controls */}
                      <div className="flex items-center justify-center space-x-4">
                        <Button
                          onClick={toggleRecording}
                          disabled={!speechSupported || isProcessing}
                          className={`w-16 h-16 rounded-full transition-all duration-300 ${isRecording
                            ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50"
                            : "bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 shadow-lg shadow-purple-500/30"
                            } ${!speechSupported || isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                          title={isRecording ? "Stop recording" : "Start recording"}
                          aria-label={isRecording ? "Stop recording" : "Start recording"}
                        >
                          {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                        </Button>

                        {/* Stop Speech Button */}
                        {isSpeaking && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                          >
                            <Button
                              onClick={stopSpeech}
                              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-full shadow-lg shadow-orange-500/30 flex items-center space-x-2"
                              title="Stop voice playback"
                              aria-label="Stop voice playback"
                            >
                              <MicOff className="w-5 h-5" />
                              <span className="font-medium">Stop Voice</span>
                            </Button>
                          </motion.div>
                        )}
                      </div>

                      {/* Help text */}
                      <p className="text-center text-gray-400 text-sm">
                        {speechSupported ? (
                          <span className="flex items-center justify-center">
                            <Brain className="w-4 h-4 mr-2 text-purple-400" />
                            <Text>Click the microphone for voice input, or type your message. General chat with RAG + CoT is completely free!</Text>
                          </span>
                        ) : (
                          <Text>Type your message to chat. Voice input requires Chrome or Edge browser.</Text>
                        )}
                      </p>

                      {/* Mode indicator */}
                      <AnimatePresence>
                        {searchMode && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="text-center"
                          >
                            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-purple-500/20 border border-purple-500/50 rounded-full">
                              <Info className="w-4 h-4 text-purple-400" />
                              <span className="text-purple-300 text-sm">
                                <Text>Using {searchMode} mode</Text>
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}