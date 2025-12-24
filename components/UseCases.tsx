"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const useCases = [
  {
    title: "Customer Support",
    description:
      "Enhance your support team with AI-powered voice interactions that understand customer issues and provide accurate solutions faster.",
    image: "/images/use-cases/customer-support.png",
    stats: { improvement: "47%", metric: "Cost Reduction" },
    gradient: "from-blue-500/20 to-cyan-500/20"
  },
  {
    title: "Sales Enhancement",
    description:
      "Empower your sales team with real-time information and insights during customer calls, increasing conversion rates and satisfaction.",
    image: "/images/use-cases/sales-enhancement.png",
    stats: { improvement: "32%", metric: "Conversion Rate" },
    gradient: "from-purple-500/20 to-pink-500/20"
  },
  {
    title: "Healthcare Assistance",
    description:
      "Provide patients with accurate medical information through voice interactions, improving accessibility and reducing administrative burden.",
    image: "/images/use-cases/healthcare.png",
    stats: { improvement: "68%", metric: "Faster Access" },
    gradient: "from-green-500/20 to-emerald-500/20"
  },
  {
    title: "Educational Tools",
    description:
      "Create interactive learning experiences with voice-based Q&A, making education more engaging and accessible for all students.",
    image: "/images/use-cases/education.png",
    stats: { improvement: "41%", metric: "Performance Boost" },
    gradient: "from-amber-500/20 to-yellow-500/20"
  }
]

export default function UseCases() {
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
            Transforming Industries
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            See how our AI-powered platform is revolutionizing different sectors with intelligent voice interactions.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {useCases.map((useCase, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300"
            >
              <div className={`absolute inset-0 bg-gradient-to-r ${useCase.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>

              <div className="relative p-8">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-purple-300 transition-colors">
                      {useCase.title}
                    </h3>
                    <p className="text-gray-300 leading-relaxed mb-6">{useCase.description}</p>
                  </div>

                  <div className="ml-6 text-right">
                    <div className="text-3xl font-bold text-purple-400">{useCase.stats.improvement}</div>
                    <div className="text-sm text-gray-400">{useCase.stats.metric}</div>
                  </div>
                </div>

                <div className="h-64 bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-xl overflow-hidden">
                  <img
                    src={useCase.image}
                    alt={useCase.title}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-300 transform group-hover:scale-105 transition-transform"
                  />
                </div>

                <div className="mt-6 flex justify-end">
                  <Button
                    variant="ghost"
                    className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 group"
                  >
                    Learn more
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
