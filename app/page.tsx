"use client"

import { Suspense } from "react"
import dynamic from "next/dynamic"
import Hero from "@/components/Hero"
import Features from "@/components/Features"
import UseCases from "@/components/UseCases"
import CTA from "@/components/CTA"
import Navigation from "@/components/Navigation"

// Dynamically import Canvas and 3D components to avoid SSR issues
const Canvas = dynamic(() => import("@react-three/fiber").then((mod) => ({ default: mod.Canvas })), {
  ssr: false,
})

const Environment = dynamic(() => import("@react-three/drei").then((mod) => ({ default: mod.Environment })), {
  ssr: false,
})

const OrbitControls = dynamic(() => import("@react-three/drei").then((mod) => ({ default: mod.OrbitControls })), {
  ssr: false,
})

const Globe = dynamic(() => import("@/components/3d/Globe"), {
  ssr: false,
})

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-900 via-gray-700 to-gray-900">
      {/* 3D Background */}
      <div className="fixed inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
          <Suspense fallback={null}>
            <Environment preset="night" />
            <Globe />
            <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
          </Suspense>
        </Canvas>
      </div>

      {/* Content */}
      <div className="relative z-10">
        <Navigation />
        <Hero />
        <Features />
        <UseCases />
        <CTA />
      </div>
    </div>
  )
}
