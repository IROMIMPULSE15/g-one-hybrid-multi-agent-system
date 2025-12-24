"use client"

import { motion } from "framer-motion"
import { MessageSquare, Zap, Database, Users, Shield, RefreshCw } from "lucide-react"

const features = [
  {
    icon: MessageSquare,
    title: "Natural Voice Input",
    description: "Speak naturally and let our AI understand context, intent, and even subtle nuances in your voice.",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: Zap,
    title: "Real-time Processing",
    description: "Experience minimal latency with our optimized voice recognition and processing algorithms.",
    color: "from-cyan-500 to-blue-500",
  },
  {
    icon: Database,
    title: "Knowledge Integration",
    description: "Connect to your existing knowledge base, FAQs, and documentation for contextually aware responses.",
    color: "from-green-500 to-emerald-500",
  },
  {
    icon: Users,
    title: "Multi-intent Recognition",
    description: "Our AI handles complex, multi-part questions and ambiguous queries with ease.",
    color: "from-orange-500 to-red-500",
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Your data stays protected with enterprise-grade security and compliance measures.",
    color: "from-indigo-500 to-purple-500",
  },
  {
    icon: RefreshCw,
    title: "Continuous Learning",
    description: "The system evolves and improves over time, learning from interactions to become more accurate.",
    color: "from-teal-500 to-cyan-500",
  },
]

export default function Features() {
  return (
    <section className="py-20 px-4 relative">
      <div className="container mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
            Powerful Features
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Our platform leverages cutting-edge AI to deliver powerful conversational intelligence capabilities.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl blur-xl from-purple-500/20 to-cyan-500/20"></div>

              <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-all duration-300 group-hover:border-purple-500/50">
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${feature.color} p-4 mb-6 group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className="w-full h-full text-white" />
                </div>

                <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-purple-300 transition-colors">
                  {feature.title}
                </h3>

                <p className="text-gray-300 leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
