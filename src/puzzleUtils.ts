import {
  SHARE_PUZZLE_KEY,
  SHARE_PUZZLE_PREFIX,
  DrawStroke,
  GridSize,
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
      const scale = Math.max(330 / naturalWidth, 330 / naturalHeight);
      const drawWidth = naturalWidth * scale;
      const drawHeight = naturalHeight * scale;
      const drawX = (330 - drawWidth) / 2;
      const drawY = (330 - drawHeight) / 2;

      context.clearRect(0, 0, 330, 330);
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
      drawPuzzleCutLines(context, gridSize);

      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => resolve(photoUri);
    image.src = photoUri;
  });
}

export function createPuzzlePieces(photoUri: string): Promise<string[]> {
  const webDocument = (globalThis as unknown as { document?: WebCanvasDocument }).document;
  const WebImage = (globalThis as unknown as { Image?: WebImageConstructor }).Image;

  if (!webDocument || !WebImage) {
    return Promise.resolve(Array(9).fill(photoUri));
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
      const cropSize = sourceSize / 3;
      const cellSize = 100;
      const margin = 13;
      const pieceCanvasSize = cellSize + margin * 2;
      const sourceMargin = cropSize * (margin / cellSize);
      const pieces: string[] = [];

      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
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
          drawPuzzlePiecePath(context, row, col, cellSize, margin);
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
          drawPuzzlePiecePath(context, row, col, cellSize, margin);
          context.lineWidth = 1.2;
          context.strokeStyle = 'rgba(42,42,42,0.42)';
          context.lineJoin = 'round';
          context.lineCap = 'round';
          context.stroke();
          pieces.push(canvas.toDataURL('image/png'));
        }
      }

      resolve(pieces);
    };
    image.onerror = () => resolve(Array(9).fill(solveSamplePieces));
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

export function saveStoredPuzzleUri(puzzleUri: string, puzzleId?: string) {
  try {
    const storage = getStorage();
    storage?.setItem(SHARE_PUZZLE_KEY, puzzleUri);
    if (puzzleId) {
      storage?.setItem(`${SHARE_PUZZLE_PREFIX}${puzzleId}`, puzzleUri);
    }
  } catch {
    // Local storage can fail for large data URLs; sharing still falls back to the sample puzzle.
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
  return Math.max(1, Math.min(12, Math.round(1 + (clamped / 242) * 11)));
}

export function sliderOffsetFromWidth(width: number) {
  return ((width - 1) / 11) * 242;
}

function getStorage() {
  return (globalThis as unknown as { localStorage?: WebStorage }).localStorage;
}

function drawPuzzlePiecePath(context: WebCanvasContext, row: number, col: number, size: number, margin: number) {
  const x = margin;
  const y = margin;

  context.beginPath();
  context.moveTo(x, y);

  if (row === 0) {
    context.lineTo(x + size, y);
  } else {
    drawHorizontalPieceEdge(context, x, y, size, getHorizontalTab(row - 1, col), false);
  }

  if (col === 2) {
    context.lineTo(x + size, y + size);
  } else {
    drawVerticalPieceEdge(context, x + size, y, size, getVerticalTab(row, col), false);
  }

  if (row === 2) {
    context.lineTo(x, y + size);
  } else {
    drawHorizontalPieceEdge(context, x, y + size, size, getHorizontalTab(row, col), true);
  }

  if (col === 0) {
    context.lineTo(x, y);
  } else {
    drawVerticalPieceEdge(context, x, y, size, getVerticalTab(row, col - 1), true);
  }

  context.closePath();
}

function drawHorizontalPieceEdge(context: WebCanvasContext, x: number, y: number, size: number, tab: number, reverse: boolean) {
  const neckIn = size * 0.34;
  const neckOut = size * 0.42;
  const crestIn = size * 0.47;
  const crestOut = size * 0.53;
  const returnIn = size * 0.58;
  const returnOut = size * 0.66;
  const depth = Math.min(14, size * 0.16);
  const shoulder = tab * depth * 0.45;
  const crest = tab * depth;

  if (!reverse) {
    context.lineTo(x + neckIn, y);
    context.bezierCurveTo(x + neckOut, y, x + neckOut, y + shoulder, x + crestIn, y + shoulder);
    context.bezierCurveTo(x + crestIn, y + crest, x + crestOut, y + crest, x + crestOut, y + shoulder);
    context.bezierCurveTo(x + returnIn, y + shoulder, x + returnIn, y, x + returnOut, y);
    context.lineTo(x + size, y);
    return;
  }

  context.lineTo(x + returnOut, y);
  context.bezierCurveTo(x + returnIn, y, x + returnIn, y + shoulder, x + crestOut, y + shoulder);
  context.bezierCurveTo(x + crestOut, y + crest, x + crestIn, y + crest, x + crestIn, y + shoulder);
  context.bezierCurveTo(x + neckOut, y + shoulder, x + neckOut, y, x + neckIn, y);
  context.lineTo(x, y);
}

function drawVerticalPieceEdge(context: WebCanvasContext, x: number, y: number, size: number, tab: number, reverse: boolean) {
  const neckIn = size * 0.34;
  const neckOut = size * 0.42;
  const crestIn = size * 0.47;
  const crestOut = size * 0.53;
  const returnIn = size * 0.58;
  const returnOut = size * 0.66;
  const depth = Math.min(14, size * 0.16);
  const shoulder = tab * depth * 0.45;
  const crest = tab * depth;

  if (!reverse) {
    context.lineTo(x, y + neckIn);
    context.bezierCurveTo(x, y + neckOut, x + shoulder, y + neckOut, x + shoulder, y + crestIn);
    context.bezierCurveTo(x + crest, y + crestIn, x + crest, y + crestOut, x + shoulder, y + crestOut);
    context.bezierCurveTo(x + shoulder, y + returnIn, x, y + returnIn, x, y + returnOut);
    context.lineTo(x, y + size);
    return;
  }

  context.lineTo(x, y + returnOut);
  context.bezierCurveTo(x, y + returnIn, x + shoulder, y + returnIn, x + shoulder, y + crestOut);
  context.bezierCurveTo(x + crest, y + crestOut, x + crest, y + crestIn, x + shoulder, y + crestIn);
  context.bezierCurveTo(x + shoulder, y + neckOut, x, y + neckOut, x, y + neckIn);
  context.lineTo(x, y);
}

function drawPuzzleCutLines(context: WebCanvasContext, gridSize: GridSize, canvasSize = 330) {
  const inset = canvasSize === 330 ? 5 : 1;
  const extent = canvasSize - inset * 2;
  const size = extent / gridSize;

  context.lineWidth = canvasSize === 330 ? 1.35 : 1.1;
  context.strokeStyle = canvasSize === 330 ? 'rgba(42,42,42,0.42)' : 'rgba(42,42,42,0.18)';
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
      drawVerticalCutSegment(context, x, inset + row * size, size, getVerticalTab(row, col - 1));
    }
    context.stroke();
  }

  for (let row = 1; row < gridSize; row += 1) {
    const y = inset + row * size;
    context.beginPath();
    context.moveTo(inset, y);
    for (let col = 0; col < gridSize; col += 1) {
      drawHorizontalCutSegment(context, inset + col * size, y, size, getHorizontalTab(row - 1, col));
    }
    context.stroke();
  }
}

