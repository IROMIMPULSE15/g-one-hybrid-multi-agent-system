"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import { Sphere } from "@react-three/drei"
import type * as THREE from "three"

export default function FloatingSphere() {
  const groupRef = useRef<THREE.Group>(null)

  const spheres = useMemo(() => {
    const sphereArray = []
    for (let i = 0; i < 15; i++) {
      sphereArray.push({
        position: [(Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12] as [
          number,
          number,
          number,
        ],
        scale: Math.random() * 0.5 + 0.2,
        color: Math.random() > 0.5 ? "#8b5cf6" : "#06b6d4",
        speed: Math.random() * 0.02 + 0.01,
      })
    }
    return sphereArray
  }, [])

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.001
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.05
    }

    spheres.forEach((sphere, index) => {
      const mesh = groupRef.current?.children[index] as THREE.Mesh
      if (mesh) {
        mesh.position.y += Math.sin(state.clock.elapsedTime * sphere.speed + index) * 0.01
        mesh.rotation.x += sphere.speed
        mesh.rotation.y += sphere.speed * 0.5
      }
    })
  })

  return (
    <group ref={groupRef} position={[0, 0, -10]}>
      {spheres.map((sphere, index) => (
        <Sphere key={index} args={[sphere.scale]} position={sphere.position}>
          <meshStandardMaterial
            color={sphere.color}
            emissive={sphere.color}
            emissiveIntensity={0.2}
            transparent
            opacity={0.6}
            roughness={0.4}
            metalness={0.8}
          />
        </Sphere>
      ))}

      {/* Central larger sphere */}
      <Sphere args={[0.8]} position={[0, 0, 0]}>
        <meshStandardMaterial
          color="#a855f7"
          emissive="#a855f7"
          emissiveIntensity={0.3}
          transparent
          opacity={0.4}
          roughness={0.2}
          metalness={0.9}
        />
      </Sphere>
    </group>
  )
}
