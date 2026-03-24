import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Send, X, MapPin } from 'lucide-react';
import { ClickData } from '@/contexts/ClickContext';
import { cn } from '@/lib/utils';

interface MiniChatProps {
  clickData: ClickData;
  onSubmit: (message: string, clickData: ClickData) => void;
  onClose: () => void;
}

function formatVector(v: { x: number; y: number; z: number }): string {
  return `[${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)}]`;
}

export function MiniChat({ clickData, onSubmit, onClose }: MiniChatProps) {
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Clamp position to keep popup within viewport
  const popupWidth = 320;
  const popupHeight = 180;
  const padding = 12;
  const x = Math.min(
    Math.max(clickData.screenPosition.x, padding),
    window.innerWidth - popupWidth - padding,
  );
  const y = Math.min(
    Math.max(clickData.screenPosition.y + 16, padding),
    window.innerHeight - popupHeight - padding,
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  const handleSubmit = () => {
    if (!message.trim()) return;
    onSubmit(message.trim(), clickData);
  };

  return (
    <div
      className={cn(
        'border-adam-neutral-600 fixed z-50 flex w-80 flex-col gap-2 rounded-lg border',
        'bg-adam-bg-secondary-dark p-3 shadow-xl backdrop-blur-sm',
      )}
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Context header */}
      <div className="flex items-center gap-2 text-xs text-adam-text-primary/60">
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate">
          Position {formatVector(clickData.position)} · Normal{' '}
          {formatVector(clickData.normal)} · Dist{' '}
          {clickData.distanceFromOrigin.toFixed(1)}
        </span>
        <button
          onClick={onClose}
          className="hover:bg-adam-neutral-600 ml-auto shrink-0 rounded p-0.5"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="flex gap-2"
      >
        <input
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. add a hole here..."
          className={cn(
            'border-adam-neutral-600 flex-1 rounded-md border bg-adam-neutral-700 px-3 py-1.5',
            'text-sm text-adam-text-primary placeholder:text-adam-text-primary/40',
            'focus:border-adam-blue focus:outline-none',
          )}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!message.trim()}
          className="bg-adam-blue px-2 hover:bg-adam-blue/80"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
