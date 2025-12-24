"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"

export default function ParticleBackground() {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const animationIdRef = useRef<number>()

  // State to store window dimensions and pixel ratio
  const [windowDimensions, setWindowDimensions] = useState({
    width: 0,
    height: 0,
    pixelRatio: 1,
  })

  // Effect to get initial dimensions and set up resize listener
  useEffect(() => {
    if (typeof window === "undefined") return

    const updateDimensions = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: Math.min(window.devicePixelRatio, 2),
      })
    }

    updateDimensions() // Set initial dimensions
    window.addEventListener("resize", updateDimensions)

    return () => {
      window.removeEventListener("resize", updateDimensions)
    }
  }, []) // Run once on mount

  // Main Three.js effect
  useEffect(() => {
    // Only proceed if mountRef is available and dimensions are set
    if (!mountRef.current || windowDimensions.width === 0 || windowDimensions.height === 0) {
      return
    }

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(75, windowDimensions.width / windowDimensions.height, 0.1, 1000)
    camera.position.z = 5

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(windowDimensions.width, windowDimensions.height)
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(windowDimensions.pixelRatio)
    rendererRef.current = renderer
    mountRef.current.appendChild(renderer.domElement)

    // Particle positions (used for lines, even if particles themselves are not rendered)
    const particleCount = 200
    const positions = new Float32Array(particleCount * 3)

    // Create sphere of points for line connections
    const radius = 2.5
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))

    for (let i = 0; i < particleCount; i++) {
      const y = 1 - (i / (particleCount - 1)) * 2
      const radiusAtY = Math.sqrt(1 - y * y)
      const theta = goldenAngle * i

      const x = Math.cos(theta) * radiusAtY * radius
      const z = Math.sin(theta) * radiusAtY * radius

      positions[i * 3] = x
      positions[i * 3 + 1] = y * radius
      positions[i * 3 + 2] = z
    }

    // Connection lines with dynamic opacity
    const lineGeometry = new THREE.BufferGeometry()
    const linePositions: number[] = []
    const lineColors: number[] = []

    const maxDistance = 1.2
    const connectionCount = Math.min(particleCount * 3, 600)

    for (let i = 0; i < particleCount && linePositions.length < connectionCount * 6; i++) {
      for (let j = i + 1; j < particleCount && linePositions.length < connectionCount * 6; j++) {
        const x1 = positions[i * 3]
        const y1 = positions[i * 3 + 1]
        const z1 = positions[i * 3 + 2]

        const x2 = positions[j * 3]
        const y2 = positions[j * 3 + 1]
        const z2 = positions[j * 3 + 2]

        const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2) + Math.pow(z2 - z1, 2))

        if (distance < maxDistance) {
          linePositions.push(x1, y1, z1, x2, y2, z2)

          const colorIntensity = 1 - distance / maxDistance
          const lineR = 0.2 + colorIntensity * 0.3
          const lineG = 0.5 + colorIntensity * 0.3
          const lineB = 0.9 + colorIntensity * 0.1

          lineColors.push(lineR, lineG, lineB, lineR, lineG, lineB)
        }
      }
    }

    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3))
    lineGeometry.setAttribute("color", new THREE.Float32BufferAttribute(lineColors, 3))

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    })

    const lineSystem = new THREE.LineSegments(lineGeometry, lineMaterial)
    scene.add(lineSystem)

    let time = 0
    const animate = () => {
      time += 0.008

      lineSystem.rotation.y = time * 0.3
      lineSystem.rotation.x = Math.sin(time * 0.5) * 0.2
      lineSystem.rotation.z = Math.sin(time * 0.3) * 0.1

      const primaryPulse = 1 + Math.sin(time * 2) * 0.08
      const secondaryPulse = 1 + Math.sin(time * 3.5) * 0.05
      const combinedScale = primaryPulse * secondaryPulse
      lineSystem.scale.setScalar(combinedScale)

      renderer.render(scene, camera)
      animationIdRef.current = requestAnimationFrame(animate)
    }

    animate()

    // Update camera and renderer on dimension changes
    camera.aspect = windowDimensions.width / windowDimensions.height
    camera.updateProjectionMatrix()
    renderer.setSize(windowDimensions.width, windowDimensions.height)
    renderer.setPixelRatio(windowDimensions.pixelRatio)

    let mouseX = 0
    let mouseY = 0
    let targetRotationX = 0
    let targetRotationY = 0

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX / windowDimensions.width) * 2 - 1
      mouseY = -(event.clientY / windowDimensions.height) * 2 + 1

      targetRotationX = mouseY * 0.15
      targetRotationY = mouseX * 0.15
    }

    const updateMouseInteraction = () => {
      if (lineSystem) {
        lineSystem.rotation.x += (targetRotationX - lineSystem.rotation.x) * 0.05
        lineSystem.rotation.y += (targetRotationY - lineSystem.rotation.y) * 0.05
      }
      requestAnimationFrame(updateMouseInteraction)
    }

    window.addEventListener("mousemove", handleMouseMove)
    updateMouseInteraction()

    let lastTime = performance.now()
    let frameCount = 0
    const targetFPS = 60

    const monitorPerformance = () => {
      const currentTime = performance.now()
      frameCount++

      if (currentTime - lastTime >= 1000) {
        const fps = frameCount
        frameCount = 0
        lastTime = currentTime

        if (fps < targetFPS * 0.8) {
          lineMaterial.opacity = Math.max(0.2, lineMaterial.opacity * 0.95)
        }
      }
    }

    const performanceInterval = setInterval(monitorPerformance, 1000)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      clearInterval(performanceInterval)

      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current)
      }

      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement)
      }

      lineGeometry.dispose()
      lineMaterial.dispose()
      renderer.dispose()
    }
  }, [windowDimensions]) // Re-run this effect when dimensions change

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        background: `
          radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(6, 182, 212, 0.05) 0%, transparent 50%),
          linear-gradient(135deg, rgba(59, 130, 246, 0.02) 0%, rgba(147, 51, 234, 0.02) 100%)
        `,
      }}
    />
  )
}
