"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import { Sphere, Box, Line, Text } from "@react-three/drei"
import * as THREE from "three"

interface AnalyticsVisualizationProps {
  isActive: boolean
}

type ChartDatum = {
  value: number
  position: [number, number, number]
  color: string
}

type DataPoint = {
  position: [number, number, number]
  value: number
  category: number
  size: number
}

type TrendLine = {
  points: THREE.Vector3[]
  color: string
}

export default function AnalyticsVisualization({ isActive }: AnalyticsVisualizationProps) {
  const groupRef = useRef<THREE.Group>(null)
  const chartsRef = useRef<THREE.Group>(null)
  const dataPointsRef = useRef<THREE.Group>(null)

  // Generate chart data
  const chartData = useMemo<ChartDatum[]>(() => {
    const data: ChartDatum[] = []
    for (let i = 0; i < 20; i++) {
      data.push({
        value: Math.random() * 2 + 0.5,
        position: [(i - 10) * 0.3, 0, 0] as [number, number, number],
        color: `hsl(${180 + i * 10}, 70%, 60%)`,
      })
    }
    return data
  }, [])

  // Generate 3D data points
  const dataPoints = useMemo<DataPoint[]>(() => {
    const points: DataPoint[] = []
    for (let i = 0; i < 100; i++) {
      points.push({
        position: [(Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4] as [
          number,
          number,
          number,
        ],
        value: Math.random(),
        category: Math.floor(Math.random() * 4),
        size: Math.random() * 0.1 + 0.05,
      })
    }
    return points
  }, [])

  // Generate trend lines
  const trendLines = useMemo<TrendLine[]>(() => {
    const lines: TrendLine[] = []
    for (let i = 0; i < 3; i++) {
      const points = []
      for (let j = 0; j < 10; j++) {
        const x = (j - 5) * 0.5
        const y = Math.sin(j * 0.5 + i) * 1.5 + i * 0.5
        const z = i * 0.5 - 1
        points.push(new THREE.Vector3(x, y, z))
      }
      lines.push({
        points,
        color: ["#06b6d4", "#8b5cf6", "#10b981"][i],
      })
    }
    return lines
  }, [])

  useFrame((state) => {
    const time = state.clock.elapsedTime

    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(time * 0.1) * 0.1
    }

    // Animate charts
    if (chartsRef.current && isActive) {
      chartsRef.current.children.forEach((child, index) => {
        if (child instanceof THREE.Mesh && chartData[index]) {
          const data = chartData[index]
          const newHeight = data.value + Math.sin(time * 2 + index * 0.2) * 0.3
          child.scale.y = newHeight
          child.position.y = newHeight / 2
        }
      })
    }

    // Animate data points
    if (dataPointsRef.current) {
      dataPointsRef.current.children.forEach((child, index) => {
        const point = dataPoints[index]
        if (point && child) {
          // Floating animation
          child.position.y += Math.sin(time + index * 0.1) * 0.01

          // Pulsing effect
          const pulse = 1 + Math.sin(time * 3 + index * 0.2) * 0.2
          child.scale.setScalar(point.size * pulse)

          // Color cycling for active state
          if (isActive && child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            const hue = (time * 50 + index * 10) % 360
            child.material.color.setHSL(hue / 360, 0.7, 0.6)
            child.material.emissiveIntensity = 0.3 + Math.sin(time * 2 + index) * 0.2
          }
        }
      })
    }
  })

  const categoryColors = ["#06b6d4", "#8b5cf6", "#10b981", "#f59e0b"]

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Central Analytics Hub */}
      <Sphere args={[0.4]} position={[0, 0, 0]}>
        <meshStandardMaterial
          color="#06b6d4"
          emissive="#06b6d4"
          emissiveIntensity={isActive ? 0.4 : 0.2}
          transparent
          opacity={0.8}
        />
      </Sphere>

      {/* Orbiting data rings */}
      {[1, 1.5, 2].map((radius, index) => (
        <group key={index} rotation={[0, 0, (index * Math.PI) / 3]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[radius, 0.02]} />
            <meshStandardMaterial
              color={categoryColors[index]}
              emissive={categoryColors[index]}
              emissiveIntensity={isActive ? 0.3 : 0.1}
              transparent
              opacity={0.6}
            />
          </mesh>
        </group>
      ))}

      {/* 3D Bar Chart */}
      <group ref={chartsRef} position={[0, -2, 0]}>
        {chartData.map((data, index) => (
          <Box
            key={index}
            args={[0.2, data.value, 0.2]}
            position={[data.position[0], data.value / 2, data.position[2]]}
          >
            <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={isActive ? 0.3 : 0.1} />
          </Box>
        ))}
      </group>

      {/* Data Points Cloud */}
      <group ref={dataPointsRef}>
        {dataPoints.map((point, index) => (
          <Sphere key={index} args={[point.size]} position={point.position}>
            <meshStandardMaterial
              color={categoryColors[point.category]}
              emissive={categoryColors[point.category]}
              emissiveIntensity={isActive ? 0.4 : 0.2}
              transparent
              opacity={0.8}
            />
          </Sphere>
        ))}
      </group>

      {/* Trend Lines */}
      {trendLines.map((line, index) => (
        <Line
          key={index}
          points={line.points}
          color={line.color}
          lineWidth={3}
          transparent
          opacity={isActive ? 0.8 : 0.4}
        />
      ))}

      {/* Dashboard Panels */}
      <group position={[3, 1, 0]}>
        {[...Array(4)].map((_, i) => (
          <Box key={i} args={[0.8, 0.6, 0.05]} position={[0, (i - 1.5) * 0.8, 0]}>
            <meshStandardMaterial color="#1e293b" emissive="#1e293b" emissiveIntensity={isActive ? 0.2 : 0.1} />
          </Box>
        ))}

        {/* Panel indicators */}
        {[...Array(4)].map((_, i) => (
          <Sphere key={i} args={[0.05]} position={[0.3, (i - 1.5) * 0.8, 0.03]}>
            <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={isActive ? 0.8 : 0.3} />
          </Sphere>
        ))}
      </group>

      {/* Metrics Display */}
      <group position={[-3, 1, 0]}>
        {[...Array(3)].map((_, i) => (
          <group key={i} position={[0, (i - 1) * 1, 0]}>
            <Box args={[1, 0.3, 0.05]}>
              <meshStandardMaterial color="#374151" emissive="#374151" emissiveIntensity={isActive ? 0.2 : 0.1} />
            </Box>

            {/* Metric bars */}
            <Box args={[0.8 * (0.3 + i * 0.3), 0.1, 0.06]} position={[-0.1 + 0.4 * (0.3 + i * 0.3), 0, 0.01]}>
              <meshStandardMaterial
                color={categoryColors[i]}
                emissive={categoryColors[i]}
                emissiveIntensity={isActive ? 0.5 : 0.2}
              />
            </Box>
          </group>
        ))}
      </group>

      {/* Real-time data stream */}
      {isActive && (
        <group position={[0, 2.5, 0]}>
          {[...Array(10)].map((_, i) => (
            <Sphere key={i} args={[0.03]} position={[(i - 5) * 0.3, Math.sin(Date.now() * 0.01 + i) * 0.2, 0]}>
              <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} />
            </Sphere>
          ))}
        </group>
      )}

      {/* Text labels */}
      <Text position={[0, 3.5, 0]} fontSize={0.3} color="#ffffff" anchorX="center" anchorY="middle">
        Analytics Dashboard
      </Text>

      <Text position={[3, 2.5, 0]} fontSize={0.15} color="#06b6d4" anchorX="center" anchorY="middle">
        Performance Metrics
      </Text>

      <Text position={[-3, 2.5, 0]} fontSize={0.15} color="#8b5cf6" anchorX="center" anchorY="middle">
        Real-time Data
      </Text>

      <Text position={[0, -3.5, 0]} fontSize={0.15} color="#10b981" anchorX="center" anchorY="middle">
        Usage Statistics
      </Text>

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 4, 4]} intensity={1} color="#06b6d4" />
      <pointLight position={[4, 2, 0]} intensity={0.5} color="#8b5cf6" />
      <pointLight position={[-4, 2, 0]} intensity={0.5} color="#10b981" />
      <pointLight position={[0, -2, 2]} intensity={0.3} color="#f59e0b" />
    </group>
  )
}
