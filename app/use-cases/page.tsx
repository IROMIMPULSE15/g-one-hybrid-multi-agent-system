"use client"

import { motion } from "framer-motion"
import {
  Headphones,
  ShoppingBag,
  Stethoscope,
  BookOpen,
  Briefcase,
  CarFront,
  ArrowRight,
  TrendingUp,
  Users,
  Clock,
} from "lucide-react"
import Navigation from "@/components/Navigation"
import ParticleBackground from "@/components/ParticleBackground"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const useCases = [
  {
    icon: Headphones,
    title: "Customer Support",
    description:
      "Deliver seamless, 24/7 customer assistance through AI-driven conversational agents that understand intent, emotion, and context in real time.",
    benefits: [
      "47% reduction in average response time",
      "92% increase in customer satisfaction",
      "60% reduction in operational costs",
      "Consistent multi-channel support",
    ],
    features: ["Natural language understanding", "Sentiment analysis", "Ticket escalation", "Knowledge base sync"],
    image: "/flowcharts/customer-support-flow.svg",
    color: "from-blue-500 to-cyan-500",
    stats: {
      improvement: "47%",
      metric: "Faster Resolution",
    },
  },
  {
    icon: ShoppingBag,
    title: "E-commerce & Retail",
    description:
      "Enhance shopping experiences with AI voice and chat assistants that personalize product discovery, assist in checkout, and improve customer retention.",
    benefits: [
      "32% higher conversion rate",
      "40% increase in repeat purchases",
      "85% boost in engagement",
      "Reduced cart abandonment",
    ],
    features: ["Personalized recommendations", "Cart & order tracking", "Payment assistance", "Inventory Q&A"],
    image: "/flowcharts/ecommerce-sales-flow.svg",
    color: "from-green-500 to-emerald-500",
    stats: {
      improvement: "32%",
      metric: "Conversion Growth",
    },
  },
  {
    icon: Stethoscope,
    title: "Healthcare",
    description:
      "Empower patients and healthcare professionals with AI assistants that streamline appointments, symptom checks, and post-consultation guidance.",
    benefits: [
      "68% faster access to care",
      "55% reduction in administrative load",
      "90% patient satisfaction",
      "Better follow-up compliance",
    ],
    features: ["Symptom triage", "Smart scheduling", "Medication reminders", "Health record insights"],
    image: "/flowcharts/healthcare-assistant-flow.svg",
    color: "from-red-500 to-pink-500",
    stats: {
      improvement: "68%",
      metric: "Faster Access",
    },
  },
  {
    icon: BookOpen,
    title: "Education & Learning",
    description:
      "Create adaptive learning journeys with AI tutors that engage, evaluate, and evolve with each student’s performance in real time.",
    benefits: [
      "41% improvement in retention",
      "75% increase in engagement",
      "50% less manual grading",
      "Data-driven personalization",
    ],
    features: ["Adaptive assessments", "Instant feedback", "Interactive tutoring", "Progress tracking"],
    image: "/flowcharts/education-learning-flow.svg",
    color: "from-purple-500 to-indigo-500",
    stats: {
      improvement: "41%",
      metric: "Learning Outcomes",
    },
  },
  {
    icon: Briefcase,
    title: "Enterprise & HR",
    description:
      "Automate HR workflows with AI that answers policy questions, assists onboarding, and streamlines employee support systems.",
    benefits: [
      "58% reduction in HR queries",
      "80% faster onboarding",
      "95% self-service resolution",
      "Improved employee satisfaction",
    ],
    features: ["Employee onboarding", "Policy lookup", "Benefits guidance", "Automated IT support"],
    image: "/flowcharts/hr-automation-flow.svg",
    color: "from-orange-500 to-yellow-500",
    stats: {
      improvement: "58%",
      metric: "Workload Reduction",
    },
  },
  {
    icon: CarFront,
    title: "Automotive & Mobility",
    description:
      "Redefine in-car experiences with AI copilots that provide real-time diagnostics, smart navigation, and proactive maintenance alerts.",
    benefits: [
      "45% increase in driver satisfaction",
      "62% faster service response",
      "70% fewer call-center escalations",
      "Improved connectivity ecosystem",
    ],
    features: ["Predictive maintenance", "Voice navigation", "Safety alerts", "Remote diagnostics"],
    image: "/flowcharts/automotive-ai-flow.svg",
    color: "from-teal-500 to-blue-500",
    stats: {
      improvement: "45%",
      metric: "Experience Gain",
    },
  },
]

