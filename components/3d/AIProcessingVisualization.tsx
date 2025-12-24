"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import { Sphere, Box, Torus, Text, Line } from "@react-three/drei"
import * as THREE from "three"

interface AIProcessingVisualizationProps {
  isActive: boolean
  processingLevel: number
}

type NeuralNode = {
  position: [number, number, number]
  layer: number
  index: number
  activation: number
}

type Connection = {
  start: [number, number, number]
  end: [number, number, number]
  strength: number
}

type Particle = {
  position: [number, number, number]
  velocity: [number, number, number]
  size: number
  color: string
}

export default function AIProcessingVisualization({ isActive, processingLevel }: AIProcessingVisualizationProps) {
  const groupRef = useRef<THREE.Group>(null)
  const neuralNetworkRef = useRef<THREE.Group>(null)
  const dataFlowRef = useRef<THREE.Group>(null)
  const processingCoreRef = useRef<THREE.Group>(null)

  // Generate neural network nodes
  const neuralNodes = useMemo<NeuralNode[]>(() => {
    const layers = [8, 12, 16, 12, 8] // Neural network architecture
    const nodes: NeuralNode[] = []

    layers.forEach((nodeCount, layerIndex) => {
      for (let i = 0; i < nodeCount; i++) {
        const x = (layerIndex - 2) * 2
        const y = (i - nodeCount / 2) * 0.5
        const z = (Math.random() - 0.5) * 0.5

        nodes.push({
          position: [x, y, z] as [number, number, number],
          layer: layerIndex,
          index: i,
          activation: Math.random(),
        })
      }
    })

    return nodes
  }, [])

  // Generate connections between nodes
  const connections = useMemo<Connection[]>(() => {
    const conns: Connection[] = []
    for (let layer = 0; layer < 4; layer++) {
      const currentLayer = neuralNodes.filter((node) => node.layer === layer)
      const nextLayer = neuralNodes.filter((node) => node.layer === layer + 1)

      currentLayer.forEach((node1) => {
        nextLayer.forEach((node2) => {
          if (Math.random() > 0.3) {
            // 70% connection probability
            conns.push({
              start: node1.position,
              end: node2.position,
              strength: Math.random(),
            })
          }
        })
      })
    }
    return conns
  }, [neuralNodes])

  // Data flow particles
  const dataParticles = useMemo<Particle[]>(() => {
    const particles: Particle[] = []
    for (let i = 0; i < 30; i++) {
      particles.push({
        position: [(Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4] as [
          number,
          number,
          number,
        ],
        velocity: [(Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02] as [
          number,
          number,
          number,
        ],
        size: Math.random() * 0.05 + 0.02,
        color: Math.random() > 0.5 ? "#8b5cf6" : "#06b6d4",
      })
    }
    return particles
  }, [])

  useFrame((state) => {
    const time = state.clock.elapsedTime

    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(time * 0.2) * 0.1
    }

    // Animate neural network
    if (neuralNetworkRef.current && isActive) {
      neuralNetworkRef.current.children.forEach((child, index) => {
        if (child instanceof THREE.Mesh && neuralNodes[index]) {
          const node = neuralNodes[index]
          const activation = Math.sin(time * 2 + node.layer + node.index) * 0.5 + 0.5
          const intensity = activation * (processingLevel / 100)

          // Update material emissive intensity
          if (child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissiveIntensity = intensity * 0.8
          }

          // Pulse effect
          const scale = 1 + intensity * 0.3
          child.scale.setScalar(scale)
        }
      })
    }

    // Animate processing core
    if (processingCoreRef.current) {
      processingCoreRef.current.rotation.x = time * 0.5
      processingCoreRef.current.rotation.y = time * 0.3
      processingCoreRef.current.rotation.z = time * 0.7

      const scale = 1 + (processingLevel / 100) * 0.5
      processingCoreRef.current.scale.setScalar(scale)
    }

    // Animate data flow
    if (dataFlowRef.current) {
      dataFlowRef.current.children.forEach((child, index) => {
        const particle = dataParticles[index]
        if (particle && child) {
          // Update position
          child.position.x += particle.velocity[0] * (isActive ? 2 : 0.5)
          child.position.y += particle.velocity[1] * (isActive ? 2 : 0.5)
          child.position.z += particle.velocity[2] * (isActive ? 2 : 0.5)

          // Wrap around boundaries
          if (Math.abs(child.position.x) > 4) child.position.x *= -1
          if (Math.abs(child.position.y) > 3) child.position.y *= -1
          if (Math.abs(child.position.z) > 2) child.position.z *= -1

          // Pulse based on processing level
          const pulse = 1 + Math.sin(time * 4 + index) * 0.2 * (processingLevel / 100)
          child.scale.setScalar(pulse)
        }
      })
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Central Processing Core */}
      <group ref={processingCoreRef} position={[0, 0, 0]}>
        <Sphere args={[0.5]}>
          <meshStandardMaterial
            color="#8b5cf6"
            emissive="#8b5cf6"
            emissiveIntensity={isActive ? 0.5 + (processingLevel / 100) * 0.3 : 0.2}
            transparent
            opacity={0.8}
          />
        </Sphere>

        {/* Core rings */}
        {[0.7, 1.0, 1.3].map((radius, index) => (
          <Torus key={index} args={[radius, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
            <meshStandardMaterial
              color="#06b6d4"
              emissive="#06b6d4"
              emissiveIntensity={isActive ? 0.4 - index * 0.1 : 0.1}
              transparent
              opacity={0.6}
            />
          </Torus>
        ))}
      </group>

      {/* Neural Network Visualization */}
      <group ref={neuralNetworkRef} position={[0, 0, 0]}>
        {neuralNodes.map((node, index) => (
          <Sphere key={index} args={[0.08]} position={node.position}>
            <meshStandardMaterial
              color={node.layer % 2 === 0 ? "#8b5cf6" : "#06b6d4"}
              emissive={node.layer % 2 === 0 ? "#8b5cf6" : "#06b6d4"}
              emissiveIntensity={isActive ? 0.3 : 0.1}
            />
          </Sphere>
        ))}

        {/* Neural connections */}
        {connections.map((connection, index) => (
          <Line
            key={index}
            points={[connection.start, connection.end]}
            color="#a855f7"
            lineWidth={1}
            transparent
            opacity={isActive ? connection.strength * 0.5 : 0.2}
          />
        ))}
      </group>

      {/* Data Flow Particles */}
      <group ref={dataFlowRef}>
        {dataParticles.map((particle, index) => (
          <Sphere key={index} args={[particle.size]} position={particle.position}>
            <meshStandardMaterial
              color={particle.color}
              emissive={particle.color}
              emissiveIntensity={isActive ? 0.6 : 0.2}
              transparent
              opacity={0.8}
            />
          </Sphere>
        ))}
      </group>

      {/* Processing indicators */}
      {isActive && (
        <group position={[0, 2, 0]}>
          {[...Array(8)].map((_, i) => {
            const angle = (i / 8) * Math.PI * 2
            const radius = 1.5
            const x = Math.cos(angle) * radius
            const z = Math.sin(angle) * radius

            return (
              <Box key={i} args={[0.1, 0.3, 0.1]} position={[x, 0, z]}>
                <meshStandardMaterial
                  color="#00ff88"
                  emissive="#00ff88"
                  emissiveIntensity={0.5 + Math.sin(Date.now() * 0.01 + i) * 0.3}
                />
              </Box>
            )
          })}
        </group>
      )}

      {/* Memory banks */}
      <group position={[3, 0, 0]}>
        {[...Array(5)].map((_, i) => (
          <Box key={i} args={[0.2, 1, 0.2]} position={[0, (i - 2) * 0.5, 0]}>
            <meshStandardMaterial
              color="#ff6b6b"
              emissive="#ff6b6b"
              emissiveIntensity={isActive ? 0.3 + (processingLevel / 100) * 0.2 : 0.1}
            />
          </Box>
        ))}
      </group>

      <group position={[-3, 0, 0]}>
        {[...Array(5)].map((_, i) => (
          <Box key={i} args={[0.2, 1, 0.2]} position={[0, (i - 2) * 0.5, 0]}>
            <meshStandardMaterial
              color="#4ecdc4"
              emissive="#4ecdc4"
              emissiveIntensity={isActive ? 0.3 + (processingLevel / 100) * 0.2 : 0.1}
            />
          </Box>
        ))}
      </group>

      {/* Text labels */}
      <Text position={[0, 3, 0]} fontSize={0.3} color="#ffffff" anchorX="center" anchorY="middle">
        AI Neural Processing
      </Text>

      {isActive && (
        <Text position={[0, -3, 0]} fontSize={0.2} color="#8b5cf6" anchorX="center" anchorY="middle">
          Processing: {Math.round(processingLevel)}%
        </Text>
      )}

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 3, 3]} intensity={1} color="#8b5cf6" />
      <pointLight position={[3, 0, 0]} intensity={0.5} color="#06b6d4" />
      <pointLight position={[-3, 0, 0]} intensity={0.5} color="#4ecdc4" />
    </group>
  )
}
