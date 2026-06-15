# Phase 1 Execution Plan — Items 2, 9, 10, 13, 14

## Overview

Five quick wins that unblock basic symbol rendering and address daily UX pain points.

---

## Item 2 — Fix Broken Symbol SVGs

### 2a. Fix extends case-sensitivity bug

**File:** scripts/extractSymbols.ts — line 141

Change:
```
extends: extendsId,
```
To:
```
extends: extendsId ? extendsId.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'unnamed' : undefined,
```

### 2b. Fix polyline fill missing

**File:** scripts/types.ts — Add fill field to GraphicPolyline interface.

**File:** scripts/extractSymbols.ts — Parse fill node in parsePolyline() and include in return.

**File:** scripts/generateSvg.ts — Render fill instead of hardcoded "none" for polylines.

### 2c. Improve pinout box

**File:** scripts/generateSvg.ts line 161 — Change fill="none" to fill="rgba(255,255,255,0.04)" on the pinout body rectangle.

### After edits: npm run build-symbols && npm run build

---

## Item 9 — Dirty State Indicator

### File: src/store/schematicStore.ts

- Add isDirty: boolean to state interface and state
- Update all mutation actions to set isDirty: true
- updateComponentPosition: add snapshot + pushSnapshotHistory

### File: src/components/EditorShell.tsx

- Subscribe to isDirty from schematicStore
- Show asterisk after project name when dirty
- Add beforeunload handler to warn of unsaved changes

---

## Item 10 — Undo for Position Changes

Handled by adding captureSnapshot + pushSnapshotHistory to updateComponentPosition in Item 9.

---

## Item 13 — Fuzzy Symbol Search

### npm install fuse.js

### File: src/components/KicadSymbolBrowser.tsx

- Import Fuse from fuse.js
- Create Fuse instance with weighted keys (id:3, name:2, reference:2, description:1, keywords:1)
- Add debounced search state with 200ms timeout
- Use fuse.search() instead of current linear filter

---

## Item 14 — Zoom-to-Fit

### File: src/store/canvasStore.ts

Add zoomToFit action that computes bounding box of all strokes+components,
calculates zoom to fit with padding, and updates offset+zoom.

### File: src/components/LeftToolbar.tsx

Add zoom-to-fit button after zoom controls.

### File: src/components/EditorShell.tsx

Add Ctrl+0 shortcut handler.

---

## Verification

```
npm run build-symbols
npm run build
npm test
```
