import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  GizmoHelper,
  GizmoViewcube,
  Stage,
  Environment,
  OrthographicCamera,
  PerspectiveCamera,
} from '@react-three/drei';
import * as THREE from 'three';
import { useState, useCallback } from 'react';
import { OrthographicPerspectiveToggle } from '@/components/viewer/OrthographicPerspectiveToggle';
import { cn } from '@/lib/utils';
import { ClickData } from '@/contexts/ClickContext';
import { AnnotationProvider } from '@/contexts/AnnotationContext';
import { AnnotationToolbar } from '@/components/viewer/AnnotationToolbar';
import { DrawingCanvas } from '@/components/viewer/DrawingCanvas';
import { TextLabelOverlay } from '@/components/viewer/TextLabelOverlay';
import { ClickMarker } from '@/components/viewer/ClickMarker';
import { ThreeEvent } from '@react-three/fiber';

interface ThreeSceneProps {
  geometry: THREE.BufferGeometry;
  color: string;
  isMobile?: boolean;
  backgroundColor?: string;
  onMeshClick?: (data: ClickData) => void;
  clickData?: ClickData | null;
  previewGeometry?: THREE.BufferGeometry | null;
  centeringOffset?: THREE.Vector3 | null;
}

export function ThreeScene({
  geometry,
  color,
  isMobile = false,
  backgroundColor = '#3B3B3B',
  onMeshClick,
  clickData,
  previewGeometry,
  centeringOffset,
}: ThreeSceneProps) {
  const [isOrthographic, setIsOrthographic] = useState(false);

  // Store the initial isMobile value to prevent position changes during resize
  const [initialIsMobile] = useState(isMobile);

  const handleMeshClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!onMeshClick) return;
      e.stopPropagation();

      const point = e.point.clone();
      let normal = new THREE.Vector3(0, 1, 0);
      if (e.face) {
        normal = e.face.normal.clone();
        normal.transformDirection(e.object.matrixWorld);
      }

      const faceIndex = e.face ? (e.faceIndex ?? 0) : 0;
      const uv = e.uv ? e.uv.clone() : null;

      // Compute OpenSCAD coordinates by inverting the -90° X rotation and centering
      const inverseRotation = new THREE.Matrix4().makeRotationX(Math.PI / 2);
      const scadPosition = point.clone().applyMatrix4(inverseRotation);
      if (centeringOffset) scadPosition.add(centeringOffset);
      const scadNormal = normal.clone().transformDirection(inverseRotation);

      onMeshClick({
        position: point,
        normal,
        scadPosition,
        scadNormal,
        objectName: e.object.name || 'mesh',
        faceIndex,
        uv,
        distanceFromOrigin: point.length(),
        screenPosition: {
          x: (e.nativeEvent as MouseEvent).clientX,
          y: (e.nativeEvent as MouseEvent).clientY,
        },
        timestamp: Date.now(),
      });
    },
    [onMeshClick, centeringOffset],
  );

  return (
    <AnnotationProvider>
      <div className="relative h-full w-full overflow-hidden">
        <AnnotationToolbar />
        <DrawingCanvas />
        <Canvas className="block h-full w-full" gl={{ stencil: true }}>
          <color attach="background" args={[backgroundColor]} />
          {isOrthographic ? (
            <OrthographicCamera
              makeDefault
              position={initialIsMobile ? [-100, 150, 100] : [-100, 100, 100]}
              zoom={40}
              near={0.1}
              far={1000}
            />
          ) : (
            <PerspectiveCamera
              makeDefault
              position={initialIsMobile ? [-100, 150, 100] : [-100, 100, 100]}
              fov={45}
              near={0.1}
              far={1000}
              zoom={0.4}
            />
          )}
          <Stage
            adjustCamera={false}
            environment={null}
            intensity={0.6}
            position={[0, 0, 0]}
          >
            <Environment files={`${import.meta.env.BASE_URL}/city.hdr`} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[5, 5, 5]} intensity={1.2} castShadow />
            <directionalLight position={[-5, 5, 5]} intensity={0.2} />
            <directionalLight position={[-5, 5, -5]} intensity={0.2} />
            <directionalLight position={[0, 5, 0]} intensity={0.2} />
            <directionalLight position={[-5, -5, -5]} intensity={0.6} />
            {/* Pass 1: Main model — writes stencil=3 everywhere solid covers */}
            <mesh
              geometry={geometry}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, 0, 0]}
              onClick={handleMeshClick}
              renderOrder={1}
            >
              <meshStandardMaterial
                color={color}
                metalness={0.6}
                roughness={0.3}
                envMapIntensity={0.3}
                stencilWrite={true}
                stencilRef={3}
                stencilFunc={THREE.AlwaysStencilFunc}
                stencilZFail={THREE.ReplaceStencilOp}
                stencilZPass={THREE.ReplaceStencilOp}
              />
            </mesh>

            {/* Pass 2: Ghost — increment overlap pixels (stencil 3→4, second tri sees 4≠3 → skip) */}
            {previewGeometry && (
              <mesh
                geometry={previewGeometry}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0, 0]}
                renderOrder={2}
              >
                <meshStandardMaterial
                  colorWrite={false}
                  depthTest={false}
                  depthWrite={false}
                  stencilWrite={true}
                  stencilRef={3}
                  stencilFunc={THREE.EqualStencilFunc}
                  stencilZPass={THREE.IncrementStencilOp}
                />
              </mesh>
            )}

            {/* Pass 3: Ghost — increment ghost-only pixels (stencil 0→1, second tri sees 1≠0 → skip) */}
            {previewGeometry && (
              <mesh
                geometry={previewGeometry}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0, 0]}
                renderOrder={3}
              >
                <meshStandardMaterial
                  colorWrite={false}
                  depthTest={false}
                  depthWrite={false}
                  stencilWrite={true}
                  stencilRef={0}
                  stencilFunc={THREE.EqualStencilFunc}
                  stencilZPass={THREE.IncrementStencilOp}
                />
              </mesh>
            )}

            {/* Pass 4: Growth highlight — ghost-only pixels (stencil=1) */}
            {previewGeometry && (
              <mesh
                geometry={previewGeometry}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0, 0]}
                renderOrder={4}
              >
                <meshStandardMaterial
                  color="#00e5ff"
                  emissive="#00e5ff"
                  emissiveIntensity={1.0}
                  transparent
                  opacity={0.55}
                  depthTest={false}
                  depthWrite={false}
                  stencilWrite={true}
                  stencilRef={1}
                  stencilFunc={THREE.EqualStencilFunc}
                  stencilFail={THREE.KeepStencilOp}
                  stencilZFail={THREE.KeepStencilOp}
                  stencilZPass={THREE.KeepStencilOp}
                />
              </mesh>
            )}

            {/* Pass 5: Shrink highlight — solid-only pixels (stencil=3) */}
            {previewGeometry && (
              <mesh
                geometry={geometry}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0, 0]}
                renderOrder={5}
              >
                <meshStandardMaterial
                  color="#00e5ff"
                  emissive="#00e5ff"
                  emissiveIntensity={1.0}
                  transparent
                  opacity={0.55}
                  depthTest={false}
                  depthWrite={false}
                  stencilWrite={true}
                  stencilRef={3}
                  stencilFunc={THREE.EqualStencilFunc}
                  stencilFail={THREE.KeepStencilOp}
                  stencilZFail={THREE.KeepStencilOp}
                  stencilZPass={THREE.KeepStencilOp}
                />
              </mesh>
            )}
          </Stage>
          {clickData && <ClickMarker clickData={clickData} />}
          <TextLabelOverlay />
          <OrbitControls
            makeDefault
            enableDamping={true}
            dampingFactor={0.05}
          />
          {!initialIsMobile && (
            <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
              <GizmoViewcube />
            </GizmoHelper>
          )}
        </Canvas>

        <div
          className={cn(
            'absolute flex flex-col items-center',
            initialIsMobile ? 'bottom-2 right-2' : 'bottom-2 right-9',
          )}
        >
          <div className="flex items-center gap-2">
            <OrthographicPerspectiveToggle
              isOrthographic={isOrthographic}
              onToggle={setIsOrthographic}
            />
          </div>
        </div>
      </div>
    </AnnotationProvider>
  );
}
