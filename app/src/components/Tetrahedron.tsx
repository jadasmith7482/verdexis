import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform float time;

  void main() {
    vNormal = normal;
    vPosition = position + vec3(
      sin(time * 0.5 + position.y) * 0.1,
      cos(time * 0.3 + position.x) * 0.1,
      sin(time * 0.7) * 0.1
    );
    vec4 mvPosition = modelViewMatrix * vec4(vPosition, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  uniform float time;
  uniform vec3 colorBase;

  float map(float value, float min1, float max1, float min2, float max2) {
    return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
  }

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vPosition.xyz);
    vec3 normal = normalize(vNormal);
    float fresnel = 0.8 + 0.2 * pow(1.0 - dot(viewDirection, normal), 2.0);
    float colorMix = map(sin(time * 0.2 + vPosition.y * 2.0), -1.0, 1.0, 0.0, 1.0);
    vec3 color = mix(colorBase, vec3(0.05, 0.55, 0.27), colorMix);
    gl_FragColor = vec4(color * fresnel, 0.7);
  }
`

function SierpinskiTetrahedron({ level = 3 }: { level?: number }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const vertices: number[] = []

    function tetrahedron(
      a: THREE.Vector3,
      b: THREE.Vector3,
      c: THREE.Vector3,
      d: THREE.Vector3,
      n: number
    ) {
      if (n === 0) {
        vertices.push(
          a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
          a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z,
          a.x, a.y, a.z, d.x, d.y, d.z, b.x, b.y, b.z,
          b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z
        )
        return
      }

      const ab = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)
      const ac = new THREE.Vector3().addVectors(a, c).multiplyScalar(0.5)
      const ad = new THREE.Vector3().addVectors(a, d).multiplyScalar(0.5)
      const bc = new THREE.Vector3().addVectors(b, c).multiplyScalar(0.5)
      const bd = new THREE.Vector3().addVectors(b, d).multiplyScalar(0.5)
      const cd = new THREE.Vector3().addVectors(c, d).multiplyScalar(0.5)

      tetrahedron(a, ab, ac, ad, n - 1)
      tetrahedron(ab, b, bc, bd, n - 1)
      tetrahedron(ac, bc, c, cd, n - 1)
      tetrahedron(ad, bd, cd, d, n - 1)
    }

    const a = new THREE.Vector3(1, 1, 1)
    const b = new THREE.Vector3(-1, -1, 1)
    const c = new THREE.Vector3(-1, 1, -1)
    const d = new THREE.Vector3(1, -1, -1)

    tetrahedron(a, b, c, d, level)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geo.computeVertexNormals()
    return geo
  }, [level])

  useFrame(({ clock, camera }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = clock.getElapsedTime()
    }

    const t = clock.getElapsedTime() * 0.1
    camera.position.x = Math.sin(t) * 3
    camera.position.y = Math.sin(t * 0.5) * 0.5
    camera.position.z = Math.cos(t) * 3
    camera.lookAt(0, 0, 0)
  })

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        uniforms={{
          time: { value: 0 },
          colorBase: { value: new THREE.Vector3(0.04, 0.08, 0.1) },
        }}
      />
    </mesh>
  )
}

export default function TetrahedronCanvas() {
  return (
    <div className="absolute inset-0 z-0" style={{ pointerEvents: 'none' }}>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 75 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <SierpinskiTetrahedron level={3} />
      </Canvas>
    </div>
  )
}
