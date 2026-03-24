# CADAM AI-Native 3D Modeler — Architecture & Implementation

## Overview

CADAM has been enhanced from a standard parametric modeling chat interface into an AI-native 3D modeler. Users can click anywhere on a 3D model to get precise spatial context, describe edits with location awareness, annotate models visually, and get AI-generated OpenSCAD code targeted to specific locations.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER INTERACTION                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Main Chat   │───▶│  3D Viewer   │───▶│  Mini-Chat   │       │
│  │   Panel      │    │ + Click      │    │   Popup      │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                    │                │
│         ▼                   ▼                    ▼                │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                 ANNOTATION LAYER                      │       │
│  │   (Drawing Canvas, Text Labels, Click Marker)         │       │
│  └──────────────────────────────────────────────────────┘       │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      BACKEND PROCESSING                          │
├──────────────────────────────────────────────────────────────────┤
│  ┌───────────────────┐    ┌─────────────────────────────┐       │
│  │  Click Context     │    │  parametric-chat Edge Fn    │       │
│  │  - Position        │    │  + edit_at_location tool    │       │
│  │  - Normal          │    │  + Location-aware prompt    │       │
│  │  - Distance        │    │  + Annotation parsing       │       │
│  └───────────────────┘    └─────────────────────────────┘       │
│                                      │                           │
│                                      ▼                           │
│                          ┌─────────────────────┐                │
│                          │  OpenSCAD WASM       │                │
│                          │  (unchanged)         │                │
│                          └─────────────────────┘                │
└──────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Click Detection & Context (Complete)

**Files created:**

- `src/contexts/ClickContext.tsx` — Click state provider + `useClick()` hook

**Files modified:**

- `src/components/viewer/ThreeScene.tsx` — `onClick` handler on mesh, raycasting to extract `ClickData`
- Prop chain: `ThreeScene` → `OpenSCADViewer` → `ParametricPreviewSection` → `ParametricView`

**Click data captured:**

| Field                | Type              | Description                                                   |
| -------------------- | ----------------- | ------------------------------------------------------------- |
| `position`           | `Vector3`         | World-space click point                                       |
| `normal`             | `Vector3`         | Surface normal (transformed to world space via `matrixWorld`) |
| `objectName`         | `string`          | Mesh name                                                     |
| `faceIndex`          | `number`          | Triangle index                                                |
| `uv`                 | `Vector2 \| null` | Texture coordinates                                           |
| `distanceFromOrigin` | `number`          | `point.length()`                                              |
| `screenPosition`     | `{x, y}`          | From `e.nativeEvent.clientX/Y`                                |
| `timestamp`          | `number`          | `Date.now()`                                                  |

**Key detail:** The mesh has `rotation={[-Math.PI / 2, 0, 0]}` (OpenSCAD Z-up → Three.js Y-up). The normal is transformed through `e.object.matrixWorld` to get correct world-space normals.

---

### Phase 2: Mini-Chat Popup (Complete)

**Files created:**

- `src/components/chat/MiniChat.tsx` — Floating chat at click location

**Integration in `ParametricView.tsx`:**

- State: `clickData: ClickData | null`
- Shows `<MiniChat>` when `clickData` is set
- On submit: prepends click context to user message, sends to existing chat pipeline
- On close/escape: clears `clickData`

**Enhanced message format:**

```
Context: User clicked at position [x, y, z] with surface normal [nx, ny, nz],
distance from origin: d.

User request: <message>
```

---

### Phase 3: Annotation System (Complete)

**Files created:**

- `src/contexts/AnnotationContext.tsx` — State: `activeTool`, `drawings[]`, `textLabels[]`
- `src/components/viewer/AnnotationToolbar.tsx` — Tool buttons (View, Draw, Text, Clear)
- `src/components/viewer/DrawingCanvas.tsx` — HTML Canvas overlay for freehand drawing
- `src/components/viewer/TextLabelOverlay.tsx` — Drei `<Html>` for 3D-positioned labels
- `src/components/viewer/ClickMarker.tsx` — Torus + sphere at click point

