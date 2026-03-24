import { useRef, useEffect, useCallback } from 'react';
import { useAnnotation } from '@/contexts/AnnotationContext';

const STROKE_COLOR = '#e94560';
const STROKE_WIDTH = 3;

export function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPathRef = useRef<Array<{ x: number; y: number }>>([]);
  const { activeTool, drawings, addDrawing, isDrawing, setIsDrawing } =
    useAnnotation();

  const isActive = activeTool === 'draw';

  // Redraw all existing drawings
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineWidth = STROKE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const drawing of drawings) {
      if (drawing.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(drawing.points[0].x, drawing.points[0].y);
      for (let i = 1; i < drawing.points.length; i++) {
        ctx.lineTo(drawing.points[i].x, drawing.points[i].y);
      }
      ctx.stroke();
    }

    // Draw current in-progress path
    const current = currentPathRef.current;
    if (current.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(current[0].x, current[0].y);
      for (let i = 1; i < current.length; i++) {
        ctx.lineTo(current[i].x, current[i].y);
      }
      ctx.stroke();
    }
  }, [drawings]);

  // Resize canvas to match parent
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const observer = new ResizeObserver(() => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      redraw();
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, [redraw]);

  // Redraw when drawings change
  useEffect(() => {
    redraw();
  }, [drawings, redraw]);

  const getCanvasPoint = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isActive) return;
    e.stopPropagation();
    setIsDrawing(true);
    currentPathRef.current = [getCanvasPoint(e)];
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !isActive) return;
    e.stopPropagation();
    currentPathRef.current.push(getCanvasPoint(e));
    redraw();
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing || !isActive) return;
    e.stopPropagation();
    setIsDrawing(false);
    const points = currentPathRef.current;
    if (points.length >= 2) {
      addDrawing({ id: crypto.randomUUID(), points: [...points] });
    }
    currentPathRef.current = [];
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[5]"
      style={{
        pointerEvents: isActive ? 'auto' : 'none',
        cursor: isActive ? 'crosshair' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}