export default function UseCasesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navigation />
      <ParticleBackground />

      <div className="relative z-10 pt-20">
        {/* Hero Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
                Real-World Use Cases
              </h1>
              <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
                Explore how industries are leveraging conversational AI to improve efficiency, user experience, and business outcomes.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Use Cases Grid */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-7xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {useCases.map((useCase, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                  className="group"
                >
                  <Card className="bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300 overflow-hidden h-full">
                    <div className="relative">
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between mb-4">
                          <div
                            className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${useCase.color} p-4 group-hover:scale-110 transition-transform duration-300`}
                          >
                            <useCase.icon className="w-full h-full text-white" />
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-bold text-purple-400">
                              {useCase.stats.improvement}
                            </div>
                            <div className="text-sm text-gray-400">{useCase.stats.metric}</div>
                          </div>
                        </div>

                        <CardTitle className="text-2xl text-white group-hover:text-purple-300 transition-colors mb-3">
                          {useCase.title}
                        </CardTitle>

                        <p className="text-gray-300 leading-relaxed">{useCase.description}</p>
                      </CardHeader>

                      <CardContent className="space-y-6">
                        {/* Flowchart Visualization */}
                        <div className="h-48 bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-xl overflow-hidden">
                          <img
                            src={useCase.image}
                            alt={`${useCase.title} Flowchart`}
                            className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                          />
                        </div>

                        {/* Benefits */}
                        <div>
                          <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                            <TrendingUp className="w-5 h-5 mr-2 text-green-400" />
                            Key Benefits
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {useCase.benefits.map((benefit, i) => (
                              <div key={i} className="text-sm text-gray-300 flex items-center">
                                <div className="w-2 h-2 bg-green-400 rounded-full mr-2 flex-shrink-0" />
                                {benefit}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Features */}
                        <div>
                          <h4 className="text-lg font-semibold text-white mb-3 flex items-center">
                            <Users className="w-5 h-5 mr-2 text-purple-400" />
                            Core Features
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {useCase.features.map((feature, i) => (
                              <span
                                key={i}
                                className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm border border-purple-500/30"
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 group w-full justify-between"
                        >
                          Learn More About This Use Case
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </CardContent>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Industry Statistics */}
        <section className="py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-12"
            >
              <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                Industry Impact
              </h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                Our conversational AI drives measurable improvements across every sector.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { icon: Clock, value: "< 2 sec", label: "Average Response Time", color: "text-blue-400" },
                { icon: Users, value: "98.5%", label: "Customer Satisfaction", color: "text-green-400" },
                { icon: TrendingUp, value: "45%", label: "Average Cost Reduction", color: "text-purple-400" },
                { icon: Briefcase, value: "500+", label: "Enterprise Clients", color: "text-cyan-400" },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 text-center hover:bg-white/10 transition-all duration-300"
                >
                  <stat.icon className={`w-12 h-12 ${stat.color} mx-auto mb-4`} />
                  <div className="text-3xl font-bold text-white mb-2">{stat.value}</div>
                  <div className="text-gray-400 text-sm">{stat.label}</div>
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
                  Ready to Transform Your Industry?
                </h2>
                <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                  Join the innovators leveraging conversational AI to reimagine their business processes.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white px-8 py-4 rounded-full text-lg font-semibold"
                  >
                    Start Your Use Case
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-2 border-purple-500/50 text-purple-300 hover:bg-purple-500/10 px-8 py-4 rounded-full text-lg font-semibold backdrop-blur-sm"
                  >
                    Schedule Consultation
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
