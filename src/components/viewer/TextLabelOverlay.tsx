import { Html } from '@react-three/drei';
import { useAnnotation } from '@/contexts/AnnotationContext';

export function TextLabelOverlay() {
  const { textLabels, removeAnnotation } = useAnnotation();

  return (
    <>
      {textLabels.map((label) => (
        <Html
          key={label.id}
          position={[label.position.x, label.position.y, label.position.z]}
          center
          distanceFactor={200}
        >
          <div
            className="group flex items-center gap-1 rounded bg-adam-neutral-800/90 px-2 py-1 text-xs text-adam-text-primary shadow-lg backdrop-blur-sm"
            style={{ whiteSpace: 'nowrap' }}
          >
            <span>{label.text}</span>
            <button
              onClick={() => removeAnnotation(label.id)}
              className="ml-1 hidden rounded px-0.5 text-adam-text-primary/40 hover:text-red-400 group-hover:inline"
            >
              ×
            </button>
          </div>
        </Html>
      ))}
    </>
  );
}
