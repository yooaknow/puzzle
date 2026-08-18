import {
  SHARE_PUZZLE_KEY,
  SHARE_PUZZLE_PREFIX,
  SHARE_PUZZLE_GRID_SIZE_KEY,
  SHARE_PUZZLE_GRID_SIZE_PREFIX,
  SHARE_PUZZLE_SOURCE_KEY,
  SHARE_PUZZLE_SOURCE_PREFIX,
  DrawStroke,
  GridSize,
  TextSticker,
  WebCanvasContext,
  WebCanvasDocument,
  WebImageConstructor,
  WebStorage,
} from './types';
import { solveSamplePieces } from './assets';

export function createPuzzleImage(photoUri: string, gridSize: GridSize): Promise<string> {
  const webDocument = (globalThis as unknown as { document?: WebCanvasDocument }).document;
  const WebImage = (globalThis as unknown as { Image?: WebImageConstructor }).Image;

  if (!webDocument || !WebImage) {
    return Promise.resolve(photoUri);
  }

  return new Promise((resolve) => {
    const image = new WebImage();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = webDocument.createElement('canvas');
      canvas.width = 330;
      canvas.height = 330;
      const context = canvas.getContext('2d');

      if (!context) {
        resolve(photoUri);
        return;
      }

      const naturalWidth = image.naturalWidth || image.width;
      const naturalHeight = image.naturalHeight || image.height;

      context.clearRect(0, 0, 330, 330);
      drawCroppedImage(context, image, naturalWidth, naturalHeight, 330);
      drawPuzzleCutLines(context, gridSize);

      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => resolve(photoUri);
    image.src = photoUri;
  });
}

export function createPuzzleArtworkImage(photoUri: string, strokes: DrawStroke[], textStickers: TextSticker[]): Promise<string> {
  const webDocument = (globalThis as unknown as { document?: WebCanvasDocument }).document;
  const WebImage = (globalThis as unknown as { Image?: WebImageConstructor }).Image;

  if (!webDocument || !WebImage) {
    return Promise.resolve(photoUri);
  }

  return new Promise((resolve) => {
    const image = new WebImage();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = webDocument.createElement('canvas');
      canvas.width = 330;
      canvas.height = 330;
      const context = canvas.getContext('2d');

      if (!context) {
        resolve(photoUri);
        return;
      }

      const naturalWidth = image.naturalWidth || image.width;
      const naturalHeight = image.naturalHeight || image.height;

      context.clearRect(0, 0, 330, 330);
      drawCroppedImage(context, image, naturalWidth, naturalHeight, 330);
      drawStrokes(context, strokes);
      drawTextStickers(context, textStickers);

      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => resolve(photoUri);
    image.src = photoUri;
  });
}

