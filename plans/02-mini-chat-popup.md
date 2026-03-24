# Sub-Plan 2: Mini-Chat Popup Component

## Overview

Create a floating mini-chat interface that appears when users click on the 3D model. This allows contextual edits with precise location information.

## UI Specification

```
┌─────────────────────────────────────────┐
│ 📍 Position: X=12.5, Y=3.2, Z=-8.1     │
│ ↗ Normal: [0.12, 0.94, 0.31]           │
│ 📏 Distance: 13.4 units                │
├─────────────────────────────────────────┤
│ Describe the change...                  │
│ ┌─────────────────────────────────────┐ │
│ │ [                              ]  ↑ │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│        [Cancel]  [Apply Edit]          │
└─────────────────────────────────────────┘
```

## Implementation

### Step 1: Create MiniChat Component

Create `src/components/chat/MiniChat.tsx`:

```typescript
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ClickData } from '@/contexts/ClickContext';
import { Send, X, MapPin } from 'lucide-react';

interface MiniChatProps {
  clickData: ClickData;
  onSubmit: (message: string, context: ClickData) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

export function MiniChat({ clickData, onSubmit, onClose, position }: MiniChatProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit(input, clickData);
      setInput('');
    }
  };

  // Adjust position to keep popup in viewport
  const popupStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 340),
    top: Math.min(position.y, window.innerHeight - 250),
    zIndex: 1000,
  };

  return (
    <div
      className="w-80 rounded-lg border border-adam-blue/30 bg-adam-neutral-800 shadow-2xl"
      style={popupStyle}
    >
      {/* Header with click context */}
      <div className="border-b border-adam-blue/20 bg-adam-blue/10 p-3">
        <div className="flex items-center gap-2 text-xs text-adam-blue">
          <MapPin className="h-3 w-3" />
          <span className="font-medium">Click Context</span>
        </div>

        <div className="mt-2 space-y-1 font-mono text-xs text-gray-300">
          <div className="flex justify-between">
            <span className="text-gray-500">Position:</span>
            <span>[{clickData.position.x.toFixed(1)}, {clickData.position.y.toFixed(1)}, {clickData.position.z.toFixed(1)}]</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Normal:</span>
            <span>[{clickData.normal.x.toFixed(2)}, {clickData.normal.y.toFixed(2)}, {clickData.normal.z.toFixed(2)}]</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Distance:</span>
            <span>{clickData.distanceFromOrigin.toFixed(1)} units</span>
          </div>
        </div>
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="p-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe the change (e.g., 'round this edge')"
          className="w-full rounded-md border border-gray-600 bg-adam-neutral-700 px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-adam-blue focus:outline-none focus:ring-1 focus:ring-adam-blue"
        />

        <div className="mt-3 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim()}
            className="bg-adam-blue hover:bg-adam-blue/80"
          >
            <Send className="mr-1 h-3 w-3" />
            Apply Edit
          </Button>
        </div>
      </form>
    </div>
  );
}
```

### Step 2: Add MiniChat to ParametricView

Modify `src/views/ParametricView.tsx`:

```typescript
import { MiniChat } from '@/components/chat/MiniChat';
import { useClick, ClickData } from '@/contexts/ClickContext';

// Add state for mini-chat
const [showMiniChat, setShowMiniChat] = useState(false);
const [miniChatPosition, setMiniChatPosition] = useState({ x: 0, y: 0 });

// Listen for click events
const { clickData, setClickData } = useClick();

// Handle mesh click to show mini-chat
const handleMeshClick = (data: ClickData) => {
  setMiniChatPosition(data.screenPosition);
  setShowMiniChat(true);
};

// Handle mini-chat submission
const handleMiniChatSubmit = (message: string, context: ClickData) => {
  // Build enhanced prompt with click context
  const enhancedMessage = `
Context: User clicked on the model at:
- Position: (${context.position.x.toFixed(2)}, ${context.position.y.toFixed(2)}, ${context.position.z.toFixed(2)})
- Surface Normal: [${context.normal.x.toFixed(2)}, ${context.normal.y.toFixed(2)}, ${context.normal.z.toFixed(2)}]
- Distance from origin: ${context.distanceFromOrigin.toFixed(2)} units

User request: "${message}"

Please modify the OpenSCAD code to address this request.
  `.trim();

  // Send to main chat
  sendMessage({ text: enhancedMessage });
  setShowMiniChat(false);
  setClickData(null);
};

// In render:
{showMiniChat && clickData && (
  <MiniChat
    clickData={clickData}
    position={miniChatPosition}
    onSubmit={handleMiniChatSubmit}
    onClose={() => {
      setShowMiniChat(false);
      setClickData(null);
    }}
  />
)}
```

### Step 3: Keyboard Shortcuts

Add escape key to close mini-chat:

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && showMiniChat) {
      setShowMiniChat(false);
      setClickData(null);
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [showMiniChat]);
```

## Files to Create/Modify

| File                               | Changes                                     |
| ---------------------------------- | ------------------------------------------- |
| `src/components/chat/MiniChat.tsx` | NEW - Mini-chat popup component             |
| `src/views/ParametricView.tsx`     | Integrate mini-chat, add state and handlers |
| `src/contexts/ClickContext.tsx`    | Already created in Plan 1                   |

## UX Considerations

1. **Position**: Popup appears near click, but constrained to viewport
2. **Focus**: Auto-focus input when popup opens
3. **Escape**: Close with Escape key
4. **Empty input**: Submit button disabled until text entered
5. **Mobile**: Consider touch-friendly sizing

## Testing Checklist

- [ ] Mini-chat appears near click location
- [ ] Click context displayed correctly
- [ ] Submit sends message with context to chat
- [ ] Cancel closes popup and clears click data
- [ ] Escape key closes popup
- [ ] Works on different screen sizes
