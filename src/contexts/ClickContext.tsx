import { createContext, useContext, useState, ReactNode } from 'react';
import * as THREE from 'three';

export interface ClickData {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  scadPosition?: THREE.Vector3;
  scadNormal?: THREE.Vector3;
  objectName: string;
  faceIndex: number;
  uv: THREE.Vector2 | null;
  distanceFromOrigin: number;
  screenPosition: { x: number; y: number };
  timestamp: number;
}

interface ClickContextType {
  clickData: ClickData | null;
  setClickData: (data: ClickData | null) => void;
}

const ClickContext = createContext<ClickContextType>({
  clickData: null,
  setClickData: () => {},
});

export function ClickProvider({ children }: { children: ReactNode }) {
  const [clickData, setClickData] = useState<ClickData | null>(null);
  return (
    <ClickContext.Provider value={{ clickData, setClickData }}>
      {children}
    </ClickContext.Provider>
  );
}

export function useClick() {
  const context = useContext(ClickContext);
  if (!context) {
    throw new Error('useClick must be used within a ClickProvider');
  }
  return context;
}

export function worldToScreen(
  position: THREE.Vector3,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const projected = position.clone().project(camera);
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((projected.x + 1) / 2) * rect.width + rect.left,
    y: ((-projected.y + 1) / 2) * rect.height + rect.top,
  };
}
