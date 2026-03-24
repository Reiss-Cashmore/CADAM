# Sub-Plan 3: Annotation System

## Overview

Allow users to annotate the 3D model with:

- **Freehand drawing** - Draw circles, arrows, highlights on the model
- **Text labels** - Place 3D-positioned text annotations
- **Screenshot capture** - Capture annotated view to send to LLM

## UI Specification

```
┌────────────────────────────────────────────────────────────┐
│  [🔴 Pencil] [📝 Text] [📷 Screenshot] [🗑️ Clear]       │
└────────────────────────────────────────────────────────────┘
```

## Implementation

### Step 1: Create Annotation Types & Context

Create `src/contexts/AnnotationContext.tsx`:

```typescript
import { createContext, useContext, useState, ReactNode } from 'react';
import * as THREE from 'three';

export type AnnotationTool = 'view' | 'draw' | 'text';

export interface DrawingPath {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface TextLabel {
  id: string;
  position: THREE.Vector3;
  content: string;
  screenPosition: { x: number; y: number };
}

export interface AnnotationState {
  activeTool: AnnotationTool;
  drawings: DrawingPath[];
  textLabels: TextLabel[];
  isDrawing: boolean;
}

interface AnnotationContextType {
  state: AnnotationState;
  setActiveTool: (tool: AnnotationTool) => void;
  addDrawing: (path: DrawingPath) => void;
  addTextLabel: (label: TextLabel) => void;
  removeAnnotation: (id: string) => void;
  clearAll: () => void;
  screenshot: string | null;
  captureScreenshot: (canvas: HTMLCanvasElement) => void;
}

const AnnotationContext = createContext<AnnotationContextType | undefined>(undefined);

export function AnnotationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AnnotationState>({
    activeTool: 'view',
    drawings: [],
    textLabels: [],
    isDrawing: false,
  });
  const [screenshot, setScreenshot] = useState<string | null>(null);

  return (
    <AnnotationContext.Provider
      value={{
        state,
        setActiveTool: (tool) => setState(s => ({ ...s, activeTool: tool })),
        addDrawing: (path) => setState(s => ({ ...s, drawings: [...s.drawings, path] })),
        addTextLabel: (label) => setState(s => ({ ...s, textLabels: [...s.textLabels, label] })),
        removeAnnotation: (id) => setState(s => ({
          ...s,
          drawings: s.drawings.filter(d => d.id !== id),
          textLabels: s.textLabels.filter(t => t.id !== id),
        })),
        clearAll: () => setState(s => ({ ...s, drawings: [], textLabels: [] })),
        screenshot,
        captureScreenshot: (canvas) => {
          setScreenshot(canvas.toDataURL('image/png'));
        },
      }}
    >
      {children}
    </AnnotationContext.Provider>
  );
}

export function useAnnotation() {
  const context = useContext(AnnotationContext);
  if (!context) throw new Error('useAnnotation must be used within AnnotationProvider');
  return context;
}
```

### Step 2: Create Annotation Toolbar

Create `src/components/viewer/AnnotationToolbar.tsx`:

```typescript
import { useAnnotation, AnnotationTool } from '@/contexts/AnnotationContext';
import { Pencil, Type, Camera, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const tools: { id: AnnotationTool; icon: React.ReactNode; label: string }[] = [
  { id: 'view', icon: <span>👁️</span>, label: 'View' },
  { id: 'draw', icon: <Pencil className="h-4 w-4" />, label: 'Draw' },
  { id: 'text', icon: <Type className="h-4 w-4" />, label: 'Text' },
  { id: 'screenshot', icon: <Camera className="h-4 w-4" />, label: 'Capture' },
];

export function AnnotationToolbar() {
  const { state, setActiveTool, clearAll, captureScreenshot } = useAnnotation();

  const handleCapture = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      captureScreenshot(canvas);
    }
  };

  return (
    <div className="absolute left-2 top-2 flex gap-1 rounded-lg bg-adam-neutral-800/90 p-1 backdrop-blur">
      {tools.map((tool) => (
        <Button
          key={tool.id}
          variant={state.activeTool === tool.id ? 'default' : 'ghost'}
          size="sm"
          onClick={() => {
            if (tool.id === 'screenshot') {
              handleCapture();
            } else {
              setActiveTool(tool.id);
            }
          }}
          className="h-8 w-8 p-0"
        >
          {tool.icon}
        </Button>
      ))}
      <div className="mx-1 w-px bg-gray-600" />
      <Button
        variant="ghost"
        size="sm"
        onClick={clearAll}
        className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

### Step 3: Create Drawing Canvas Overlay

Create `src/components/viewer/DrawingCanvas.tsx`:

```typescript
import { useRef, useEffect, useState, useCallback } from 'react';
import { useAnnotation, DrawingPath } from '@/contexts/AnnotationContext';

