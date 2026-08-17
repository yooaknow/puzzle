import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  GestureResponderEvent,
  Image,
  ImageStyle,
  Pressable,
  SafeAreaView,
  Share,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';

import {
  cardPhotoPuzzle,
  cardPuzzleSheet,
  celebrationAsset,
  loginPuzzleAsset,
  photoBadgeIconAsset,
  puzzleBadgeIconAsset,
  receivedArm,
  receivedPuzzleSheet,
  receivedYellowPuzzle,
  redoIconAsset,
  solveCompleteCelebrationAsset,
  solveCompletePuzzleAsset,
  solveSamplePieces,
  solveSamplePuzzle,
  splashArm,
  splashPuzzleSheet,
  splashYellowPuzzle,
  trashIconAsset,
  undoIconAsset,
  uploadIcon,
} from './src/assets';
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  DrawStroke,
  GRID_GAP_X,
  GRID_GAP_Y,
  GRID_LEFT,
  GRID_TOP,
  GridSize,
  ScreenName,
  TextSticker,
  TILE_HEIGHT,
  TILE_WIDTH,
  WebDocument,
  WebNavigator,
  WebUrl,
} from './src/types';
import {
  createDrawingOverlay,
  createEmptyPuzzleBoard,
  createPuzzleImage,
  createPuzzlePieces,
  createSharedPuzzleId,
  getShareUrl,
  getSharedPuzzleId,
  getStoredPuzzleUri,
  isSharedLink,
  saveStoredPuzzleUri,
  sliderOffsetFromWidth,
  widthFromSlider,
} from './src/puzzleUtils';

export default function App() {
  const [screen, setScreen] = useState<ScreenName>(() => (isSharedLink() ? 'received' : 'splash'));
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [completedPuzzleUri, setCompletedPuzzleUri] = useState<string | null>(null);
  const [solvedPuzzleUri, setSolvedPuzzleUri] = useState<string | null>(null);
  const [completedStrokes, setCompletedStrokes] = useState<DrawStroke[]>([]);
  const [completedTextStickers, setCompletedTextStickers] = useState<TextSticker[]>([]);
  const selectedPhotoUri = selectedPhotoIndex === null ? null : photoUris[selectedPhotoIndex];
  const { width, height } = useWindowDimensions();
  const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);

  useEffect(() => {
    return () => {
      const webUrl = (globalThis as unknown as { URL?: WebUrl }).URL;
      if (webUrl) {
        photoUris.forEach((uri) => webUrl.revokeObjectURL(uri));
      }
    };
  }, [photoUris]);

  const openPhotoPicker = () => {
    const webDocument = (globalThis as unknown as { document?: WebDocument }).document;
    const webUrl = (globalThis as unknown as { URL?: WebUrl }).URL;

    if (!webDocument || !webUrl) {
      return;
    }

    const input = webDocument.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files ?? []).filter((file) => file.type?.startsWith('image/'));
      if (files.length === 0) {
        return;
      }

      photoUris.forEach((uri) => webUrl.revokeObjectURL(uri));
      const nextUris = files.map((file) => webUrl.createObjectURL(file));
      setPhotoUris(nextUris);
      setSelectedPhotoIndex(null);
      setScreen('photos');
    };
    input.click();
  };

  const goBack = () => {
    if (screen === 'photos') {
      setScreen('card');
      return;
    }
    if (screen === 'puzzle') {
      setScreen('photos');
      return;
    }
    if (screen === 'complete') {
      setScreen('puzzle');
      return;
    }
    if (screen === 'solve') {
      setScreen('received');
      return;
    }
    if (screen === 'solveComplete') {
      setScreen('solve');
      return;
    }
    if (screen === 'received') {
      setScreen('splash');
      return;
    }
    setScreen('splash');
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" backgroundColor="#fff" />
      <View style={[styles.screen, { transform: [{ scale }] }]}>
        {screen === 'splash' && <SplashScreen onStart={() => setScreen('card')} />}
        {screen === 'received' && <ReceivedLinkScreen onOpenPuzzle={() => setScreen('solve')} />}
        {screen === 'card' && <CardCreateScreen onBack={goBack} onPickPhoto={openPhotoPicker} />}
        {screen === 'photos' && (
          <PhotoSelectScreen
            photoUris={photoUris}
            selectedPhotoIndex={selectedPhotoIndex}
            onBack={goBack}
            onPickPhoto={openPhotoPicker}
            onSelectPhoto={setSelectedPhotoIndex}
            onMakePuzzle={() => setScreen('puzzle')}
          />
        )}
        {screen === 'puzzle' && selectedPhotoUri && (
          <PuzzleDecorateScreen
            photoUri={selectedPhotoUri}
            onBack={goBack}
            onComplete={(puzzleUri, strokes, textStickers) => {
              setCompletedPuzzleUri(puzzleUri);
              setCompletedStrokes(strokes);
              setCompletedTextStickers(textStickers);
              setScreen('complete');
            }}
          />
        )}
        {screen === 'complete' && completedPuzzleUri && (
          <PuzzleCompleteScreen puzzleUri={completedPuzzleUri} strokes={completedStrokes} textStickers={completedTextStickers} onBack={goBack} />
        )}
        {screen === 'solve' && (
          <PuzzleSolveScreen
            puzzleUri={completedPuzzleUri ?? getStoredPuzzleUri(getSharedPuzzleId()) ?? solveSamplePuzzle}
            screenScale={scale}
            screenOffsetX={(width - DESIGN_WIDTH * scale) / 2}
            screenOffsetY={(height - DESIGN_HEIGHT * scale) / 2}
            onBack={goBack}
            onComplete={(puzzleUri) => {
              setSolvedPuzzleUri(puzzleUri);
              setScreen('solveComplete');
            }}
          />
        )}
        {screen === 'solveComplete' && <SolvedPuzzleCompleteScreen puzzleUri={solvedPuzzleUri ?? completedPuzzleUri ?? getStoredPuzzleUri(getSharedPuzzleId()) ?? solveSamplePuzzle} onBack={goBack} />}
      </View>
    </SafeAreaView>
  );
}

function SplashScreen({ onStart }: { onStart: () => void }) {
  return (
    <View style={styles.fill}>
      <View style={styles.splashHeroPuzzleWrap}>
        <Image source={{ uri: splashYellowPuzzle }} style={styles.splashHeroPuzzle} resizeMode="cover" />
      </View>
      <Image source={{ uri: splashArm }} style={styles.splashArm} resizeMode="cover" />

      <View style={styles.splashCopyBlock}>
        <Text style={styles.splashHeadline}>하고 싶은{'\n'}말이 있는데{'\n'}그냥 알려주긴{'\n'}싫어.</Text>
        <Text style={styles.splashBrand}>푸러봐</Text>
      </View>

      <PuzzleCrop image={splashPuzzleSheet} style={styles.splashPinkPuzzle} cropStyle={styles.splashPinkCrop} opacity={0.4} />
      <PuzzleCrop image={splashPuzzleSheet} style={styles.splashPurplePuzzle} cropStyle={styles.splashPurpleCrop} opacity={0.7} />
      <PuzzleCrop image={splashPuzzleSheet} style={styles.splashMintPuzzle} cropStyle={styles.splashMintCrop} opacity={0.4} />

      <Pressable onPress={onStart} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>퍼즐 만들기</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
      <Text style={styles.splashLoginText}>로그인 · 내 퍼즐함</Text>
    </View>
  );
}

