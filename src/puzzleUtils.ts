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
      const pieces: string[] = [];

      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          const canvas = webDocument.createElement('canvas');
          canvas.width = 108;
          canvas.height = 108;
          const context = canvas.getContext('2d');

          if (!context) {
            pieces.push(photoUri);
            continue;
          }

          context.clearRect(0, 0, 108, 108);
          context.drawImage(image, sourceX + col * cropSize, sourceY + row * cropSize, cropSize, cropSize, 0, 0, 108, 108);
          pieces.push(canvas.toDataURL('image/png'));
        }
      }

      resolve(pieces);
    };
    image.onerror = () => resolve(Array(9).fill(solveSamplePieces));
    image.src = photoUri;
  });
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

function drawPuzzleCutLines(context: WebCanvasContext, gridSize: GridSize) {
  const inset = 5;
  const extent = 320;
  const size = extent / gridSize;

  context.lineWidth = 1.35;
  context.strokeStyle = 'rgba(42,42,42,0.42)';
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
  const start = size * 0.36;
  const end = size * 0.64;
  const cp = size * 0.08;
  const depth = Math.min(13, size * 0.16);
  context.lineTo(x, y + start);
  context.bezierCurveTo(x + tab * depth, y + start + cp, x + tab * depth, y + end - cp, x, y + end);
  context.lineTo(x, y + size);
}

function drawHorizontalCutSegment(context: WebCanvasContext, x: number, y: number, size: number, tab: number) {
  const start = size * 0.36;
  const end = size * 0.64;
  const cp = size * 0.08;
  const depth = Math.min(13, size * 0.16);
  context.lineTo(x + start, y);
  context.bezierCurveTo(x + start + cp, y + tab * depth, x + end - cp, y + tab * depth, x + end, y);
  context.lineTo(x + size, y);
}

function getVerticalTab(row: number, col: number) {
  return (row + col) % 2 === 0 ? 1 : -1;
}

function getHorizontalTab(row: number, col: number) {
  return (row + col) % 2 === 0 ? -1 : 1;
}
