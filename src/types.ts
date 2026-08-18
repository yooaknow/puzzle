export const SHARE_PUZZLE_KEY = 'puzzlw:sharedPuzzleUri';
export const SHARE_PUZZLE_PREFIX = 'puzzlw:sharedPuzzleUri:';
export const SHARE_PUZZLE_SOURCE_KEY = 'puzzlw:sharedPuzzleSourceUri';
export const SHARE_PUZZLE_SOURCE_PREFIX = 'puzzlw:sharedPuzzleSourceUri:';
export const SHARE_PUZZLE_GRID_SIZE_KEY = 'puzzlw:sharedPuzzleGridSize';
export const SHARE_PUZZLE_GRID_SIZE_PREFIX = 'puzzlw:sharedPuzzleGridSize:';

export const DESIGN_WIDTH = 390;
export const DESIGN_HEIGHT = 844;
export const TILE_WIDTH = 111;
export const TILE_HEIGHT = 147;
export const GRID_LEFT = 21;
export const GRID_TOP = 126;
export const GRID_GAP_X = 22;
export const GRID_GAP_Y = 14;

export type ScreenName = 'splash' | 'received' | 'login' | 'signup' | 'card' | 'photos' | 'puzzle' | 'complete' | 'solve' | 'solveComplete';
export type GridSize = 3 | 4 | 5;
export type Point = { x: number; y: number };
export type DrawStroke = { points: Point[]; color: string; width: number };
export type TextSticker = { id: number; text: string; color: string; x: number; y: number };

export type WebFile = {
  type?: string;
};

export type WebInput = {
  type: string;
  accept: string;
  multiple: boolean;
  files?: ArrayLike<WebFile>;
  onchange: null | (() => void);
  click: () => void;
};

export type WebDocument = {
  createElement: (tagName: 'input') => WebInput;
};

export type WebUrl = {
  createObjectURL: (file: WebFile) => string;
  revokeObjectURL: (url: string) => void;
};

export type WebNavigator = {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  clipboard?: {
    writeText: (text: string) => Promise<void>;
  };
};

export type WebStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type WebCanvasContext = {
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  bezierCurveTo: (cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) => void;
  closePath: () => void;
  save: () => void;
  restore: () => void;
  clip: () => void;
  drawImage: (
    ...args:
      | [image: WebImageElement, dx: number, dy: number, dw: number, dh: number]
      | [image: WebImageElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number]
  ) => void;
  stroke: () => void;
  fill: () => void;
  arc: (x: number, y: number, radius: number, startAngle: number, endAngle: number) => void;
  clearRect: (x: number, y: number, width: number, height: number) => void;
  fillRect: (x: number, y: number, width: number, height: number) => void;
  fillText: (text: string, x: number, y: number) => void;
  lineWidth: number;
  strokeStyle: string;
  fillStyle: string;
  lineJoin: string;
  lineCap: string;
  font: string;
  textAlign: string;
  textBaseline: string;
};

export type WebCanvas = {
  width: number;
  height: number;
  getContext: (contextId: '2d') => WebCanvasContext | null;
  toDataURL: (type?: string) => string;
};

export type WebImageElement = {
  crossOrigin: string;
  src: string;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  onload: null | (() => void);
  onerror: null | (() => void);
};

export type WebImageConstructor = new () => WebImageElement;

export type WebCanvasDocument = {
  createElement: (tagName: 'canvas') => WebCanvas;
};