**Drawing:** Red (#e94560), 3px stroke, screen-space canvas overlay with `pointerEvents` toggle.

**Text labels:** 3D-positioned via Drei `<Html>` with `distanceFactor={200}`, delete-on-hover.

**Click marker:** Cyan (#00e5ff) torus + sphere, emissive material, `depthTest={false}`, pulse animation via `useFrame`, oriented to surface normal via `THREE.Quaternion.setFromUnitVectors`.

---

### Phase 4: LLM Context-Aware Editing (Complete)

**Files modified:**

- `supabase/functions/parametric-chat/index.ts`

**New tool: `edit_at_location`**

```typescript
{
  name: 'edit_at_location',
  parameters: {
    text: string,           // User edit request
    click_context: {
      position: number[],   // [x, y, z] world-space
      normal: number[],     // [nx, ny, nz] surface normal
      distance_from_origin?: number
    },
    baseCode?: string       // Current OpenSCAD code
  }
}
```

**Agent prompt guidance:** When user message contains click context, the agent is instructed to use `edit_at_location` instead of `build_parametric_model`.

**Tool handler:** Resolves base code from tool input or artifact history, builds location-aware prompt injecting click coordinates, calls LLM with `STRICT_CODE_PROMPT`, returns modified OpenSCAD code.

**Strict code prompt addition:** Location-Aware Editing section explaining how to use position/normal/distance to place geometry with `translate()` and orient features along the normal direction.

---

## Parameter Live Preview (In Progress)

**Goal:** When dragging a parameter slider, show a ghost (transparent cyan) model of the nudged value overlaying the current solid model. On release, the ghost becomes the main model.

**Current implementation state:**

- `ParameterInput.tsx` — `onLiveChange` and `onDragEnd` callbacks wired to slider events
- `ParameterSection.tsx` — Forwards callbacks to each `ParameterInput`
- `ParametricView.tsx` — `handleParameterLiveChange` computes nudged code (debounced 300ms), `handleParameterDragEnd` clears preview

**Remaining work:**

- `OpenSCADViewer.tsx` — Needs second `useOpenSCAD` worker for preview compilation
- `ThreeScene.tsx` — Needs ghost mesh rendering (transparent cyan, `depthWrite={false}`)

**Previous approaches tried and abandoned:**

1. **Per-index vertex diff** — STL vertex ordering is not consistent between compilations. Comparing `vertex[i]` to `vertex[i]` compared different model regions → entire model highlighted.

2. **Bounding-box axis matching** — Tried matching parameter value to geometry extent. Failed because: many parameters don't correspond to any axis (`wall_thickness`, `fillet_radius`), and centering makes highlighting always appear at the model center.

3. **Nearest-neighbor spatial hash** — Correct approach but deemed too complex. Would build a spatial grid from preview vertices and find closest matches for each current vertex.

**Chosen approach:** Ghost overlay — compile nudged code in separate worker, render result as transparent mesh. Simple, avoids all vertex comparison. The ghost itself shows what changes.

---

## Data Flow Diagrams

### Click → Edit Flow

```
ThreeScene.onClick
  → handleMeshClick(ClickData)
  → ParametricView.setClickData(data)
  → MiniChat renders at screenPosition
  → User types "add a hole here"
  → handleMiniChatSubmit: prepend click context to message
  → sendMessage({ text: enhancedMessage })
  → Edge function receives message
  → Agent selects edit_at_location tool
  → Code gen LLM receives position/normal/code
  → Modified OpenSCAD code returned
  → Model recompiles and renders
```

### Parameter Preview Flow (Target)

```
Slider drag starts
  → ParameterSlider.onValueChange
  → ParameterInput.onLiveChange(param, value)
  → ParametricView.handleParameterLiveChange
  → Debounce 300ms → setPreviewCode(nudgedCode)
  → OpenSCADPreview: second useOpenSCAD compiles preview
  → previewGeometry → ThreeScene renders ghost mesh

Slider released
  → ParameterSlider.onValueCommit
  → ParameterInput.onDragEnd()
  → ParametricView.handleParameterDragEnd → clear preview
  → Normal compilation pipeline: main model updates
```

---

## Key Design Decisions

| Decision                        | Rationale                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| React Context for state         | Simple enough for this use case, follows CADAM patterns, no Redux needed           |
| Drei `<Html>` for labels        | Auto 3D→screen projection, occlusion support, already a dependency                 |
| Screen-space drawing canvas     | Simpler than 3D drawing, adequate for annotation use case                          |
| New `edit_at_location` tool     | Cleaner than modifying existing tools, structured data for LLM, easier to debug    |
| `adjustCamera={false}` on Stage | Prevents camera reset on re-render when `clickData` prop changes                   |
| Ghost overlay for param preview | Avoids all vertex comparison complexity, the transparent mesh IS the visualization |
| Separate preview worker         | Preview compilation doesn't block main pipeline, lazy creation                     |

---

## File Manifest

### New Files

| Path                                          | Phase | Purpose                     |
| --------------------------------------------- | ----- | --------------------------- |
| `src/contexts/ClickContext.tsx`               | 1     | Click state management      |
| `src/contexts/AnnotationContext.tsx`          | 3     | Annotation state management |
| `src/components/chat/MiniChat.tsx`            | 2     | Floating chat popup         |
| `src/components/viewer/ClickMarker.tsx`       | 3     | 3D click indicator          |
| `src/components/viewer/AnnotationToolbar.tsx` | 3     | Annotation tool selector    |
| `src/components/viewer/DrawingCanvas.tsx`     | 3     | Freehand drawing overlay    |
| `src/components/viewer/TextLabelOverlay.tsx`  | 3     | 3D text labels              |

### Modified Files

| Path                                                 | Changes                                                                     |
| ---------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/components/viewer/ThreeScene.tsx`               | onClick handler, annotation overlays, ClickMarker, Stage adjustCamera=false |
| `src/components/viewer/OpenSCADViewer.tsx`           | Click/preview props forwarding                                              |
| `src/components/viewer/ParametricPreviewSection.tsx` | Click/preview props forwarding                                              |
| `src/views/ParametricView.tsx`                       | Click state, MiniChat, parameter preview handlers                           |
| `src/components/parameter/ParameterInput.tsx`        | onLiveChange + onDragEnd callbacks                                          |
| `src/components/parameter/ParameterSection.tsx`      | Forward live change callbacks                                               |
| `supabase/functions/parametric-chat/index.ts`        | edit_at_location tool + handler + prompt                                    |

---

## Dependencies

All features use existing dependencies — no new packages:

- `three` — 3D math, geometry, materials
- `@react-three/fiber` — React Three.js renderer, events
- `@react-three/drei` — Html, Line, OrbitControls, Stage, GizmoHelper
- `lucide-react` — Icons (Send, X, MapPin, Pencil, Type, Camera, Trash2)
- Radix UI — Button, tooltips, etc.

---

## Known Issues & Limitations

1. **Single mesh assumption** — Click detection assumes one main mesh in scene
2. **2D-only drawing** — Freehand annotations are screen-space, not projected onto model surface
3. **No annotation persistence** — Annotations are session-only, not saved with model
4. **No undo/redo** — Clear is all-or-nothing for annotations
5. **Screenshot capture** — Button exists but screenshot-to-LLM pipeline not fully integrated
6. **Parameter preview** — Ghost overlay approach designed but second worker not yet wired up
