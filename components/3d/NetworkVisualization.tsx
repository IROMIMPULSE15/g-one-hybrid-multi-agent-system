"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import { Line, Sphere } from "@react-three/drei"
import type * as THREE from "three"

export default function NetworkVisualization() {
  const groupRef = useRef<THREE.Group>(null)

  const nodes = useMemo(() => {
    const nodeArray = []
    for (let i = 0; i < 20; i++) {
      nodeArray.push({
        position: [(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10] as [
          number,
          number,
          number,
        ],
        color: Math.random() > 0.5 ? "#8b5cf6" : "#06b6d4",
      })
    }
    return nodeArray
  }, [])

  const connections = useMemo(() => {
    const connectionArray = []
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const distance = Math.sqrt(
          Math.pow(nodes[i].position[0] - nodes[j].position[0], 2) +
            Math.pow(nodes[i].position[1] - nodes[j].position[1], 2) +
            Math.pow(nodes[i].position[2] - nodes[j].position[2], 2),
        )
        if (distance < 4 && Math.random() > 0.7) {
          connectionArray.push({
            start: nodes[i].position,
            end: nodes[j].position,
          })
        }
      }
    }
    return connectionArray
  }, [nodes])

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, -8]}>
      {/* Nodes */}
      {nodes.map((node, index) => (
        <Sphere key={index} args={[0.1]} position={node.position}>
          <meshStandardMaterial
            color={node.color}
            emissive={node.color}
            emissiveIntensity={0.3}
            transparent
            opacity={0.8}
          />
        </Sphere>
      ))}

      {/* Connections */}
      {connections.map((connection, index) => (
        <Line
          key={index}
          points={[connection.start, connection.end]}
          color="#a855f7"
          lineWidth={1}
          transparent
          opacity={0.3}
        />
      ))}

      {/* Central hub */}
      <Sphere args={[0.3]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.5} transparent opacity={0.9} />
      </Sphere>
    </group>
  )
}
