"use client"

import { motion } from "framer-motion"
import ParticleBackground from "@/components/ParticleBackground"
import { MessageSquare, Zap, Database, Shield, RefreshCw, Mic, Brain, BarChart3, Globe, Cpu } from "lucide-react"
import Navigation from "@/components/Navigation"
import { Button } from "@/components/ui/button"

// Particle background (client-only)

const featureCategories = [
  {
    title: "Voice Intelligence",
    description: "Advanced voice recognition and natural language processing",
    features: [
      {
        icon: Mic,
        title: "Multi-Language Support",
        description: "Support for 45+ languages with real-time translation capabilities",
        stats: "99.2% accuracy",
      },
      {
        icon: Brain,
        title: "Context Understanding",
        description: "AI that understands context, intent, and emotional nuances",
        stats: "< 200ms response",
      },
      {
        icon: MessageSquare,
        title: "Natural Conversations",
        description: "Human-like interactions with advanced dialogue management",
        stats: "95% satisfaction",
      },
    ],
  },
  {
    title: "AI Processing",
    description: "Cutting-edge artificial intelligence for intelligent responses",
    features: [
      {
        icon: Cpu,
        title: "Neural Networks",
        description: "Advanced deep learning models for superior understanding",
        stats: "10B+ parameters",
      },
      {
        icon: Zap,
        title: "Real-time Processing",
        description: "Lightning-fast response times with edge computing",
        stats: "< 100ms latency",
      },
      {
        icon: RefreshCw,
        title: "Continuous Learning",
        description: "Self-improving AI that learns from every interaction",
        stats: "24/7 learning",
      },
    ],
  },
  {
    title: "Enterprise Features",
    description: "Professional-grade features for business applications",
    features: [
      {
        icon: Shield,
        title: "Enterprise Security",
        description: "Bank-grade security with end-to-end encryption",
        stats: "SOC 2 compliant",
      },
      {
        icon: BarChart3,
        title: "Advanced Analytics",
        description: "Comprehensive insights and performance metrics",
        stats: "Real-time dashboards",
      },
      {
        icon: Database,
        title: "Knowledge Integration",
        description: "Seamless integration with existing knowledge bases",
        stats: "1000+ integrations",
      },
    ],
  },
]

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navigation />

      {/* Particle background (replaces the previous 3D canvas) */}
      <ParticleBackground />

      <div className="relative z-10 pt-20">
        {/* Hero Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl text-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
                Powerful Features
              </h1>
              <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
                Discover the advanced capabilities that make our conversational AI platform the most intelligent and
                reliable solution for your business needs.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Feature Categories */}
        {featureCategories.map((category, categoryIndex) => (
          <section key={categoryIndex} className="py-16 px-4">
            <div className="container mx-auto max-w-7xl">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: categoryIndex * 0.1 }}
                className="text-center mb-12"
              >
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">{category.title}</h2>
                <p className="text-lg text-gray-300 max-w-2xl mx-auto">{category.description}</p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {category.features.map((feature, featureIndex) => (
                  <motion.div
                    key={featureIndex}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: featureIndex * 0.1 }}
                    className="group relative"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all duration-300 group-hover:border-purple-500/50 h-full">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-purple-500 to-cyan-500 p-4 mb-6 group-hover:scale-110 transition-transform duration-300">
                        <feature.icon className="w-full h-full text-white" />
                      </div>

                      <h3 className="text-xl font-bold text-white mb-4 group-hover:text-purple-300 transition-colors">
                        {feature.title}
                      </h3>

                      <p className="text-gray-300 leading-relaxed mb-4">{feature.description}</p>

                      <div className="inline-flex items-center px-3 py-1 bg-purple-500/20 rounded-full border border-purple-500/30">
                        <span className="text-purple-300 text-sm font-medium">{feature.stats}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        ))}

        {/* Technical Specifications */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                Technical Specifications
              </h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                Built on cutting-edge technology stack for maximum performance and reliability.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: "Processing Speed", value: "< 100ms", icon: Zap },
                { label: "Accuracy Rate", value: "99.2%", icon: BarChart3 },
                { label: "Uptime", value: "99.99%", icon: Shield },
                { label: "Languages", value: "45+", icon: Globe },
              ].map((spec, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 text-center hover:bg-white/10 transition-all duration-300"
                >
                  <spec.icon className="w-8 h-8 text-purple-400 mx-auto mb-4" />
                  <div className="text-2xl font-bold text-white mb-2">{spec.value}</div>
                  <div className="text-gray-400 text-sm">{spec.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-3xl blur-xl"></div>

              <div className="relative bg-gradient-to-r from-purple-900/50 to-cyan-900/50 backdrop-blur-sm border border-purple-500/30 rounded-3xl p-12 text-center">
                <h2 className="text-3xl md:text-4xl font-bold mb-6 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  Ready to Experience These Features?
                </h2>
                <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                  See our advanced features in action with a personalized demo.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white px-8 py-4 rounded-full text-lg font-semibold"
                  >
                    Try Demo
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
            </motion.div>
          </div>
        </section>
      </div>
    </div>
  )
}