export function createPuzzlePieces(photoUri: string, gridSize: GridSize = 3): Promise<string[]> {
  const webDocument = (globalThis as unknown as { document?: WebCanvasDocument }).document;
  const WebImage = (globalThis as unknown as { Image?: WebImageConstructor }).Image;
  const pieceCount = gridSize * gridSize;

  if (!webDocument || !WebImage) {
    return Promise.resolve(Array(pieceCount).fill(photoUri));
  }

  return new Promise((resolve) => {
    const image = new WebImage();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const naturalWidth = image.naturalWidth || image.width;
      const naturalHeight = image.naturalHeight || image.height;
      const sourceSize = Math.min(naturalWidth, naturalHeight);
      const sourceX = (naturalWidth - sourceSize) / 2;
      const sourceY = (naturalHeight - sourceSize) / 2;
      const cropSize = sourceSize / gridSize;
      const cellSize = 302 / gridSize;
      const margin = getPuzzlePieceMargin(cellSize);
      const pieceCanvasSize = cellSize + margin * 2;
      const sourceMargin = cropSize * (margin / cellSize);
      const pieces: string[] = [];

      for (let row = 0; row < gridSize; row += 1) {
        for (let col = 0; col < gridSize; col += 1) {
          const canvas = webDocument.createElement('canvas');
          canvas.width = pieceCanvasSize;
          canvas.height = pieceCanvasSize;
          const context = canvas.getContext('2d');

          if (!context) {
            pieces.push(photoUri);
            continue;
          }

          context.clearRect(0, 0, pieceCanvasSize, pieceCanvasSize);
          context.save();
          drawPuzzlePiecePath(context, row, col, gridSize, cellSize, margin);
          context.clip();
          context.drawImage(
            image,
            sourceX + col * cropSize - sourceMargin,
            sourceY + row * cropSize - sourceMargin,
            cropSize + sourceMargin * 2,
            cropSize + sourceMargin * 2,
            0,
            0,
            pieceCanvasSize,
            pieceCanvasSize,
          );
          context.restore();
          drawPuzzlePiecePath(context, row, col, gridSize, cellSize, margin);
          context.lineWidth = 1;
          context.strokeStyle = 'rgba(42, 42, 42, 0.34)';
          context.lineJoin = 'round';
          context.lineCap = 'round';
          context.stroke();
          pieces.push(canvas.toDataURL('image/png'));
        }
      }

      resolve(pieces);
    };
    image.onerror = () => resolve(Array(pieceCount).fill(solveSamplePieces));
    image.src = photoUri;
  });
}

export function createEmptyPuzzleBoard(size = 302, gridSize: GridSize = 3) {
  const webDocument = (globalThis as unknown as { document?: WebCanvasDocument }).document;

  if (!webDocument) {
    return '';
  }

  const canvas = webDocument.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  if (!context) {
    return '';
  }

  context.clearRect(0, 0, size, size);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, size, size);
  drawPuzzleCutLines(context, gridSize, size);

  return canvas.toDataURL('image/png');
}

export function createDrawingOverlay(strokes: DrawStroke[]) {
  const webDocument = (globalThis as unknown as { document?: WebCanvasDocument }).document;

  if (!webDocument) {
    return '';
  }

  const canvas = webDocument.createElement('canvas');
  canvas.width = 330;
  canvas.height = 330;

  const context = canvas.getContext('2d');
  if (!context) {
    return '';
  }

  context.clearRect(0, 0, 330, 330);

  strokes.forEach((stroke) => {
    const [firstPoint, ...restPoints] = stroke.points;
    if (!firstPoint) {
      return;
    }

    drawStroke(context, stroke, firstPoint, restPoints);
  });

  return canvas.toDataURL('image/png');
}

export function createSharedPuzzleId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getShareUrl(puzzleId?: string) {
  const webLocation = (globalThis as unknown as { location?: { href?: string } }).location;
  const currentUrl = webLocation?.href ?? 'https://puzzlw.app';
  const baseUrl = currentUrl.split('?')[0].split('#')[0];
  return puzzleId ? `${baseUrl}?shared=1&puzzleId=${encodeURIComponent(puzzleId)}` : `${baseUrl}?shared=1`;
}

export function isSharedLink() {
  const webLocation = (globalThis as unknown as { location?: { search?: string } }).location;
  return webLocation?.search?.includes('shared=1') ?? false;
}

