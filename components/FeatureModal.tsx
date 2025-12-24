"use client"

import { useState, useEffect, Suspense } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Mic, Brain, BarChart3, Play, Pause, Volume2 } from "lucide-react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Dynamically import 3D components
const Canvas = dynamic(() => import("@react-three/fiber").then((mod) => ({ default: mod.Canvas })), {
  ssr: false,
})

const Environment = dynamic(() => import("@react-three/drei").then((mod) => ({ default: mod.Environment })), {
  ssr: false,
})

const OrbitControls = dynamic(() => import("@react-three/drei").then((mod) => ({ default: mod.OrbitControls })), {
  ssr: false,
})

const VoiceVisualization = dynamic(() => import("@/components/3d/VoiceVisualization"), {
  ssr: false,
})

const AIProcessingVisualization = dynamic(() => import("@/components/3d/AIProcessingVisualization"), {
  ssr: false,
})

const AnalyticsVisualization = dynamic(() => import("@/components/3d/AnalyticsVisualization"), {
  ssr: false,
})

interface FeatureModalProps {
  isOpen: boolean
  onClose: () => void
  feature: string | null
}

const featureData = {
  voice: {
    title: "Voice Recognition",
    icon: Mic,
    color: "from-green-500 to-emerald-500",
    description:
      "Advanced voice recognition technology that understands natural speech patterns and converts them to actionable commands.",
    features: [
      "Real-time speech processing",
      "Multi-language support (45+ languages)",
      "Noise cancellation",
      "Context-aware understanding",
      "Emotion detection",
      "Speaker identification",
    ],
    stats: [
      { label: "Accuracy", value: "99.2%" },
      { label: "Response Time", value: "<200ms" },
      { label: "Languages", value: "45+" },
      { label: "Noise Reduction", value: "95%" },
    ],
  },
  ai: {
    title: "AI Processing",
    icon: Brain,
    color: "from-purple-500 to-indigo-500",
    description:
      "Cutting-edge artificial intelligence that processes information, learns from interactions, and provides intelligent responses.",
    features: [
      "Neural network processing",
      "Machine learning algorithms",
      "Natural language understanding",
      "Context retention",
      "Predictive analytics",
      "Continuous learning",
    ],
    stats: [
      { label: "Processing Speed", value: "<100ms" },
      { label: "Model Parameters", value: "10B+" },
      { label: "Training Data", value: "500TB+" },
      { label: "Accuracy Rate", value: "97.8%" },
    ],
  },
  analytics: {
    title: "Analytics",
    icon: BarChart3,
    color: "from-cyan-500 to-blue-500",
    description:
      "Comprehensive analytics and insights that help you understand user behavior, performance metrics, and optimization opportunities.",
    features: [
      "Real-time dashboards",
      "User behavior tracking",
      "Performance metrics",
      "Predictive insights",
      "Custom reports",
      "Data visualization",
    ],
    stats: [
      { label: "Data Points", value: "1M+/sec" },
      { label: "Real-time Updates", value: "100ms" },
      { label: "Retention Period", value: "2 years" },
      { label: "Visualization Types", value: "25+" },
    ],
  },
}

