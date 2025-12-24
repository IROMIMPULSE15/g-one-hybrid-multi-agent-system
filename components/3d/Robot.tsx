"use client"

import { useRef, useEffect } from "react"
import { useFrame } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"

export default function Robot() {
  const modelRef = useRef<THREE.Group>(null)
  const mixer = useRef<THREE.AnimationMixer | null>(null)

  // Load the model
  const { scene, animations } = useGLTF("/models/wall-eanimated.glb")

  useEffect(() => {
    if (scene) {
      // Set up the model's initial position and scale
      scene.scale.set(0.5, 0.5, 0.5) // Reduced size
      scene.position.set(0, -1, 0) // Moved up one line from -1.5 to -1
      scene.rotation.set(0, Math.PI * 0.25, 0)  // Rotate 45 degrees for better view

      // Only set up shadows, no material changes
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
      })
    }

    // Set up animations if they exist
    if (animations && animations.length > 0) {
      mixer.current = new THREE.AnimationMixer(scene)
      const action = mixer.current.clipAction(animations[0])
      action.play()
    }
  }, [scene, animations])

  useFrame((state, delta) => {
    // Update animations
    if (mixer.current) {
      mixer.current.update(delta)
    }

    // Add gentle floating animation to the model
    if (modelRef.current) {
      modelRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.1
      modelRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.05
    }
  })

  return (
    <group ref={modelRef}>
      <primitive object={scene} />
    </group>
  )
}

// Pre-load the model
useGLTF.preload("/models/wall-eanimated.glb")