export function getSharedPuzzleId() {
  const webLocation = (globalThis as unknown as { location?: { search?: string } }).location;
  const search = webLocation?.search ?? '';
  const match = search.match(/[?&]puzzleId=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function saveStoredPuzzleUri(puzzleUri: string, puzzleId?: string, puzzleSourceUri?: string, gridSize: GridSize = 3) {
  try {
    const storage = getStorage();
    storage?.setItem(SHARE_PUZZLE_GRID_SIZE_KEY, String(gridSize));
    if (puzzleId) {
      storage?.setItem(`${SHARE_PUZZLE_GRID_SIZE_PREFIX}${puzzleId}`, String(gridSize));
    }
    storage?.setItem(SHARE_PUZZLE_KEY, puzzleUri);
    storage?.setItem(SHARE_PUZZLE_SOURCE_KEY, puzzleSourceUri ?? puzzleUri);
    if (puzzleId) {
      storage?.setItem(`${SHARE_PUZZLE_PREFIX}${puzzleId}`, puzzleUri);
      storage?.setItem(`${SHARE_PUZZLE_SOURCE_PREFIX}${puzzleId}`, puzzleSourceUri ?? puzzleUri);
    }
  } catch {
    // Local storage can fail for large data URLs; sharing still falls back to the sample puzzle.
  }
}

export function getStoredPuzzleGridSize(puzzleId?: string | null): GridSize {
  try {
    const storage = getStorage();
    const storedValue = puzzleId
      ? storage?.getItem(`${SHARE_PUZZLE_GRID_SIZE_PREFIX}${puzzleId}`) ?? storage?.getItem(SHARE_PUZZLE_GRID_SIZE_KEY)
      : storage?.getItem(SHARE_PUZZLE_GRID_SIZE_KEY);
    return parseGridSize(storedValue);
  } catch {
    return 3;
  }
}

export function getStoredPuzzleSourceUri(puzzleId?: string | null) {
  try {
    const storage = getStorage();
    if (puzzleId) {
      return storage?.getItem(`${SHARE_PUZZLE_SOURCE_PREFIX}${puzzleId}`) ?? storage?.getItem(SHARE_PUZZLE_SOURCE_KEY) ?? null;
    }
    return storage?.getItem(SHARE_PUZZLE_SOURCE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function getStoredPuzzleUri(puzzleId?: string | null) {
  try {
    const storage = getStorage();
    if (puzzleId) {
      return storage?.getItem(`${SHARE_PUZZLE_PREFIX}${puzzleId}`) ?? storage?.getItem(SHARE_PUZZLE_KEY) ?? null;
    }
    return storage?.getItem(SHARE_PUZZLE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function widthFromSlider(locationX: number) {
  const clamped = Math.max(0, Math.min(242, locationX));
  return Math.max(1, Math.min(9, Math.round(1 + (clamped / 242) * 8)));
}

export function sliderOffsetFromWidth(width: number) {
  return ((width - 1) / 8) * 242;
}

function getStorage() {
  return (globalThis as unknown as { localStorage?: WebStorage }).localStorage;
}

function drawCroppedImage(context: WebCanvasContext, image: Parameters<WebCanvasContext['drawImage']>[0], naturalWidth: number, naturalHeight: number, canvasSize: number) {
  const scale = Math.max(canvasSize / naturalWidth, canvasSize / naturalHeight);
  const drawWidth = naturalWidth * scale;
  const drawHeight = naturalHeight * scale;
  const drawX = (canvasSize - drawWidth) / 2;
  const drawY = (canvasSize - drawHeight) / 2;
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawStrokes(context: WebCanvasContext, strokes: DrawStroke[]) {
  strokes.forEach((stroke) => {
    const [firstPoint, ...restPoints] = stroke.points;
    if (firstPoint) {
      drawStroke(context, stroke, firstPoint, restPoints);
    }
  });
}

function drawStroke(context: WebCanvasContext, stroke: DrawStroke, firstPoint: DrawStroke['points'][number], restPoints: DrawStroke['points']) {
  context.beginPath();
  context.lineWidth = stroke.width;
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.moveTo(firstPoint.x, firstPoint.y);

  restPoints.forEach((point) => {
    context.lineTo(point.x, point.y);
  });

  context.stroke();

  if (restPoints.length === 0) {
    context.beginPath();
    context.arc(firstPoint.x, firstPoint.y, stroke.width / 2, 0, Math.PI * 2);
    context.fill();
  }
}

function drawTextStickers(context: WebCanvasContext, textStickers: TextSticker[]) {
  context.font = '700 19px sans-serif';
  context.textAlign = 'left';
  context.textBaseline = 'middle';

  textStickers.forEach((sticker) => {
    context.fillStyle = sticker.color;
    context.fillText(sticker.text, sticker.x - 70, sticker.y);
  });
}

function parseGridSize(value?: string | null): GridSize {
  return value === '4' || value === '5' ? Number(value) as GridSize : 3;
}

export function getPuzzlePieceMargin(cellSize: number) {
  return Math.max(24, Math.min(42, cellSize * 0.42));
}

function drawPuzzlePiecePath(context: WebCanvasContext, row: number, col: number, gridSize: GridSize, size: number, margin: number) {
  const x = margin;
  const y = margin;

  context.beginPath();
  context.moveTo(x, y);

  if (row === 0) {
    context.lineTo(x + size, y);
  } else {
    drawPointEdge(context, getHorizontalEdgePoints(row - 1, col, x, y, size), false);
  }

  if (col === gridSize - 1) {
    context.lineTo(x + size, y + size);
  } else {
    drawPointEdge(context, getVerticalEdgePoints(row, col, x + size, y, size), false);
  }

  if (row === gridSize - 1) {
    context.lineTo(x, y + size);
  } else {
    drawPointEdge(context, getHorizontalEdgePoints(row, col, x, y + size, size), true);
  }

  if (col === 0) {
    context.lineTo(x, y);
  } else {
    drawPointEdge(context, getVerticalEdgePoints(row, col - 1, x, y, size), true);
  }

  context.closePath();
}

type EdgeProfile = {
  flip: number;
  leadIn: number;
  tabOffset: number;
  neckOffset: number;
  exitBend: number;
  leadOut: number;
};

function drawPuzzleCutLines(context: WebCanvasContext, gridSize: GridSize, canvasSize = 330) {
  const inset = canvasSize / 302;
  const extent = canvasSize - inset * 2;
  const size = extent / gridSize;

  context.lineWidth = canvasSize === 330 ? 1.25 : 1.1;
  context.strokeStyle = canvasSize === 330 ? 'rgba(42,42,42,0.38)' : 'rgba(42,42,42,0.18)';
  context.lineJoin = 'round';
  context.lineCap = 'round';

  context.beginPath();
  context.moveTo(inset, inset);
  context.lineTo(inset + extent, inset);
  context.lineTo(inset + extent, inset + extent);
  context.lineTo(inset, inset + extent);
  context.closePath();
  context.stroke();

  for (let col = 1; col < gridSize; col += 1) {
    const x = inset + col * size;
    context.beginPath();
    context.moveTo(x, inset);
    for (let row = 0; row < gridSize; row += 1) {
      drawPointEdge(context, getVerticalEdgePoints(row, col - 1, x, inset + row * size, size), false);
    }
    context.stroke();
  }

  for (let row = 1; row < gridSize; row += 1) {
    const y = inset + row * size;
    context.beginPath();
    context.moveTo(inset, y);
    for (let col = 0; col < gridSize; col += 1) {
      drawPointEdge(context, getHorizontalEdgePoints(row - 1, col, inset + col * size, y, size), false);
    }
    context.stroke();
  }
}

type Point = { x: number; y: number };

function drawPointEdge(context: WebCanvasContext, points: Point[], reverse: boolean) {
  const edgePoints = reverse ? [...points].reverse() : points;

  edgePoints.slice(1).forEach((point) => {
    context.lineTo(point.x, point.y);
  });
}

function getHorizontalEdgePoints(row: number, col: number, x: number, y: number, size: number) {
  const profile = getEdgeProfile(row, col, 31);
  const tabSize = 0.125;
  const l = (ratio: number) => x + size * ratio;
  const w = (ratio: number) => y + size * ratio * profile.flip;

  return sampleCubicEdge([
    { x, y },
    { x: l(0.2), y: w(profile.leadIn) },
    { x: l(0.5 + profile.tabOffset + profile.exitBend), y: w(-tabSize + profile.neckOffset) },
    { x: l(0.5 - tabSize + profile.tabOffset), y: w(tabSize + profile.neckOffset) },
    { x: l(0.5 - 2 * tabSize + profile.tabOffset - profile.exitBend), y: w(3 * tabSize + profile.neckOffset) },
    { x: l(0.5 + 2 * tabSize + profile.tabOffset - profile.exitBend), y: w(3 * tabSize + profile.neckOffset) },
    { x: l(0.5 + tabSize + profile.tabOffset), y: w(tabSize + profile.neckOffset) },
    { x: l(0.5 + profile.tabOffset + profile.exitBend), y: w(-tabSize + profile.neckOffset) },
    { x: l(0.8), y: w(profile.leadOut) },
    { x: x + size, y },
  ]);
}

function getVerticalEdgePoints(row: number, col: number, x: number, y: number, size: number) {
  const profile = getEdgeProfile(row, col, 17);
  const tabSize = 0.125;
  const l = (ratio: number) => y + size * ratio;
  const w = (ratio: number) => x + size * ratio * profile.flip;

  return sampleCubicEdge([
    { x, y },
    { x: w(profile.leadIn), y: l(0.2) },
    { x: w(-tabSize + profile.neckOffset), y: l(0.5 + profile.tabOffset + profile.exitBend) },
    { x: w(tabSize + profile.neckOffset), y: l(0.5 - tabSize + profile.tabOffset) },
    { x: w(3 * tabSize + profile.neckOffset), y: l(0.5 - 2 * tabSize + profile.tabOffset - profile.exitBend) },
    { x: w(3 * tabSize + profile.neckOffset), y: l(0.5 + 2 * tabSize + profile.tabOffset - profile.exitBend) },
    { x: w(tabSize + profile.neckOffset), y: l(0.5 + tabSize + profile.tabOffset) },
    { x: w(-tabSize + profile.neckOffset), y: l(0.5 + profile.tabOffset + profile.exitBend) },
    { x: w(profile.leadOut), y: l(0.8) },
    { x, y: y + size },
  ]);
}

function sampleCubicEdge(points: Point[]) {
  const samples: Point[] = [points[0]];

  for (let index = 1; index < points.length; index += 3) {
    const start = points[index - 1];
    const controlA = points[index];
    const controlB = points[index + 1];
    const end = points[index + 2];

    for (let step = 1; step <= 12; step += 1) {
      const t = step / 12;
      const mt = 1 - t;
      samples.push({
        x: mt ** 3 * start.x + 3 * mt ** 2 * t * controlA.x + 3 * mt * t ** 2 * controlB.x + t ** 3 * end.x,
        y: mt ** 3 * start.y + 3 * mt ** 2 * t * controlA.y + 3 * mt * t ** 2 * controlB.y + t ** 3 * end.y,
      });
    }
  }

  return samples;
}

function getEdgeProfile(row: number, col: number, salt: number): EdgeProfile {
  return {
    flip: seededUnit(row, col, salt) > 0.5 ? 1 : -1,
    leadIn: seededRange(row, col, salt + 1, -0.02, 0.02),
    tabOffset: seededRange(row, col, salt + 2, -0.035, 0.035),
    neckOffset: seededRange(row, col, salt + 3, -0.02, 0.02),
    exitBend: seededRange(row, col, salt + 4, -0.025, 0.025),
    leadOut: seededRange(row, col, salt + 5, -0.02, 0.02),
  };
}

function seededRange(row: number, col: number, salt: number, min: number, max: number) {
  return min + seededUnit(row, col, salt) * (max - min);
}

function seededUnit(row: number, col: number, salt: number) {
  return hashEdge(row, col, salt) / 0xffffffff;
}

function hashEdge(row: number, col: number, salt: number) {
  let value = (row + 1) * 73856093 ^ (col + 1) * 19349663 ^ salt * 83492791;
  value = Math.imul(value ^ (value >>> 16), 2246822507);
  value = Math.imul(value ^ (value >>> 13), 3266489909);
  return (value ^ (value >>> 16)) >>> 0;
}
