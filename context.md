# Volt — Master Project Context

## Overview

Volt is a next-generation circuit design and simulation platform.

Instead of dragging and dropping electronic components from a toolbar, users sketch circuits naturally using a mouse, trackpad, or stylus. Volt recognizes the hand-drawn symbols, converts them into clean schematic components, automatically detects electrical connections, and allows the resulting circuit to be simulated.

The goal is to make circuit design feel as natural as drawing on paper while retaining the precision and power of professional engineering software.

---

# Vision

Volt should feel like:

* Figma for electronics
* Excalidraw for circuit design
* Linear-level polish
* Vercel-level design quality

Volt should feel modern, premium, and fast.

The product should not resemble traditional engineering software.

Avoid visual inspiration from:

* LTspice
* Proteus
* Multisim
* Legacy CAD applications

Instead, draw inspiration from:

* Vercel
* Linear
* Raycast
* ReactBits
* Modern developer tools

---

# Core User Experience

Current workflow in most circuit software:

1. Open component library
2. Search component
3. Drag component
4. Position component
5. Connect wires
6. Repeat

Volt workflow:

1. Draw a resistor
2. Volt recognizes it
3. Volt replaces it with a clean resistor symbol
4. Draw wires
5. Volt detects connections
6. Simulate instantly

The experience should feel intelligent, effortless, and fast.

---

# Product Identity

Name:

Volt

Primary tagline:

Draw. Detect. Simulate.

Alternative taglines:

* Circuit design at the speed of sketching.
* From sketch to simulation.
* The fastest way to design circuits.
* Where ideas become circuits.

Personality:

* Precise
* Professional
* Intelligent
* Fast
* Engineering-focused

Avoid:

* Playful
* Cartoonish
* Educational toy aesthetics
* Excessive visual flair

---

# Design System

## Themes

### Dark Theme

Requirements:

* Pure AMOLED black backgrounds
* High contrast
* Deep blacks
* Clean surfaces
* Thin borders

Primary background:

#000000

### Light Theme

Requirements:

* Warm white backgrounds
* Soft neutral surfaces
* Comfortable contrast
* Minimal visual noise

---

## Accent Color

Single accent color:

Yellow

Use yellow only for:

* Active states
* Focus states
* Selections
* Highlights
* Important actions

Avoid introducing unnecessary colors.

The interface should remain mostly monochrome.

---

## Visual Style

Requirements:

* Rounded corners
* Thin borders
* Clean spacing
* Strong typography
* Minimal visual clutter
* Consistent hierarchy
* Subtle shadows

Animations:

* Fast
* Purposeful
* Subtle

Avoid:

* Flashy effects
* Glassmorphism
* Neumorphism
* Excessive motion
* Distracting transitions

Every interaction should feel engineered.

---

# Technical Stack

Frontend:

* React
* TypeScript
* Vite
* TailwindCSS

State Management:

* Zustand

Canvas Layer:

* SVG or Canvas rendering

Architecture:

* Modular
* Scalable
* Maintainable
* Production-ready

---

# Development Philosophy

Volt must be built incrementally.

Each development phase should:

* Solve a specific problem
* Maintain code quality
* Preserve scalability
* Avoid technical debt
* Keep architecture clean

Refactor when necessary.

Do not prioritize speed over maintainability.

This is intended to become a real product, not a prototype.

---

# Core Architecture

Volt consists of five major systems.

## 1. Canvas Engine

Responsibilities:

* Infinite canvas
* Pan
* Zoom
* Coordinate system
* Grid rendering
* High-performance rendering

---

## 2. Drawing Engine

Responsibilities:

* Pen tool
* Eraser tool
* Undo
* Redo
* Stroke storage
* Stroke metadata

All sketches should be stored as vector data.

Example:

Stroke:
[(x1,y1),(x2,y2),(x3,y3)]

Not raster images.

---

## 3. Recognition Engine

The recognition approach has changed from automatic per-stroke detection to AI-powered batch conversion.

### Previous approach (deprecated)

Rule-based recognition that analyzed each stroke immediately on mouseup and attempted to classify it as a component. This has been removed from the active code path.

### Current approach

The user draws their entire circuit freehand in Sketch mode. All strokes are preserved exactly as drawn. When the user clicks Convert to Circuit, the strokes are preprocessed (simplified via Ramer-Douglas-Peucker, normalized to 0-100 coordinate space, geometric features computed) and sent as structured text to an AI model via the Supabase Edge Function. The AI returns a JSON description of the circuit which is then rendered onto the canvas using the existing schematic system.

### Vision model support

The system also supports sending a rasterized image of the strokes to a vision-capable AI model (MiniCPM-V via Ollama). The frontend can switch between text-based (stroke coordinates) and vision-based (image) recognition depending on configuration.

### Sketch mode rules

* Strokes are never auto-classified
* Strokes persist until Convert is clicked or canvas is cleared
* The recognition engine is not called on mouseup in sketch mode
* Only the Convert button triggers AI processing

---

## 4. Circuit Graph Engine

Responsibilities:

Convert drawings into:

* Components
* Nodes
* Connections

The graph becomes the source of truth.

Simulation must operate on the graph rather than the drawing layer.

---

## 5. Simulation Engine

Initial version:

DC simulation only.

Support:

* Voltage sources
* Resistors
* LEDs

Calculate:

* Voltage
* Current
* Power

Future versions may support:

* SPICE compatibility
* Logic simulation
* Signal analysis
* Oscilloscope views

---

# Recognition Workflow

Example:

User draws resistor.

Recognition engine:

1. Detects symbol
2. Creates resistor component
3. Preserves position
4. Preserves scale
5. Preserves rotation

Volt then replaces the sketch with a clean SVG symbol.

The transition should feel smooth and intelligent.

---

# Future Features

Potential future capabilities:

* AI symbol recognition
* SPICE simulation
* Logic gates
* Truth tables
* Karnaugh maps
* PCB generation
* Verilog export
* Relay logic visualization
* Collaboration
* Cloud sync
* Native desktop app

Current development should keep these future features in mind.

---

# Code Quality Standards

Always prioritize:

* Type safety
* Clean architecture
* Reusable components
* Consistent naming
* Scalable folder structure
* Performance
* Accessibility

Avoid:

* Monolithic files
* Duplicate code
* Hardcoded values
* Quick fixes
* Architectural shortcuts

---

# Response Requirements

Whenever I request a development phase:

1. Explain architectural decisions.
2. Generate production-ready code.
3. Show all files that must be created or modified.
4. Preserve consistency with previous phases.
5. Follow the Volt design system exactly.
6. Keep the codebase scalable.
7. Avoid unnecessary complexity.
8. Never sacrifice maintainability for speed.

Assume Volt is intended to become a real software product.
