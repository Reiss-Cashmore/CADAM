# AI-Native 3D Modeler: Implementation Plan

## Project: CADAM Enhancement - Context-Aware Editing

### Goal

Transform CADAM from a standard parametric modeling chat interface into an AI-native 3D modeler where users can:

1. Click anywhere on a 3D model to get precise context
2. Describe edits with location awareness
3. Annotate models visually
4. Get AI-generated OpenSCAD code targeted to specific locations

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐             │
│  │  Main Chat   │────▶│  3D Viewer   │────▶│  Mini-Chat   │             │
│  │   Panel      │     │ + Click      │     │   Popup      │             │
│  └──────────────┘     └──────────────┘     └──────────────┘             │
│         │                     │                     │                    │
│         ▼                     ▼                     ▼                    │
│  ┌─────────────────────────────────────────────────────────────┐         │
│  │                    ANNOTATION LAYER                         │         │
│  │   (Drawing, Text Labels, Screenshot Capture)                │         │
│  └─────────────────────────────────────────────────────────────┘         │
│                               │                                          │
└───────────────────────────────┼──────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND PROCESSING                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────┐    ┌──────────────────────────────────────┐    │
│  │  Click Context      │    │  Parametric-Chat Edge Function       │    │
│  │  - Position         │    │  + New: edit_at_location tool       │    │
│  │  - Normal           │    │  + Enhanced system prompt            │    │
│  │  - Distance         │    │  + Annotation parsing               │    │
│  └─────────────────────┘    └──────────────────────────────────────┘    │
│                                        │                                 │
│                                        ▼                                 │
│                         ┌──────────────────────────────────────┐         │
│                         │  OpenSCAD WASM Compiler             │         │
│                         │  (Existing - no changes needed)      │         │
│                         └──────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Click Detection & Context (Foundation)

**Files:** `plans/01-click-detection.md`

- Create `ClickContext` for global click state
- Modify `ThreeScene.tsx` to capture click events
- Extract: position, normal, object info, screen coords

### Phase 2: Mini-Chat Popup

**Files:** `plans/02-mini-chat-popup.md`

- Create `MiniChat` component with click context display
- Integrate into `ParametricView`
- Handle submission with location data

### Phase 3: Annotation System

**Files:** `plans/03-annotation-system.md`

- Create `AnnotationContext` for drawings/text labels
- Build toolbar UI (pencil, text, screenshot, clear)
- Canvas overlay for freehand drawing
- 3D-positioned text labels using Drei's Html

### Phase 4: LLM Context-Aware Integration

**Files:** `plans/04-llm-context-aware-edits.md`

- Add `edit_at_location` tool to parametric-chat
- Enhance system prompt with location awareness
- Frontend changes to pass click context + annotations

---

## File Manifest

### New Files to Create

| Path                                          | Description                 |
| --------------------------------------------- | --------------------------- |
| `src/contexts/ClickContext.tsx`               | Click state management      |
| `src/contexts/AnnotationContext.tsx`          | Annotation state management |
| `src/components/chat/MiniChat.tsx`            | Floating chat popup         |
| `src/components/viewer/AnnotationToolbar.tsx` | Toolbar UI                  |
| `src/components/viewer/DrawingCanvas.tsx`     | Drawing overlay             |
| `src/components/viewer/TextLabelOverlay.tsx`  | 3D text labels              |

### Files to Modify

| Path                                          | Changes                    |
| --------------------------------------------- | -------------------------- |
| `src/components/viewer/ThreeScene.tsx`        | Add onClick handler        |
| `src/views/ParametricView.tsx`                | Integrate mini-chat, state |
| `supabase/functions/parametric-chat/index.ts` | Add location-aware tool    |

---

## Context Data Structure

```typescript
interface ClickContext {
  position: [number, number, number]; // World coordinates
  normal: [number, number, number]; // Surface normal
  distanceFromOrigin: number;
  screenPosition: { x: number; y: number };
}

interface AnnotationContext {
  drawings: DrawingPath[]; // Freehand paths
  textLabels: TextLabel[]; // 3D-positioned text
  screenshot?: string; // Base64 PNG
}

interface LLMContext {
  clickContext: ClickContext;
  annotationContext?: AnnotationContext;
  currentCode: string;
  userRequest: string;
}
```

---

## Dependencies

### Already Available (CADAM)

- `three` - 3D math and geometry
- `@react-three/fiber` - React Three.js renderer
- `@react-three/drei` - Helper components (Html, etc.)
- `lucide-react` - Icons
- Radix UI components

### No New Dependencies Required

---

## Testing Strategy

### Unit Tests

- Click context capture accuracy
- Annotation state management
- Coordinate transformations

### Integration Tests

- Click → Mini-chat → Submit flow
- Annotation → Screenshot → LLM context
- Full flow: Click → Edit → Regenerate → Render

### Manual Testing

- Click at various model locations
- Verify normal direction accuracy
- Test all annotation tools
- Verify generated code compiles

---

## Success Criteria

1. ✅ User can click on model and see position/normal data
2. ✅ Mini-chat appears at click location with context
3. ✅ Edit requests with context generate relevant code
4. ✅ Annotations can be drawn and captured
5. ✅ Screenshot can be sent to LLM
6. ✅ System works with existing OpenSCAD compilation
7. ✅ No performance degradation on existing features

---

## Implementation Order

```
Phase 1 (Foundation)
    │
    ├── Create ClickContext.tsx
    ├── Modify ThreeScene.tsx
    └── Test click detection

Phase 2 (UI)
    │
    ├── Create MiniChat.tsx
    ├── Integrate into ParametricView
    └── Test popup flow

Phase 3 (Enhancement)
    │
    ├── Create AnnotationContext.tsx
    ├── Create AnnotationToolbar.tsx
    ├── Create DrawingCanvas.tsx
    └── Test annotations

Phase 4 (AI Integration)
    │
    ├── Modify parametric-chat function
    ├── Add edit_at_location tool
    ├── Update frontend message handling
    └── End-to-end testing
```

---

## Key Design Decisions

### 1. Why React Context for State?

- Simple enough for this use case
- Already follows CADAM's patterns
- No Redux complexity needed

### 2. Why Drei Html for Labels?

- Automatically handles 3D→screen projection
- Supports occlusion
- Built into existing dependency

### 3. Why Screenshot vs Coordinates?

- Screenshot is simpler to implement
- LLM can "see" annotations visually
- Coordinates can be added later if needed

### 4. Why New Tool vs Modified Prompt?

- Cleaner separation of concerns
- Better structured data for the LLM
- Easier to debug and iterate

---

## Open Questions & Tradeoffs

1. **Click precision**: Raycasting gives point accuracy, but complex models may need hierarchical object detection
2. **Annotation persistence**: Should annotations save with the model? (Scope: current session only)
3. **Mobile support**: Mini-chat and drawing may need touch-specific handling
4. **Undo/redo**: For annotation changes (future enhancement)

---

## Related Documentation

- [React Three Fiber Events](https://docs.pmndrs/react-three-fiber/events)
- [Drei Html Component](https://github.com/pmndrs/drei#html)
- [CADAM Parametric Chat](file://../../supabase/functions/parametric-chat/index.ts)
- [Three.js Raycaster](https://threejs.org/docs/#api/en/core/Raycaster)
