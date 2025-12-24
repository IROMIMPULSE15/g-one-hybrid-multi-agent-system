"use client"

import { motion } from "framer-motion"
import {
  BookOpen,
  Download,
  Video,
  Code,
  Users,
  ArrowRight,
  Search,
  Clock,
  CheckCircle,
  PlayCircle,
  Terminal,
  Shield,
  Zap,
  GitBranch,
  ChevronRight,
  ExternalLink,
  Copy,
  FileText,
} from "lucide-react"
import Navigation from "@/components/Navigation"
import ParticleBackground from "@/components/ParticleBackground"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Workflow Diagram Component (Pure Tailwind)
const WorkflowStep = ({ step, isLast, isActive }: { step: any; isLast: boolean; isActive?: boolean }) => (
  <div className="flex items-center">
    <div className={`flex flex-col items-center ${isActive ? 'text-purple-400' : 'text-gray-400'}`}>
      <div className={`w-12 h-12 rounded-full border-2 ${isActive ? 'border-purple-500 bg-purple-500/20' : 'border-gray-600 bg-white/5'} flex items-center justify-center mb-2`}>
        <step.icon className="w-6 h-6" />
      </div>
      <p className="text-xs font-medium max-w-24 text-center">{step.title}</p>
    </div>
    {!isLast && (
      <div className="w-20 h-0.5 bg-gradient-to-r from-purple-500/50 to-cyan-500/50 mx-2"></div>
    )}
  </div>
)

const resourceCategories = [
  {
    title: "Documentation",
    icon: BookOpen,
    description: "Comprehensive guides and API documentation",
    resources: [
      {
        title: "Getting Started Guide",
        description: "Complete setup and integration guide for new users",
        type: "Guide",
        format: "PDF + Web",
        difficulty: "Beginner",
        time: "15 min",
        prerequisites: "None",
        downloadUrl: "#",
      },
      {
        title: "API Reference",
        description: "Detailed API documentation with examples",
        type: "Documentation",
        format: "Interactive",
        difficulty: "Intermediate",
        time: "30 min",
        prerequisites: "API Basics",
        downloadUrl: "#",
      },
      {
        title: "Best Practices",
        description: "Optimization tips and recommended implementations",
        type: "Guide",
        format: "PDF",
        difficulty: "Advanced",
        time: "20 min",
        prerequisites: "API Reference",
        downloadUrl: "#",
      },
    ],
  },
  {
    title: "Video Tutorials",
    icon: Video,
    description: "Step-by-step video guides and demos",
    resources: [
      {
        title: "Platform Overview",
        description: "Complete walkthrough of all platform features",
        type: "Video",
        format: "4K • Subtitles",
        difficulty: "Beginner",
        time: "25 min",
        prerequisites: "None",
        downloadUrl: "#",
      },
      {
        title: "Integration Tutorial",
        description: "How to integrate our AI into your existing systems",
        type: "Video",
        format: "HD • Code Along",
        difficulty: "Intermediate",
        time: "18 min",
        prerequisites: "API Basics",
        downloadUrl: "#",
      },
      {
        title: "Advanced Configuration",
        description: "Custom training and advanced setup options",
        type: "Video",
        format: "HD • Live Demo",
        difficulty: "Advanced",
        time: "35 min",
        prerequisites: "Integration",
        downloadUrl: "#",
      },
    ],
  },
  {
    title: "Code Examples",
    icon: Code,
    description: "Ready-to-use code snippets and SDKs",
    resources: [
      {
        title: "JavaScript SDK",
        description: "Complete SDK with examples for web applications",
        type: "SDK",
        format: "npm • GitHub",
        difficulty: "Beginner",
        time: "10 min",
        code: `npm install @yourai/sdk`,
        downloadUrl: "#",
      },
      {
        title: "Python Integration",
        description: "Python examples for backend integration",
        type: "Code",
        format: "pip • Jupyter",
        difficulty: "Intermediate",
        time: "12 min",
        code: `pip install yourai-python`,
        downloadUrl: "#",
      },
      {
        title: "React Components",
        description: "Pre-built React components for quick integration",
        type: "Components",
        format: "npm • Storybook",
        difficulty: "Beginner",
        time: "8 min",
        code: `import { ChatWidget } from '@yourai/react'`,
        downloadUrl: "#",
      },
    ],
  },
  {
    title: "Case Studies",
    icon: Users,
    description: "Real-world implementations and success stories",
    resources: [
      {
        title: "E-commerce Success Story",
        description: "How TechCorp increased conversions by 47%",
        type: "Case Study",
        format: "PDF • 6 pages",
        difficulty: "All Levels",
        time: "12 min",
        metrics: "+47% conversion • -62% support cost",
        downloadUrl: "#",
      },
      {
        title: "Healthcare Implementation",
        description: "Improving patient support with AI conversations",
        type: "Case Study",
        format: "PDF • 8 pages",
        difficulty: "All Levels",
        time: "15 min",
        metrics: "24/7 support • 91% satisfaction",
        downloadUrl: "#",
      },
      {
        title: "Financial Services",
        description: "Streamlining customer service in banking",
        type: "Case Study",
        format: "PDF • 5 pages",
        difficulty: "All Levels",
        time: "10 min",
        metrics: "3.2x faster resolution",
        downloadUrl: "#",
      },
    ],
  },
]

