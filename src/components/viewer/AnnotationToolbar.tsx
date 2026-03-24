import { MousePointer2, Pencil, Type, Trash2 } from 'lucide-react';
import { useAnnotation, AnnotationTool } from '@/contexts/AnnotationContext';
import { cn } from '@/lib/utils';

const tools: Array<{
  id: AnnotationTool;
  icon: typeof MousePointer2;
  label: string;
}> = [
  { id: 'view', icon: MousePointer2, label: 'View' },
  { id: 'draw', icon: Pencil, label: 'Draw' },
  { id: 'text', icon: Type, label: 'Text' },
];

export function AnnotationToolbar() {
  const { activeTool, setActiveTool, clearAll, drawings, textLabels } =
    useAnnotation();

  const hasAnnotations = drawings.length > 0 || textLabels.length > 0;

  return (
    <div className="border-adam-neutral-600 absolute left-3 top-3 z-10 flex items-center gap-1 rounded-lg border bg-adam-neutral-800/80 p-1 backdrop-blur-sm">
      {tools.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          title={label}
          onClick={() => setActiveTool(id)}
          className={cn(
            'rounded-md p-1.5 transition-colors',
            activeTool === id
              ? 'bg-adam-blue text-white'
              : 'hover:bg-adam-neutral-600 text-adam-text-primary/60 hover:text-adam-text-primary',
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
      {hasAnnotations && (
        <button
          title="Clear all"
          onClick={clearAll}
          className="rounded-md p-1.5 text-adam-text-primary/60 transition-colors hover:bg-red-500/20 hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
