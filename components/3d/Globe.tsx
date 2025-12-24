"use client"

import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Box, RoundedBox } from "@react-three/drei"
import type * as THREE from "three"

export default function Globe() {
  const meshRef = useRef<THREE.Mesh>(null)
  const cubesRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.1
      meshRef.current.rotation.y += 0.008
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.2) * 0.05
    }

    if (cubesRef.current) {
      cubesRef.current.rotation.y += 0.005
      cubesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1
    }
  })

  return (
    <group position={[2, 0, -3]}>
      {/* Main geometric cube */}
      <RoundedBox ref={meshRef} args={[2.5, 2.5, 2.5]} radius={0.1} scale={1.2}>
        <meshStandardMaterial
          color="#8b5cf6"
          transparent
          opacity={0.4}
          roughness={0.2}
          metalness={0.8}
          emissive="#a855f7"
          emissiveIntensity={0.1}
        />
      </RoundedBox>

      {/* Wireframe overlay */}
      <RoundedBox args={[2.5, 2.5, 2.5]} radius={0.1} scale={1.21}>
        <meshBasicMaterial color="#a855f7" wireframe transparent opacity={0.3} />
      </RoundedBox>

      {/* Floating smaller cubes */}
      <group ref={cubesRef}>
        {[...Array(8)].map((_, i) => {
          const angle = (i / 8) * Math.PI * 2
          const radius = 4
          const x = Math.cos(angle) * radius
          const z = Math.sin(angle) * radius
          const y = Math.sin(i * 0.5) * 2

          return (
            <Box key={i} args={[0.3, 0.3, 0.3]} position={[x, y, z]} rotation={[i * 0.3, i * 0.5, i * 0.2]}>
              <meshStandardMaterial
                color="#06b6d4"
                transparent
                opacity={0.6}
                emissive="#06b6d4"
                emissiveIntensity={0.2}
              />
            </Box>
          )
        })}
      </group>

      {/* Additional geometric elements */}
      <Box args={[1, 1, 1]} position={[3, 1, 1]} rotation={[0.5, 0.5, 0]}>
        <meshStandardMaterial color="#f59e0b" transparent opacity={0.5} emissive="#f59e0b" emissiveIntensity={0.3} />
      </Box>

      <Box args={[0.8, 0.8, 0.8]} position={[-2, -1, 2]} rotation={[1, 1, 0.5]}>
        <meshStandardMaterial color="#ef4444" transparent opacity={0.4} emissive="#ef4444" emissiveIntensity={0.2} />
      </Box>

      {/* Particles */}
      {[...Array(50)].map((_, i) => (
        <mesh key={i} position={[(Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8]}>
          <sphereGeometry args={[0.02]} />
          <meshBasicMaterial color="#a855f7" transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  )
}