function drawVerticalCutSegment(context: WebCanvasContext, x: number, y: number, size: number, tab: number) {
  const neckIn = size * 0.34;
  const neckOut = size * 0.42;
  const crestIn = size * 0.47;
  const crestOut = size * 0.53;
  const returnIn = size * 0.58;
  const returnOut = size * 0.66;
  const depth = Math.min(14, size * 0.16);
  const shoulder = tab * depth * 0.45;
  const crest = tab * depth;

  context.lineTo(x, y + neckIn);
  context.bezierCurveTo(x, y + neckOut, x + shoulder, y + neckOut, x + shoulder, y + crestIn);
  context.bezierCurveTo(x + crest, y + crestIn, x + crest, y + crestOut, x + shoulder, y + crestOut);
  context.bezierCurveTo(x + shoulder, y + returnIn, x, y + returnIn, x, y + returnOut);
  context.lineTo(x, y + size);
}

function drawHorizontalCutSegment(context: WebCanvasContext, x: number, y: number, size: number, tab: number) {
  const neckIn = size * 0.34;
  const neckOut = size * 0.42;
  const crestIn = size * 0.47;
  const crestOut = size * 0.53;
  const returnIn = size * 0.58;
  const returnOut = size * 0.66;
  const depth = Math.min(14, size * 0.16);
  const shoulder = tab * depth * 0.45;
  const crest = tab * depth;

  context.lineTo(x + neckIn, y);
  context.bezierCurveTo(x + neckOut, y, x + neckOut, y + shoulder, x + crestIn, y + shoulder);
  context.bezierCurveTo(x + crestIn, y + crest, x + crestOut, y + crest, x + crestOut, y + shoulder);
  context.bezierCurveTo(x + returnIn, y + shoulder, x + returnIn, y, x + returnOut, y);
  context.lineTo(x + size, y);
}

function getVerticalTab(row: number, col: number) {
  return (row + col) % 2 === 0 ? 1 : -1;
}

function getHorizontalTab(row: number, col: number) {
  return (row + col) % 2 === 0 ? -1 : 1;
}
