export interface Point {
  x: number;
  y: number;
}

export interface Pin {
  name: string;
  number: string;
  pos: Point;
  length: number;
  orientation: number;
  electricalType: string;
  graphicStyle: string;
}

export interface Stroke {
  width: number;
  type: string;
  color?: string;
}

export interface Fill {
  type: string;
  color?: string;
}

export interface GraphicLine {
  type: 'line';
  start: Point;
  end: Point;
  stroke: Stroke;
}

export interface GraphicPolyline {
  type: 'polyline';
  pts: Point[];
  stroke: Stroke;
  fill: Fill;
}

export interface GraphicRectangle {
  type: 'rectangle';
  start: Point;
  end: Point;
  stroke: Stroke;
  fill: Fill;
}

export interface GraphicCircle {
  type: 'circle';
  center: Point;
  radius: number;
  stroke: Stroke;
  fill: Fill;
}

export interface GraphicArc {
  type: 'arc';
  start: Point;
  mid: Point;
  end: Point;
  stroke: Stroke;
}

export type Graphic = GraphicLine | GraphicPolyline | GraphicRectangle | GraphicCircle | GraphicArc;

export interface SymbolEntry {
  id: string;
  name: string;
  reference: string;
  description: string;
  keywords: string[];
  fpFilters: string[];
  datasheet: string;
  units: number;
  sourceFile: string;
  hasSvg: boolean;
}

export interface NormalizedSymbol extends SymbolEntry {
  pins: Pin[];
  graphics: Graphic[];
  extends?: string;
}

export interface NormalizedPin {
  name: string;
  number: string;
  x: number;
  y: number;
  orientation: number;
}

/** Pin position in 0-100 coordinate space (pre-computed from normalized SVG coords) */
export interface SvgCoordPin {
  name: string;
  number: string;
  x: number;
  y: number;
}

export interface SymbolCatalog {
  version: string;
  generated: string;
  count: number;
  symbols: SymbolEntry[];
}

