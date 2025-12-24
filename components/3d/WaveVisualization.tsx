"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import { Plane } from "@react-three/drei"
import * as THREE from "three"

interface WaveVisualizationProps {
  isActive: boolean
  audioLevel: number
}

export default function WaveVisualization({ isActive, audioLevel }: WaveVisualizationProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  // Custom shader for wave effect
  const vertexShader = `
    uniform float uTime;
    uniform float uAmplitude;
    uniform float uFrequency;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      vUv = uv;
      
      vec4 modelPosition = modelMatrix * vec4(position, 1.0);
      
      float elevation = sin(modelPosition.x * uFrequency + uTime) * 
                       sin(modelPosition.z * uFrequency * 0.5 + uTime * 0.5) * 
                       uAmplitude;
      
      elevation += sin(modelPosition.x * uFrequency * 2.0 + uTime * 2.0) * 
                   sin(modelPosition.z * uFrequency + uTime) * 
                   uAmplitude * 0.5;
      
      modelPosition.y += elevation;
      vElevation = elevation;
      
      vec4 viewPosition = viewMatrix * modelPosition;
      vec4 projectedPosition = projectionMatrix * viewPosition;
      
      gl_Position = projectedPosition;
    }
  `

  const fragmentShader = `
    uniform float uTime;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uColorC;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      float mixStrength = (vElevation + 0.5) * 0.5;
      
      vec3 color = mix(uColorA, uColorB, mixStrength);
      color = mix(color, uColorC, sin(vUv.x * 10.0 + uTime) * 0.5 + 0.5);
      
      float alpha = 0.6 + mixStrength * 0.4;
      
      gl_FragColor = vec4(color, alpha);
    }
  `

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmplitude: { value: 0.3 },
      uFrequency: { value: 2.0 },
      uColorA: { value: new THREE.Color("#8b5cf6") }, // Purple
      uColorB: { value: new THREE.Color("#06b6d4") }, // Cyan
      uColorC: { value: new THREE.Color("#a855f7") }, // Light purple
    }),
    [],
  )

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime

      // Increase amplitude when active (recording or playing)
      const targetAmplitude = isActive ? 0.8 + (audioLevel / 100) * 0.5 : 0.3
      materialRef.current.uniforms.uAmplitude.value = THREE.MathUtils.lerp(
        materialRef.current.uniforms.uAmplitude.value,
        targetAmplitude,
        0.05,
      )

      // Increase frequency when active
      const targetFrequency = isActive ? 3.0 + (audioLevel / 100) * 2.0 : 2.0
      materialRef.current.uniforms.uFrequency.value = THREE.MathUtils.lerp(
        materialRef.current.uniforms.uFrequency.value,
        targetFrequency,
        0.02,
      )
    }

    if (meshRef.current) {
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.2) * 0.1
    }
  })

  return (
    <group position={[0, -2, -5]}>
      {/* Main wave plane */}
      <Plane ref={meshRef} args={[20, 20, 128, 128]} rotation={[-Math.PI / 2, 0, 0]}>
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
        />
      </Plane>

      {/* Secondary wave for depth */}
      <Plane args={[15, 15, 64, 64]} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{
            ...uniforms,
            uAmplitude: { value: 0.2 },
            uFrequency: { value: 1.5 },
            uColorA: { value: new THREE.Color("#1e40af") },
            uColorB: { value: new THREE.Color("#3730a3") },
            uColorC: { value: new THREE.Color("#4338ca") },
          }}
          transparent
          side={THREE.DoubleSide}
          opacity={0.4}
        />
      </Plane>

      {/* Floating particles */}
      {[...Array(50)].map((_, i) => (
        <mesh key={i} position={[(Math.random() - 0.5) * 20, Math.random() * 3 + 1, (Math.random() - 0.5) * 20]}>
          <sphereGeometry args={[0.02]} />
          <meshBasicMaterial color={i % 2 === 0 ? "#8b5cf6" : "#06b6d4"} transparent opacity={0.6} />
        </mesh>
      ))}

      {/* Ambient lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 5, 0]} intensity={1} color="#8b5cf6" />
      <pointLight position={[5, 3, 5]} intensity={0.5} color="#06b6d4" />
      <pointLight position={[-5, 3, -5]} intensity={0.5} color="#a855f7" />
    </group>
  )
}
