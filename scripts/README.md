# KiCad Symbol Ingestion Pipeline

This pipeline reads KiCad `.kicad_sym` files, extracts symbol data, and converts it into a lightweight catalog and SVG previews for use in the Volt frontend.

## Architecture

```
kicad-symbols/                          ← cloned KiCad symbol library (22,756 .kicad_sym files)
  scripts/
    parseKicadSym.ts                    ← S-expression tokenizer + parser
    extractSymbols.ts                   ← Converts parsed sexprs → NormalizedSymbol
    generateSvg.ts                      ← NormalizedSymbol → SVG string
    buildSymbols.ts                     ← Main entry point: scans, parses, deduplicates, generates output
    types.ts                            ← Shared TypeScript types
  src/assets/symbols/
    catalog.json                        ← Lightweight search index (8.7 MB, 22,652 entries)
    previews/*.svg                      ← Individual SVG preview files (22,652 files)
  src/components/KicadSymbol.tsx         ← React renderer component
```

## Usage

### Build the catalog

```bash
npm run build-symbols
```

This runs `tsx scripts/buildSymbols.ts`, which:

1. Recursively scans `kicad-symbols/` for all `.kicad_sym` files
2. Parses each file with the S-expression parser
3. Extracts symbol name, reference, pins, graphic primitives
4. Deduplicates symbols (prefers Device library versions)
5. Generates SVG previews for each symbol
6. Writes a lightweight `catalog.json` (search index without full geometry)

### Render a symbol in React

```tsx
import KicadSymbol from '@/components/KicadSymbol';

<KicadSymbol symbolId="r" width={100} height={100} />
<KicadSymbol symbolId="ne5532" width={200} height={200} />
```

The component looks up the symbol ID in the catalog and renders the SVG preview inline.

## Pipeline Stages

### 1. S-expression Parser (`parseKicadSym.ts`)

A lightweight tokenizer + recursive descent parser for KiCad's S-expression format.

**Tokens:**
- `(` / `)` — list delimiters
- `"..."` — quoted strings (handled as single tokens)
- Unquoted atoms — identifiers, numbers, booleans

**Output:** Tree of `SExpr` nodes:
- `{ type: 'list', children: SExpr[] }`
- `{ type: 'atom', value: string }`
- `{ type: 'number', value: number }`
- `{ type: 'string', value: string }`

### 2. Symbol Extractor (`extractSymbols.ts`)

Traverses the parsed tree and extracts:

| Field | Source |
|-------|--------|
| `id` | KiCad symbol name (slugified) |
| `name` | `Value` property |
| `reference` | `Reference` property (e.g., "R", "U", "Q") |
| `description` | `Description` property |
| `keywords` | `ki_keywords` property (split on whitespace) |
| `pins` | Pin definitions from sub-symbols |
| `graphics` | Rectangle, polyline, circle, arc primitives |
| `units` | Number of sub-symbol units |
| `sourceFile` | Relative path to source `.kicad_sym` |

**Supported primitives:** `rectangle`, `polyline` (→ `line` for 2-point), `circle`, `arc`

**Skipped (logged as warnings if encountered):** `bezier`

### 3. SVG Generator (`generateSvg.ts`)

Converts a `NormalizedSymbol` to an SVG string:

- Computes bounding box from all graphics and pins
- Centers and scales the symbol to fit the viewport (with padding)
- Dark background (`#0f0f13`)
- Draws graphics as white primitives
- Draws pins as yellow (`#ffd60a`) lines with pin number labels

## Output Format

### `catalog.json`

```json
{
  "version": "1.0.0",
  "generated": "2026-06-12T...",
  "count": 22652,
  "symbols": [
    {
      "id": "r",
      "name": "R",
      "reference": "R",
      "description": "Resistor",
      "keywords": ["R", "res", "resistor"],
      "fpFilters": ["R_*"],
      "datasheet": "",
      "units": 1,
      "sourceFile": "Device.kicad_symdir\\R.kicad_sym",
      "hasSvg": true
    }
  ]
}
```

The catalog is intentionally **lightweight** — it contains only search metadata, not full pin/graphic geometry. This keeps the file at ~8.7 MB instead of ~200 MB, making it feasible for Vite to bundle.

Full symbol geometry (pins + graphics) can be re-extracted on demand by re-parsing the source file referenced in `sourceFile`. This keeps the frontend lean while preserving access to complete data when needed.

### SVG Previews

Located at `src/assets/symbols/previews/{id}.svg`. Each SVG is a 400×400 dark-themed rendering of the symbol with yellow pins.

## Key Symbols (Device Library)

| ID | Name | Reference |
|---|---|---|
| `r` | Resistor | R |
| `c` | Unpolarized capacitor | C |
| `led` | Light emitting diode | D |
| `d` | Diode | D |
| `battery` | Multiple-cell battery | BT |
| `l` | Inductor | L |
| `q_npn` | NPN transistor | Q |
| `q_pnp` | PNP transistor | Q |
| `speaker` | Speaker | LS |
| `microphone` | Microphone | MK |
| `fuse` | Fuse | F |
| `thermistor` | Thermistor | TH |
| `solar_cell` | Solar cell | SC |
| `crystal` | Crystal | Y |
| `antenna` | Antenna | AE |
| `r_potentiometer` | Potentiometer | RV |
| `ne5532` | NE5532 op-amp | U |
| `lm358` | LM358 op-amp | U |

## KiCad File Format Assumptions

### S-expression structure

- Files use the `kicad_symbol_lib` wrapper format (v20251024+)
- Each file contains one or more `(symbol "Name" ...)` definitions
- Symbols have optional `(property "Key" "Value" ...)` metadata
- Graphic primitives and pins are nested inside `(symbol "Name_N_M" ...)` sub-symbols

### Pin format

```
(pin <electrical_type> <graphic_style>
  (at x y orientation)
  (length l)
  (name "..." (effects ...))
  (number "..." (effects ...))
)
```

- Electrical types: `passive`, `input`, `output`, `bidirectional`, `power_in`, `power_out`, `open_collector`, etc.
- Graphic styles: `line` (default)
- Orientation: 0=right, 90=up, 180=left, 270=down

### Coordinate system

All coordinates in the KiCad library are in **millimeters** with the origin at the symbol center. The SVG generator preserves this coordinate system and applies a uniform scale transform when rendering.

## Limitations & Future Work

1. **Bezier curves** — Not currently parsed. Most KiCad symbols use polylines and rectangles, so this is rarely needed.

2. **Multi-unit symbols** — Only the first unit's geometry is extracted. Complex multi-unit parts (like quad op-amps with separate power pins) may show incomplete graphics.

3. **Power symbols** — Explicitly skipped (symbols with name "power"). These are typically used for net labels rather than placed components.

4. **Text fields** — `(property ...)` text is extracted as metadata but not rendered on SVG previews. Pin names are rendered as labels.

5. **Alias symbols** — KiCad's `(symbol "Foo" (extends "Bar") ...)` inheritance is not handled. Symbols using `extends` will only have their own overrides, missing inherited properties.

6. **Full geometry on demand** — The catalog stores only search metadata. To access full pin/graphic data at runtime, implement a lazy loader that re-parses `sourceFile` when needed.

7. **Symbol search** — The catalog includes `keywords` and `description` fields. Integrate with a fuzzy search library (e.g., Fuse.js) for a searchable component browser.
