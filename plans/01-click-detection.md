# Sub-Plan 1: Click Detection & Context System

## Overview

Add raycasting and click detection to the 3D viewer. When users click on a model, capture:

- **Position**: Exact (x, y, z) world coordinates where clicked
- **Surface Normal**: The face normal vector at the click point
- **Object ID**: Which mesh/object was clicked
- **UV Coordinates**: Texture mapping position if available
- **Distance from Origin**: Distance from model origin (0,0,0)

## Implementation

### Step 1: Create Click Context Provider

Create `src/contexts/ClickContext.tsx`:

```typescript
import { createContext, useContext, useState, ReactNode } from 'react';
import * as THREE from 'three';

export interface ClickData {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  objectName?: string;
  faceIndex?: number;
  uv?: THREE.Vector2;
  distanceFromOrigin: number;
  screenPosition: { x: number; y: number };
  timestamp: number;
}

interface ClickContextType {
  clickData: ClickData | null;
  setClickData: (data: ClickData | null) => void;
  isClicking: boolean;
}

const ClickContext = createContext<ClickContextType | undefined>(undefined);

export function ClickProvider({ children }: { children: ReactNode }) {
  const [clickData, setClickData] = useState<ClickData | null>(null);
  const [isClicking, setIsClicking] = useState(false);

  return (
    <ClickContext.Provider value={{ clickData, setClickData, isClicking }}>
      {children}
    </ClickContext.Provider>
  );
}

export function useClick() {
  const context = useContext(ClickContext);
  if (!context) throw new Error('useClick must be used within ClickProvider');
  return context;
}

// Helper: Convert 3D point to screen coordinates
export function worldToScreen(position: THREE.Vector3, camera: THREE.Camera): { x: number; y: number } {
  const vector = position.clone().project(camera);
  return {
    x: (vector.x + 1) / 2 * window.innerWidth,
    y: (-vector.y + 1) / 2 * window.innerHeight
  };
}
```

### Step 2: Modify ThreeScene.tsx

Modify `src/components/viewer/ThreeScene.tsx`:

```typescript
import { ClickProvider, useClick } from '@/contexts/ClickContext';
import * as THREE from 'three';

function SceneContent({ geometry }: { geometry: THREE.BufferGeometry }) {
  const { setClickData } = useClick();

  // ... existing setup ...

  return (
    <>
      {/* Existing camera and lights */}

      <mesh
        geometry={geometry}
        onClick={(e) => {
          e.stopPropagation();

          const point = e.point.clone();
          let normal = new THREE.Vector3(0, 1, 0);

          if (e.face) {
            // Transform face normal to world space
            normal.copy(e.face.normal);
            normal.transformDirection(e.object.matrixWorld).normalize();
          }

          const screenPos = {
            x: (point.project(camera).x + 1) / 2 * window.innerWidth,
            y: (-point.project(camera).y + 1) / 2 * window.innerHeight
          };

          setClickData({
            position: point.clone(),
            normal: normal.normalize(),
            objectName: e.object.name || 'model',
            faceIndex: e.face?.a,
            uv: e.uv?.clone(),
            distanceFromOrigin: point.length(),
            screenPosition: screenPos,
            timestamp: Date.now()
          });
        }}
      >
        <meshStandardMaterial
          color={color}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
    </>
  );
}

export function ThreeScene(props) {
  return (
    <ClickProvider>
      {/* ... rest of component ... */}
    </ClickProvider>
  );
}
```

### Step 3: Add Click Data to Chat Messages

Modify the message sending logic in `ParametricView.tsx` to include click data when submitting from mini-chat:

```typescript
// When user clicks and uses mini-chat, send this context:
const enhancedPrompt = `
User clicked on model at position (${clickData.position.x.toFixed(2)}, ${clickData.position.y.toFixed(2)}, ${clickData.position.z.toFixed(2)})
with surface normal (${clickData.normal.x.toFixed(2)}, ${clickData.normal.y.toFixed(2)}, ${clickData.normal.z.toFixed(2)})
Distance from origin: ${clickData.distanceFromOrigin.toFixed(2)}

User request: "${userMessage}"
`;
```

## Files to Modify

| File                                   | Changes                                       |
| -------------------------------------- | --------------------------------------------- |
| `src/contexts/ClickContext.tsx`        | NEW - Create click context provider and hooks |
| `src/components/viewer/ThreeScene.tsx` | Add onClick handler with raycasting           |
| `src/views/ParametricView.tsx`         | Integrate mini-chat with click data           |

## Testing Checklist

- [ ] Click on model surface captures position correctly
- [ ] Surface normal is accurate (perpendicular to face)
- [ ] Screen coordinates match mouse position
- [ ] Multiple clicks update context properly
- [ ] Works with orbit controls (camera movement)

## Dependencies

No new dependencies required - uses existing:

- `three` (already installed)
- React Context API (built-in)
