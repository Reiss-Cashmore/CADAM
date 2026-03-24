import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import * as THREE from 'three';

export type AnnotationTool = 'view' | 'draw' | 'text';

export interface DrawingPath {
  id: string;
  points: Array<{ x: number; y: number }>;
}

export interface TextLabel {
  id: string;
  position: THREE.Vector3;
  text: string;
}

interface AnnotationState {
  activeTool: AnnotationTool;
  drawings: DrawingPath[];
  textLabels: TextLabel[];
  isDrawing: boolean;
}

interface AnnotationContextType extends AnnotationState {
  setActiveTool: (tool: AnnotationTool) => void;
  addDrawing: (drawing: DrawingPath) => void;
  addTextLabel: (label: TextLabel) => void;
  removeAnnotation: (id: string) => void;
  clearAll: () => void;
  setIsDrawing: (drawing: boolean) => void;
}

const AnnotationContext = createContext<AnnotationContextType | null>(null);

export function AnnotationProvider({ children }: { children: ReactNode }) {
  const [activeTool, setActiveTool] = useState<AnnotationTool>('view');
  const [drawings, setDrawings] = useState<DrawingPath[]>([]);
  const [textLabels, setTextLabels] = useState<TextLabel[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const addDrawing = useCallback((drawing: DrawingPath) => {
    setDrawings((prev) => [...prev, drawing]);
  }, []);

  const addTextLabel = useCallback((label: TextLabel) => {
    setTextLabels((prev) => [...prev, label]);
  }, []);

  const removeAnnotation = useCallback((id: string) => {
    setDrawings((prev) => prev.filter((d) => d.id !== id));
    setTextLabels((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setDrawings([]);
    setTextLabels([]);
  }, []);

  return (
    <AnnotationContext.Provider
      value={{
        activeTool,
        setActiveTool,
        drawings,
        addDrawing,
        textLabels,
        addTextLabel,
        removeAnnotation,
        clearAll,
        isDrawing,
        setIsDrawing,
      }}
    >
      {children}
    </AnnotationContext.Provider>
  );
}

export function useAnnotation() {
  const context = useContext(AnnotationContext);
  if (!context) {
    throw new Error('useAnnotation must be used within an AnnotationProvider');
  }
  return context;
}