export default function FeatureModal({ isOpen, onClose, feature }: FeatureModalProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [processingData, setProcessingData] = useState(0)

  useEffect(() => {
    if (isOpen && feature) {
      setIsPlaying(true)

      // Simulate audio levels for voice recognition
      if (feature === "voice") {
        const interval = setInterval(() => {
          setAudioLevel(Math.random() * 100)
        }, 100)
        return () => clearInterval(interval)
      }

      // Simulate processing data for AI
      if (feature === "ai") {
        const interval = setInterval(() => {
          setProcessingData((prev) => (prev + Math.random() * 10) % 100)
        }, 200)
        return () => clearInterval(interval)
      }
    } else {
      setIsPlaying(false)
      setAudioLevel(0)
      setProcessingData(0)
    }
  }, [isOpen, feature])

  if (!isOpen || !feature || !featureData[feature as keyof typeof featureData]) return null

  const data = featureData[feature as keyof typeof featureData]

  const renderVisualization = () => {
    switch (feature) {
      case "voice":
        return <VoiceVisualization isActive={isPlaying} audioLevel={audioLevel} />
      case "ai":
        return <AIProcessingVisualization isActive={isPlaying} processingLevel={processingData} />
      case "analytics":
        return <AnalyticsVisualization isActive={isPlaying} />
      default:
        return null
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto"
        >
          <Card className="bg-slate-900/95 backdrop-blur-sm border border-white/10">
            <CardHeader className="relative">
              <button
                onClick={onClose}
                className="absolute right-4 top-4 text-gray-400 hover:text-white transition-colors z-10"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center space-x-4">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${data.color} p-4`}>
                  <data.icon className="w-full h-full text-white" />
                </div>
                <div>
                  <CardTitle className="text-3xl font-bold text-white">{data.title}</CardTitle>
                  <p className="text-gray-300 text-lg mt-2">{data.description}</p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-8">
              {/* 3D Visualization */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="h-96 bg-black/20 rounded-xl overflow-hidden relative">
                  <Canvas camera={{ position: [0, 0, 8], fov: 60 }}>
                    <Suspense fallback={null}>
                      <Environment preset="night" />
                      {renderVisualization()}
                      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
                    </Suspense>
                  </Canvas>

                  {/* Overlay Controls */}
                  <div className="absolute bottom-4 left-4 flex items-center space-x-2">
                    <Button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className={`bg-gradient-to-r ${data.color} hover:opacity-90`}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>

                    {feature === "voice" && (
                      <div className="flex items-center space-x-2 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2">
                        <Volume2 className="w-4 h-4 text-white" />
                        <div className="flex space-x-1">
                          {[...Array(10)].map((_, i) => (
                            <div
                              key={i}
                              className={`w-1 h-4 rounded-full transition-all duration-100 ${
                                i < (audioLevel / 10) ? "bg-green-400" : "bg-gray-600"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {feature === "ai" && (
                      <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2">
                        <span className="text-white text-sm">Processing: {Math.round(processingData)}%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Feature Details */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Key Features</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {data.features.map((feature, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg border border-white/10"
                        >
                          <div className="w-2 h-2 bg-green-400 rounded-full flex-shrink-0" />
                          <span className="text-gray-300">{feature}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Performance Stats</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {data.stats.map((stat, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="text-center p-4 bg-white/5 rounded-lg border border-white/10"
                        >
                          <div
                            className={`text-2xl font-bold bg-gradient-to-r ${data.color} bg-clip-text text-transparent`}
                          >
                            {stat.value}
                          </div>
                          <div className="text-gray-400 text-sm">{stat.label}</div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Demo Section */}
              <div className="bg-gradient-to-r from-purple-900/30 to-cyan-900/30 rounded-xl p-6 border border-purple-500/20">
                <h3 className="text-xl font-semibold text-white mb-4">Interactive Demo</h3>
                <p className="text-gray-300 mb-4">
                  Experience {data.title.toLowerCase()} in action. The 3D visualization above shows real-time processing
                  and analysis.
                </p>

                <div className="flex flex-wrap gap-4">
                  <Button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`bg-gradient-to-r ${data.color} hover:opacity-90`}
                  >
                    {isPlaying ? "Pause Demo" : "Start Demo"}
                  </Button>

                  {feature === "voice" && (
                    <Button
                      variant="outline"
                      className="border-green-500/50 text-green-300 hover:bg-green-500/10"
                      onClick={() => setAudioLevel(Math.random() * 100)}
                    >
                      Simulate Voice Input
                    </Button>
                  )}

                  {feature === "ai" && (
                    <Button
                      variant="outline"
                      className="border-purple-500/50 text-purple-300 hover:bg-purple-500/10"
                      onClick={() => setProcessingData(Math.random() * 100)}
                    >
                      Trigger AI Processing
                    </Button>
                  )}

                  {feature === "analytics" && (
                    <Button variant="outline" className="border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10">
                      Generate Report
                    </Button>
                  )}
                </div>
              </div>

              {/* Technical Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-white mb-2">Technology Stack</h4>
                    <ul className="text-gray-300 text-sm space-y-1">
                      {feature === "voice" && (
                        <>
                          <li>• WebRTC Audio Processing</li>
                          <li>• Deep Neural Networks</li>
                          <li>• Real-time Transcription</li>
                          <li>• Noise Reduction Algorithms</li>
                        </>
                      )}
                      {feature === "ai" && (
                        <>
                          <li>• Transformer Architecture</li>
                          <li>• GPU-Accelerated Computing</li>
                          <li>• Distributed Processing</li>
                          <li>• Continuous Learning</li>
                        </>
                      )}
                      {feature === "analytics" && (
                        <>
                          <li>• Real-time Data Streaming</li>
                          <li>• Machine Learning Insights</li>
                          <li>• Interactive Visualizations</li>
                          <li>• Predictive Modeling</li>
                        </>
                      )}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-white mb-2">Use Cases</h4>
                    <ul className="text-gray-300 text-sm space-y-1">
                      {feature === "voice" && (
                        <>
                          <li>• Voice Commands</li>
                          <li>• Dictation & Transcription</li>
                          <li>• Voice Authentication</li>
                          <li>• Accessibility Features</li>
                        </>
                      )}
                      {feature === "ai" && (
                        <>
                          <li>• Intelligent Responses</li>
                          <li>• Content Generation</li>
                          <li>• Decision Support</li>
                          <li>• Automated Analysis</li>
                        </>
                      )}
                      {feature === "analytics" && (
                        <>
                          <li>• Performance Monitoring</li>
                          <li>• User Behavior Analysis</li>
                          <li>• Business Intelligence</li>
                          <li>• Trend Prediction</li>
                        </>
                      )}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="bg-white/5 border-white/10">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-white mb-2">Benefits</h4>
                    <ul className="text-gray-300 text-sm space-y-1">
                      {feature === "voice" && (
                        <>
                          <li>• Hands-free Operation</li>
                          <li>• Natural Interaction</li>
                          <li>• Improved Accessibility</li>
                          <li>• Faster Input Method</li>
                        </>
                      )}
                      {feature === "ai" && (
                        <>
                          <li>• Intelligent Automation</li>
                          <li>• Reduced Manual Work</li>
                          <li>• Better Decision Making</li>
                          <li>• Continuous Improvement</li>
                        </>
                      )}
                      {feature === "analytics" && (
                        <>
                          <li>• Data-Driven Insights</li>
                          <li>• Performance Optimization</li>
                          <li>• Strategic Planning</li>
                          <li>• ROI Measurement</li>
                        </>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
