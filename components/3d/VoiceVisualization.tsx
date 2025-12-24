"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import { Sphere, Text } from "@react-three/drei"
import * as THREE from "three"

interface VoiceVisualizationProps {
  isActive: boolean
  audioLevel: number
}

export default function VoiceVisualization({ isActive, audioLevel }: VoiceVisualizationProps) {
  const groupRef = useRef<THREE.Group>(null)
  const waveformRef = useRef<THREE.Group>(null)
  const particlesRef = useRef<THREE.Group>(null)

  // Generate waveform data
  const waveformData = useMemo(() => {
    const points = []
    for (let i = 0; i < 100; i++) {
      const x = (i - 50) * 0.1
      const y = Math.sin(i * 0.2) * 0.5
      const z = 0
      points.push(new THREE.Vector3(x, y, z))
    }
    return points
  }, [])

  // Generate voice particles
  const voiceParticles = useMemo(() => {
    const particles = []
    for (let i = 0; i < 50; i++) {
      particles.push({
        position: [(Math.random() - 0.5) * 8, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4] as [
          number,
          number,
          number,
        ],
        speed: Math.random() * 0.02 + 0.01,
        phase: Math.random() * Math.PI * 2,
        size: Math.random() * 0.1 + 0.05,
      })
    }
    return particles
  }, [])

  useFrame((state) => {
    const time = state.clock.elapsedTime

    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(time * 0.3) * 0.1
    }

    // Animate waveform based on audio level
    if (waveformRef.current && isActive) {
      waveformRef.current.children.forEach((child, index) => {
        if (child instanceof THREE.Mesh) {
          const amplitude = (audioLevel / 100) * 2 + 0.5
          child.position.y = Math.sin(time * 3 + index * 0.2) * amplitude
          child.scale.setScalar(1 + Math.sin(time * 4 + index * 0.1) * 0.3)
        }
      })
    }

    // Animate voice particles
    if (particlesRef.current) {
      particlesRef.current.children.forEach((child, index) => {
        const particle = voiceParticles[index]
        if (particle && child) {
          child.position.x += Math.sin(time + particle.phase) * particle.speed
          child.position.y += Math.cos(time * 0.5 + particle.phase) * particle.speed * 0.5

          // Reset position if too far
          if (Math.abs(child.position.x) > 5) {
            child.position.x = (Math.random() - 0.5) * 8
          }

          // Pulse effect based on audio level
          const scale = particle.size * (1 + (audioLevel / 100) * 0.5)
          child.scale.setScalar(scale)
        }
      })
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Central microphone visualization */}
      <group position={[0, 0, 0]}>
        <Sphere args={[0.3]} position={[0, 0, 0]}>
          <meshStandardMaterial
            color="#00ff88"
            emissive="#00ff88"
            emissiveIntensity={isActive ? 0.3 + (audioLevel / 100) * 0.5 : 0.1}
            transparent
            opacity={0.8}
          />
        </Sphere>

        {/* Microphone body */}
        <mesh position={[0, -0.5, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.6]} />
          <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* Microphone stand */}
        <mesh position={[0, -1, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.4]} />
          <meshStandardMaterial color="#666666" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>

      {/* Sound waves */}
      {isActive && (
        <group>
          {[1, 2, 3].map((ring, index) => (
            <mesh key={index} position={[0, 0, 0]} rotation={[0, 0, 0]}>
              <torusGeometry args={[0.5 + index * 0.5, 0.02]} />
              <meshStandardMaterial
                color="#00ffff"
                emissive="#00ffff"
                emissiveIntensity={0.5 - index * 0.1}
                transparent
                opacity={0.6 - index * 0.15}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* Waveform visualization */}
      <group ref={waveformRef} position={[0, 1.5, 0]}>
        {waveformData.map((point, index) => (
          <Sphere key={index} args={[0.03]} position={[point.x, point.y, point.z]}>
            <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={isActive ? 0.5 : 0.2} />
          </Sphere>
        ))}
      </group>

      {/* Voice particles */}
      <group ref={particlesRef}>
        {voiceParticles.map((particle, index) => (
          <Sphere key={index} args={[particle.size]} position={particle.position}>
            <meshStandardMaterial
              color="#88ff00"
              emissive="#88ff00"
              emissiveIntensity={isActive ? 0.4 : 0.1}
              transparent
              opacity={0.7}
            />
          </Sphere>
        ))}
      </group>

      {/* Frequency bars */}
      {isActive && (
        <group position={[0, -2, 0]}>
          {[...Array(20)].map((_, i) => {
            const height = 0.1 + (audioLevel / 100) * Math.random() * 1.5
            return (
              <mesh key={i} position={[(i - 10) * 0.2, height / 2, 0]}>
                <boxGeometry args={[0.1, height, 0.1]} />
                <meshStandardMaterial color="#00ffaa" emissive="#00ffaa" emissiveIntensity={0.3} />
              </mesh>
            )
          })}
        </group>
      )}

      {/* Text labels */}
      <Text position={[0, 2.5, 0]} fontSize={0.3} color="#ffffff" anchorX="center" anchorY="middle">
        Voice Recognition Active
      </Text>

      {isActive && (
        <Text position={[0, -2.8, 0]} fontSize={0.2} color="#00ff88" anchorX="center" anchorY="middle">
          Audio Level: {Math.round(audioLevel)}%
        </Text>
      )}

      {/* Ambient lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 2, 2]} intensity={1} color="#00ff88" />
      <pointLight position={[2, 0, 0]} intensity={0.5} color="#00ffff" />
      <pointLight position={[-2, 0, 0]} intensity={0.5} color="#88ff00" />
    </group>
  )
}