export function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state, addDrawing } = useAnnotation();
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = useCallback((e: React.MouseEvent) => {
    if (state.activeTool !== 'draw') return;
    setIsDrawing(true);
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setCurrentPath([{ x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    }
  }, [state.activeTool]);

  const draw = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || state.activeTool !== 'draw') return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setCurrentPath(prev => [...prev, point]);

      // Draw on canvas
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && currentPath.length > 0) {
        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(currentPath[currentPath.length - 1].x, currentPath[currentPath.length - 1].y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
    }
  }, [isDrawing, state.activeTool, currentPath]);

  const stopDrawing = useCallback(() => {
    if (isDrawing && currentPath.length > 1) {
      addDrawing({
        id: Date.now().toString(),
        points: currentPath,
        color: '#e94560',
        width: 3,
      });
    }
    setIsDrawing(false);
    setCurrentPath([]);
  }, [isDrawing, currentPath, addDrawing]);

  // Resize canvas to match parent
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (canvas && parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
  }, []);

  // Render existing drawings
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    state.drawings.forEach(path => {
      if (path.points.length < 2) return;
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      path.points.forEach(point => ctx.lineTo(point.x, point.y));
      ctx.stroke();
    });
  }, [state.drawings]);

  if (state.activeTool !== 'draw') return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-auto absolute inset-0 cursor-crosshair"
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
    />
  );
}
```

### Step 4: Create Text Label Component

Create `src/components/viewer/TextLabelOverlay.tsx`:

```typescript
import { useState, useRef } from 'react';
import { useAnnotation, TextLabel } from '@/contexts/AnnotationContext';
import { Html } from '@react-three/drei';

function TextLabelItem({ label }: { label: TextLabel }) {
  return (
    <Html position={[label.position.x, label.position.y, label.position.z]} center>
      <div className="rounded bg-adam-blue/80 px-2 py-1 text-sm text-white backdrop-blur">
        {label.content}
      </div>
    </Html>
  );
}

export function TextLabelLayer({ annotations }: { annotations: TextLabel[] }) {
  return (
    <>
      {annotations.map(label => (
        <TextLabelItem key={label.id} label={label} />
      ))}
    </>
  );
}

// Input component for adding text labels
export function TextLabelInput() {
  const [input, setInput] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);
  const { addTextLabel } = useAnnotation();

  const handleConfirm = () => {
    if (!input.trim()) return;
    setIsPlacing(true);
  };

  const handleSceneClick = (e: ThreeEvent) => {
    if (!isPlacing) return;
    addTextLabel({
      id: Date.now().toString(),
      position: e.point.clone(),
      content: input,
      screenPosition: { x: e.clientX, y: e.clientY },
    });
    setInput('');
    setIsPlacing(false);
  };

  // This would be integrated into the ThreeScene component
  return null; // Placeholder - see integration below
}
```

### Step 5: Integrate Annotation System into ThreeScene

Modify `src/components/viewer/ThreeScene.tsx`:

```typescript
import { AnnotationProvider, useAnnotation } from '@/contexts/AnnotationContext';
import { AnnotationToolbar } from '@/components/viewer/AnnotationToolbar';
import { DrawingCanvas } from '@/components/viewer/DrawingCanvas';
import { TextLabelLayer } from '@/components/viewer/TextLabelOverlay';

function SceneWithAnnotations() {
  const { state } = useAnnotation();

  return (
    <>
      {/* Existing scene content */}
      <SceneContent />

      {/* 3D text labels */}
      <TextLabelLayer annotations={state.textLabels} />
    </>
  );
}

export function ThreeScene(props) {
  return (
    <AnnotationProvider>
      <div className="relative h-full w-full">
        <Canvas>
          {/* ... existing setup ... */}
          <SceneWithAnnotations />
        </Canvas>

        {/* Toolbar overlay */}
        <AnnotationToolbar />

        {/* Drawing canvas overlay */}
        <DrawingCanvas />
      </div>
    </AnnotationProvider>
  );
}
```

### Step 6: Include Annotations in LLM Context

Modify the mini-chat or main chat to include annotation data:

```typescript
function getAnnotationContext(): string {
  const { state, screenshot } = useAnnotation();

  let context = '';

  if (state.drawings.length > 0) {
    context += `\nAnnotations: User has drawn ${state.drawings.length} mark(s) on the model.\n`;
  }

  if (state.textLabels.length > 0) {
    context += `\nText Labels:\n`;
    state.textLabels.forEach((label) => {
      context += `- "${label.content}" at (${label.position.x.toFixed(1)}, ${label.position.y.toFixed(1)}, ${label.position.z.toFixed(1)})\n`;
    });
  }

  if (screenshot) {
    context += `\n[Screenshot attached - see attached image]\n`;
  }

  return context;
}
```

## Files to Create/Modify

| File                                          | Changes                           |
| --------------------------------------------- | --------------------------------- |
| `src/contexts/AnnotationContext.tsx`          | NEW - Annotation state management |
| `src/components/viewer/AnnotationToolbar.tsx` | NEW - Toolbar UI                  |
| `src/components/viewer/DrawingCanvas.tsx`     | NEW - Drawing overlay             |
| `src/components/viewer/TextLabelOverlay.tsx`  | NEW - 3D text labels              |
| `src/components/viewer/ThreeScene.tsx`        | Integrate annotation providers    |

## Testing Checklist

- [ ] Toolbar appears and tool selection works
- [ ] Can draw freehand paths on viewport
- [ ] Can place text labels in 3D space
- [ ] Can capture screenshot with annotations
- [ ] Annotations clear properly
- [ ] Annotations included in LLM context when submitted
