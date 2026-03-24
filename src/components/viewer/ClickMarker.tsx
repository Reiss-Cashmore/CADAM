import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ClickData } from '@/contexts/ClickContext';

interface ClickMarkerProps {
  clickData: ClickData;
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);

export function ClickMarker({ clickData }: ClickMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Compute quaternion to orient the torus flush with the surface normal
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(Z_AXIS, clickData.normal),
    [clickData.normal],
  );

  // Pulse animation + apply orientation each frame
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const scale = 1 + 0.15 * Math.sin(clock.elapsedTime * 3);
    groupRef.current.scale.setScalar(scale);
    groupRef.current.quaternion.copy(quaternion);
  });

  return (
    <group ref={groupRef} position={clickData.position}>
      {/* Outer ring */}
      <mesh>
        <torusGeometry args={[1.2, 0.15, 16, 32]} />
        <meshStandardMaterial
          color="#00e5ff"
          emissive="#00e5ff"
          emissiveIntensity={2}
          depthTest={false}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Center dot */}
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial
          color="#00e5ff"
          emissive="#00e5ff"
          emissiveIntensity={2}
          depthTest={false}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}
