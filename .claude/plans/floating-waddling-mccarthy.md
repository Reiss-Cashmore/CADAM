# Plan: Fix Ghost Preview for Both Growth and Shrink

## Context

The two-bit stencil approach (using `stencilWriteMask` to write separate stencil bits) causes the entire model to be highlighted during slider drag, and shrink regions show no highlight at all. Root cause: the ghost stencil writer's Replace op **overwrites** the solid's stencil value at overlap pixels (stencil becomes 2 instead of 3), so the growth highlight renders everywhere the ghost exists (including overlap with solid).

## Approach: Single-value stencil with ordered Replace + depth filtering

Drop `stencilWriteMask` and `stencilFuncMask`. Use plain Replace with different ref values. Rely on **render order** to determine which value "wins" at overlap pixels, then use **polygon offset + depth test** to filter out the growth highlight at overlap.

### Stencil values after rendering passes 1 + 2

| Region       | Solid writes         | Ghost writes | Final stencil |
| ------------ | -------------------- | ------------ | ------------- |
| Neither      | —                    | —            | 0             |
| Solid only   | 1                    | —            | **1**         |
| Ghost only   | —                    | 2            | **2**         |
| Both overlap | 1 → overwritten by 2 | 2            | **2**         |

### How each highlight filters correctly

- **Growth** (test Equal 2): Passes at ghost-only AND overlap. But at overlap, polygon offset pushes ghost behind solid → **depth test fails** → only ghost-only pixels render.
- **Shrink** (test Equal 1): Passes only at solid-only pixels (never overwritten). No depth ambiguity.
- **Identical geometry** (no change): Everything is overlap (stencil=2). Growth fails depth test. Shrink fails stencil test. **No highlight.**

## Changes — `src/components/viewer/ThreeScene.tsx` only

### 1. Main solid mesh (renderOrder=1)

Remove `stencilWriteMask`. Use simple Replace with ref=1.

```tsx
<mesh
  geometry={geometry}
  rotation={[-Math.PI / 2, 0, 0]}
  position={[0, 0, 0]}
  onClick={handleMeshClick}
  renderOrder={1}
>
  <meshStandardMaterial
    color={color}
    metalness={0.6}
    roughness={0.3}
    envMapIntensity={0.3}
    stencilWrite={true}
    stencilRef={1}
    stencilFunc={THREE.AlwaysStencilFunc}
    stencilZFail={THREE.ReplaceStencilOp}
    stencilZPass={THREE.ReplaceStencilOp}
  />
</mesh>
```

### 2. Ghost stencil writer (renderOrder=2, invisible)

Remove `stencilWriteMask`. Replace with ref=2, overwrites solid's 1 at overlap.

```tsx
<mesh
  geometry={previewGeometry}
  rotation={[-Math.PI / 2, 0, 0]}
  position={[0, 0, 0]}
  renderOrder={2}
>
  <meshStandardMaterial
    colorWrite={false}
    depthTest={false}
    depthWrite={false}
    stencilWrite={true}
    stencilRef={2}
    stencilFunc={THREE.AlwaysStencilFunc}
    stencilZPass={THREE.ReplaceStencilOp}
  />
</mesh>
```

### 3. Growth highlight (renderOrder=3)

Remove `stencilFuncMask`. Test Equal 2. Polygon offset pushes behind solid to filter overlap.

```tsx
<mesh
  geometry={previewGeometry}
  rotation={[-Math.PI / 2, 0, 0]}
  position={[0, 0, 0]}
  renderOrder={3}
>
  <meshStandardMaterial
    color="#00e5ff"
    emissive="#00e5ff"
    emissiveIntensity={0.6}
    transparent
    opacity={0.35}
    depthWrite={false}
    polygonOffset
    polygonOffsetFactor={4}
    polygonOffsetUnits={4}
    stencilWrite={false}
    stencilRef={2}
    stencilFunc={THREE.EqualStencilFunc}
  />
</mesh>
```

### 4. Shrink highlight (renderOrder=4)

Remove `stencilFuncMask`. Test Equal 1. Negative polygon offset pulls in front of solid.

```tsx
<mesh
  geometry={geometry}
  rotation={[-Math.PI / 2, 0, 0]}
  position={[0, 0, 0]}
  renderOrder={4}
>
  <meshStandardMaterial
    color="#00e5ff"
    emissive="#00e5ff"
    emissiveIntensity={0.6}
    transparent
    opacity={0.35}
    depthWrite={false}
    polygonOffset
    polygonOffsetFactor={-2}
    polygonOffsetUnits={-2}
    stencilWrite={false}
    stencilRef={1}
    stencilFunc={THREE.EqualStencilFunc}
  />
</mesh>
```

## Verification

1. Drag slider to **increase** a parameter → only extending edges glow cyan, unchanged parts look normal
2. Drag slider to **decrease** a parameter → edges being removed glow cyan
3. **Click** slider without dragging → no highlight appears
4. Rotate model while dragging → highlights update correctly from all angles
5. Release slider → ghost disappears, model updates normally
6. No z-fighting artifacts at any angle