function ReceivedLinkScreen({ onOpenPuzzle }: { onOpenPuzzle: () => void }) {
  return (
    <View style={styles.fill}>
      <View style={styles.receivedHeroPuzzleWrap}>
        <Image source={{ uri: receivedYellowPuzzle }} style={styles.receivedHeroPuzzle} resizeMode="cover" />
      </View>
      <Image source={{ uri: receivedArm }} style={styles.receivedArm} resizeMode="cover" />

      <View style={styles.receivedCopyBlock}>
        <Text style={styles.receivedHeadline}>누군가{'\n'}당신에게{'\n'}하고 싶은 말이{'\n'}있대요.</Text>
        <Text style={styles.receivedBrand}>푸러봐</Text>
      </View>

      <PuzzleCrop image={receivedPuzzleSheet} style={styles.receivedPinkPuzzle} cropStyle={styles.receivedPinkCrop} opacity={0.5} />
      <PuzzleCrop image={receivedPuzzleSheet} style={styles.receivedPurplePuzzle} cropStyle={styles.receivedPurpleCrop} opacity={0.7} />
      <PuzzleCrop image={receivedPuzzleSheet} style={styles.receivedMintPuzzle} cropStyle={styles.receivedMintCrop} opacity={0.4} />

      <Pressable onPress={onOpenPuzzle} style={({ pressed }) => [styles.receivedButton, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>퍼즐 확인하기</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </View>
  );
}

function CardCreateScreen({ onBack, onPickPhoto }: { onBack: () => void; onPickPhoto: () => void }) {
  return (
    <View style={styles.fill}>
      <TopBar title="시작하기" onBack={onBack} withBorder />

      <Pressable onPress={onPickPhoto} style={styles.photoPuzzleArea}>
        <View style={styles.photoPuzzleWrap}>
          <Image source={{ uri: cardPhotoPuzzle }} style={styles.photoPuzzle} resizeMode="cover" />
        </View>
        <Image source={{ uri: uploadIcon }} style={styles.uploadIcon} resizeMode="contain" />
        <Text style={styles.photoPrompt}>사진을 선택해 주세요</Text>
      </Pressable>

      <PuzzleCrop image={cardPuzzleSheet} style={styles.cardPinkPuzzle} cropStyle={styles.cardPinkCrop} opacity={0.7} />
      <PuzzleCrop image={cardPuzzleSheet} style={styles.cardPurplePuzzle} cropStyle={styles.cardPurpleCrop} opacity={0.7} />
      <PuzzleCrop image={cardPuzzleSheet} style={styles.cardSmallYellowPuzzle} cropStyle={styles.cardSmallYellowCrop} opacity={0.6} />

      <View style={styles.cardTitleBlock}>
        <Text style={styles.cardTitleLine}>사진으로</Text>
        <Text style={styles.cardTitleLine}>
          <Text style={styles.cardTitleAccent}>퍼즐</Text>을 만들어볼까요?
        </Text>
      </View>

      <Text style={styles.cardDescription}>
        소중한 사진 한 장을 골라주세요.{'\n'}사진 위에 하고 싶은 말을 꾸미면{'\n'}나만의 퍼즐이 완성돼요.
      </Text>

      <Pressable onPress={onPickPhoto} style={({ pressed }) => [styles.cardSelectButton, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>사진 선택하기</Text>
      </Pressable>
      <Text style={styles.cardHelperText}>선택한 사진은 퍼즐을 만드는 데만 사용돼요</Text>
    </View>
  );
}

function PhotoSelectScreen({
  photoUris,
  selectedPhotoIndex,
  onBack,
  onPickPhoto,
  onSelectPhoto,
  onMakePuzzle,
}: {
  photoUris: string[];
  selectedPhotoIndex: number | null;
  onBack: () => void;
  onPickPhoto: () => void;
  onSelectPhoto: (index: number) => void;
  onMakePuzzle: () => void;
}) {
  const hasSelection = selectedPhotoIndex !== null;

  return (
    <View style={styles.fill}>
      <TopBar title="사진 선택" onBack={onBack} />
      <View style={styles.tabBar}>
        <Text style={styles.activeTab}>최근 항목</Text>
        <Text style={styles.inactiveTab}>즐겨 찾기</Text>
        <View style={styles.activeTabLine} />
      </View>

      <View style={styles.photoGrid}>
        {photoUris.map((uri, index) => {
          const isSelected = selectedPhotoIndex === index;
          const isDimmed = hasSelection && !isSelected;
          const row = Math.floor(index / 3);
          const col = index % 3;

          return (
            <Pressable
              key={`${uri}-${index}`}
              onPress={() => onSelectPhoto(index)}
              style={[
                styles.photoTile,
                {
                  left: col * (TILE_WIDTH + GRID_GAP_X),
                  top: row * (TILE_HEIGHT + GRID_GAP_Y),
                },
                isSelected && styles.selectedPhotoTile,
              ]}
            >
              <Image source={{ uri }} style={styles.loadedPhoto} resizeMode="cover" />
              {isDimmed && <View style={styles.dimOverlay} />}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.bottomPanel}>
        <Pressable
          disabled={!hasSelection}
          onPress={hasSelection ? onMakePuzzle : onPickPhoto}
          style={({ pressed }) => [styles.makeButton, !hasSelection && styles.disabledButton, pressed && hasSelection && styles.pressed]}
        >
          <Text style={styles.primaryText}>퍼즐 제작하기</Text>
        </Pressable>
        <Text style={styles.bottomHelperText}>선택한 사진은 퍼즐을 만드는 데만 사용돼요</Text>
      </View>
    </View>
  );
}

function PuzzleDecorateScreen({
  photoUri,
  onBack,
  onComplete,
}: {
  photoUri: string;
  onBack: () => void;
  onComplete: (puzzleUri: string, strokes: DrawStroke[], textStickers: TextSticker[]) => void;
}) {
  const [tool, setTool] = useState<'draw' | 'text'>('draw');
  const [gridSize, setGridSize] = useState<GridSize>(3);
  const [puzzleUri, setPuzzleUri] = useState(photoUri);
  const [penColor, setPenColor] = useState('#914fec');
  const [penWidth, setPenWidth] = useState(5);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [redoStrokes, setRedoStrokes] = useState<DrawStroke[]>([]);
  const [textStickers, setTextStickers] = useState<TextSticker[]>([]);
  const [activeTextId, setActiveTextId] = useState<number | null>(null);
  const [textDraft, setTextDraft] = useState('');
  const [textColor, setTextColor] = useState('#914fec');
  const drawingOverlayUri = useMemo(() => createDrawingOverlay(strokes), [strokes]);

  useEffect(() => {
    let isMounted = true;

    createPuzzleImage(photoUri, gridSize).then((nextUri) => {
      if (isMounted) {
        setPuzzleUri(nextUri);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [photoUri, gridSize]);

  const cycleGridSize = () => {
    setGridSize((current) => (current === 3 ? 4 : current === 4 ? 5 : 3));
  };

  const getDrawPoint = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    return {
      x: Math.max(0, Math.min(330, locationX)),
      y: Math.max(0, Math.min(330, locationY)),
    };
  };

  const startDrawing = (event: GestureResponderEvent) => {
    if (tool !== 'draw') {
      return;
    }

    setRedoStrokes([]);
    setStrokes((current) => [...current, { color: penColor, width: penWidth, points: [getDrawPoint(event)] }]);
  };

  const continueDrawing = (event: GestureResponderEvent) => {
    if (tool !== 'draw') {
      return;
    }

    setStrokes((current) => {
      const latest = current[current.length - 1];
      if (!latest) {
        return current;
      }

      const next = current.slice();
      next[next.length - 1] = { ...latest, points: [...latest.points, getDrawPoint(event)] };
      return next;
    });
  };

  const updateTextDraft = (text: string) => {
    setTextDraft(text);
    setTextStickers((current) => {
      if (text.trim().length === 0) {
        setActiveTextId(null);
        return [];
      }

      if (activeTextId === null) {
        const nextSticker = { id: Date.now(), text, color: textColor, x: 165, y: 165 };
        setActiveTextId(nextSticker.id);
        return [nextSticker];
      }

      return current.map((sticker) => (sticker.id === activeTextId ? { ...sticker, text } : sticker));
    });
  };

  const updateTextColor = (color: string) => {
    setTextColor(color);
    setTextStickers((current) => current.map((sticker) => (sticker.id === activeTextId ? { ...sticker, color } : sticker)));
  };

  const moveActiveText = (event: GestureResponderEvent) => {
    if (tool !== 'text' || activeTextId === null) {
      return;
    }

    const point = getDrawPoint(event);
    setTextStickers((current) =>
      current.map((sticker) => (sticker.id === activeTextId ? { ...sticker, x: point.x, y: point.y } : sticker)),
    );
  };

  return (
    <View style={styles.fill}>
      <TopBar title="퍼즐 꾸미기" onBack={onBack} withBorder />

      <View style={styles.puzzlePreview}>
        <Image source={{ uri: puzzleUri }} style={styles.puzzlePreviewImage} resizeMode="cover" />
        <Image source={{ uri: drawingOverlayUri }} style={styles.drawingOverlay} resizeMode="stretch" />
        {textStickers.map((sticker) => (
          <Text
            key={sticker.id}
            style={[
              styles.puzzleTextSticker,
              {
                color: sticker.color,
                left: sticker.x,
                top: sticker.y,
                transform: [{ translateX: -70 }, { translateY: -16 }],
              },
              activeTextId === sticker.id && styles.activePuzzleTextSticker,
            ]}
          >
            {sticker.text}
          </Text>
        ))}
        <View
          style={[styles.drawingHitArea, tool === 'text' && styles.textHitArea]}
          onStartShouldSetResponder={() => tool === 'draw' || (tool === 'text' && activeTextId !== null)}
          onMoveShouldSetResponder={() => tool === 'draw' || (tool === 'text' && activeTextId !== null)}
          onResponderGrant={tool === 'draw' ? startDrawing : moveActiveText}
          onResponderMove={tool === 'draw' ? continueDrawing : moveActiveText}
        />
        <Pressable onPress={cycleGridSize} style={({ pressed }) => [styles.puzzleSizeBadge, pressed && styles.pressed]}>
          <Image source={{ uri: puzzleBadgeIconAsset }} style={styles.puzzleBadgeIcon} resizeMode="contain" />
          <Text style={styles.puzzleBadgeText}>{gridSize}X{gridSize}</Text>
        </Pressable>
        <View style={styles.imageBadge}>
          <Image source={{ uri: photoBadgeIconAsset }} style={styles.imageBadgeIcon} resizeMode="contain" />
        </View>
      </View>

      <View style={styles.puzzleControls}>
        <View style={styles.toolTabs}>
          <Pressable onPress={() => setTool('draw')} style={[styles.toolTab, tool === 'draw' && styles.activeToolTab]}>
            <Text style={[styles.toolTabText, tool === 'draw' && styles.activeToolTabText]}>✎ 그리기</Text>
          </Pressable>
          <Pressable onPress={() => setTool('text')} style={[styles.toolTab, tool === 'text' && styles.activeToolTab]}>
            <Text style={[styles.toolTabText, tool === 'text' && styles.activeToolTabText]}>T 텍스트</Text>
          </Pressable>
        </View>
        {tool === 'draw' ? (
          <DrawPanel penColor={penColor} penWidth={penWidth} onColorChange={setPenColor} onWidthChange={setPenWidth} />
        ) : (
          <TextPanelEditor text={textDraft} textColor={textColor} onTextChange={updateTextDraft} onColorChange={updateTextColor} />
        )}
      </View>

      <Pressable
        onPress={() => {
          setStrokes((current) => {
            if (current.length === 0) {
              return current;
            }
            const next = current.slice(0, -1);
            setRedoStrokes((redo) => [current[current.length - 1], ...redo]);
            return next;
          });
        }}
        style={({ pressed }) => [styles.undoButton, pressed && styles.pressed]}
        hitSlop={8}
      >
        <Image source={{ uri: undoIconAsset }} style={[styles.historyIcon, styles.undoIcon]} resizeMode="contain" />
      </Pressable>
      <Pressable
        onPress={() => {
          setRedoStrokes((current) => {
            if (current.length === 0) {
              return current;
            }
            const [restored, ...rest] = current;
            setStrokes((drawn) => [...drawn, restored]);
            return rest;
          });
        }}
        style={({ pressed }) => [styles.redoButton, pressed && styles.pressed]}
        hitSlop={8}
      >
        <Image source={{ uri: redoIconAsset }} style={[styles.historyIcon, styles.redoIcon]} resizeMode="contain" />
      </Pressable>
      <Pressable
        onPress={() => {
          setStrokes([]);
          setRedoStrokes([]);
          setTextStickers([]);
          setTextDraft('');
          setActiveTextId(null);
        }}
        style={({ pressed }) => [styles.trashButton, pressed && styles.pressed]}
        hitSlop={8}
      >
        <Image source={{ uri: trashIconAsset }} style={styles.trashIcon} resizeMode="contain" />
      </Pressable>

      <Pressable onPress={() => onComplete(puzzleUri, strokes, textStickers)} style={({ pressed }) => [styles.completeButton, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>퍼즐 완성</Text>
      </Pressable>
    </View>
  );
}

function PuzzleCompleteScreen({
  puzzleUri,
  strokes,
  textStickers,
  onBack,
}: {
  puzzleUri: string;
  strokes: DrawStroke[];
  textStickers: TextSticker[];
  onBack: () => void;
}) {
  const drawingOverlayUri = useMemo(() => createDrawingOverlay(strokes), [strokes]);
  const sharePuzzleId = useMemo(() => createSharedPuzzleId(), []);
  const shareUrl = useMemo(() => getShareUrl(sharePuzzleId), [sharePuzzleId]);

  useEffect(() => {
    saveStoredPuzzleUri(puzzleUri, sharePuzzleId);
  }, [puzzleUri, sharePuzzleId]);

  const sharePuzzle = async () => {
    const title = '퍼즐이 완성됐어요!';
    const text = '내가 만든 퍼즐을 확인해보세요.';
    const webNavigator = (globalThis as unknown as { navigator?: WebNavigator }).navigator;

    try {
      if (webNavigator?.share) {
        await webNavigator.share({ title, text, url: shareUrl });
        return;
      }

      await Share.share({
        title,
        message: `${text}\n${shareUrl}`,
        url: shareUrl,
      });
    } catch (error) {
      try {
        await webNavigator?.clipboard?.writeText(shareUrl);
        Alert.alert('링크 복사 완료', '공유 링크를 복사했어요.');
      } catch {
        Alert.alert('공유할 수 없어요', '이 브라우저에서는 공유 기능을 지원하지 않아요.');
      }
    }
  };

  return (
    <View style={styles.fill}>
      <TopBar title="퍼즐 완성" onBack={onBack} withBorder />

      <Image source={{ uri: celebrationAsset }} style={styles.celebrationImage} resizeMode="cover" />
      <Text style={styles.completeTitle}>
        <Text style={styles.completeTitleAccent}>퍼즐</Text>이 완성됐어요!
      </Text>
      <Text style={styles.completeSubtitle}>특별한 메시지를 전달할 준비가 완료됐어요</Text>

      <View style={styles.completedPuzzleFrame}>
        <Image source={{ uri: puzzleUri }} style={styles.completedPuzzleImage} resizeMode="cover" />
        <Image source={{ uri: drawingOverlayUri }} style={styles.completedDrawingOverlay} resizeMode="stretch" />
        {textStickers.map((sticker) => (
          <Text
            key={sticker.id}
            style={[
              styles.completedTextSticker,
              {
                color: sticker.color,
                left: sticker.x,
                top: sticker.y,
                transform: [{ translateX: -70 }, { translateY: -16 }],
              },
            ]}
          >
            {sticker.text}
          </Text>
        ))}
      </View>

      <Pressable onPress={sharePuzzle} style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>공유하기</Text>
      </Pressable>

      <View style={styles.loginNotice}>
        <Text style={styles.loginNoticeTitle}>보낸 퍼즐, 간직할까요?</Text>
        <Text style={styles.loginNoticeBody}>로그인하면 내가 보낸 퍼즐을 모아볼 수 있어요</Text>
        <Image source={{ uri: loginPuzzleAsset }} style={styles.loginNoticeImage} resizeMode="cover" />
      </View>
    </View>
  );
}

function PuzzleSolveScreen({
  puzzleUri,
  screenScale,
  screenOffsetX,
  screenOffsetY,
  onBack,
  onComplete,
}: {
  puzzleUri: string;
  screenScale: number;
  screenOffsetX: number;
  screenOffsetY: number;
  onBack: () => void;
  onComplete: (puzzleUri: string) => void;
}) {
  const [pieceUris, setPieceUris] = useState<string[]>([]);
  const [placedPieces, setPlacedPieces] = useState<Array<number | null>>(Array(9).fill(null));
  const [selectedPiece, setSelectedPiece] = useState<number | null>(null);
  const [draggingPiece, setDraggingPiece] = useState<{ pieceIndex: number; x: number; y: number } | null>(null);
  const draggingPieceRef = useRef<{ pieceIndex: number; x: number; y: number } | null>(null);
  const [trayPage, setTrayPage] = useState(0);
  const placedCount = placedPieces.filter((piece) => piece !== null).length;
  const isSolved = placedCount === 9;
  const availablePieces = pieceUris.map((_, index) => index).filter((index) => !placedPieces.includes(index));
  const trayPageCount = Math.max(1, Math.ceil(availablePieces.length / 2));
  const visiblePieces = availablePieces.slice(trayPage * 2, trayPage * 2 + 2);
  const emptyBoardUri = useMemo(() => createEmptyPuzzleBoard(), []);

  useEffect(() => {
    let isMounted = true;
    createPuzzlePieces(puzzleUri).then((pieces) => {
      if (isMounted) {
        setPieceUris(pieces);
        setPlacedPieces(Array(9).fill(null));
        setSelectedPiece(null);
        setDraggingPiece(null);
        draggingPieceRef.current = null;
        setTrayPage(0);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [puzzleUri]);

  useEffect(() => {
    setTrayPage((current) => Math.min(current, trayPageCount - 1));
  }, [trayPageCount]);

  const getDesignPoint = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    return {
      x: (pageX - screenOffsetX) / screenScale,
      y: (pageY - screenOffsetY) / screenScale,
    };
  };

  const getDropSlot = (event: GestureResponderEvent) => {
    const point = getDesignPoint(event);
    const boardLeft = 44;
    const boardTop = 187;
    const boardSize = 302;
    const slotSize = boardSize / 3;

    if (point.x < boardLeft || point.x > boardLeft + boardSize || point.y < boardTop || point.y > boardTop + boardSize) {
      return null;
    }

    const col = Math.min(2, Math.floor((point.x - boardLeft) / slotSize));
    const row = Math.min(2, Math.floor((point.y - boardTop) / slotSize));
    return row * 3 + col;
  };

  const startDraggingPiece = (pieceIndex: number, event: GestureResponderEvent) => {
    const point = getDesignPoint(event);
    const nextDraggingPiece = { pieceIndex, x: point.x, y: point.y };
    setSelectedPiece(pieceIndex);
    draggingPieceRef.current = nextDraggingPiece;
    setDraggingPiece(nextDraggingPiece);
  };

  const moveDraggingPiece = (event: GestureResponderEvent) => {
    const current = draggingPieceRef.current;
    if (!current) {
      return;
    }

    const point = getDesignPoint(event);
    const nextDraggingPiece = { ...current, x: point.x, y: point.y };
    draggingPieceRef.current = nextDraggingPiece;
    setDraggingPiece(nextDraggingPiece);
  };

  const finishDraggingPiece = (event: GestureResponderEvent) => {
    const currentDraggingPiece = draggingPieceRef.current;
    if (!currentDraggingPiece || placedPieces.includes(currentDraggingPiece.pieceIndex)) {
      draggingPieceRef.current = null;
      setDraggingPiece(null);
      return;
    }

    const slotIndex = getDropSlot(event);
    if (slotIndex === currentDraggingPiece.pieceIndex && placedPieces[slotIndex] === null) {
      setPlacedPieces((current) => {
        const next = current.slice();
        next[slotIndex] = currentDraggingPiece.pieceIndex;
        return next;
      });
    }

    setSelectedPiece(null);
    draggingPieceRef.current = null;
    setDraggingPiece(null);
  };

  return (
    <View style={styles.fill}>
      <TopBar title="퍼즐 맞추기" onBack={onBack} withBorder />

      <View style={styles.solveCounter}>
        <Image source={{ uri: puzzleBadgeIconAsset }} style={styles.solveCounterIcon} resizeMode="contain" />
        <Text style={styles.solveCounterText}>
          <Text style={styles.solveCounterDone}>{placedCount}</Text>
          <Text style={styles.solveCounterTotal}>/9</Text>
        </Text>
      </View>

      <View style={[styles.solveBoard, isSolved && styles.solvedBoard]}>
        {isSolved ? (
          <Image source={{ uri: puzzleUri }} style={styles.solvedPuzzleImage} resizeMode="cover" />
        ) : (
          <>
            <Image source={{ uri: emptyBoardUri }} style={styles.emptySolveBoardImage} resizeMode="cover" />
            {Array.from({ length: 9 }).map((_, index) => {
              const placedPiece = placedPieces[index];
              return (
                <View key={index} style={styles.solveSlot}>
                  {placedPiece !== null && pieceUris[placedPiece] ? (
                    <Image source={{ uri: pieceUris[placedPiece] }} style={styles.solvePlacedPiece} resizeMode="cover" />
                  ) : null}
                </View>
              );
            })}
          </>
        )}
      </View>

      <View style={styles.solveTray}>
        <Pressable
          onPress={() => setTrayPage((current) => Math.max(0, current - 1))}
          disabled={trayPage === 0}
          style={({ pressed }) => [styles.solveArrowLeft, trayPage === 0 && styles.disabledSolveArrow, pressed && trayPage > 0 && styles.pressed]}
        >
          <Text style={styles.solveArrowText}>‹</Text>
        </Pressable>
        {isSolved ? (
          <Text style={styles.solveEmptyTrayText}>남은 퍼즐 조각이 없습니다.</Text>
        ) : (
          <View style={styles.solvePieceRow}>
            {visiblePieces.map((pieceIndex) => (
              <View
                key={pieceIndex}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(event) => startDraggingPiece(pieceIndex, event)}
                onResponderMove={moveDraggingPiece}
                onResponderRelease={finishDraggingPiece}
                onResponderTerminate={() => {
                  setSelectedPiece(null);
                  draggingPieceRef.current = null;
                  setDraggingPiece(null);
                }}
                style={[styles.solvePieceButton, selectedPiece === pieceIndex && styles.selectedSolvePiece]}
              >
                <Image source={{ uri: pieceUris[pieceIndex] ?? solveSamplePieces }} style={styles.solvePieceImage} resizeMode="cover" />
              </View>
            ))}
          </View>
        )}
        <Pressable
          onPress={() => setTrayPage((current) => Math.min(trayPageCount - 1, current + 1))}
          disabled={trayPage >= trayPageCount - 1}
          style={({ pressed }) => [
            styles.solveArrowRight,
            trayPage >= trayPageCount - 1 && styles.disabledSolveArrow,
            pressed && trayPage < trayPageCount - 1 && styles.pressed,
          ]}
        >
          <Text style={styles.solveArrowText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.solveBottomSheet}>
        <Pressable
          disabled={placedCount < 9}
          onPress={() => onComplete(puzzleUri)}
          style={({ pressed }) => [styles.solveCompleteButton, placedCount < 9 && styles.disabledButton, pressed && placedCount === 9 && styles.pressed]}
        >
          <Text style={styles.primaryText}>퍼즐 완성하기</Text>
        </Pressable>
        <Text style={styles.solveHelperText}>조각을 선택해서 퍼즐판에 놓아보세요!</Text>
      </View>
      {draggingPiece && pieceUris[draggingPiece.pieceIndex] ? (
        <Image
          source={{ uri: pieceUris[draggingPiece.pieceIndex] }}
          style={[styles.draggingSolvePiece, { left: draggingPiece.x - 54, top: draggingPiece.y - 54 }]}
          resizeMode="cover"
        />
      ) : null}
    </View>
  );
}

function SolvedPuzzleCompleteScreen({ puzzleUri, onBack }: { puzzleUri: string; onBack: () => void }) {
  return (
    <View style={styles.fill}>
      <TopBar title="퍼즐 완성" onBack={onBack} withBorder />

      <Image source={{ uri: solveCompleteCelebrationAsset }} style={styles.solvedCompleteCelebration} resizeMode="cover" />
      <Text style={styles.solvedCompleteTitle}>
        <Text style={styles.completeTitleAccent}>퍼즐</Text>이 완성됐어요!
      </Text>
      <Text style={styles.solvedCompleteSubtitle}>완성된 퍼즐을 확인해보세요.</Text>

      <View style={styles.solvedCompletePuzzleFrame}>
        <Image source={{ uri: puzzleUri }} style={styles.solvedCompletePuzzleImage} resizeMode="cover" />
      </View>

      <Pressable style={({ pressed }) => [styles.solvedSaveButton, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>로그인하고 저장하기</Text>
      </Pressable>

      <View style={styles.solvedLoginNotice}>
        <Text style={styles.solvedLoginNoticeTitle}>이 순간을 함께 나누고 싶다면?</Text>
        <Text style={styles.solvedLoginNoticeBody}>나만의 퍼즐을 만들어 선물해보세요.</Text>
        <Image source={{ uri: solveCompletePuzzleAsset }} style={styles.solvedLoginNoticeImage} resizeMode="cover" />
      </View>
    </View>
  );
}

function DrawPanel({
  penColor,
  penWidth,
  onColorChange,
  onWidthChange,
}: {
  penColor: string;
  penWidth: number;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
}) {
  const colors = ['#f14444', '#f7821b', '#ffcb05', '#b0db4a', '#37b83f', '#297af4', '#914fec', '#ed72bd', '#ecc192', '#feffff', '#000', '#fff'];

  return (
    <View style={styles.panelBody}>
      <View style={styles.colorGrid}>
        {colors.map((color, index) => (
          <Pressable
            key={`${color}-${index}`}
            onPress={() => onColorChange(color)}
            style={[styles.colorSwatch, { backgroundColor: color }, penColor === color && styles.selectedSwatch]}
          />
        ))}
      </View>
      <Text style={styles.sliderLabel}>펜 굵기</Text>
      <View
        style={styles.sliderTrack}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(event) => onWidthChange(widthFromSlider(event.nativeEvent.locationX))}
        onResponderMove={(event) => onWidthChange(widthFromSlider(event.nativeEvent.locationX))}
      >
        <View style={[styles.sliderFill, { width: sliderOffsetFromWidth(penWidth) }]} />
        <View style={[styles.sliderThumb, { left: sliderOffsetFromWidth(penWidth) - 7 }]} />
      </View>
      <Text style={styles.sliderValue}>{penWidth}px</Text>
    </View>
  );
}

function TextPanel() {
  return (
    <View style={styles.panelBody}>
      <TextInput style={styles.textBox} placeholder="텍스트를 입력하세요" placeholderTextColor="rgba(90,89,89,0.5)" multiline />
      <Text style={styles.textColorLabel}>글자 색상</Text>
      <View style={styles.textColorRow}>
        {['#f14444', '#f7821b', '#ffcb05', '#b0db4a', '#37b83f', '#297af4', '#fff', '#000'].map((color, index) => (
          <View key={`${color}-${index}`} style={[styles.textColorSwatch, { backgroundColor: color }]} />
        ))}
      </View>
    </View>
  );
}

function TextPanelEditor({
  text,
  textColor,
  onTextChange,
  onColorChange,
}: {
  text: string;
  textColor: string;
  onTextChange: (text: string) => void;
  onColorChange: (color: string) => void;
}) {
  const colors = ['#f14444', '#f7821b', '#ffcb05', '#b0db4a', '#37b83f', '#297af4', '#fff', '#000'];

  return (
    <View style={styles.panelBody}>
      <TextInput
        style={styles.textBox}
        value={text}
        onChangeText={onTextChange}
        placeholder="텍스트를 입력하세요"
        placeholderTextColor="rgba(90,89,89,0.5)"
        multiline
      />
      <Text style={styles.textColorLabel}>글자 색상</Text>
      <View style={styles.textColorRow}>
        {colors.map((color, index) => (
          <Pressable
            key={`${color}-${index}`}
            onPress={() => onColorChange(color)}
            style={[styles.textColorSwatch, { backgroundColor: color }, textColor === color && styles.selectedSwatch]}
          />
        ))}
      </View>
    </View>
  );
}

function TopBar({ title, onBack, withBorder = false }: { title: string; onBack: () => void; withBorder?: boolean }) {
  return (
    <View style={[styles.topBar, withBorder && styles.topBarBorder]}>
      <Pressable onPress={onBack} hitSlop={12} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>
      <Text style={styles.topBarTitle}>{title}</Text>
    </View>
  );
}

type PuzzleCropProps = {
  image: string;
  style: StyleProp<ViewStyle>;
  cropStyle: StyleProp<ImageStyle>;
  opacity: number;
};

function PuzzleCrop({ image, style, cropStyle, opacity }: PuzzleCropProps) {
  return (
    <View style={[styles.cropBox, style, { opacity }]}>
      <Image source={{ uri: image }} style={[styles.cropImage, cropStyle]} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  screen: {
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
    backgroundColor: '#fff',
  },
  cropBox: {
    position: 'absolute',
    overflow: 'hidden',
  },
  cropImage: {
    position: 'absolute',
  },
  splashHeroPuzzleWrap: {
    position: 'absolute',
    left: 67,
    top: 64,
    width: 267,
    height: 247,
    overflow: 'hidden',
  },
  splashHeroPuzzle: {
    position: 'absolute',
    left: -69,
    top: 0,
    width: 370,
    height: 247,
  },
  splashArm: {
    position: 'absolute',
    left: -9,
    top: 206,
    width: 164,
    height: 129,
  },
  splashCopyBlock: {
    position: 'absolute',
    left: 31,
    top: 392,
  },
  splashHeadline: {
    color: '#030303',
    fontSize: 30,
    lineHeight: 43,
    fontWeight: '900',
    letterSpacing: 0,
  },
  splashBrand: {
    marginTop: 23,
    color: '#b38cfb',
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '900',
    letterSpacing: 0,
  },
  splashPinkPuzzle: {
    left: 320,
    top: 345,
    width: 56,
    height: 56,
    transform: [{ rotate: '19.1deg' }],
  },
  splashPinkCrop: {
    left: -107,
    top: -9,
    width: 198,
    height: 133,
  },
  splashPurplePuzzle: {
    left: 322,
    top: 409,
    width: 41,
    height: 35,
    transform: [{ rotate: '-12.42deg' }],
  },
  splashPurpleCrop: {
    left: -22,
    top: -42,
    width: 127,
    height: 85,
  },
  splashMintPuzzle: {
    left: -7,
    top: 740,
    width: 118,
    height: 101,
  },
  splashMintCrop: {
    left: -51,
    top: -16,
    width: 340,
    height: 228,
  },
  primaryButton: {
    position: 'absolute',
    left: 29,
    top: 694,
    width: 343,
    height: 54,
    borderRadius: 8,
    backgroundColor: '#2d3440',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.86,
  },
  primaryText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0,
  },
  chevron: {
    position: 'absolute',
    right: 27,
    top: 10,
    color: '#fff',
    fontSize: 38,
    lineHeight: 38,
    fontWeight: '300',
  },
  splashLoginText: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 770,
    color: '#9f9f9f',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  receivedHeroPuzzleWrap: {
    position: 'absolute',
    left: 67,
    top: 93,
    width: 267,
    height: 247,
    overflow: 'hidden',
  },
  receivedHeroPuzzle: {
    position: 'absolute',
    left: -69,
    top: 0,
    width: 370,
    height: 247,
  },
  receivedArm: {
    position: 'absolute',
    left: -2,
    top: 235,
    width: 164,
    height: 129,
  },
  receivedCopyBlock: {
    position: 'absolute',
    left: 38,
    top: 415,
  },
  receivedHeadline: {
    color: '#030303',
    fontSize: 30,
    lineHeight: 43,
    fontWeight: '900',
    letterSpacing: 0,
  },
  receivedBrand: {
    marginTop: 23,
    color: '#b38cfb',
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '900',
    letterSpacing: 0,
  },
  receivedPinkPuzzle: {
    left: 333,
    top: 377,
    width: 56,
    height: 56,
    transform: [{ rotate: '19.1deg' }],
  },
  receivedPinkCrop: {
    left: -107,
    top: -9,
    width: 198,
    height: 133,
  },
  receivedPurplePuzzle: {
    left: 333,
    top: 450,
    width: 105,
    height: 90,
    transform: [{ rotate: '-12.42deg' }],
  },
  receivedPurpleCrop: {
    left: -57,
    top: -109,
    width: 327,
    height: 218,
  },
  receivedMintPuzzle: {
    left: -8,
    top: 797,
    width: 118,
    height: 101,
  },
  receivedMintCrop: {
    left: -51,
    top: -16,
    width: 340,
    height: 228,
  },
  receivedButton: {
    position: 'absolute',
    left: 29,
    top: 735,
    width: 343,
    height: 54,
    borderRadius: 8,
    backgroundColor: '#2d3440',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    zIndex: 20,
  },
  topBarBorder: {
    borderBottomWidth: 1.2,
    borderBottomColor: '#e6e7e9',
  },
  backButton: {
    position: 'absolute',
    left: 14,
    top: 12,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: '#141517',
    fontSize: 38,
    lineHeight: 38,
    fontWeight: '300',
  },
  topBarTitle: {
    color: '#141517',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0,
  },
  photoPuzzleArea: {
    position: 'absolute',
    left: 32,
    top: 81,
    width: 325,
    height: 295,
  },
  photoPuzzleWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 325,
    height: 295,
    overflow: 'hidden',
  },
  photoPuzzle: {
    position: 'absolute',
    left: -59,
    top: 0,
    width: 442,
    height: 295,
  },
  uploadIcon: {
    position: 'absolute',
    left: 136,
    top: 103,
    width: 63,
    height: 63,
  },
  photoPrompt: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 180,
    color: '#9f9f9f',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  cardPinkPuzzle: {
    left: 28,
    top: 93,
    width: 63,
    height: 60,
    transform: [{ rotate: '-155.05deg' }],
  },
  cardPinkCrop: {
    left: -108,
    top: -7,
    width: 202,
    height: 135,
  },
  cardPurplePuzzle: {
    left: 340,
    top: 372,
    width: 42,
    height: 36,
    transform: [{ rotate: '-12.42deg' }],
  },
  cardPurpleCrop: {
    left: -23,
    top: -43,
    width: 131,
    height: 87,
  },
  cardSmallYellowPuzzle: {
    left: 301,
    top: 461,
    width: 33,
    height: 30,
    transform: [{ rotate: '13.52deg' }],
  },
  cardSmallYellowCrop: {
    left: -56,
    top: -34,
    width: 105,
    height: 70,
  },
  cardTitleBlock: {
    position: 'absolute',
    left: 36,
    right: 36,
    top: 423,
    alignItems: 'center',
  },
  cardTitleLine: {
    color: '#030303',
    fontSize: 27,
    lineHeight: 40,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0,
  },
  cardTitleAccent: {
    color: '#ac81ff',
  },
  cardDescription: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 545,
    color: 'rgba(3,3,3,0.58)',
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  cardSelectButton: {
    position: 'absolute',
    left: 29,
    top: 694,
    width: 343,
    height: 54,
    borderRadius: 8,
    backgroundColor: '#2d3440',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHelperText: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 770,
    color: '#9f9f9f',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 58,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
    backgroundColor: '#fff',
    zIndex: 15,
  },
  activeTab: {
    position: 'absolute',
    left: 50,
    top: 20,
    width: 110,
    color: '#ab81ff',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0,
  },
  inactiveTab: {
    position: 'absolute',
    left: 242,
    top: 20,
    width: 110,
    color: '#666',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  activeTabLine: {
    position: 'absolute',
    left: 0,
    bottom: -1,
    width: 200,
    height: 2,
    backgroundColor: '#ab81ff',
  },
  photoGrid: {
    position: 'absolute',
    left: GRID_LEFT,
    top: GRID_TOP,
    width: 368,
    height: 580,
  },
  photoTile: {
    position: 'absolute',
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    backgroundColor: '#e3e3e3',
    overflow: 'hidden',
  },
  selectedPhotoTile: {
    borderWidth: 3,
    borderColor: '#78ecd9',
  },
  loadedPhoto: {
    width: '100%',
    height: '100%',
  },
  dimOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(19,19,19,0.3)',
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    top: 701,
    width: 403,
    height: 173,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.22,
    shadowRadius: 50,
    zIndex: 30,
  },
  makeButton: {
    position: 'absolute',
    left: 29,
    top: 24,
    width: 343,
    height: 54,
    borderRadius: 8,
    backgroundColor: '#2d3440',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#d9d9d9',
  },
  solveCounter: {
    position: 'absolute',
    right: 17,
    top: 126,
    width: 86,
    height: 33,
    borderRadius: 20,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  solveCounterIcon: {
    width: 23,
    height: 18,
  },
  solveCounterText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  solveCounterDone: {
    color: '#ab81ff',
  },
  solveCounterTotal: {
    color: '#cecece',
  },
  solveBoard: {
    position: 'absolute',
    left: 44,
    top: 187,
    width: 302,
    height: 302,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
    flexDirection: 'row',
    flexWrap: 'wrap',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  emptySolveBoardImage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 302,
    height: 302,
  },
  solvedBoard: {
    left: 26,
    top: 178,
    width: 337,
    height: 305,
  },
  solvedPuzzleImage: {
    width: '100%',
    height: '100%',
  },
  solveSlot: {
    width: 100.67,
    height: 100.67,
    backgroundColor: 'transparent',
  },
  solvePlacedPiece: {
    width: '100%',
    height: '100%',
  },
  solveTray: {
    position: 'absolute',
    left: 43,
    top: 526,
    width: 330,
    height: 136,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    justifyContent: 'center',
  },
  solvePieceRow: {
    height: 136,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 28,
  },
  solvePieceButton: {
    width: 108,
    height: 108,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedSolvePiece: {
    borderColor: '#ab81ff',
    transform: [{ scale: 1.04 }],
  },
  draggingSolvePiece: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 10,
    zIndex: 60,
    opacity: 0.94,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  solvePieceImage: {
    width: '100%',
    height: '100%',
  },
  solveEmptyTrayText: {
    color: '#9f9f9f',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  solveArrowLeft: {
    position: 'absolute',
    left: -20,
    top: 45,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  solveArrowRight: {
    position: 'absolute',
    right: -20,
    top: 45,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  solveArrowText: {
    color: '#9f9f9f',
    fontSize: 30,
    lineHeight: 31,
    fontWeight: '300',
  },
  disabledSolveArrow: {
    opacity: 0.35,
  },
  solveBottomSheet: {
    position: 'absolute',
    left: -7,
    top: 708,
    width: 403,
    height: 173,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: 5 },
  },
  solveCompleteButton: {
    position: 'absolute',
    left: 44,
    top: 24,
    width: 343,
    height: 54,
    borderRadius: 8,
    backgroundColor: '#2d3440',
    alignItems: 'center',
    justifyContent: 'center',
  },
  solveHelperText: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 96,
    color: '#9f9f9f',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  solvedCompleteCelebration: {
    position: 'absolute',
    left: 161,
    top: 136,
    width: 67,
    height: 100,
  },
  solvedCompleteTitle: {
    position: 'absolute',
    left: 36,
    top: 241,
    width: 318,
    color: '#030303',
    fontSize: 27,
    lineHeight: 40,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0,
  },
  solvedCompleteSubtitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 288,
    color: '#9f9f9f',
    fontSize: 17,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  solvedCompletePuzzleFrame: {
    position: 'absolute',
    left: 22,
    top: 334,
    width: 347,
    height: 314,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(42,42,42,0.45)',
    overflow: 'hidden',
    backgroundColor: '#d3d3d3',
  },
  solvedCompletePuzzleImage: {
    width: '100%',
    height: '100%',
  },
  solvedSaveButton: {
    position: 'absolute',
    left: 29,
    top: 686,
    width: 343,
    height: 54,
    borderRadius: 8,
    backgroundColor: '#2d3440',
    alignItems: 'center',
    justifyContent: 'center',
  },
  solvedLoginNotice: {
    position: 'absolute',
    left: 24,
    top: 754,
    width: 342,
    height: 74,
    borderRadius: 7,
    backgroundColor: 'rgba(171,129,255,0.1)',
    overflow: 'hidden',
  },
  solvedLoginNoticeTitle: {
    position: 'absolute',
    left: 15,
    top: 13,
    color: '#141517',
    fontSize: 15,
    lineHeight: 28,
    fontWeight: '700',
  },
  solvedLoginNoticeBody: {
    position: 'absolute',
    left: 15,
    top: 42,
    color: '#6933d5',
    fontSize: 13,
    fontWeight: '400',
  },
  solvedLoginNoticeImage: {
    position: 'absolute',
    right: 25,
    top: 3,
    width: 55,
    height: 66,
  },
  bottomHelperText: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 96,
    color: '#9f9f9f',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  puzzlePreview: {
    position: 'absolute',
    left: 30,
    top: 89,
    width: 330,
    height: 330,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(42,42,42,0.24)',
    backgroundColor: '#d3d3d3',
    overflow: 'hidden',
  },
  puzzlePreviewImage: {
    width: '100%',
    height: '100%',
  },
  drawingOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 330,
    height: 330,
  },
  drawingHitArea: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 330,
    height: 330,
    zIndex: 5,
  },
  textHitArea: {
    zIndex: 8,
  },
  puzzleTextSticker: {
    position: 'absolute',
    width: 140,
    minHeight: 32,
    zIndex: 7,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  activePuzzleTextSticker: {
    textDecorationLine: 'underline',
  },
  puzzleSizeBadge: {
    position: 'absolute',
    left: 14,
    bottom: 15,
    width: 71,
    height: 25,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    zIndex: 10,
  },
  puzzleBadgeIcon: {
    width: 16,
    height: 16,
  },
  puzzleBadgeText: {
    color: '#fff',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '500',
  },
  imageBadge: {
    position: 'absolute',
    right: 12,
    top: 10,
    width: 32,
    height: 25,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  imageBadgeIcon: {
    width: 16,
    height: 16,
  },
  puzzleControls: {
    position: 'absolute',
    left: 36,
    top: 509,
    width: 330,
    height: 227,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(129,129,129,0.2)',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  toolTabs: {
    height: 43,
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
  },
  toolTab: {
    width: 165,
    height: 43,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeToolTab: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  toolTabText: {
    color: '#9f9f9f',
    fontSize: 15,
    fontWeight: '500',
  },
  activeToolTabText: {
    color: '#ab81ff',
    fontWeight: '700',
  },
  panelBody: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 43,
    bottom: 0,
  },
  colorGrid: {
    position: 'absolute',
    left: 28,
    top: 22,
    width: 276,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  selectedSwatch: {
    borderWidth: 3,
    borderColor: '#ab81ff',
  },
  sliderLabel: {
    position: 'absolute',
    left: 28,
    top: 132,
    color: 'rgba(90,89,89,0.7)',
    fontSize: 13,
    fontWeight: '700',
  },
  sliderTrack: {
    position: 'absolute',
    left: 28,
    top: 159,
    width: 242,
    height: 5,
    borderRadius: 50,
    backgroundColor: '#e6e5e6',
  },
  sliderFill: {
    height: 5,
    borderRadius: 50,
    backgroundColor: '#626262',
  },
  sliderThumb: {
    position: 'absolute',
    left: 91,
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#626262',
  },
  sliderValue: {
    position: 'absolute',
    right: 27,
    top: 151,
    color: 'rgba(90,89,89,0.7)',
    fontSize: 12,
    fontWeight: '700',
  },
  textBox: {
    position: 'absolute',
    left: 17,
    top: 17,
    width: 293,
    height: 71,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(129,129,129,0.2)',
    paddingHorizontal: 10,
    paddingTop: 10,
    color: '#141517',
    fontSize: 12,
    textAlignVertical: 'top',
  },
  textColorLabel: {
    position: 'absolute',
    left: 20,
    top: 103,
    color: 'rgba(90,89,89,0.7)',
    fontSize: 13,
    fontWeight: '700',
  },
  textColorRow: {
    position: 'absolute',
    left: 20,
    top: 122,
    flexDirection: 'row',
    gap: 7,
  },
  textColorSwatch: {
    width: 31,
    height: 30,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  undoButton: {
    position: 'absolute',
    left: 279,
    top: 426,
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redoButton: {
    position: 'absolute',
    left: 309,
    top: 426,
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashButton: {
    position: 'absolute',
    left: 343,
    top: 426,
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyIcon: {
    width: 16,
    height: 16,
    opacity: 0.72,
  },
  undoIcon: {
    transform: [{ rotate: '90deg' }],
  },
  redoIcon: {
    transform: [{ rotate: '-90deg' }],
  },
  trashIcon: {
    width: 17,
    height: 15,
    opacity: 0.72,
  },
  completeButton: {
    position: 'absolute',
    left: 29,
    top: 782,
    width: 343,
    height: 54,
    borderRadius: 8,
    backgroundColor: '#2d3440',
    alignItems: 'center',
    justifyContent: 'center',
  },
  celebrationImage: {
    position: 'absolute',
    left: 168,
    top: 136,
    width: 67,
    height: 100,
  },
  completeTitle: {
    position: 'absolute',
    left: 36,
    right: 36,
    top: 241,
    color: '#030303',
    fontSize: 27,
    lineHeight: 40,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0,
  },
  completeTitleAccent: {
    color: '#ab81ff',
  },
  completeSubtitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 292,
    color: '#9f9f9f',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  completedPuzzleFrame: {
    position: 'absolute',
    left: 30,
    top: 334,
    width: 330,
    height: 330,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(42,42,42,0.45)',
    overflow: 'hidden',
    backgroundColor: '#d3d3d3',
  },
  completedPuzzleImage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 330,
    height: 330,
  },
  completedDrawingOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 330,
    height: 330,
  },
  completedTextSticker: {
    position: 'absolute',
    width: 140,
    minHeight: 32,
    zIndex: 5,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  shareButton: {
    position: 'absolute',
    left: 29,
    top: 686,
    width: 343,
    height: 54,
    borderRadius: 8,
    backgroundColor: '#2d3440',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginNotice: {
    position: 'absolute',
    left: 30,
    top: 754,
    width: 342,
    height: 74,
    borderRadius: 7,
    backgroundColor: 'rgba(171,129,255,0.1)',
    overflow: 'hidden',
  },
  loginNoticeTitle: {
    position: 'absolute',
    left: 15,
    top: 13,
    color: '#141517',
    fontSize: 15,
    lineHeight: 28,
    fontWeight: '700',
  },
  loginNoticeBody: {
    position: 'absolute',
    left: 15,
    top: 41,
    width: 249,
    color: '#6933d5',
    fontSize: 13,
    fontWeight: '400',
  },
  loginNoticeImage: {
    position: 'absolute',
    right: 18,
    top: 3,
    width: 55,
    height: 66,
  },
});