const workflows = [
  {
    title: "Integration Workflow",
    steps: [
      { title: "Create Account", icon: Users },
      { title: "Get API Key", icon: Shield },
      { title: "Install SDK", icon: Terminal },
      { title: "Test Endpoint", icon: Zap },
      { title: "Go Live", icon: CheckCircle },
    ],
  },
  {
    title: "Model Training Pipeline",
    steps: [
      { title: "Prepare Data", icon: FileText },
      { title: "Upload Dataset", icon: Download },
      { title: "Configure Model", icon: GitBranch },
      { title: "Train & Validate", icon: PlayCircle },
      { title: "Deploy", icon: CheckCircle },
    ],
  },
  {
    title: "Deployment Process",
    steps: [
      { title: "Sandbox Test", icon: Code },
      { title: "Staging Review", icon: Shield },
      { title: "Load Testing", icon: Zap },
      { title: "Production Rollout", icon: CheckCircle },
    ],
  },
]

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <Navigation />
      <ParticleBackground />

      <div className="pt-20 px-4 py-12">
        <div className="container mx-auto max-w-7xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
              Developer Library
            </h1>
            <p className="text-xl text-gray-300 max-w-4xl mx-auto mb-10">
              Comprehensive documentation, workflows, code samples, and real-world implementations for building with our AI platform.
            </p>

            {/* Search */}
            <div className="max-w-2xl mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-6 h-6" />
              <Input
                placeholder="Search guides, APIs, code, videos, workflows..."
                className="pl-12 pr-4 py-7 bg-white/10 border-white/20 text-white placeholder-gray-400 focus:border-purple-500 text-lg"
              />
            </div>
          </motion.div>

          {/* Workflow Diagrams */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <h2 className="text-3xl font-bold text-white mb-10 text-center">Platform Workflows</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {workflows.map((flow, i) => (
                <Card key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/8 transition-all">
                  <CardHeader>
                    <CardTitle className="text-xl text-white flex items-center gap-2">
                      <GitBranch className="w-5 h-5 text-purple-400" />
                      {flow.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center overflow-x-auto pb-2">
                      {flow.steps.map((step, idx) => (
                        <WorkflowStep key={idx} step={step} isLast={idx === flow.steps.length - 1} isActive={idx === 0} />
                      ))}
                    </div>
                    <Button className="mt-4 w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700">
                      View Full Flow <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.section>

          <Separator className="bg-white/10 mb-16" />

          {/* Resource Categories with Enhanced Metadata */}
          {resourceCategories.map((category, catIdx) => (
            <motion.section
              key={catIdx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: catIdx * 0.1 }}
              className="mb-20"
            >
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-600/80 to-cyan-600/80 p-3 flex items-center justify-center">
                  <category.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white">{category.title}</h2>
                  <p className="text-gray-300">{category.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {category.resources.map((res, resIdx) => (
                  <Card
                    key={resIdx}
                    className="bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300 group"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50">
                          {res.type}
                        </Badge>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {res.time}
                        </span>
                      </div>
                      <CardTitle className="text-lg text-white group-hover:text-purple-300 transition-colors">
                        {res.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-300 text-sm mb-4">{res.description}</p>

                      {/* Metadata */}
                      <div className="flex flex-wrap gap-2 mb-4 text-xs">
                        <Badge variant="outline" className="border-gray-600 text-gray-400">
                          {res.difficulty}
                        </Badge>
                        <Badge variant="outline" className="border-cyan-600 text-cyan-400">
                          {res.format}
                        </Badge>
                        {res.prerequisites && res.prerequisites !== "None" && (
                          <Badge variant="outline" className="border-purple-600 text-purple-400">
                            {res.prerequisites}
                          </Badge>
                        )}
                      </div>

                      {/* Code Snippet (if available) */}
                      {res.code && (
                        <div className="mb-4 p-3 bg-black/30 rounded-lg font-mono text-xs text-cyan-300 flex items-center justify-between">
                          <code>{res.code}</code>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      )}

                      {/* Metrics (Case Studies) */}
                      {res.metrics && (
                        <p className="text-green-400 text-sm font-medium mb-4">{res.metrics}</p>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" className="flex-1 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10">
                          <Download className="mr-1 w-4 h-4" /> Download
                        </Button>
                        <Button size="sm" className="flex-1 bg-purple-600 hover:bg-purple-700 text-white">
                          <ExternalLink className="mr-1 w-4 h-4" /> View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.section>
          ))}

          {/* Support Section */}
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-20"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-3xl blur-xl"></div>
              <div className="relative bg-gradient-to-r from-purple-900/50 to-cyan-900/50 backdrop-blur-sm border border-purple-500/30 rounded-3xl p-12 text-center">
                <h2 className="text-4xl font-bold mb-6 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  Need Help Implementing?
                </h2>
                <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                  Get expert guidance, join live office hours, or request architecture review.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white px-8 py-4 rounded-full text-lg font-semibold"
                  >
                    Book Expert Session
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-2 border-purple-500/50 text-purple-300 hover:bg-purple-500/10 px-8 py-4 rounded-full text-lg font-semibold backdrop-blur-sm"
                  >
                    Join Developer Community
                  </Button>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  )
}