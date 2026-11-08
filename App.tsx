import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  Image,
  ImageSourcePropType,
  ImageStyle,
  LayoutChangeEvent,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';

import {
  aiPromptPreviewAsset,
  aiPromptSparkleAsset,
  cardStartPhotoPlaceholderIconAsset,
  cardStartPuzzleFrameAsset,
  cardStartPuzzleSheetAsset,
  celebrationAsset,
  decoratePencilIconAsset,
  decorateTextIconAsset,
  mainBannerCharacterAsset,
  mainEmptySentEnvelopeAsset,
  mainHeartFilledIconAsset,
  mainLogoAsset,
  mainMenuTextRightIconAsset,
  mainNotificationBellIconAsset,
  mainPinkGiftPuzzleAsset,
  mainPracticePuzzleAsset,
  mainModalCloseIconAsset,
  mainReceivedNotificationPuzzleAsset,
  mainReceivedPurplePuzzleAsset,
  mainShareArrowIconAsset,
  mainTabBookHalfIconAsset,
  mainTabBookOutlineIconAsset,
  mainTabGlowIconAsset,
  mainTabHomeFilledIconAsset,
  mainTabPersonFilledIconAsset,
  mainTabPuzzleFilledIconAsset,
  mainYellowGiftPuzzleAsset,
  practicePuzzlePhotoUri,
  profileChevronRightIconAsset,
  profilePuzzleAvatarAsset,
  loginPuzzleAsset,
  puzzleSizeBadgeIconAsset,
  redoIconAsset,
  solveCounterPuzzleIconAsset,
  sharedPublicLockFillIconAsset,
  sharedPublicModalCloseIconAsset,
  linkCreatedPuzzleAsset,
  splashBlackArmAsset,
  splashChevronRightIconAsset,
  splashPuzzleSheetAsset,
  splashYellowPuzzleAsset,
  trashIconAsset,
  undoIconAsset,
} from './src/assets';
import {
  AuthAccount,
  AuthCredentials,
  authenticateAccount,
  deleteAccount,
  findProfileBySlug,
  getCachedAccount,
  getDisplayNameFromSlug,
  PublicProfile,
  restoreAccount,
  signOut,
} from './src/authStore';
import { clearLegacyLocalData } from './src/browserStorage';
import { BODY_FONT_FAMILY, DISPLAY_FONT_FAMILY, loadWebFonts } from './src/fonts';
import {
  claimSentPuzzle,
  getPuzzle,
  listProfilePuzzles,
  listReceivedPuzzles,
  listSentPuzzles,
  markPuzzleSolved,
  PuzzleRecord,
  ReceivedPuzzle,
  receivePuzzle,
  savePuzzle,
} from './src/puzzleStore';
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
  WebCopyDocument,
  WebDocument,
  WebNavigator,
  WebUrl,
} from './src/types';
import {
  createDrawingOverlay,
  createEmptyPuzzleBoard,
  createPuzzleArtworkImage,
  createPuzzleImage,
  createPuzzlePieces,
  getShareUrl,
  getSharedProfileSlug,
  getSharedPuzzleId,
  getPuzzlePieceMargin,
  getProfileShareUrl,
  isSharedLink,
  sliderOffsetFromWidth,
  widthFromSlider,
} from './src/puzzleUtils';

const EMPTY_PHOTO_URIS: string[] = [];
const DRAW_COLORS = ['#f14444', '#f7821b', '#ffcb05', '#b0db4a', '#37b83f', '#297af4', '#914fec', '#ed72bd', '#ecc192', '#feffff', '#000', '#fff'];
const TEXT_COLORS = ['#f14444', '#f7821b', '#ffcb05', '#b0db4a', '#37b83f', '#297af4', '#fff', '#000'];
const AI_PUZZLE_ARTWORK_URI = '/images/ai-puzzle-artwork-sunset.png';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PUBLIC_PUZZLE_COLORS = ['#f7d8df', '#dccbff', '#cde8ff', '#ffe6a8', '#e9eef2', '#f5d6bf'];

type SolveTarget = {
  // null이면 연습용 퍼즐이라 풀어도 퍼즐함에 저장하지 않는다.
  puzzleId: string | null;
  sourceUri: string;
  gridSize: GridSize;
};

type PendingAuthAction = { type: 'claimSent' | 'saveSolved'; puzzleId: string };

const PRACTICE_SOLVE_TARGET: SolveTarget = { puzzleId: null, sourceUri: practicePuzzlePhotoUri, gridSize: 3 };

// 다른 화면에서 들어온 기록이 없을 때 뒤로 가기가 향하는 화면.
const DEFAULT_BACK_SCREEN: Partial<Record<ScreenName, ScreenName>> = {
  photos: 'card',
  puzzle: 'photos',
  aiDecorate: 'puzzle',
  complete: 'puzzle',
  solve: 'receivedSplash',
  solveComplete: 'solve',
  linkCreated: 'card',
  puzzleBox: 'card',
  profile: 'card',
};

export default function App() {
  const sharedPuzzleId = useMemo(() => getSharedPuzzleId(), []);
  const sharedProfileSlug = useMemo(() => getSharedProfileSlug(), []);
  const [screen, setScreen] = useState<ScreenName>(() => {
    if (sharedPuzzleId) {
      return 'receivedSplash';
    }
    return isSharedLink() ? 'received' : 'splash';
  });
  const [backScreens, setBackScreens] = useState<Partial<Record<ScreenName, ScreenName>>>({});
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  // 지금 꾸미는 사진으로 이미 만든 퍼즐. 꾸미기로 돌아가 다시 완성하면 새로 만들지 않고 덮어쓴다.
  const [draftPuzzleId, setDraftPuzzleId] = useState<string | null>(null);
  // 프로필 링크로 들어와 만드는 퍼즐이면 그 링크 주인에게 보낸다.
  const [draftRecipientSlug, setDraftRecipientSlug] = useState<string | null>(null);
  const [completedPuzzle, setCompletedPuzzle] = useState<PuzzleRecord | null>(null);
  const [solveTarget, setSolveTarget] = useState<SolveTarget>(PRACTICE_SOLVE_TARGET);
  const [currentAccount, setCurrentAccount] = useState<AuthAccount | null>(() => getCachedAccount());
  const [pendingAuthAction, setPendingAuthAction] = useState<PendingAuthAction | null>(null);
  const [puzzleBoxTab, setPuzzleBoxTab] = useState<'received' | 'sent'>('received');
  const [dismissedNoticePuzzleId, setDismissedNoticePuzzleId] = useState<string | null>(null);
  const [libraryVersion, setLibraryVersion] = useState(0);
  const selectedPhotoUri = selectedPhotoIndex === null ? null : photoUris[selectedPhotoIndex];
  const { width, height } = useWindowDimensions();
  const [viewportSize, setViewportSize] = useState({ width, height });
  const scale = getResponsiveScale(viewportSize.width, viewportSize.height);
  const screenViewportRef = useRef<View>(null);
  // 디자인 좌표 (0,0)이 지금 화면 어디에 있는지. 세로로 스크롤된 만큼도 반영돼야 퍼즐 조각을 끌어 놓을 자리가 맞는다.
  const getScreenOrigin = useCallback(() => {
    const node = screenViewportRef.current as unknown as { getBoundingClientRect?: () => { left: number; top: number } } | null;
    const rect = node?.getBoundingClientRect?.();
    const webWindow = globalThis as unknown as { scrollX?: number; scrollY?: number };
    if (rect) {
      return { x: rect.left + (webWindow.scrollX ?? 0), y: rect.top + (webWindow.scrollY ?? 0) };
    }
    return {
      x: Math.max(0, (viewportSize.width - DESIGN_WIDTH * scale) / 2),
      y: Math.max(0, (viewportSize.height - DESIGN_HEIGHT * scale) / 2),
    };
  }, [viewportSize, scale]);

  const [receivedPuzzles, setReceivedPuzzles] = useState<ReceivedPuzzle[]>([]);
  const [sentPuzzles, setSentPuzzles] = useState<PuzzleRecord[]>([]);
  const [sharedProfile, setSharedProfile] = useState<PublicProfile | null>(null);
  const [sharedProfilePuzzles, setSharedProfilePuzzles] = useState<ReceivedPuzzle[]>([]);
  const currentAccountId = currentAccount?.id ?? null;
  const noticePuzzle = receivedPuzzles.find((puzzle) => puzzle.solvedAt === null && puzzle.id !== dismissedNoticePuzzleId) ?? null;
  const sharedProfileName = sharedProfile?.name ?? (sharedProfileSlug ? getDisplayNameFromSlug(sharedProfileSlug) : '친구');
  const refreshLibrary = () => setLibraryVersion((current) => current + 1);

  // 서버 데이터가 바뀔 만한 일을 하고 나면 libraryVersion을 올려서 목록을 다시 받아온다.
  useEffect(() => {
    if (!currentAccountId) {
      setReceivedPuzzles([]);
      setSentPuzzles([]);
      return;
    }

    let isActive = true;
    Promise.all([listReceivedPuzzles(), listSentPuzzles()])
      .then(([received, sent]) => {
        if (isActive) {
          setReceivedPuzzles(received);
          setSentPuzzles(sent);
        }
      })
      .catch(() => {
        if (isActive) {
          showToast('퍼즐함을 불러오지 못했어요. 인터넷 연결을 확인해주세요.');
        }
      });
    return () => {
      isActive = false;
    };
  }, [currentAccountId, libraryVersion]);

  useEffect(() => {
    if (!sharedProfileSlug) {
      return;
    }

    let isActive = true;
    Promise.all([findProfileBySlug(sharedProfileSlug), listProfilePuzzles(sharedProfileSlug)])
      .then(([profile, puzzles]) => {
        if (isActive) {
          setSharedProfile(profile);
          setSharedProfilePuzzles(puzzles);
        }
      })
      .catch(() => {
        // 이름은 링크에서 되살린 값으로 보여주고, 공개 퍼즐만 비워둔다.
      });
    return () => {
      isActive = false;
    };
  }, [sharedProfileSlug, libraryVersion]);

  // 다른 사람이 보낸 퍼즐이 들어왔을 수 있으니 홈이나 퍼즐함으로 올 때마다 다시 받아온다.
  useEffect(() => {
    if (screen === 'card' || screen === 'puzzleBox') {
      refreshLibrary();
    }
  }, [screen]);

  const handleRootLayout = useCallback((event: LayoutChangeEvent) => {
    const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
    setViewportSize((current) => {
      if (Math.abs(current.width - nextWidth) < 0.5 && Math.abs(current.height - nextHeight) < 0.5) {
        return current;
      }
      return { width: nextWidth, height: nextHeight };
    });
  }, []);

  useEffect(() => {
    loadWebFonts();
    clearLegacyLocalData();

    // 기억해 둔 계정으로 먼저 그리고, 서버 세션으로 다시 확인한다.
    let isActive = true;
    restoreAccount().then((account) => {
      // undefined면 서버에 못 닿은 것이라 지금 계정을 그대로 둔다.
      if (isActive && account !== undefined) {
        setCurrentAccount(account);
      }
    });
    return () => {
      isActive = false;
    };
  }, []);

  // 로그인한 채로 공유 링크를 열면 그 퍼즐을 받은 퍼즐에 담아둔다.
  useEffect(() => {
    if (currentAccountId && sharedPuzzleId) {
      receivePuzzle(sharedPuzzleId)
        .then(refreshLibrary)
        .catch(() => {
          // 퍼즐을 여는 데는 문제가 없으니 조용히 넘어간다. 다 맞추면 다시 담긴다.
        });
    }
  }, [currentAccountId, sharedPuzzleId]);

  useEffect(() => {
    return () => {
      const webUrl = (globalThis as unknown as { URL?: WebUrl }).URL;
      if (webUrl) {
        photoUris.forEach((uri) => webUrl.revokeObjectURL(uri));
      }
    };
  }, [photoUris]);

  // 뒤로 가기가 지금 화면으로 돌아오도록 기록하고 이동한다.
  const navigate = (nextScreen: ScreenName, backScreen: ScreenName = screen) => {
    setBackScreens((current) => ({ ...current, [nextScreen]: backScreen }));
    setScreen(nextScreen);
  };

  const goBack = () => {
    setScreen(backScreens[screen] ?? DEFAULT_BACK_SCREEN[screen] ?? 'splash');
  };

  const openLogin = (pendingAction: PendingAuthAction | null) => {
    setPendingAuthAction(pendingAction);
    navigate('login');
  };

  const handleAuthSubmit = async (credentials: AuthCredentials) => {
    const result = await authenticateAccount(credentials);
    if (!result.account) {
      return result.error;
    }

    const account = result.account;
    let nextScreen: ScreenName = credentials.mode === 'signup' ? 'linkCreated' : 'card';
    try {
      if (sharedPuzzleId) {
        await receivePuzzle(sharedPuzzleId);
      }
      if (pendingAuthAction) {
        if (pendingAuthAction.type === 'claimSent') {
          await claimSentPuzzle(pendingAuthAction.puzzleId);
          setPuzzleBoxTab('sent');
        } else {
          await markPuzzleSolved(pendingAuthAction.puzzleId);
          setPuzzleBoxTab('received');
        }
        if (credentials.mode === 'login') {
          nextScreen = 'puzzleBox';
        }
        setPendingAuthAction(null);
      }
    } catch {
      showToast('퍼즐을 퍼즐함에 담지 못했어요. 잠시 후 다시 시도해주세요.');
    }

    setCurrentAccount(account);
    refreshLibrary();
    setScreen(nextScreen);
    return null;
  };

  const handleLogout = async () => {
    await signOut();
    setCurrentAccount(null);
    setScreen('splash');
    showToast('로그아웃했어요.');
  };

  const handleDeleteAccount = async () => {
    if (!currentAccount) {
      return;
    }
    try {
      await deleteAccount();
    } catch {
      showToast('탈퇴하지 못했어요. 잠시 후 다시 시도해주세요.');
      return;
    }
    setCurrentAccount(null);
    refreshLibrary();
    setScreen('splash');
    showToast('탈퇴가 완료됐어요.');
  };

  const openPhotoPicker = (recipientSlug: string | null) => {
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
      setDraftPuzzleId(null);
      setDraftRecipientSlug(recipientSlug);
      if (screen !== 'photos') {
        navigate('photos');
      }
    };
    input.click();
  };

  const createPuzzle = () => openPhotoPicker(null);

  const openSolve = (puzzle: PuzzleRecord | null) => {
    setSolveTarget(puzzle ? { puzzleId: puzzle.id, sourceUri: puzzle.sourceUri, gridSize: puzzle.gridSize } : PRACTICE_SOLVE_TARGET);
    navigate('solve');
  };

  const openSharedPuzzle = async () => {
    let puzzle: PuzzleRecord | null = null;
    try {
      puzzle = sharedPuzzleId ? await getPuzzle(sharedPuzzleId) : null;
      if (!puzzle) {
        // 보낸 사람이 탈퇴했거나, 서버에 저장하기 전 버전에서 만든 링크
        showToast('퍼즐을 찾을 수 없어 연습용 퍼즐을 열었어요.');
      }
    } catch {
      showToast('퍼즐을 불러오지 못해 연습용 퍼즐을 열었어요. 인터넷 연결을 확인해주세요.');
    }
    openSolve(puzzle);
  };

  const openSentPuzzle = (puzzle: PuzzleRecord) => {
    setCompletedPuzzle(puzzle);
    navigate('complete');
  };

  const openPuzzleBox = (tab: 'received' | 'sent' = 'received') => {
    setPuzzleBoxTab(tab);
    setScreen('puzzleBox');
  };

  return (
    <SafeAreaView style={styles.root} onLayout={handleRootLayout}>
      <StatusBar style="dark" backgroundColor="#fff" />
      <ScrollView style={styles.rootScroll} contentContainerStyle={styles.rootScrollContent} showsVerticalScrollIndicator={false}>
        <View ref={screenViewportRef} style={[styles.screenViewport, { width: DESIGN_WIDTH * scale, height: DESIGN_HEIGHT * scale }]}>
          <View style={[styles.screen, { transform: [{ scale }], transformOrigin: 'top left' }]}>
            {screen === 'splash' && (
              <SplashScreen
                onStart={() => setScreen('card')}
                onLogin={() => (currentAccount ? setScreen('card') : openLogin(null))}
              />
            )}
            {screen === 'received' && (
              <ReceivedLinkScreen
                recipientName={sharedProfileName}
                publicPuzzles={sharedProfilePuzzles}
                onCreatePuzzle={() => openPhotoPicker(sharedProfileSlug)}
                onOpenPuzzle={openSolve}
              />
            )}
            {screen === 'receivedSplash' && <ReceivedSplashScreen onCheckPuzzle={openSharedPuzzle} />}
            {screen === 'login' && (
              <AuthScreen
                mode="login"
                onBack={goBack}
                onSwitchMode={() => navigate('signup', backScreens.login ?? 'splash')}
                onSubmit={handleAuthSubmit}
              />
            )}
            {screen === 'signup' && (
              <AuthScreen
                mode="signup"
                onBack={goBack}
                onSwitchMode={() => navigate('login', backScreens.signup ?? 'splash')}
                onSubmit={handleAuthSubmit}
              />
            )}
            {screen === 'linkCreated' && currentAccount && (
              <LinkCreatedScreen account={currentAccount} onBack={() => setScreen('card')} onDone={() => setScreen('card')} />
            )}
            {screen === 'card' && (
              currentAccount ? (
                <HomeScreen
                  account={currentAccount}
                  receivedPuzzles={receivedPuzzles}
                  sentPuzzles={sentPuzzles}
                  noticePuzzle={noticePuzzle}
                  onDismissNotice={(puzzle) => setDismissedNoticePuzzleId(puzzle.id)}
                  onCreatePuzzle={createPuzzle}
                  onOpenPractice={() => openSolve(null)}
                  onOpenReceivedPuzzle={openSolve}
                  onOpenSentPuzzle={openSentPuzzle}
                  onOpenPuzzleBox={() => openPuzzleBox()}
                  onOpenProfile={() => setScreen('profile')}
                />
              ) : (
                <CardCreateScreen onBack={goBack} onPickPhoto={createPuzzle} />
              )
            )}
            {screen === 'puzzleBox' && (
              <PuzzleBoxScreen
                initialTab={puzzleBoxTab}
                receivedPuzzles={receivedPuzzles}
                sentPuzzles={sentPuzzles}
                onBack={() => setScreen('card')}
                onHome={() => setScreen('card')}
                onProfile={() => (currentAccount ? setScreen('profile') : openLogin(null))}
                onCreatePuzzle={createPuzzle}
                onOpenPractice={() => openSolve(null)}
                onOpenReceivedPuzzle={openSolve}
                onOpenSentPuzzle={openSentPuzzle}
              />
            )}
            {screen === 'profile' && currentAccount && (
              <ProfileScreen
                account={currentAccount}
                onBack={() => setScreen('card')}
                onHome={() => setScreen('card')}
                onPuzzleBox={() => openPuzzleBox()}
                onLogout={handleLogout}
                onDeleteAccount={handleDeleteAccount}
              />
            )}
            {screen === 'photos' && (
              <PhotoSelectScreen
                photoUris={photoUris}
                selectedPhotoIndex={selectedPhotoIndex}
                onBack={goBack}
                onPickPhoto={() => openPhotoPicker(draftRecipientSlug)}
                onSelectPhoto={(index) => {
                  setSelectedPhotoIndex(index);
                  setDraftPuzzleId(null);
                }}
                onMakePuzzle={() => setScreen('puzzle')}
              />
            )}
            {screen === 'puzzle' && selectedPhotoUri && (
              <PuzzleDecorateScreen
                photoUri={selectedPhotoUri}
                screenScale={scale}
                onBack={goBack}
                onChangePhoto={() => setScreen('aiDecorate')}
                onComplete={async (sourceUri, gridSize) => {
                  let puzzle: PuzzleRecord;
                  try {
                    puzzle = await savePuzzle({
                      id: draftPuzzleId,
                      sourceUri,
                      gridSize,
                      recipientSlug: draftRecipientSlug,
                    });
                  } catch {
                    showToast('퍼즐을 저장하지 못했어요. 인터넷 연결을 확인해주세요.');
                    return;
                  }
                  setDraftPuzzleId(puzzle.id);
                  setCompletedPuzzle(puzzle);
                  refreshLibrary();
                  navigate('complete');
                }}
              />
            )}
            {screen === 'aiDecorate' && selectedPhotoUri && (
              <AiDecorateScreen
                photoUri={selectedPhotoUri}
                onBack={() => setScreen('puzzle')}
                onSkip={() => setScreen('puzzle')}
                onApply={() => showToast('AI로 꾸미기는 준비 중이에요.')}
              />
            )}
            {screen === 'complete' && completedPuzzle && (
              <PuzzleCompleteScreen
                puzzle={completedPuzzle}
                isLoggedIn={currentAccount !== null}
                onBack={goBack}
                onKeepPuzzle={() =>
                  currentAccount ? openPuzzleBox('sent') : openLogin({ type: 'claimSent', puzzleId: completedPuzzle.id })
                }
              />
            )}
            {screen === 'solve' && (
              <PuzzleSolveScreen
                puzzleSourceUri={solveTarget.sourceUri}
                gridSize={solveTarget.gridSize}
                screenScale={scale}
                getScreenOrigin={getScreenOrigin}
                onBack={goBack}
                onComplete={() => {
                  if (currentAccount && solveTarget.puzzleId) {
                    markPuzzleSolved(solveTarget.puzzleId)
                      .then(refreshLibrary)
                      .catch(() => showToast('다 맞춘 퍼즐을 퍼즐함에 담지 못했어요.'));
                  }
                  setScreen('solveComplete');
                }}
              />
            )}
            {screen === 'solveComplete' && (
              <SolvedPuzzleCompleteScreen
                puzzleUri={solveTarget.sourceUri}
                gridSize={solveTarget.gridSize}
                isPractice={solveTarget.puzzleId === null}
                isLoggedIn={currentAccount !== null}
                onBack={goBack}
                onSave={() => {
                  if (!currentAccount) {
                    openLogin(solveTarget.puzzleId ? { type: 'saveSolved', puzzleId: solveTarget.puzzleId } : null);
                    return;
                  }
                  if (solveTarget.puzzleId) {
                    openPuzzleBox('received');
                    return;
                  }
                  setScreen('card');
                }}
                // 받은 퍼즐을 다 맞춘 사람이 "나도 만들어줄게"를 누르면 사진 고르기 대신 푸러봐 첫 화면부터 보여준다.
                onCreatePuzzle={() => setScreen(currentAccount ? 'card' : 'splash')}
              />
            )}
          </View>
        </View>
      </ScrollView>
      <Toast />
    </SafeAreaView>
  );
}

// 웹에서는 Alert.alert가 아무것도 띄우지 않아서, 짧은 안내는 화면 아래 토스트로 보여준다.
let toastListener: ((message: string) => void) | null = null;

function showToast(message: string) {
  toastListener?.(message);
}

function Toast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    toastListener = (nextMessage) => {
      setMessage(nextMessage);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setMessage(null), 2400);
    };
    return () => {
      toastListener = null;
      clearTimeout(hideTimer);
    };
  }, []);

  if (!message) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.toastWrap}>
      <View style={styles.toast}>
        <Text style={styles.toastText}>{message}</Text>
      </View>
    </View>
  );
}

async function shareLink({ title, text, url }: { title: string; text: string; url: string }) {
  const webNavigator = (globalThis as unknown as { navigator?: WebNavigator }).navigator;

  if (webNavigator?.share) {
    try {
      await webNavigator.share({ title, text, url });
      return true;
    } catch (error) {
      // 공유 창을 그냥 닫은 경우엔 조용히 끝낸다.
      if ((error as { name?: string } | null)?.name === 'AbortError') {
        return false;
      }
    }
  }

  // 공유 창이 없는 브라우저에서는 문구까지 같이 복사해서, 붙여넣기만 해도 같은 메시지가 가게 한다.
  if (await copyText(`${text}\n${url}`)) {
    showToast('링크를 복사했어요. 친구에게 붙여넣어 보내주세요.');
    return true;
  }
  showToast('이 브라우저에서는 링크를 공유할 수 없어요.');
  return false;
}

// 카톡 같은 메신저에 링크와 함께 붙는 문구. 받는 사람이 눌러보고 싶게 쓴다.
function getPuzzleShareText(senderName: string | null) {
  return `${senderName ? `${senderName}님이` : '누군가'} 당신에게 퍼즐을 보냈어요 🧩\n조각을 다 맞추면 숨겨둔 메시지가 보여요.`;
}

function getProfileShareText(name: string) {
  return `${name}님에게 하고 싶은 말, 퍼즐로 보내주세요 🧩\n조각을 다 맞춰야 보이는 메시지를 만들 수 있어요.`;
}

async function copyText(text: string) {
  const webNavigator = (globalThis as unknown as { navigator?: WebNavigator }).navigator;
  try {
    if (webNavigator?.clipboard) {
      await webNavigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 앱 안 브라우저처럼 클립보드 권한이 막힌 곳이 있어서 아래 방법으로 한 번 더 시도한다.
  }

  const webDocument = (globalThis as unknown as { document?: WebCopyDocument }).document;
  if (!webDocument?.body) {
    return false;
  }
  const textArea = webDocument.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  webDocument.body.appendChild(textArea);
  textArea.select();
  try {
    return webDocument.execCommand('copy');
  } catch {
    return false;
  } finally {
    webDocument.body.removeChild(textArea);
  }
}

function formatMonthDay(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatFullDate(timestamp: number) {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}.${month}.${day}`;
}

function SplashScreen({ onStart, onLogin }: { onStart: () => void; onLogin: () => void }) {
  return (
    <View style={styles.splashRoot}>
      <View style={styles.splashHeroPuzzleWrap}>
        <Image source={splashYellowPuzzleAsset} style={styles.splashHeroPuzzle} resizeMode="cover" />
      </View>
      <Image source={splashBlackArmAsset} style={styles.splashArm} resizeMode="cover" />

      <View style={styles.splashCopyBlock}>
        <Text style={styles.splashHeadline}>하고 싶은{'\n'}말이 있는데{'\n'}그냥 알려주긴{'\n'}싫어.</Text>
        <Text style={styles.splashBrand}>푸러봐</Text>
      </View>

      <PuzzleCrop image={splashPuzzleSheetAsset} style={styles.splashPinkPuzzle} cropStyle={styles.splashPinkCrop} opacity={0.4} />
      <PuzzleCrop image={splashPuzzleSheetAsset} style={styles.splashPurplePuzzle} cropStyle={styles.splashPurpleCrop} opacity={0.7} />
      <PuzzleCrop image={splashPuzzleSheetAsset} style={styles.splashMintPuzzle} cropStyle={styles.splashMintCrop} opacity={0.4} />

      <Pressable onPress={onStart} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>퍼즐 만들기</Text>
        <Image source={splashChevronRightIconAsset} style={styles.chevronIcon} resizeMode="contain" />
      </Pressable>
      <Pressable onPress={onLogin} style={({ pressed }) => [styles.splashLoginButton, pressed && styles.pressed]}>
        <Text style={styles.splashLoginText}>로그인 · 내 퍼즐함</Text>
      </Pressable>
    </View>
  );
}

function ReceivedSplashScreen({ onCheckPuzzle }: { onCheckPuzzle: () => void }) {
  return (
    <View style={styles.splashRoot}>
      <View style={styles.splashHeroPuzzleWrap}>
        <Image source={splashYellowPuzzleAsset} style={styles.splashHeroPuzzle} resizeMode="cover" />
      </View>
      <Image source={splashBlackArmAsset} style={styles.splashArm} resizeMode="cover" />

      <View style={styles.splashCopyBlock}>
        <Text style={styles.splashHeadline}>누군가{'\n'}당신에게{'\n'}하고 싶은 말이{'\n'}있대요.</Text>
        <Text style={styles.splashBrand}>푸러봐</Text>
      </View>

      <PuzzleCrop image={splashPuzzleSheetAsset} style={styles.splashPinkPuzzle} cropStyle={styles.splashPinkCrop} opacity={0.4} />
      <PuzzleCrop image={splashPuzzleSheetAsset} style={styles.splashPurplePuzzle} cropStyle={styles.splashPurpleCrop} opacity={0.7} />
      <PuzzleCrop image={splashPuzzleSheetAsset} style={styles.splashMintPuzzle} cropStyle={styles.splashMintCrop} opacity={0.4} />

      <Pressable onPress={onCheckPuzzle} style={({ pressed }) => [styles.receivedButton, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>퍼즐 확인하기</Text>
        <Image source={splashChevronRightIconAsset} style={styles.chevronIcon} resizeMode="contain" />
      </Pressable>
    </View>
  );
}

type SharedPublicPuzzleCardProps = {
  backgroundColor: string;
  date: string;
  imageUri: string;
  onPress: () => void;
  locked?: boolean;
};

function SharedPublicPuzzleCard({ backgroundColor, date, imageUri, onPress, locked = false }: SharedPublicPuzzleCardProps) {
  return (
    <Pressable disabled={locked} onPress={onPress} style={({ pressed }) => [styles.sharedPublicPuzzleCard, pressed && styles.pressed]}>
      <View style={[styles.sharedPublicPuzzlePreview, { backgroundColor }]}>
        <Image source={{ uri: imageUri }} style={[styles.sharedPublicPuzzleImage, styles.sharedPublicPuzzlePhoto]} resizeMode="cover" blurRadius={locked ? 7 : 0} />
        {locked && <View style={styles.sharedPublicLockedScrim} />}
        {locked && <Image source={sharedPublicLockFillIconAsset} style={styles.sharedPublicLockIcon} resizeMode="contain" />}
      </View>
      <View style={styles.sharedPublicPuzzleMeta}>
        <Text style={styles.sharedPublicPuzzleDate}>{date}</Text>
        {!locked && (
          <View style={styles.sharedPublicPuzzleLink}>
            <Text style={styles.sharedPublicPuzzleLinkText}>퍼즐 보기</Text>
            <Image source={mainShareArrowIconAsset} style={styles.sharedPublicPuzzleArrow} resizeMode="contain" />
          </View>
        )}
      </View>
    </Pressable>
  );
}

function ReceivedLinkScreen({
  recipientName,
  publicPuzzles,
  onCreatePuzzle,
  onOpenPuzzle,
}: {
  recipientName: string;
  publicPuzzles: ReceivedPuzzle[];
  onCreatePuzzle: () => void;
  onOpenPuzzle: (puzzle: ReceivedPuzzle) => void;
}) {
  const [selectedPublicPuzzle, setSelectedPublicPuzzle] = useState<ReceivedPuzzle | null>(null);
  const isPrivatePublicPuzzles = useMemo(() => {
    const webLocation = (globalThis as unknown as { location?: { search?: string } }).location;
    return webLocation?.search?.includes('private=1') ?? false;
  }, []);
  // 디자인처럼 두 개씩 세 줄까지 보여준다.
  const publicPuzzleRows = useMemo(() => {
    const rows: ReceivedPuzzle[][] = [];
    publicPuzzles.slice(0, 6).forEach((puzzle, index) => {
      if (index % 2 === 0) {
        rows.push([]);
      }
      rows[rows.length - 1].push(puzzle);
    });
    return rows;
  }, [publicPuzzles]);

  return (
    <View style={styles.sharedLinkRoot}>
      <Image source={mainLogoAsset} style={styles.sharedLinkLogo} resizeMode="contain" />

      <View style={styles.sharedLinkBanner}>
        <Text style={styles.sharedLinkBannerTitle}>{recipientName}님에게{'\n'}퍼즐을 만들어주세요!</Text>
        <Text style={styles.sharedLinkBannerDescription}>사진과 하고 싶은 말을 담아{'\n'}특별한 퍼즐로 보내보세요.</Text>
        <Pressable onPress={onCreatePuzzle} style={({ pressed }) => [styles.sharedLinkBannerCta, pressed && styles.pressed]}>
          <Text style={styles.sharedLinkBannerCtaText}>퍼즐 만들어주기!</Text>
          <Image source={mainShareArrowIconAsset} style={styles.sharedLinkBannerArrow} resizeMode="contain" />
        </Pressable>
        <View style={styles.sharedLinkBannerUnderline} />
        <Image source={mainBannerCharacterAsset} style={styles.sharedLinkBannerCharacter} resizeMode="contain" />
      </View>

      <Text style={styles.sharedPublicTitle}>{recipientName}님이 공개한 퍼즐</Text>
      <Text style={styles.sharedPublicCount}>{isPrivatePublicPuzzles ? '0개' : `${publicPuzzles.length}개`}</Text>
      {publicPuzzles.length === 0 ? (
        <Text style={styles.sharedPublicEmptyText}>아직 공개한 퍼즐이 없어요.</Text>
      ) : (
        <View style={styles.sharedPublicGrid}>
          {publicPuzzleRows.map((row, rowIndex) => (
            <View key={`public-row-${rowIndex}`} style={styles.sharedPublicRow}>
              {row.map((puzzle, columnIndex) => (
                <SharedPublicPuzzleCard
                  key={puzzle.id}
                  backgroundColor={PUBLIC_PUZZLE_COLORS[(rowIndex * 2 + columnIndex) % PUBLIC_PUZZLE_COLORS.length]}
                  date={formatMonthDay(puzzle.solvedAt ?? puzzle.receivedAt)}
                  imageUri={puzzle.sourceUri}
                  locked={isPrivatePublicPuzzles}
                  onPress={() => setSelectedPublicPuzzle(puzzle)}
                />
              ))}
            </View>
          ))}
        </View>
      )}

      {selectedPublicPuzzle && (
        <SharedPublicPuzzleModal
          puzzle={selectedPublicPuzzle}
          onClose={() => setSelectedPublicPuzzle(null)}
          onLater={() => setSelectedPublicPuzzle(null)}
          onStart={() => onOpenPuzzle(selectedPublicPuzzle)}
        />
      )}
    </View>
  );
}

function SharedPublicPuzzleModal({
  puzzle,
  onClose,
  onLater,
  onStart,
}: {
  puzzle: ReceivedPuzzle;
  onClose: () => void;
  onLater: () => void;
  onStart: () => void;
}) {
  return (
    <View style={styles.sharedPublicModalOverlay}>
      <View style={styles.sharedPublicModalCard}>
        <Text style={styles.sharedPublicModalTitle}>{formatMonthDay(puzzle.solvedAt ?? puzzle.receivedAt)} 퍼즐</Text>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.sharedPublicModalClose, pressed && styles.pressed]}>
          <Image source={sharedPublicModalCloseIconAsset} style={styles.sharedPublicModalCloseIcon} resizeMode="contain" />
        </Pressable>
        <Image source={{ uri: puzzle.sourceUri }} style={styles.sharedPublicModalPuzzle} resizeMode="cover" />
        <Pressable onPress={onLater} style={({ pressed }) => [styles.sharedPublicModalLaterButton, pressed && styles.pressed]}>
          <Text style={styles.sharedPublicModalButtonText}>아니요, 다음에 할게요</Text>
        </Pressable>
        <Pressable onPress={onStart} style={({ pressed }) => [styles.sharedPublicModalStartButton, pressed && styles.pressed]}>
          <Text style={styles.sharedPublicModalButtonText}>저도 풀어볼래요!</Text>
        </Pressable>
      </View>
    </View>
  );
}

function LinkCreatedScreen({ account, onBack, onDone }: { account: AuthAccount; onBack: () => void; onDone: () => void }) {
  const shareProfileLink = async () => {
    const shared = await shareLink({
      title: '푸러봐',
      text: getProfileShareText(account.name),
      url: getProfileShareUrl(account.slug),
    });
    if (shared) {
      onDone();
    }
  };

  return (
    <View style={styles.linkCreatedRoot}>
      <TopBar title="링크 생성" onBack={onBack} withBorder />

      <Text style={styles.linkCreatedTitle}>
        <Text>짜잔!{'\n'}내 </Text>
        <Text style={styles.linkCreatedTitleAccent}>푸러봐</Text>
        <Text> 링크가{'\n'}생겼어요</Text>
      </Text>

      <Image source={linkCreatedPuzzleAsset} style={styles.linkCreatedPuzzle} resizeMode="cover" />

      <Text style={styles.linkCreatedDescription}>생성된 링크로 친구들이{'\n'}나에게 퍼즐을 보낼 수 있어요.</Text>

      <Pressable onPress={shareProfileLink} style={({ pressed }) => [styles.linkCreatedShareButton, pressed && styles.pressed]}>
        <Text style={styles.linkCreatedShareText}>링크 공유하기</Text>
      </Pressable>
      <Pressable onPress={onDone} style={({ pressed }) => [styles.linkCreatedSkipButton, pressed && styles.pressed]}>
        <Text style={styles.linkCreatedSkipText}>나중에 할게요</Text>
      </Pressable>
    </View>
  );
}

function AuthScreen({
  mode,
  onBack,
  onSwitchMode,
  onSubmit,
}: {
  mode: 'login' | 'signup';
  onBack: () => void;
  onSwitchMode: () => void;
  onSubmit: (credentials: AuthCredentials) => Promise<string | null>;
}) {
  const isSignup = mode === 'signup';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit =
    !isSubmitting && email.trim().length > 0 && password.length > 0 && (!isSignup || (name.trim().length > 0 && passwordConfirm.length > 0));

  return (
    <View style={styles.fill}>
      <TopBar title={isSignup ? '회원가입' : '로그인'} onBack={onBack} withBorder />

      <View style={styles.authHeroPuzzleWrap}>
        <Image source={splashYellowPuzzleAsset} style={styles.authHeroPuzzle} resizeMode="contain" />
      </View>
      <PuzzleCrop image={splashPuzzleSheetAsset} style={styles.authPinkPuzzle} cropStyle={styles.authPinkCrop} opacity={0.7} />
      <PuzzleCrop image={splashPuzzleSheetAsset} style={styles.authPurplePuzzle} cropStyle={styles.authPurpleCrop} opacity={0.65} />

      <View style={styles.authTitleBlock}>
        <Text style={styles.authTitle}>{isSignup ? '퍼즐을 보관할' : '내 퍼즐함을'}{'\n'}{isSignup ? '공간을 만들어요' : '열어볼까요?'}</Text>
        <Text style={styles.authSubtitle}>
          {isSignup ? '보낸 퍼즐과 받은 퍼즐을\n한곳에 모아둘 수 있어요.' : '퍼즐함에서 만들고 받은 퍼즐을\n이어서 확인해보세요.'}
        </Text>
      </View>

      <View style={styles.authForm}>
        {isSignup ? (
          <AuthInput label="이름" value={name} onChangeText={setName} placeholder="이름을 입력하세요" />
        ) : null}
        <AuthInput label="이메일" value={email} onChangeText={setEmail} placeholder="이메일을 입력하세요" keyboardType="email-address" />
        <AuthInput label="비밀번호" value={password} onChangeText={setPassword} placeholder="비밀번호를 입력하세요" secureTextEntry />
        {isSignup ? (
          <AuthInput label="비밀번호 확인" value={passwordConfirm} onChangeText={setPasswordConfirm} placeholder="비밀번호를 한 번 더 입력하세요" secureTextEntry />
        ) : null}
      </View>

      {!isSignup ? (
        <Pressable onPress={() => showToast('비밀번호 찾기는 준비 중이에요.')} style={({ pressed }) => [styles.authForgotButton, pressed && styles.pressed]}>
          <Text style={styles.authForgotText}>비밀번호를 잊으셨나요?</Text>
        </Pressable>
      ) : null}
      {authError.length > 0 ? <Text style={styles.authErrorText}>{authError}</Text> : null}

      <Pressable
        disabled={!canSubmit}
        onPress={async () => {
          setIsSubmitting(true);
          const error = await onSubmit({ mode, name, email, password, passwordConfirm });
          // 성공하면 다른 화면으로 넘어가 이 화면은 사라진다.
          setAuthError(error ?? '');
          setIsSubmitting(false);
        }}
        style={({ pressed }) => [
          styles.authPrimaryButton,
          !canSubmit && styles.disabledButton,
          pressed && canSubmit && styles.pressed,
        ]}
      >
        <Text style={styles.primaryText}>{isSubmitting ? '잠시만요…' : isSignup ? '회원가입하기' : '로그인하기'}</Text>
      </Pressable>

      <Pressable onPress={onSwitchMode} style={({ pressed }) => [styles.authSwitchButton, pressed && styles.pressed]}>
        <Text style={styles.authSwitchText}>
          {isSignup ? '이미 계정이 있나요? ' : '아직 계정이 없나요? '}
          <Text style={styles.authSwitchAccent}>{isSignup ? '로그인' : '회원가입'}</Text>
        </Text>
      </Pressable>
    </View>
  );
}

function AuthInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secureTextEntry = false,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address';
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.authInputGroup}>
      <Text style={styles.authInputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(90,89,89,0.45)"
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        style={styles.authInput}
      />
    </View>
  );
}

function CardCreateScreen({ onBack, onPickPhoto }: { onBack: () => void; onPickPhoto: () => void }) {
  return (
    <View style={styles.fill}>
      <TopBar title="시작하기" onBack={onBack} withBorder />

      <Pressable onPress={onPickPhoto} style={styles.photoPuzzleArea}>
        <View style={styles.photoPuzzleWrap}>
          <Image source={cardStartPuzzleFrameAsset} style={styles.photoPuzzle} resizeMode="cover" />
        </View>
        <Image source={cardStartPhotoPlaceholderIconAsset} style={styles.uploadIcon} resizeMode="contain" />
        <Text style={styles.photoPrompt}>사진을 선택해 주세요</Text>
      </Pressable>

      <PuzzleCrop image={cardStartPuzzleSheetAsset} style={styles.cardPinkPuzzle} cropStyle={styles.cardPinkCrop} opacity={0.7} />
      <PuzzleCrop image={cardStartPuzzleSheetAsset} style={styles.cardPurplePuzzle} cropStyle={styles.cardPurpleCrop} opacity={0.7} />
      <PuzzleCrop image={cardStartPuzzleSheetAsset} style={styles.cardSmallYellowPuzzle} cropStyle={styles.cardSmallYellowCrop} opacity={0.6} />

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

type HomePuzzleTileItem = {
  id: string;
  variant?: 'puzzle';
  source: ImageSourcePropType;
  label: string;
  badge: 'practice' | 'newPink' | 'newYellow' | 'newPurple';
  imageStyle: StyleProp<ImageStyle>;
  onPress: () => void;
};

type HomePhotoTileItem = {
  id: string;
  variant: 'photo';
  source: ImageSourcePropType;
  imageStyle?: StyleProp<ImageStyle>;
  onPress: () => void;
};

function createPracticeTileItem(onPress: () => void): HomePuzzleTileItem {
  return {
    id: 'practice',
    source: mainPracticePuzzleAsset,
    label: '연습용 퍼즐',
    badge: 'practice',
    imageStyle: styles.homePuzzlePracticeImage,
    onPress,
  };
}

// 아직 안 푼 퍼즐은 선물 상자로 보여준다. 상자 색은 분홍·노랑·보라 순서로 돌아간다.
function createGiftTileItem(puzzle: ReceivedPuzzle, index: number, onPress: () => void): HomePuzzleTileItem {
  const gifts = [
    { source: mainPinkGiftPuzzleAsset, badge: 'newPink' as const },
    { source: mainYellowGiftPuzzleAsset, badge: 'newYellow' as const },
    { source: mainReceivedPurplePuzzleAsset, badge: 'newPurple' as const },
  ];
  const gift = gifts[index % gifts.length];

  return {
    id: puzzle.id,
    source: gift.source,
    label: '친구가 보낸 퍼즐',
    badge: gift.badge,
    imageStyle: styles.homePuzzleGiftImage,
    onPress,
  };
}

function HomeScreen({
  account,
  receivedPuzzles,
  sentPuzzles,
  noticePuzzle,
  onDismissNotice,
  onCreatePuzzle,
  onOpenPractice,
  onOpenReceivedPuzzle,
  onOpenSentPuzzle,
  onOpenPuzzleBox,
  onOpenProfile,
}: {
  account: AuthAccount;
  receivedPuzzles: ReceivedPuzzle[];
  sentPuzzles: PuzzleRecord[];
  noticePuzzle: ReceivedPuzzle | null;
  onDismissNotice: (puzzle: ReceivedPuzzle) => void;
  onCreatePuzzle: () => void;
  onOpenPractice: () => void;
  onOpenReceivedPuzzle: (puzzle: ReceivedPuzzle) => void;
  onOpenSentPuzzle: (puzzle: PuzzleRecord) => void;
  onOpenPuzzleBox: () => void;
  onOpenProfile: () => void;
}) {
  const weekAgo = Date.now() - WEEK_MS;
  let giftIndex = 0;
  // 피그마처럼 안 푼 퍼즐은 선물 상자, 이미 푼 퍼즐은 사진으로 보여준다.
  const receivedTiles: Array<HomePuzzleTileItem | HomePhotoTileItem> = [
    createPracticeTileItem(onOpenPractice),
    ...receivedPuzzles
      .filter((puzzle) => puzzle.receivedAt >= weekAgo)
      .sort((a, b) => Number(a.solvedAt !== null) - Number(b.solvedAt !== null))
      .map((puzzle): HomePuzzleTileItem | HomePhotoTileItem =>
        puzzle.solvedAt === null
          ? createGiftTileItem(puzzle, giftIndex++, () => onOpenReceivedPuzzle(puzzle))
          : {
              id: puzzle.id,
              variant: 'photo',
              source: { uri: puzzle.sourceUri },
              imageStyle: styles.homeSentPhotoImage,
              onPress: () => onOpenReceivedPuzzle(puzzle),
            },
      ),
  ];
  const sentTiles: HomePhotoTileItem[] = sentPuzzles.slice(0, 10).map((puzzle) => ({
    id: puzzle.id,
    variant: 'photo',
    source: { uri: puzzle.sourceUri },
    imageStyle: styles.homeSentPhotoImage,
    onPress: () => onOpenSentPuzzle(puzzle),
  }));

  const shareProfileLink = () =>
    shareLink({ title: '푸러봐', text: getProfileShareText(account.name), url: getProfileShareUrl(account.slug) });

  return (
    <View style={styles.homeRoot}>
      <Image source={mainLogoAsset} style={styles.homeLogo} resizeMode="contain" />
      <Image source={mainMenuTextRightIconAsset} style={styles.homeMenuIcon} resizeMode="contain" />
      <Image source={mainNotificationBellIconAsset} style={styles.homeBellIcon} resizeMode="contain" />

      <Pressable onPress={shareProfileLink} style={({ pressed }) => [styles.homeBanner, pressed && styles.pressed]}>
        <Text style={styles.homeBannerTitle}>친구에게 퍼즐을{'\n'}받아볼까요?</Text>
        <Text style={styles.homeBannerDescription}>
          내 링크를 공유하면{'\n'}친구가 나에게 퍼즐을 보내줄 수 있어요.
        </Text>
        <View style={styles.homeShareUnderline} />
        <View style={styles.homeShareLink}>
          <Text style={styles.homeShareButtonText}>링크 공유하러 가기!</Text>
          <Image source={mainShareArrowIconAsset} style={styles.homeShareButtonArrow} resizeMode="contain" />
        </View>
        <Image source={mainBannerCharacterAsset} style={styles.homeBannerCharacter} resizeMode="cover" />
      </Pressable>

      <HomeSectionHeader title="이번 주 받은 퍼즐" style={styles.homeReceivedHeader} highlightStyle={styles.homeReceivedHighlight} showHeart onPressMore={onOpenPuzzleBox} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.homeReceivedRow}
        contentContainerStyle={styles.homePuzzleRowContent}
      >
        {receivedTiles.map((item) => (
          <HomeTile key={item.id} item={item} />
        ))}
      </ScrollView>

      <HomeSectionHeader title="최근 보낸 퍼즐" style={styles.homeSentHeader} highlightStyle={styles.homeSentHighlight} onPressMore={onOpenPuzzleBox} />
      <Image source={mainTabGlowIconAsset} style={styles.homeTabGlow} resizeMode="stretch" />
      {sentTiles.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.homeSentRow}
          contentContainerStyle={styles.homePuzzleRowContent}
        >
          {sentTiles.map((item) => (
            <HomeTile key={item.id} item={item} />
          ))}
        </ScrollView>
      ) : (
        <Pressable onPress={onCreatePuzzle} style={styles.homeSentEmpty}>
          <Image source={mainEmptySentEnvelopeAsset} style={styles.homeSentEmptyImage} resizeMode="contain" />
          <Text style={styles.homeSentEmptyText}>아직 보낸 퍼즐이 없습니다.</Text>
        </Pressable>
      )}

      <HomeTabBar activeTab="home" onHome={() => undefined} onPuzzleBox={onOpenPuzzleBox} onProfile={onOpenProfile} />
      {noticePuzzle && (
        <ReceivedPuzzleNotice
          onClose={() => onDismissNotice(noticePuzzle)}
          onLater={() => onDismissNotice(noticePuzzle)}
          onStart={() => {
            onDismissNotice(noticePuzzle);
            onOpenReceivedPuzzle(noticePuzzle);
          }}
        />
      )}
    </View>
  );
}

function HomeSectionHeader({
  title,
  style,
  highlightStyle,
  showHeart = false,
  onPressMore,
}: {
  title: string;
  style?: StyleProp<ViewStyle>;
  highlightStyle: StyleProp<ViewStyle>;
  showHeart?: boolean;
  onPressMore?: () => void;
}) {
  return (
    <View style={[styles.homeSectionHeader, style]}>
      <View style={styles.homeSectionTitleWrap}>
        <View style={[styles.homeSectionHighlight, highlightStyle]} />
        <Text style={styles.homeSectionTitle}>{title}</Text>
        {showHeart && <Image source={mainHeartFilledIconAsset} style={styles.homeSectionHeart} resizeMode="contain" />}
      </View>
      <Pressable onPress={onPressMore} disabled={!onPressMore} style={({ pressed }) => pressed && styles.pressed}>
        <Text style={styles.homeSectionMore}>{'전체보기 >'}</Text>
      </Pressable>
    </View>
  );
}

function HomePuzzleTile({ item }: { item: HomePuzzleTileItem }) {
  const isPractice = item.badge === 'practice';
  const isYellow = item.badge === 'newYellow';

  return (
    <Pressable onPress={item.onPress} style={({ pressed }) => [styles.homePuzzleTile, pressed && styles.pressed]}>
      <View
        style={[
          styles.homePuzzleBadge,
          isPractice ? styles.homePuzzleBadgePractice : isYellow ? styles.homePuzzleBadgeYellow : item.badge === 'newPurple' ? styles.homePuzzleBadgePurple : styles.homePuzzleBadgeNew,
        ]}
      >
        <Text style={[styles.homePuzzleBadgeText, isPractice ? styles.homePuzzleBadgeTextPractice : styles.homePuzzleBadgeTextNew]}>
          {isPractice ? '연습용' : 'NEW'}
        </Text>
      </View>
      <Image source={item.source} style={item.imageStyle} resizeMode="contain" />
      <Text style={styles.homePuzzleLabel}>{item.label}</Text>
    </Pressable>
  );
}

function HomePhotoTile({ item, tileStyle }: { item: HomePhotoTileItem; tileStyle?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={item.onPress} style={({ pressed }) => [styles.homePhotoTile, tileStyle, pressed && styles.pressed]}>
      <Image source={item.source} style={[styles.homePhotoTileImage, item.imageStyle]} resizeMode="cover" />
    </Pressable>
  );
}

function HomeTile({ item }: { item: HomePuzzleTileItem | HomePhotoTileItem }) {
  return item.variant === 'photo' ? <HomePhotoTile item={item} /> : <HomePuzzleTile item={item} />;
}

function ProfileScreen({
  account,
  onBack,
  onHome,
  onPuzzleBox,
  onLogout,
  onDeleteAccount,
}: {
  account: AuthAccount;
  onBack: () => void;
  onHome: () => void;
  onPuzzleBox: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
}) {
  const [confirmAction, setConfirmAction] = useState<'logout' | 'delete' | null>(null);
  const showPreparing = () => showToast('준비 중이에요.');

  return (
    <View style={styles.profileRoot}>
      <View style={styles.profileTopBar}>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.profileBackButton, pressed && styles.pressed]}>
          <Text style={styles.profileBackIcon}>‹</Text>
        </Pressable>
        <Text style={styles.profileTopTitle}>내 정보</Text>
      </View>

      <View style={styles.profileSummary}>
        <View style={styles.profileAvatarCircle}>
          <Image source={profilePuzzleAvatarAsset} style={styles.profileAvatarImage} resizeMode="cover" />
        </View>
        <Text style={styles.profileName}>{account.name}</Text>
        {account.createdAt ? <Text style={styles.profileCreatedAt}>계정 생성일 {formatFullDate(account.createdAt)}</Text> : null}
      </View>

      <ProfileSectionHeader title="계정 정보" top={238} />
      <ProfileRow label="이름" top={279} onPress={showPreparing} />
      <ProfileRow label="이메일" top={329} onPress={showPreparing} />
      <ProfileRow label="비밀번호" top={380} onPress={showPreparing} />

      <ProfileSectionHeader title="서비스 정보" top={428} />
      <ProfileRow label="이용약관" top={471} onPress={showPreparing} />
      <ProfileRow label="개인정보 처리 방침" top={520} onPress={showPreparing} />
      <ProfileRow label="문의하기" top={572} onPress={showPreparing} />

      <ProfileSectionHeader title="계정 관리" top={622} />
      <ProfileRow label="로그아웃" top={666} isAccent showChevron={false} onPress={() => setConfirmAction('logout')} />
      <ProfileRow label="회원 탈퇴" top={716} showChevron={false} onPress={() => setConfirmAction('delete')} />

      <HomeTabBar activeTab="profile" onHome={onHome} onPuzzleBox={onPuzzleBox} onProfile={() => undefined} />

      {confirmAction === 'logout' && (
        <ConfirmDialog
          title="로그아웃할까요?"
          message={'다시 로그인하면\n퍼즐함을 그대로 볼 수 있어요.'}
          confirmLabel="로그아웃"
          onCancel={() => setConfirmAction(null)}
          onConfirm={onLogout}
        />
      )}
      {confirmAction === 'delete' && (
        <ConfirmDialog
          title="정말 탈퇴할까요?"
          message={'보낸 퍼즐과 받은 퍼즐이\n모두 지워지고 되돌릴 수 없어요.'}
          confirmLabel="탈퇴하기"
          onCancel={() => setConfirmAction(null)}
          onConfirm={onDeleteAccount}
        />
      )}
    </View>
  );
}

function ProfileSectionHeader({ title, top }: { title: string; top: number }) {
  return (
    <View style={[styles.profileSectionHeader, { top }]}>
      <Text style={styles.profileSectionHeaderText}>{title}</Text>
    </View>
  );
}

function ProfileRow({
  label,
  top,
  isAccent = false,
  showChevron = true,
  onPress,
}: {
  label: string;
  top: number;
  isAccent?: boolean;
  showChevron?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.profileRow, { top }, pressed && styles.pressed]}>
      <Text style={[styles.profileRowText, isAccent && styles.profileRowTextAccent]}>{label}</Text>
      {showChevron && <Image source={profileChevronRightIconAsset} style={styles.profileRowChevron} resizeMode="contain" />}
      <View style={styles.profileRowDivider} />
    </Pressable>
  );
}

function PuzzleBoxScreen({
  initialTab,
  receivedPuzzles,
  sentPuzzles,
  onBack,
  onHome,
  onProfile,
  onCreatePuzzle,
  onOpenPractice,
  onOpenReceivedPuzzle,
  onOpenSentPuzzle,
}: {
  initialTab: 'received' | 'sent';
  receivedPuzzles: ReceivedPuzzle[];
  sentPuzzles: PuzzleRecord[];
  onBack: () => void;
  onHome: () => void;
  onProfile: () => void;
  onCreatePuzzle: () => void;
  onOpenPractice: () => void;
  onOpenReceivedPuzzle: (puzzle: ReceivedPuzzle) => void;
  onOpenSentPuzzle: (puzzle: PuzzleRecord) => void;
}) {
  const [activePuzzleBoxTab, setActivePuzzleBoxTab] = useState<'received' | 'sent'>(initialTab);
  const unsolvedTiles: HomePuzzleTileItem[] = [
    createPracticeTileItem(onOpenPractice),
    ...receivedPuzzles
      .filter((puzzle) => puzzle.solvedAt === null)
      .map((puzzle, index) => createGiftTileItem(puzzle, index, () => onOpenReceivedPuzzle(puzzle))),
  ];
  const solvedPuzzles = receivedPuzzles
    .filter((puzzle) => puzzle.solvedAt !== null)
    .sort((a, b) => (b.solvedAt ?? 0) - (a.solvedAt ?? 0));
  const sentTiles: HomePhotoTileItem[] = sentPuzzles.map((puzzle) => ({
    id: puzzle.id,
    variant: 'photo',
    source: { uri: puzzle.sourceUri },
    imageStyle: styles.puzzleBoxSentPhotoImage,
    onPress: () => onOpenSentPuzzle(puzzle),
  }));
  const isReceivedTab = activePuzzleBoxTab === 'received';

  return (
    <View style={styles.puzzleBoxRoot}>
      <View style={styles.puzzleBoxTopBar}>
        <Pressable onPress={onBack} style={({ pressed }) => [styles.puzzleBoxBackButton, pressed && styles.pressed]}>
          <Text style={styles.puzzleBoxBackIcon}>‹</Text>
        </Pressable>
        <Text style={styles.puzzleBoxTitle}>퍼즐함</Text>
      </View>

      <View style={styles.puzzleBoxTabBar}>
        <Pressable onPress={() => setActivePuzzleBoxTab('received')} style={({ pressed }) => [styles.puzzleBoxTabButton, styles.puzzleBoxTabButtonReceived, pressed && styles.pressed]}>
          <Text style={[styles.puzzleBoxTabText, isReceivedTab ? styles.puzzleBoxTabTextActive : styles.puzzleBoxTabTextInactive]}>받은 퍼즐</Text>
        </Pressable>
        <Pressable onPress={() => setActivePuzzleBoxTab('sent')} style={({ pressed }) => [styles.puzzleBoxTabButton, styles.puzzleBoxTabButtonSent, pressed && styles.pressed]}>
          <Text style={[styles.puzzleBoxTabText, !isReceivedTab ? styles.puzzleBoxTabTextActive : styles.puzzleBoxTabTextInactive]}>보낸 퍼즐</Text>
        </Pressable>
        <View style={[styles.puzzleBoxTabIndicator, !isReceivedTab && styles.puzzleBoxTabIndicatorSent]} />
      </View>

      {isReceivedTab ? (
        <>
          <Text style={styles.puzzleBoxUnsolvedTitle}>아직 안 푼 퍼즐</Text>
          <View style={styles.puzzleBoxUnsolvedHighlight} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.puzzleBoxUnsolvedRow} contentContainerStyle={styles.puzzleBoxRowContent}>
            {unsolvedTiles.map((item) => (
              <HomePuzzleTile key={item.id} item={item} />
            ))}
          </ScrollView>

          <Text style={styles.puzzleBoxSolvedTitle}>최근 푼 퍼즐</Text>
          {solvedPuzzles.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.puzzleBoxSolvedRow} contentContainerStyle={styles.puzzleBoxSolvedRowContent}>
              {solvedPuzzles.map((puzzle) => (
                <View key={puzzle.id} style={styles.puzzleBoxSolvedCard}>
                  <Image source={{ uri: puzzle.sourceUri }} style={styles.puzzleBoxSolvedImage} resizeMode="cover" />
                  <View style={styles.puzzleBoxPublicBadge}>
                    <Text style={styles.puzzleBoxPublicBadgeText}>공개</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.puzzleBoxSolvedEmptyText}>아직 푼 퍼즐이 없어요.</Text>
          )}
        </>
      ) : sentTiles.length > 0 ? (
        <ScrollView style={styles.puzzleBoxSentScroll} contentContainerStyle={styles.puzzleBoxSentGrid} showsVerticalScrollIndicator={false}>
          {sentTiles.map((item) => (
            <HomePhotoTile key={item.id} item={item} tileStyle={styles.puzzleBoxSentTile} />
          ))}
        </ScrollView>
      ) : (
        <Pressable onPress={onCreatePuzzle} style={styles.puzzleBoxSentEmpty}>
          <Image source={mainEmptySentEnvelopeAsset} style={styles.homeSentEmptyImage} resizeMode="contain" />
          <Text style={styles.homeSentEmptyText}>아직 보낸 퍼즐이 없습니다.</Text>
        </Pressable>
      )}
      <Pressable onPress={onCreatePuzzle} style={({ pressed }) => [styles.puzzleBoxCreateButton, pressed && styles.pressed]}>
        <Text style={styles.puzzleBoxCreateButtonText}>+</Text>
      </Pressable>

      <HomeTabBar activeTab="puzzleBox" onHome={onHome} onPuzzleBox={() => undefined} onProfile={onProfile} />
    </View>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View style={styles.receivedNoticeOverlay}>
      <View style={styles.confirmCard}>
        <Text style={styles.confirmTitle}>{title}</Text>
        <Text style={styles.confirmMessage}>{message}</Text>
        <Pressable onPress={onCancel} style={({ pressed }) => [styles.confirmCancelButton, pressed && styles.pressed]}>
          <Text style={styles.receivedNoticeLaterText}>취소</Text>
        </Pressable>
        <Pressable onPress={onConfirm} style={({ pressed }) => [styles.confirmOkButton, pressed && styles.pressed]}>
          <Text style={styles.receivedNoticeStartText}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ReceivedPuzzleNotice({
  onClose,
  onLater,
  onStart,
}: {
  onClose: () => void;
  onLater: () => void;
  onStart: () => void;
}) {
  return (
    <View style={styles.receivedNoticeOverlay}>
      <View style={styles.receivedNoticeCard}>
        <Pressable onPress={onClose} style={({ pressed }) => [styles.receivedNoticeClose, pressed && styles.pressed]}>
          <Image source={mainModalCloseIconAsset} style={styles.receivedNoticeCloseIcon} resizeMode="contain" />
        </Pressable>
        <Text style={styles.receivedNoticeTitle}>
          <Text style={styles.receivedNoticeTitleAccent}>퍼즐</Text>
          이 왔어요!{'\n'}지금 바로 맞춰볼까요?
        </Text>
        <View style={styles.receivedNoticeShadow} />
        <Image source={mainReceivedNotificationPuzzleAsset} style={styles.receivedNoticePuzzle} resizeMode="contain" />
        <Pressable onPress={onLater} style={({ pressed }) => [styles.receivedNoticeLaterButton, pressed && styles.pressed]}>
          <Text style={styles.receivedNoticeLaterText}>아니요, 다음에 할게요</Text>
        </Pressable>
        <Pressable onPress={onStart} style={({ pressed }) => [styles.receivedNoticeStartButton, pressed && styles.pressed]}>
          <Text style={styles.receivedNoticeStartText}>네! 지금 할래요</Text>
        </Pressable>
      </View>
    </View>
  );
}

function HomeTabBar({
  activeTab,
  onHome,
  onPuzzleBox,
  onProfile,
}: {
  activeTab: 'home' | 'puzzleBox' | 'profile';
  onHome: () => void;
  onPuzzleBox: () => void;
  onProfile: () => void;
}) {
  const isHomeActive = activeTab === 'home';
  const isPuzzleBoxActive = activeTab === 'puzzleBox';
  const isProfileActive = activeTab === 'profile';

  return (
    <View style={styles.homeTabBar}>
      <Pressable accessibilityRole="button" onPress={onHome} onPressIn={onHome} style={({ pressed }) => [styles.homeTabButton, pressed && styles.pressed]}>
        <Image source={mainTabHomeFilledIconAsset} style={[styles.homeTabHomeIcon, !isHomeActive && styles.homeTabIconInactive]} resizeMode="contain" />
        <Text style={[styles.homeTabLabel, isHomeActive ? styles.homeTabLabelActive : styles.homeTabLabelInactive]}>홈</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onPuzzleBox} onPressIn={onPuzzleBox} style={({ pressed }) => [styles.homeTabButton, pressed && styles.pressed]}>
        <Image source={mainTabBookHalfIconAsset} style={styles.homeTabBookIcon} resizeMode="contain" />
        <Image source={mainTabPuzzleFilledIconAsset} style={[styles.homeTabPuzzleIcon, styles.homeTabPuzzleIconFlow, !isPuzzleBoxActive && styles.homeTabIconInactive]} resizeMode="contain" />
        <Text style={[styles.homeTabLabel, isPuzzleBoxActive ? styles.homeTabLabelActive : styles.homeTabLabelInactive]}>퍼즐함</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onProfile} onPressIn={onProfile} style={({ pressed }) => [styles.homeTabButton, pressed && styles.pressed]}>
        <Image source={mainTabBookOutlineIconAsset} style={styles.homeTabBookOutlineIcon} resizeMode="contain" />
        <Image source={mainTabPersonFilledIconAsset} style={[styles.homeTabProfileIcon, styles.homeTabProfileIconFlow, !isProfileActive && styles.homeTabIconInactive]} resizeMode="contain" />
        <Text style={[styles.homeTabLabel, isProfileActive ? styles.homeTabLabelActive : styles.homeTabLabelInactive]}>내 정보</Text>
      </Pressable>
      <View style={styles.homeTabIndicator} />
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
  const [activePhotoTab, setActivePhotoTab] = useState<'recent' | 'favorites'>('recent');
  const favoritePhotoUris = EMPTY_PHOTO_URIS;
  const visiblePhotoUris = activePhotoTab === 'recent' ? photoUris : favoritePhotoUris;
  const hasSelection = activePhotoTab === 'recent' && selectedPhotoIndex !== null;
  const isFavoritesTab = activePhotoTab === 'favorites';

  return (
    <View style={styles.fill}>
      <TopBar title="사진 선택" onBack={onBack} />
      <View style={styles.tabBar}>
        <Pressable onPress={() => setActivePhotoTab('recent')} style={[styles.photoTab, styles.recentPhotoTab]}>
          <Text style={[styles.photoTabText, activePhotoTab === 'recent' ? styles.activePhotoTabText : styles.inactivePhotoTabText]}>최근 항목</Text>
        </Pressable>
        <Pressable onPress={() => setActivePhotoTab('favorites')} style={[styles.photoTab, styles.favoritePhotoTab]}>
          <Text style={[styles.photoTabText, isFavoritesTab ? styles.activePhotoTabText : styles.inactivePhotoTabText]}>즐겨 찾기</Text>
        </Pressable>
        <View style={[styles.activeTabLine, isFavoritesTab && styles.favoriteTabLine]} />
      </View>

      <View style={styles.photoGrid}>
        {visiblePhotoUris.map((uri, index) => {
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
        {isFavoritesTab && visiblePhotoUris.length === 0 ? (
          <View style={styles.emptyFavoriteState}>
            <Text style={styles.emptyFavoriteTitle}>즐겨찾기한 사진이 없어요</Text>
            <Text style={styles.emptyFavoriteBody}>최근 항목에서 사진을 선택해 퍼즐을 만들어보세요.</Text>
          </View>
        ) : null}
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
  screenScale,
  onBack,
  onChangePhoto,
  onComplete,
}: {
  photoUri: string;
  screenScale: number;
  onBack: () => void;
  onChangePhoto: () => void;
  onComplete: (puzzleSourceUri: string, gridSize: GridSize) => Promise<void>;
}) {
  const [isCompleting, setIsCompleting] = useState(false);
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
    const coordinateScale = screenScale > 0 ? screenScale : 1;

    return {
      x: Math.max(0, Math.min(330, locationX / coordinateScale)),
      y: Math.max(0, Math.min(330, locationY / coordinateScale)),
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
          style={[styles.drawingHitArea, NO_TOUCH_SCROLL, tool === 'text' && styles.textHitArea]}
          onStartShouldSetResponder={() => tool === 'draw' || (tool === 'text' && activeTextId !== null)}
          onMoveShouldSetResponder={() => tool === 'draw' || (tool === 'text' && activeTextId !== null)}
          onResponderGrant={tool === 'draw' ? startDrawing : moveActiveText}
          onResponderMove={tool === 'draw' ? continueDrawing : moveActiveText}
        />
        <Pressable onPress={cycleGridSize} style={({ pressed }) => [styles.puzzleSizeBadge, pressed && styles.pressed]}>
          <Image source={puzzleSizeBadgeIconAsset} style={styles.puzzleBadgeIcon} resizeMode="contain" />
          <Text style={styles.puzzleBadgeText}>{gridSize}X{gridSize}</Text>
        </Pressable>
        <Pressable onPress={onChangePhoto} style={({ pressed }) => [styles.imageBadge, pressed && styles.pressed]} hitSlop={8}>
          <Text style={styles.imageBadgeText}>AI</Text>
        </Pressable>
      </View>

      <View style={styles.puzzleControls}>
        <View style={styles.toolTabs}>
          <Pressable onPress={() => setTool('draw')} style={[styles.toolTab, tool === 'draw' && styles.activeToolTab]}>
            <Image
              source={decoratePencilIconAsset}
              style={[styles.toolTabPencilIcon, { tintColor: tool === 'draw' ? designSystem.color.primary : designSystem.color.muted }]}
              resizeMode="contain"
            />
            <Text style={[styles.toolTabText, tool === 'draw' && styles.activeToolTabText]}>그리기</Text>
          </Pressable>
          <Pressable onPress={() => setTool('text')} style={[styles.toolTab, tool === 'text' && styles.activeToolTab]}>
            <Image
              source={decorateTextIconAsset}
              style={[styles.toolTabTextIcon, { tintColor: tool === 'text' ? designSystem.color.primary : designSystem.color.muted }]}
              resizeMode="contain"
            />
            <Text style={[styles.toolTabText, tool === 'text' && styles.activeToolTabText]}>텍스트</Text>
          </Pressable>
        </View>
        {tool === 'draw' ? (
          <DrawPanel penColor={penColor} penWidth={penWidth} screenScale={screenScale} onColorChange={setPenColor} onWidthChange={setPenWidth} />
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
        <Image source={undoIconAsset} style={styles.historyIcon} resizeMode="contain" />
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
        <Image source={redoIconAsset} style={styles.historyIcon} resizeMode="contain" />
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
        <Image source={trashIconAsset} style={styles.trashIcon} resizeMode="contain" />
      </Pressable>

      <Pressable
        disabled={isCompleting}
        onPress={async () => {
          // 이미지를 서버에 올리는 동안 다시 누르면 퍼즐이 두 개 만들어지므로 막는다.
          setIsCompleting(true);
          try {
            const puzzleSourceUri = await createPuzzleArtworkImage(photoUri, strokes, textStickers);
            await onComplete(puzzleSourceUri, gridSize);
          } finally {
            setIsCompleting(false);
          }
        }}
        style={({ pressed }) => [styles.completeButton, isCompleting && styles.disabledButton, pressed && styles.pressed]}
      >
        <Text style={styles.primaryText}>{isCompleting ? '저장하는 중…' : '퍼즐 완성'}</Text>
      </Pressable>
    </View>
  );
}

function AiDecorateScreen({
  photoUri,
  onBack,
  onSkip,
  onApply,
}: {
  photoUri: string;
  onBack: () => void;
  onSkip: () => void;
  onApply: () => void;
}) {
  const [prompt, setPrompt] = useState('');
  const previewSource: ImageSourcePropType = photoUri === AI_PUZZLE_ARTWORK_URI ? aiPromptPreviewAsset : { uri: photoUri };

  return (
    <View style={styles.fill}>
      <TopBar title="AI로 꾸미기" onBack={onBack} withBorder />

      <View style={styles.aiDecoratePreview}>
        <Image source={previewSource} style={styles.aiDecoratePreviewImage} resizeMode="cover" />
      </View>

      <Text style={styles.aiDecorateTitle}>사진을 어떻게 바꿔볼까요?</Text>
      <Text style={styles.aiDecorateHelper}>원하는 모습을 자유롭게 적어주세요!</Text>

      <View style={styles.aiPromptBox}>
        <TextInput
          value={prompt}
          onChangeText={(value) => setPrompt(value.slice(0, 50))}
          placeholder="예) 배경을 별이 가득한 밤하늘로 바꿔줘"
          placeholderTextColor="rgba(121, 121, 121, 0.49)"
          multiline
          maxLength={50}
          style={styles.aiPromptInput}
        />
        <Image source={aiPromptSparkleAsset} style={styles.aiPromptSparkle} resizeMode="contain" />
        <Text style={styles.aiPromptCount}>{prompt.length}/50</Text>
      </View>

      <Pressable onPress={onApply} style={({ pressed }) => [styles.aiApplyButton, pressed && styles.pressed]}>
        <Text style={styles.aiApplyButtonText}>AI로 바꾸기</Text>
      </Pressable>
      <Pressable onPress={onSkip} style={({ pressed }) => [styles.aiSkipButton, pressed && styles.pressed]}>
        <Text style={styles.aiSkipText}>건너뛰기</Text>
      </Pressable>
    </View>
  );
}

function PuzzleCompleteScreen({
  puzzle,
  isLoggedIn,
  onBack,
  onKeepPuzzle,
}: {
  puzzle: PuzzleRecord;
  isLoggedIn: boolean;
  onBack: () => void;
  onKeepPuzzle: () => void;
}) {
  // 받는 사람이 맞추게 될 모습 그대로(그림·글씨 + 칸 선) 보여준다.
  const [displayPuzzleUri, setDisplayPuzzleUri] = useState(puzzle.sourceUri);

  useEffect(() => {
    let isMounted = true;

    createPuzzleImage(puzzle.sourceUri, puzzle.gridSize).then((nextUri) => {
      if (isMounted) {
        setDisplayPuzzleUri(nextUri);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [puzzle.sourceUri, puzzle.gridSize]);

  const sharePuzzle = () =>
    shareLink({ title: '푸러봐', text: getPuzzleShareText(puzzle.senderName), url: getShareUrl(puzzle.id) });

  return (
    <View style={styles.fill}>
      <TopBar title="퍼즐 완성" onBack={onBack} withBorder />

      <Image source={celebrationAsset} style={styles.celebrationImage} resizeMode="contain" />
      <Text style={styles.completeTitle}>
        <Text style={styles.completeTitleAccent}>퍼즐</Text>이 완성됐어요!
      </Text>
      <Text style={styles.completeSubtitle}>특별한 메시지를 전달할 준비가 완료됐어요</Text>

      <View style={styles.completedPuzzleFrame}>
        <Image source={{ uri: displayPuzzleUri }} style={styles.completedPuzzleImage} resizeMode="cover" />
      </View>

      <Pressable onPress={sharePuzzle} style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>공유하기</Text>
      </Pressable>

      <Pressable onPress={onKeepPuzzle} style={({ pressed }) => [styles.loginNotice, pressed && styles.pressed]}>
        <Text style={styles.loginNoticeTitle}>{isLoggedIn ? '보낸 퍼즐을 퍼즐함에 담았어요' : '보낸 퍼즐, 간직할까요?'}</Text>
        <Text style={styles.loginNoticeBody}>{isLoggedIn ? '퍼즐함에서 언제든 다시 볼 수 있어요' : '로그인하면 내가 보낸 퍼즐을 모아볼 수 있어요'}</Text>
        <Image source={loginPuzzleAsset} style={styles.loginNoticeImage} resizeMode="cover" />
      </Pressable>
    </View>
  );
}

function PuzzleSolveScreen({
  puzzleSourceUri,
  gridSize,
  screenScale,
  getScreenOrigin,
  onBack,
  onComplete,
}: {
  puzzleSourceUri: string;
  gridSize: GridSize;
  screenScale: number;
  getScreenOrigin: () => { x: number; y: number };
  onBack: () => void;
  onComplete: () => void;
}) {
  const totalPieces = gridSize * gridSize;
  const boardSize = 302;
  const slotSize = boardSize / gridSize;
  const pieceMargin = getPuzzlePieceMargin(slotSize);
  const placedPieceSize = slotSize + pieceMargin * 2;
  const trayPieceSize = gridSize === 3 ? 108 : gridSize === 4 ? 92 : 78;
  const [pieceUris, setPieceUris] = useState<string[]>([]);
  const [trayPieceOrder, setTrayPieceOrder] = useState<number[]>([]);
  const [placedPieces, setPlacedPieces] = useState<Array<number | null>>(Array(totalPieces).fill(null));
  const [selectedPiece, setSelectedPiece] = useState<number | null>(null);
  const [draggingPiece, setDraggingPiece] = useState<{ pieceIndex: number; x: number; y: number } | null>(null);
  const draggingPieceRef = useRef<{ pieceIndex: number; x: number; y: number } | null>(null);
  const [trayPage, setTrayPage] = useState(0);
  const placedCount = placedPieces.filter((piece) => piece !== null).length;
  const isSolved = placedCount === totalPieces;
  const placedPieceSet = useMemo(() => new Set(placedPieces.filter((piece): piece is number => piece !== null)), [placedPieces]);
  const availablePieces = useMemo(() => trayPieceOrder.filter((index) => !placedPieceSet.has(index)), [trayPieceOrder, placedPieceSet]);
  const trayPageCount = Math.max(1, Math.ceil(availablePieces.length / 2));
  const visiblePieces = useMemo(() => availablePieces.slice(trayPage * 2, trayPage * 2 + 2), [availablePieces, trayPage]);
  const boardSlots = useMemo(() => Array.from({ length: totalPieces }, (_, index) => index), [totalPieces]);
  const emptyBoardUri = useMemo(() => createEmptyPuzzleBoard(boardSize, gridSize), [gridSize]);
  const slotStyle = useMemo<StyleProp<ViewStyle>>(() => ({ width: slotSize, height: slotSize }), [slotSize]);
  const placedPieceStyle = useMemo<StyleProp<ImageStyle>>(
    () => ({ left: -pieceMargin, top: -pieceMargin, width: placedPieceSize, height: placedPieceSize }),
    [pieceMargin, placedPieceSize],
  );
  const trayPieceStyle = useMemo<StyleProp<ViewStyle>>(() => ({ width: trayPieceSize, height: trayPieceSize }), [trayPieceSize]);

  useEffect(() => {
    let isMounted = true;
    createPuzzlePieces(puzzleSourceUri, gridSize).then((pieces) => {
      if (isMounted) {
        setPieceUris(pieces);
        setTrayPieceOrder(shufflePieceOrder(pieces.length));
        setPlacedPieces(Array(totalPieces).fill(null));
        setSelectedPiece(null);
        setDraggingPiece(null);
        draggingPieceRef.current = null;
        setTrayPage(0);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [puzzleSourceUri, gridSize, totalPieces]);

  useEffect(() => {
    setTrayPage((current) => Math.min(current, trayPageCount - 1));
  }, [trayPageCount]);

  const getDesignPoint = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    const origin = getScreenOrigin();
    return {
      x: (pageX - origin.x) / screenScale,
      y: (pageY - origin.y) / screenScale,
    };
  };

  const getDropSlot = (event: GestureResponderEvent) => {
    const point = getDesignPoint(event);
    const boardLeft = 44;
    const boardTop = 152;
    const slotSize = boardSize / gridSize;

    if (point.x < boardLeft || point.x > boardLeft + boardSize || point.y < boardTop || point.y > boardTop + boardSize) {
      return null;
    }

    const col = Math.min(gridSize - 1, Math.floor((point.x - boardLeft) / slotSize));
    const row = Math.min(gridSize - 1, Math.floor((point.y - boardTop) / slotSize));
    return row * gridSize + col;
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
    if (!currentDraggingPiece || placedPieceSet.has(currentDraggingPiece.pieceIndex)) {
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
        <Image source={solveCounterPuzzleIconAsset} style={styles.solveCounterIcon} resizeMode="contain" />
        <Text style={styles.solveCounterText}>
          <Text style={styles.solveCounterDone}>{placedCount}</Text>
          <Text style={styles.solveCounterTotal}>/{totalPieces}</Text>
        </Text>
      </View>

      <View style={styles.solveBoard}>
        <Image source={{ uri: emptyBoardUri }} style={styles.emptySolveBoardImage} resizeMode="cover" />
        {boardSlots.map((index) => {
          const placedPiece = placedPieces[index];
          return (
            <View key={index} style={[styles.solveSlot, slotStyle]}>
              {placedPiece !== null && pieceUris[placedPiece] ? (
                <Image source={{ uri: pieceUris[placedPiece] }} style={[styles.solvePlacedPiece, placedPieceStyle]} resizeMode="cover" />
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.solveTray}>
        <Pressable
          onPress={() => setTrayPage((current) => Math.max(0, current - 1))}
          disabled={trayPage === 0}
          style={({ pressed }) => [styles.solveArrowLeft, trayPage === 0 && styles.disabledSolveArrow, pressed && trayPage > 0 && styles.pressed]}
        >
          <View style={[styles.solveArrowChevron, styles.solveArrowChevronLeft]} />
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
                style={[styles.solvePieceButton, trayPieceStyle, NO_TOUCH_SCROLL, selectedPiece === pieceIndex && styles.selectedSolvePiece]}
              >
                {pieceUris[pieceIndex] ? (
                  <Image source={{ uri: pieceUris[pieceIndex] }} style={styles.solvePieceImage} resizeMode="cover" />
                ) : null}
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
          <View style={styles.solveArrowChevron} />
        </Pressable>
      </View>

      <View style={styles.solveBottomSheet}>
        <Pressable
          disabled={placedCount < totalPieces}
          onPress={onComplete}
          style={({ pressed }) => [styles.solveCompleteButton, placedCount < totalPieces && styles.disabledButton, pressed && placedCount === totalPieces && styles.pressed]}
        >
          <Text style={styles.primaryText}>퍼즐 완성하기</Text>
        </Pressable>
        <Text style={styles.solveHelperText}>조각을 선택해서 퍼즐판에 놓아보세요!</Text>
      </View>
      {draggingPiece && pieceUris[draggingPiece.pieceIndex] ? (
        <Image
          source={{ uri: pieceUris[draggingPiece.pieceIndex] }}
          style={[
            styles.draggingSolvePiece,
            { left: draggingPiece.x - trayPieceSize / 2, top: draggingPiece.y - trayPieceSize / 2, width: trayPieceSize, height: trayPieceSize },
          ]}
          resizeMode="cover"
        />
      ) : null}
    </View>
  );
}

function shufflePieceOrder(pieceCount: number) {
  const order = Array.from({ length: pieceCount }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }
  if (pieceCount > 1 && order.every((pieceIndex, index) => pieceIndex === index)) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return order;
}

function SolvedPuzzleCompleteScreen({
  puzzleUri,
  gridSize,
  isPractice,
  isLoggedIn,
  onBack,
  onSave,
  onCreatePuzzle,
}: {
  puzzleUri: string;
  gridSize: GridSize;
  isPractice: boolean;
  isLoggedIn: boolean;
  onBack: () => void;
  onSave: () => void;
  onCreatePuzzle: () => void;
}) {
  const [displayPuzzleUri, setDisplayPuzzleUri] = useState(puzzleUri);
  const saveLabel = isLoggedIn ? (isPractice ? '홈으로 가기' : '퍼즐함에서 보기') : isPractice ? '로그인하기' : '로그인하고 저장하기';

  useEffect(() => {
    let isMounted = true;

    createPuzzleImage(puzzleUri, gridSize).then((nextUri) => {
      if (isMounted) {
        setDisplayPuzzleUri(nextUri);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [puzzleUri, gridSize]);

  return (
    <View style={styles.fill}>
      <TopBar title="퍼즐 완성" onBack={onBack} withBorder />

      <Image source={celebrationAsset} style={styles.solvedCompleteCelebration} resizeMode="contain" />
      <Text style={styles.solvedCompleteTitle}>
        <Text style={styles.completeTitleAccent}>퍼즐</Text>이 완성됐어요!
      </Text>
      <Text style={styles.solvedCompleteSubtitle}>완성된 퍼즐을 확인해보세요.</Text>

      <View style={styles.solvedCompletePuzzleFrame}>
        <Image source={{ uri: displayPuzzleUri }} style={styles.solvedCompletePuzzleImage} resizeMode="cover" />
      </View>

      <Pressable onPress={onSave} style={({ pressed }) => [styles.solvedSaveButton, pressed && styles.pressed]}>
        <Text style={styles.primaryText}>{saveLabel}</Text>
      </Pressable>

      <Pressable onPress={onCreatePuzzle} style={({ pressed }) => [styles.solvedLoginNotice, pressed && styles.pressed]}>
        <Text style={styles.solvedLoginNoticeTitle}>나도 널 위해서 만들어줄게!</Text>
        <Text style={styles.solvedLoginNoticeBody}>로그인 없이 나만의 퍼즐을 만들어보세요.</Text>
        <Image source={loginPuzzleAsset} style={styles.solvedLoginNoticeImage} resizeMode="cover" />
      </Pressable>
    </View>
  );
}

function DrawPanel({
  penColor,
  penWidth,
  screenScale,
  onColorChange,
  onWidthChange,
}: {
  penColor: string;
  penWidth: number;
  screenScale: number;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
}) {
  const getSliderWidth = (locationX: number) => widthFromSlider(locationX / Math.max(screenScale, 0.01));

  return (
    <View style={styles.panelBody}>
      <View style={styles.colorGrid}>
        {DRAW_COLORS.map((color, index) => (
          <Pressable
            key={`${color}-${index}`}
            onPress={() => onColorChange(color)}
            style={[styles.colorSwatch, { backgroundColor: color }, penColor === color && styles.selectedSwatch]}
          />
        ))}
      </View>
      <Text style={styles.sliderLabel}>펜 굵기</Text>
      <View
        style={[styles.sliderTouchArea, NO_TOUCH_SCROLL]}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(event) => onWidthChange(getSliderWidth(event.nativeEvent.locationX))}
        onResponderMove={(event) => onWidthChange(getSliderWidth(event.nativeEvent.locationX))}
      >
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: sliderOffsetFromWidth(penWidth) }]} />
        </View>
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
        {TEXT_COLORS.map((color, index) => (
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
        {TEXT_COLORS.map((color, index) => (
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
  image: string | ImageSourcePropType;
  style: StyleProp<ViewStyle>;
  cropStyle: StyleProp<ImageStyle>;
  opacity: number;
};

function PuzzleCrop({ image, style, cropStyle, opacity }: PuzzleCropProps) {
  const imageSource = typeof image === 'string' ? { uri: image } : image;

  return (
    <View style={[styles.cropBox, style, { opacity }]}>
      <Image source={imageSource} style={[styles.cropImage, cropStyle]} resizeMode="cover" />
    </View>
  );
}

const designSystem = {
  color: {
    background: '#fff',
    text: '#141517',
    muted: '#9f9f9f',
    primary: '#ab81ff',
    primaryDark: '#6933d5',
    button: '#2d3440',
    disabled: '#d9d9d9',
    border: '#e6e7e9',
    panelBorder: 'rgba(129,129,129,0.2)',
  },
  radius: {
    button: 8,
    panel: 10,
    card: 12,
  },
  size: {
    screenWidth: DESIGN_WIDTH,
    screenHeight: DESIGN_HEIGHT,
    buttonWidth: 343,
    buttonHeight: 54,
    topBarHeight: 58,
  },
  font: {
    family: BODY_FONT_FAMILY,
    display: DISPLAY_FONT_FAMILY,
    topBarTitle: 17,
    body: 15,
    caption: 13,
    hero: 27,
  },
} as const;

const PHONE_MAX_WIDTH = 500;

// 화면이 세로로 스크롤되는 폰에서, 조각 끌기·그림 그리기·굵기 조절을 할 때 페이지가 같이 움직이지 않게 한다. (웹 전용 스타일)
const NO_TOUCH_SCROLL = { touchAction: 'none' } as unknown as ViewStyle;

function getResponsiveScale(width: number, height: number) {
  const widthScale = width / designSystem.size.screenWidth;
  const heightScale = height / designSystem.size.screenHeight;

  // 폰에서는 가로를 꽉 채우고 모자란 세로는 스크롤로 넘긴다.
  // (높이에 맞추면 브라우저 주소창 높이만큼 화면 전체가 줄어들어 양옆에 여백이 생긴다)
  // 디자인(390)보다 조금 넓은 폰(아이폰 17 402, 갤럭시 412, 프로맥스 440)도 폰으로 본다.
  // 카톡 안 브라우저처럼 위아래 막대가 화면을 줄이는 곳에서 특히 양옆이 크게 비었다.
  // 태블릿·PC처럼 넓은 화면에서만 기기 한 대가 통째로 보이도록 높이에 맞춘다.
  return width <= PHONE_MAX_WIDTH ? widthScale : Math.min(widthScale, heightScale);
}

// 피그마 화면(402x874)은 맨 위에 폰이 직접 그리는 상태바 자리를 비워두고 있다.
// 앱 캔버스는 그 아래에서 시작하므로 그 높이만큼 화면을 위로 끌어올린다.
const STATUS_STRIP = 49;
const FRAME_HEIGHT = DESIGN_HEIGHT + STATUS_STRIP;

const styles = StyleSheet.create({
  toastWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 48,
    alignItems: 'center',
    zIndex: 50,
  },
  toast: {
    maxWidth: 358,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(20,21,23,0.88)',
  },
  toastText: {
    color: '#fff',
    fontFamily: designSystem.font.family,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
  },
  root: {
    flex: 1,
    backgroundColor: designSystem.color.background,
  },
  rootScroll: {
    flex: 1,
    width: '100%',
  },
  rootScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenViewport: {
    overflow: 'hidden',
  },
  screen: {
    width: designSystem.size.screenWidth,
    height: designSystem.size.screenHeight,
    backgroundColor: designSystem.color.background,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
    backgroundColor: designSystem.color.background,
  },
  splashRoot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -STATUS_STRIP,
    height: FRAME_HEIGHT,
    backgroundColor: designSystem.color.background,
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
    left: 86,
    top: 93,
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
    left: -2,
    top: 235,
    width: 164,
    height: 129,
  },
  splashCopyBlock: {
    position: 'absolute',
    left: 38,
    top: 415,
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
    left: 328,
    top: 354,
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
    left: 329,
    top: 437,
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
    left: 0,
    top: 769,
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
    left: 23,
    top: 723,
    width: designSystem.size.buttonWidth,
    height: designSystem.size.buttonHeight,
    borderRadius: designSystem.radius.button,
    backgroundColor: designSystem.color.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.86,
  },
  primaryText: {
    color: designSystem.color.background,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0,
  },
  chevron: {
    position: 'absolute',
    right: 27,
    top: 10,
    color: designSystem.color.background,
    fontSize: 38,
    lineHeight: 38,
    fontWeight: '300',
  },
  chevronIcon: {
    position: 'absolute',
    right: 25,
    top: 18,
    width: 19,
    height: 19,
  },
  splashLoginButton: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 790,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLoginText: {
    color: designSystem.color.muted,
    fontSize: designSystem.font.body,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  authHeroPuzzleWrap: {
    position: 'absolute',
    left: 140,
    top: 82,
    width: 110,
    height: 110,
  },
  authHeroPuzzle: {
    width: '100%',
    height: '100%',
  },
  authPinkPuzzle: {
    left: 30,
    top: 126,
    width: 43,
    height: 41,
    transform: [{ rotate: '-155deg' }],
  },
  authPinkCrop: {
    left: -84,
    top: -5,
    width: 157,
    height: 105,
  },
  authPurplePuzzle: {
    left: 322,
    top: 159,
    width: 36,
    height: 31,
    transform: [{ rotate: '-12deg' }],
  },
  authPurpleCrop: {
    left: -22,
    top: -42,
    width: 127,
    height: 85,
  },
  authTitleBlock: {
    position: 'absolute',
    left: 36,
    right: 36,
    top: 210,
    alignItems: 'center',
  },
  authTitle: {
    color: '#030303',
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0,
  },
  authSubtitle: {
    marginTop: 10,
    width: 300,
    color: designSystem.color.muted,
    fontSize: designSystem.font.caption,
    lineHeight: 19,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  authForm: {
    position: 'absolute',
    left: 29,
    top: 348,
    width: designSystem.size.buttonWidth,
    gap: 12,
  },
  authInputGroup: {
    width: designSystem.size.buttonWidth,
    height: 68,
  },
  authInputLabel: {
    color: '#5a5959',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 0,
  },
  authInput: {
    marginTop: 5,
    width: designSystem.size.buttonWidth,
    height: 45,
    borderRadius: designSystem.radius.button,
    borderWidth: 1,
    borderColor: designSystem.color.panelBorder,
    backgroundColor: designSystem.color.background,
    paddingHorizontal: 15,
    color: designSystem.color.text,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0,
  },
  authForgotButton: {
    position: 'absolute',
    right: 29,
    top: 506,
  },
  authForgotText: {
    color: designSystem.color.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0,
  },
  authErrorText: {
    position: 'absolute',
    left: 29,
    right: 29,
    top: 560,
    color: '#e24b4b',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  authPrimaryButton: {
    position: 'absolute',
    left: 29,
    top: 705,
    width: designSystem.size.buttonWidth,
    height: 50,
    borderRadius: designSystem.radius.button,
    backgroundColor: designSystem.color.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authSwitchButton: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 768,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authSwitchText: {
    color: designSystem.color.muted,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  authSwitchAccent: {
    color: designSystem.color.primary,
    fontWeight: '800',
  },
  sharedLinkRoot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -STATUS_STRIP,
    height: FRAME_HEIGHT,
    backgroundColor: '#fbfbfb',
    overflow: 'hidden',
  },
  sharedLinkLogo: {
    position: 'absolute',
    left: 158,
    top: 71,
    width: 86,
    height: 45,
  },
  sharedLinkBanner: {
    position: 'absolute',
    left: -6,
    top: 132,
    width: 403,
    height: 233,
    backgroundColor: '#a26ffd',
    overflow: 'hidden',
  },
  sharedLinkBannerTitle: {
    position: 'absolute',
    left: 33,
    top: 35,
    color: '#fff',
    fontSize: 23,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  sharedLinkBannerDescription: {
    position: 'absolute',
    left: 33,
    top: 115,
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  sharedLinkBannerCta: {
    position: 'absolute',
    left: 27,
    top: 171,
    height: 22,
    minWidth: 146,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sharedLinkBannerCtaText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  sharedLinkBannerArrow: {
    width: 17,
    height: 10,
    marginLeft: 6,
    tintColor: '#fff',
    transform: [{ rotate: '90deg' }],
  },
  sharedLinkBannerUnderline: {
    position: 'absolute',
    left: 33,
    top: 189,
    width: 99,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  sharedLinkBannerCharacter: {
    position: 'absolute',
    left: 245,
    top: 57,
    width: 168,
    height: 140,
  },
  sharedPublicTitle: {
    position: 'absolute',
    left: 21,
    top: 393,
    color: '#141517',
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  sharedPublicCount: {
    position: 'absolute',
    right: 22,
    top: 397,
    color: '#666',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  sharedPublicGrid: {
    position: 'absolute',
    left: 22,
    top: 435,
    width: 359,
    gap: 18,
  },
  sharedPublicRow: {
    width: 359,
    flexDirection: 'row',
    gap: 12,
  },
  sharedPublicPuzzleCard: {
    width: 173.5,
    height: 156,
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  sharedPublicPuzzlePreview: {
    width: 173.5,
    height: 122,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    overflow: 'hidden',
  },
  sharedPublicPuzzleImage: {
    position: 'absolute',
  },
  sharedPublicPuzzlePhoto: {
    left: 0,
    top: -26,
    width: 173.5,
    height: 173.5,
  },
  sharedPublicEmptyText: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 470,
    color: designSystem.color.muted,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  sharedPublicLockedScrim: {
    position: 'absolute',
    left: -10,
    top: -8,
    width: 190,
    height: 138,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  sharedPublicLockIcon: {
    position: 'absolute',
    left: 68,
    top: 46,
    width: 30,
    height: 30,
  },
  sharedPublicPuzzleMeta: {
    height: 34,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sharedPublicPuzzleDate: {
    color: '#8b8496',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  sharedPublicPuzzleLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sharedPublicPuzzleLinkText: {
    color: '#a26ffd',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  sharedPublicPuzzleArrow: {
    width: 11,
    height: 7,
    marginLeft: 3,
    tintColor: '#a26ffd',
    transform: [{ rotate: '90deg' }],
  },
  sharedPublicModalOverlay: {
    position: 'absolute',
    left: -18,
    top: -16,
    width: 439,
    height: 901,
    backgroundColor: 'rgba(0, 0, 0, 0.36)',
    zIndex: 10,
  },
  sharedPublicModalCard: {
    position: 'absolute',
    left: 56,
    top: 234,
    width: 332,
    height: 455,
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  sharedPublicModalTitle: {
    position: 'absolute',
    left: 7,
    top: 22,
    width: 318,
    height: 79,
    color: '#202020',
    fontFamily: designSystem.font.display,
    fontSize: 23,
    lineHeight: 34,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  sharedPublicModalClose: {
    position: 'absolute',
    right: 13,
    top: 12,
    width: 27,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  sharedPublicModalCloseIcon: {
    width: 27,
    height: 27,
  },
  sharedPublicModalPuzzle: {
    position: 'absolute',
    left: 38,
    top: 66,
    width: 256,
    height: 231,
    borderRadius: 12,
  },
  sharedPublicModalLaterButton: {
    position: 'absolute',
    left: 23,
    top: 323,
    width: 285,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#d9d9d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedPublicModalStartButton: {
    position: 'absolute',
    left: 22,
    top: 375,
    width: 288,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#2d3440',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sharedPublicModalButtonText: {
    color: '#fff',
    fontFamily: designSystem.font.family,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  linkCreatedRoot: {
    flex: 1,
    backgroundColor: '#fff',
  },
  linkCreatedTitle: {
    position: 'absolute',
    left: 38,
    top: 162,
    width: 267,
    height: 197,
    color: '#030303',
    fontFamily: designSystem.font.display,
    fontSize: 28,
    lineHeight: 43,
    fontWeight: '800',
    letterSpacing: 2,
    includeFontPadding: false,
  },
  linkCreatedTitleAccent: {
    color: '#b38cfb',
  },
  linkCreatedPuzzle: {
    position: 'absolute',
    left: 77,
    top: 325,
    width: 228,
    height: 242,
  },
  linkCreatedDescription: {
    position: 'absolute',
    left: 0,
    top: 579,
    width: 390,
    color: 'rgba(3, 3, 3, 0.4)',
    fontFamily: designSystem.font.family,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  linkCreatedShareButton: {
    position: 'absolute',
    left: 23,
    top: 723,
    width: 343,
    height: 54,
    borderRadius: 8,
    backgroundColor: '#2d3440',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkCreatedShareText: {
    color: '#fff',
    fontFamily: designSystem.font.family,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  linkCreatedSkipButton: {
    position: 'absolute',
    left: 125,
    top: 792,
    width: 140,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkCreatedSkipText: {
    color: '#9f9f9f',
    fontFamily: designSystem.font.family,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  receivedButton: {
    position: 'absolute',
    left: 23,
    top: 735,
    width: designSystem.size.buttonWidth,
    height: designSystem.size.buttonHeight,
    borderRadius: designSystem.radius.button,
    backgroundColor: designSystem.color.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeRoot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -STATUS_STRIP,
    height: FRAME_HEIGHT,
    backgroundColor: '#fff',
  },
  homeLogo: {
    position: 'absolute',
    left: 158,
    top: 71,
    width: 86,
    height: 45,
  },
  homeMenuIcon: {
    position: 'absolute',
    left: 16,
    top: 83,
    width: 21,
    height: 21,
    transform: [{ rotate: '180deg' }, { scaleY: -1 }],
  },
  homeBellIcon: {
    position: 'absolute',
    left: 365,
    top: 83,
    width: 21,
    height: 21,
  },
  homeBanner: {
    position: 'absolute',
    left: -6,
    top: 128,
    width: 403,
    height: 175,
    backgroundColor: '#a26ffd',
    overflow: 'hidden',
  },
  homeBannerCharacter: {
    position: 'absolute',
    left: 241,
    top: 35,
    width: 168,
    height: 140,
  },
  homeBannerTitle: {
    position: 'absolute',
    left: 27,
    top: 22,
    color: '#fff',
    fontFamily: designSystem.font.family,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '700',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  homeBannerDescription: {
    position: 'absolute',
    left: 27,
    top: 83,
    color: '#fff',
    fontFamily: designSystem.font.family,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  homeShareUnderline: {
    position: 'absolute',
    left: 27,
    top: 151,
    width: 116,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  homeShareLink: {
    position: 'absolute',
    left: 27,
    top: 133,
    flexDirection: 'row',
    alignItems: 'center',
  },
  homeShareButtonText: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: designSystem.font.family,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  homeShareButtonArrow: {
    marginLeft: 8,
    width: 21,
    height: 12,
    transform: [{ rotate: '90deg' }],
  },
  homeSectionHeader: {
    position: 'absolute',
    left: 20,
    right: 22,
    height: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homeReceivedHeader: {
    top: 331,
  },
  homeSentHeader: {
    top: 563,
  },
  homeSectionTitleWrap: {
    height: 24,
    justifyContent: 'flex-end',
  },
  homeSectionHighlight: {
    position: 'absolute',
    top: 19,
    width: 64,
    height: 4,
    backgroundColor: '#d3b4fb',
    zIndex: 0,
  },
  homeReceivedHighlight: {
    left: 51,
  },
  homeSentHighlight: {
    left: 34,
  },
  homeSectionTitle: {
    position: 'relative',
    color: '#141517',
    fontFamily: designSystem.font.family,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '600',
    zIndex: 1,
    includeFontPadding: false,
  },
  homeSectionHeart: {
    position: 'absolute',
    left: 121,
    top: 6,
    width: 18,
    height: 17,
    zIndex: 1,
  },
  homeSectionMore: {
    color: '#666',
    fontFamily: designSystem.font.family,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    includeFontPadding: false,
  },
  homeReceivedRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 365,
    height: 174,
  },
  homeSentRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 597,
    height: 174,
  },
  homePuzzleRowContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 15,
    alignItems: 'center',
  },
  homePuzzleTile: {
    width: 135,
    height: 146,
    borderRadius: 10,
    backgroundColor: designSystem.color.background,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  homePuzzleBadge: {
    position: 'absolute',
    left: 44,
    top: 11,
    width: 49,
    height: 19,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  homePuzzleBadgePractice: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#78c8ba',
  },
  homePuzzleBadgeNew: {
    backgroundColor: '#feb5d8',
  },
  homePuzzleBadgeYellow: {
    backgroundColor: '#fded7f',
  },
  homePuzzleBadgePurple: {
    backgroundColor: '#ab81ff',
  },
  homePuzzleBadgeText: {
    fontFamily: designSystem.font.family,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '800',
  },
  homePuzzleBadgeTextPractice: {
    color: '#78c8ba',
  },
  homePuzzleBadgeTextNew: {
    color: '#fff',
  },
  homePuzzlePracticeImage: {
    position: 'absolute',
    left: 16,
    top: 46,
    width: 92,
    height: 48,
  },
  homePuzzleGiftImage: {
    position: 'absolute',
    left: 29,
    top: 34,
    width: 77,
    height: 77,
  },
  homePuzzleLabel: {
    position: 'absolute',
    left: 14,
    top: 115,
    width: 107,
    color: '#141517',
    fontFamily: designSystem.font.family,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  homePhotoTile: {
    width: 135,
    height: 146,
    borderRadius: 10,
    backgroundColor: designSystem.color.background,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  homePhotoTileImage: {
    position: 'absolute',
  },
  homeSentPhotoImage: {
    left: 0,
    top: 0,
    width: 135,
    height: 146,
  },
  homeSentEmpty: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 618,
    height: 121,
    alignItems: 'center',
    zIndex: 1,
  },
  homeSentEmptyImage: {
    position: 'absolute',
    top: 0,
    width: 99,
    height: 74,
    opacity: 1,
    zIndex: 2,
  },
  homeSentEmptyText: {
    position: 'absolute',
    top: 93,
    color: 'rgba(3,3,3,0.4)',
    fontFamily: designSystem.font.family,
    fontSize: 15,
    lineHeight: 28,
    fontWeight: '500',
    includeFontPadding: false,
  },
  receivedNoticeOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.36)',
    zIndex: 20,
  },
  receivedNoticeCard: {
    position: 'absolute',
    left: 29,
    top: 255,
    width: 332,
    height: 412,
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  receivedNoticeClose: {
    position: 'absolute',
    left: 292,
    top: 12,
    width: 27,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  receivedNoticeCloseIcon: {
    width: 27,
    height: 27,
  },
  receivedNoticeTitle: {
    position: 'absolute',
    left: 7,
    top: 44,
    width: 318,
    color: '#202020',
    fontFamily: designSystem.font.display,
    fontSize: 23,
    lineHeight: 34,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
  },
  receivedNoticeTitleAccent: {
    color: '#ab81ff',
  },
  receivedNoticePuzzle: {
    position: 'absolute',
    left: 88,
    top: 128,
    width: 155,
    height: 155,
    transform: [{ rotate: '15.85deg' }],
    zIndex: 1,
  },
  receivedNoticeShadow: {
    position: 'absolute',
    left: 102,
    top: 241,
    width: 119,
    height: 13,
    borderRadius: 60,
    backgroundColor: 'rgba(150,116,224,0.22)',
  },
  receivedNoticeLaterButton: {
    position: 'absolute',
    left: 23,
    top: 293,
    width: 285,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#d9d9d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receivedNoticeStartButton: {
    position: 'absolute',
    left: 22,
    top: 345,
    width: 288,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#2d3440',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receivedNoticeLaterText: {
    color: '#fff',
    fontFamily: designSystem.font.family,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '600',
    includeFontPadding: false,
  },
  receivedNoticeStartText: {
    color: '#fff',
    fontFamily: designSystem.font.family,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '600',
    includeFontPadding: false,
  },
  confirmCard: {
    position: 'absolute',
    left: 29,
    top: 340,
    width: 332,
    height: 244,
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  confirmTitle: {
    position: 'absolute',
    left: 7,
    top: 32,
    width: 318,
    color: '#202020',
    fontFamily: designSystem.font.display,
    fontSize: 23,
    lineHeight: 34,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
  },
  confirmMessage: {
    position: 'absolute',
    left: 16,
    top: 76,
    width: 300,
    color: '#666',
    fontFamily: designSystem.font.family,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
    textAlign: 'center',
    includeFontPadding: false,
  },
  confirmCancelButton: {
    position: 'absolute',
    left: 22,
    top: 128,
    width: 288,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#d9d9d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmOkButton: {
    position: 'absolute',
    left: 22,
    top: 180,
    width: 288,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#2d3440',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRoot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -STATUS_STRIP,
    height: FRAME_HEIGHT,
    backgroundColor: '#fff',
  },
  profileTopBar: {
    position: 'absolute',
    left: -6,
    top: 2,
    width: 402,
    height: 105,
    backgroundColor: '#fff',
    borderBottomWidth: 1.2,
    borderBottomColor: '#e6e7e9',
  },
  profileBackButton: {
    position: 'absolute',
    left: 16,
    top: 66,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBackIcon: {
    color: '#141517',
    fontFamily: designSystem.font.family,
    fontSize: 32,
    lineHeight: 32,
    fontWeight: '300',
    includeFontPadding: false,
  },
  profileTopTitle: {
    position: 'absolute',
    left: 166,
    top: 67,
    width: 68,
    color: '#141517',
    fontFamily: designSystem.font.family,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
  },
  profileSummary: {
    position: 'absolute',
    left: 0,
    top: 107,
    width: 404,
    height: 131,
    borderBottomWidth: 1,
    borderBottomColor: '#e6e7e9',
  },
  profileAvatarCircle: {
    position: 'absolute',
    left: 29,
    top: 31,
    width: 61,
    height: 61,
    borderRadius: 100,
    backgroundColor: '#f5f2fd',
    overflow: 'hidden',
  },
  profileAvatarImage: {
    position: 'absolute',
    left: 8,
    top: 8,
    width: 46,
    height: 46,
  },
  profileName: {
    position: 'absolute',
    left: 103,
    top: 39,
    color: '#141517',
    fontFamily: designSystem.font.family,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '600',
    includeFontPadding: false,
  },
  profileCreatedAt: {
    position: 'absolute',
    left: 103,
    top: 65,
    width: 241,
    color: '#666',
    fontFamily: designSystem.font.family,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    includeFontPadding: false,
  },
  profileSectionHeader: {
    position: 'absolute',
    left: 0,
    width: 402,
    height: 38,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
  },
  profileSectionHeaderText: {
    marginLeft: 32,
    color: '#030303',
    fontFamily: designSystem.font.family,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    includeFontPadding: false,
  },
  profileRow: {
    position: 'absolute',
    left: 0,
    width: 402,
    height: 51,
  },
  profileRowText: {
    position: 'absolute',
    left: 32,
    top: 12,
    color: '#4e4e4e',
    fontFamily: designSystem.font.family,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    includeFontPadding: false,
  },
  profileRowTextAccent: {
    color: '#6b3ec5',
  },
  profileRowChevron: {
    position: 'absolute',
    left: 363,
    top: 13,
    width: 16,
    height: 16,
  },
  profileRowDivider: {
    position: 'absolute',
    left: 24,
    top: 46,
    width: 355,
    height: 1,
    backgroundColor: '#e6e7e9',
  },
  puzzleBoxRoot: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -STATUS_STRIP,
    height: FRAME_HEIGHT,
    backgroundColor: '#fff',
  },
  puzzleBoxTopBar: {
    position: 'absolute',
    left: -6,
    top: 2,
    width: 402,
    height: 105,
    backgroundColor: '#fff',
    borderBottomWidth: 1.2,
    borderBottomColor: '#e6e7e9',
  },
  puzzleBoxBackButton: {
    position: 'absolute',
    left: 16,
    top: 66,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  puzzleBoxBackIcon: {
    color: '#141517',
    fontFamily: designSystem.font.family,
    fontSize: 32,
    lineHeight: 32,
    fontWeight: '300',
    includeFontPadding: false,
  },
  puzzleBoxTitle: {
    position: 'absolute',
    left: 166,
    top: 67,
    width: 68,
    color: '#141517',
    fontFamily: designSystem.font.family,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
  },
  puzzleBoxTabBar: {
    position: 'absolute',
    left: -6,
    top: 95,
    width: 402,
    height: 60,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
  },
  puzzleBoxTabText: {
    width: 110,
    color: '#666',
    fontFamily: designSystem.font.family,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
    includeFontPadding: false,
  },
  puzzleBoxTabTextActive: {
    color: '#ab81ff',
    fontWeight: '700',
  },
  puzzleBoxTabTextInactive: {
    color: '#666',
    fontWeight: '500',
  },
  puzzleBoxTabButton: {
    position: 'absolute',
    top: 0,
    width: 200,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  puzzleBoxTabButtonReceived: {
    left: 0,
  },
  puzzleBoxTabButtonSent: {
    left: 200,
  },
  puzzleBoxTabIndicator: {
    position: 'absolute',
    left: 0,
    top: 59,
    width: 200,
    height: 2,
    backgroundColor: '#ab81ff',
  },
  puzzleBoxTabIndicatorSent: {
    left: 205,
  },
  puzzleBoxUnsolvedTitle: {
    position: 'absolute',
    left: 25,
    top: 183,
    color: '#141517',
    fontFamily: designSystem.font.family,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '600',
    includeFontPadding: false,
  },
  puzzleBoxUnsolvedHighlight: {
    position: 'absolute',
    left: 60,
    top: 199,
    width: 67,
    height: 4,
    backgroundColor: '#d3b4fb',
  },
  puzzleBoxUnsolvedRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 209,
    height: 176,
  },
  puzzleBoxRowContent: {
    paddingLeft: 25,
    paddingRight: 24,
    paddingVertical: 10,
    gap: 16,
    alignItems: 'center',
  },
  puzzleBoxSolvedTitle: {
    position: 'absolute',
    left: 25,
    top: 408,
    color: '#141517',
    fontFamily: designSystem.font.family,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '600',
    includeFontPadding: false,
  },
  puzzleBoxSolvedRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 435,
    height: 336,
  },
  puzzleBoxSolvedRowContent: {
    paddingHorizontal: 26,
    paddingVertical: 10,
    gap: 16,
  },
  puzzleBoxSolvedEmptyText: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 520,
    color: designSystem.color.muted,
    fontFamily: designSystem.font.family,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
    includeFontPadding: false,
  },
  puzzleBoxSolvedCard: {
    width: 349,
    height: 316,
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  puzzleBoxSolvedImage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 349,
    height: 316,
  },
  puzzleBoxSentScroll: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 170,
    height: 600,
  },
  puzzleBoxSentGrid: {
    paddingLeft: 29,
    paddingRight: 24,
    paddingTop: 14,
    paddingBottom: 100,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 23,
    rowGap: 24,
  },
  puzzleBoxSentTile: {
    width: 157,
    height: 177,
  },
  puzzleBoxSentPhotoImage: {
    left: 0,
    top: 0,
    width: 157,
    height: 177,
  },
  puzzleBoxSentEmpty: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 330,
    height: 121,
    alignItems: 'center',
  },
  puzzleBoxPublicBadge: {
    position: 'absolute',
    right: 13,
    top: 11,
    width: 62,
    height: 24,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  puzzleBoxPublicBadgeText: {
    color: '#fff',
    fontFamily: designSystem.font.family,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '800',
    includeFontPadding: false,
  },
  puzzleBoxCreateButton: {
    position: 'absolute',
    left: 328,
    top: 692,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ab81ff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  puzzleBoxCreateButtonText: {
    color: '#fff',
    fontFamily: designSystem.font.family,
    fontSize: 42,
    lineHeight: 44,
    fontWeight: '300',
    includeFontPadding: false,
  },
  homeTabBar: {
    position: 'absolute',
    left: -1,
    right: 0,
    top: 782,
    width: 405,
    height: 93,
    backgroundColor: designSystem.color.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: '#828282',
    shadowOpacity: 0.15,
    shadowRadius: 80,
    shadowOffset: { width: 0, height: -5 },
    elevation: 20,
    zIndex: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
  },
  homeTabGlow: {
    position: 'absolute',
    left: 146,
    top: 613,
    width: 113,
    height: 93,
    zIndex: 0,
  },
  homeTabButton: {
    width: 92,
    height: 78,
    alignItems: 'center',
    zIndex: 40,
  },
  homeTabItem: {
    position: 'absolute',
    top: 0,
    width: 92,
    height: 78,
    alignItems: 'center',
  },
  homeTabItemHome: {
    left: 31,
  },
  homeTabItemPuzzle: {
    left: 144,
  },
  homeTabItemProfile: {
    left: 274,
  },
  homeTabHomeIcon: {
    marginTop: 19,
    width: 20,
    height: 20,
  },
  homeTabPuzzleIcon: {
    position: 'absolute',
    top: 17,
    left: 33.5,
    width: 25,
    height: 25,
  },
  homeTabPuzzleIconFlow: {
    position: 'relative',
    top: 0,
    left: 0,
    marginTop: -21,
  },
  homeTabBookIcon: {
    marginTop: 20,
    width: 21,
    height: 21,
    opacity: 0,
  },
  homeTabBookOutlineIcon: {
    marginTop: 20,
    width: 22,
    height: 22,
    opacity: 0,
  },
  homeTabProfileIcon: {
    position: 'absolute',
    top: 21,
    left: 36.5,
    width: 19,
    height: 19,
  },
  homeTabProfileIconFlow: {
    position: 'relative',
    top: 0,
    left: 0,
    marginTop: -22,
  },
  homeTabLabel: {
    marginTop: 8,
    width: 92,
    color: '#616161',
    fontFamily: designSystem.font.family,
    fontSize: 11,
    lineHeight: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  homeTabLabelActive: {
    color: '#374957',
    fontWeight: '600',
  },
  homeTabLabelInactive: {
    color: '#616161',
    fontWeight: '500',
  },
  homeTabIconInactive: {
    opacity: 0.35,
  },
  homeTabIndicator: {
    position: 'absolute',
    left: 120,
    top: 82,
    width: 150,
    height: 5,
    borderRadius: 108,
    backgroundColor: '#3c3c3c',
    opacity: 0.1,
  },
  homeTabHitHome: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 130,
    height: 82,
    zIndex: 30,
  },
  homeTabHitPuzzle: {
    position: 'absolute',
    left: 130,
    top: 0,
    width: 130,
    height: 82,
    zIndex: 30,
  },
  homeTabHitProfile: {
    position: 'absolute',
    left: 260,
    top: 0,
    width: 145,
    height: 82,
    zIndex: 30,
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: designSystem.size.topBarHeight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: designSystem.color.background,
    zIndex: 20,
  },
  topBarBorder: {
    borderBottomWidth: 1.2,
    borderBottomColor: designSystem.color.border,
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
    color: designSystem.color.text,
    fontSize: 32,
    lineHeight: 32,
    fontWeight: '300',
  },
  topBarTitle: {
    color: designSystem.color.text,
    fontSize: designSystem.font.topBarTitle,
    fontWeight: '700',
    letterSpacing: 0,
  },
  photoPuzzleArea: {
    position: 'absolute',
    left: 32,
    top: 126,
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
    left: 135,
    top: 97,
    width: 63,
    height: 63,
  },
  photoPrompt: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 178,
    color: designSystem.color.muted,
    fontSize: designSystem.font.body,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  cardPinkPuzzle: {
    left: 11,
    top: 126,
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
    left: 337,
    top: 402,
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
    left: 310,
    top: 493,
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
    top: 468,
    alignItems: 'center',
  },
  cardTitleLine: {
    color: '#030303',
    fontSize: designSystem.font.hero,
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
    top: 595,
    color: 'rgba(3,3,3,0.58)',
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  cardSelectButton: {
    position: 'absolute',
    left: 23,
    top: 723,
    width: designSystem.size.buttonWidth,
    height: designSystem.size.buttonHeight,
    borderRadius: designSystem.radius.button,
    backgroundColor: designSystem.color.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHelperText: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 795,
    color: designSystem.color.muted,
    fontSize: designSystem.font.body,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 46,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f1f1',
    backgroundColor: designSystem.color.background,
    zIndex: 15,
  },
  photoTab: {
    position: 'absolute',
    top: 0,
    width: 201.5,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentPhotoTab: {
    left: 0,
  },
  favoritePhotoTab: {
    right: 0,
  },
  photoTabText: {
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    letterSpacing: 0,
  },
  activePhotoTabText: {
    color: designSystem.color.primary,
    fontWeight: '700',
  },
  inactivePhotoTabText: {
    color: '#666',
    fontWeight: '500',
  },
  activeTabLine: {
    position: 'absolute',
    left: 0,
    bottom: -1,
    width: 200,
    height: 2,
    backgroundColor: designSystem.color.primary,
  },
  favoriteTabLine: {
    left: 201.5,
  },
  photoGrid: {
    position: 'absolute',
    left: GRID_LEFT,
    top: GRID_TOP,
    width: TILE_WIDTH * 3 + GRID_GAP_X * 2,
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
  emptyFavoriteState: {
    position: 'absolute',
    left: 0,
    top: 150,
    width: TILE_WIDTH * 3 + GRID_GAP_X * 2,
    alignItems: 'center',
  },
  emptyFavoriteTitle: {
    color: '#5a5959',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyFavoriteBody: {
    marginTop: 8,
    color: designSystem.color.muted,
    fontSize: designSystem.font.caption,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 403,
    height: 173,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: designSystem.color.background,
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
    width: designSystem.size.buttonWidth,
    height: designSystem.size.buttonHeight,
    borderRadius: designSystem.radius.button,
    backgroundColor: designSystem.color.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: designSystem.color.disabled,
  },
  solveCounter: {
    position: 'absolute',
    right: 57,
    top: 96,
    width: 86,
    height: 33,
    borderRadius: 20,
    backgroundColor: designSystem.color.background,
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
    height: 23,
  },
  solveCounterText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  solveCounterDone: {
    color: designSystem.color.primary,
  },
  solveCounterTotal: {
    color: '#cecece',
  },
  solveBoard: {
    position: 'absolute',
    left: 44,
    top: 152,
    width: 302,
    height: 302,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: designSystem.color.background,
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
  solveSlot: {
    width: 100.67,
    height: 100.67,
    backgroundColor: 'transparent',
  },
  solvePlacedPiece: {
    position: 'absolute',
    left: -14,
    top: -14,
    width: 128,
    height: 128,
  },
  solveTray: {
    position: 'absolute',
    left: 44,
    top: 464,
    width: 302,
    height: 136,
    borderRadius: designSystem.radius.panel,
    backgroundColor: designSystem.color.background,
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
    gap: 14,
  },
  solvePieceButton: {
    width: 128,
    height: 128,
    borderRadius: designSystem.radius.card,
  },
  selectedSolvePiece: {
    transform: [{ scale: 1.04 }],
    opacity: 0.86,
  },
  draggingSolvePiece: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: designSystem.radius.card,
    zIndex: 60,
    opacity: 0.94,
  },
  solvePieceImage: {
    width: '100%',
    height: '100%',
  },
  solveEmptyTrayText: {
    color: designSystem.color.muted,
    fontSize: designSystem.font.body,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  solveArrowLeft: {
    position: 'absolute',
    left: 8,
    top: 50,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: designSystem.color.background,
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
    right: 8,
    top: 50,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: designSystem.color.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  solveArrowChevron: {
    width: 9,
    height: 9,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: '#b6b6b6',
    transform: [{ rotate: '45deg' }],
  },
  solveArrowChevronLeft: {
    transform: [{ rotate: '-135deg' }],
  },
  disabledSolveArrow: {
    opacity: 0.35,
  },
  solveBottomSheet: {
    position: 'absolute',
    left: -7,
    bottom: 0,
    width: 403,
    height: 173,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: designSystem.color.background,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: 5 },
  },
  solveCompleteButton: {
    position: 'absolute',
    left: 44,
    top: 24,
    width: designSystem.size.buttonWidth,
    height: designSystem.size.buttonHeight,
    borderRadius: designSystem.radius.button,
    backgroundColor: designSystem.color.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solveHelperText: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 96,
    color: designSystem.color.muted,
    fontSize: designSystem.font.body,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  solvedCompleteCelebration: {
    position: 'absolute',
    left: 161,
    top: 101,
    width: 67,
    height: 100,
  },
  solvedCompleteTitle: {
    position: 'absolute',
    left: 36,
    top: 206,
    width: 318,
    color: '#030303',
    fontSize: designSystem.font.hero,
    lineHeight: 40,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0,
  },
  solvedCompleteSubtitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 253,
    color: designSystem.color.muted,
    fontSize: 17,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  solvedCompletePuzzleFrame: {
    position: 'absolute',
    left: 22,
    top: 299,
    width: 347,
    height: 314,
    borderRadius: designSystem.radius.card,
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
    top: 651,
    width: designSystem.size.buttonWidth,
    height: designSystem.size.buttonHeight,
    borderRadius: designSystem.radius.button,
    backgroundColor: designSystem.color.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  solvedLoginNotice: {
    position: 'absolute',
    left: 24,
    top: 719,
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
    color: designSystem.color.text,
    fontSize: designSystem.font.body,
    lineHeight: 28,
    fontWeight: '700',
  },
  solvedLoginNoticeBody: {
    position: 'absolute',
    left: 15,
    top: 42,
    color: designSystem.color.primaryDark,
    fontSize: designSystem.font.caption,
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
    color: designSystem.color.muted,
    fontSize: designSystem.font.body,
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
    borderRadius: 20,
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
  imageBadgeText: {
    color: '#fff',
    fontFamily: designSystem.font.family,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '500',
    includeFontPadding: false,
  },
  puzzleControls: {
    position: 'absolute',
    left: 36,
    top: 460,
    width: 330,
    height: 227,
    borderRadius: designSystem.radius.panel,
    borderWidth: 1,
    borderColor: designSystem.color.panelBorder,
    overflow: 'hidden',
    backgroundColor: designSystem.color.background,
  },
  toolTabs: {
    height: 43,
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
  },
  toolTab: {
    width: 165,
    height: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  toolTabPencilIcon: {
    width: 14,
    height: 14,
  },
  toolTabTextIcon: {
    width: 12,
    height: 13,
  },
  activeToolTab: {
    backgroundColor: designSystem.color.background,
    borderTopLeftRadius: designSystem.radius.panel,
    borderTopRightRadius: designSystem.radius.panel,
  },
  toolTabText: {
    color: designSystem.color.muted,
    fontSize: designSystem.font.body,
    fontWeight: '500',
  },
  activeToolTabText: {
    color: designSystem.color.primary,
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
    top: 24,
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
    top: 136,
    color: 'rgba(90,89,89,0.7)',
    fontSize: 13,
    fontWeight: '700',
  },
  sliderTouchArea: {
    position: 'absolute',
    left: 28,
    top: 153,
    width: 242,
    height: 28,
    justifyContent: 'center',
  },
  sliderTrack: {
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
    top: 7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#626262',
  },
  sliderValue: {
    position: 'absolute',
    right: 27,
    top: 155,
    color: 'rgba(90,89,89,0.7)',
    fontSize: 12,
    fontWeight: '700',
  },
  textBox: {
    position: 'absolute',
    left: 17,
    top: 20,
    width: 293,
    height: 71,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(129,129,129,0.2)',
    paddingHorizontal: 10,
    paddingTop: 10,
    color: '#141517',
    fontSize: 14,
    lineHeight: 18,
    textAlignVertical: 'top',
  },
  textColorLabel: {
    position: 'absolute',
    left: 20,
    top: 110,
    color: 'rgba(90,89,89,0.7)',
    fontSize: 13,
    fontWeight: '700',
  },
  textColorRow: {
    position: 'absolute',
    left: 20,
    top: 138,
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
    left: 271,
    top: 427,
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redoButton: {
    position: 'absolute',
    left: 301,
    top: 427,
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashButton: {
    position: 'absolute',
    left: 336,
    top: 430,
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyIcon: {
    width: 25,
    height: 25,
  },
  trashIcon: {
    width: 17,
    height: 15,
  },
  completeButton: {
    position: 'absolute',
    left: 23,
    top: 733,
    width: designSystem.size.buttonWidth,
    height: designSystem.size.buttonHeight,
    borderRadius: designSystem.radius.button,
    backgroundColor: designSystem.color.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiDecoratePreview: {
    position: 'absolute',
    left: 30,
    top: 89,
    width: 330,
    height: 330,
    borderRadius: 20,
    backgroundColor: '#d3d3d3',
    overflow: 'hidden',
  },
  aiDecoratePreviewImage: {
    position: 'absolute',
    left: -5,
    top: -6,
    width: 341,
    height: 341,
  },
  aiDecorateTitle: {
    position: 'absolute',
    left: 31,
    top: 452,
    color: '#141517',
    fontFamily: designSystem.font.family,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  aiDecorateHelper: {
    position: 'absolute',
    left: 31,
    top: 478,
    color: '#9f9f9f',
    fontFamily: designSystem.font.family,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  aiPromptBox: {
    position: 'absolute',
    left: 27,
    top: 514,
    width: 336,
    height: 135,
    borderRadius: 6,
    borderWidth: 1.4,
    borderColor: 'rgba(171, 129, 255, 0.5)',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  aiPromptInput: {
    position: 'absolute',
    left: 13,
    top: 9,
    width: 282,
    height: 82,
    padding: 0,
    color: '#141517',
    fontFamily: designSystem.font.family,
    fontSize: 15,
    lineHeight: 25,
    fontWeight: '500',
    textAlignVertical: 'top',
    outlineStyle: 'none' as never,
  },
  aiPromptSparkle: {
    position: 'absolute',
    right: 15,
    top: 8,
    width: 33,
    height: 31,
  },
  aiPromptCount: {
    position: 'absolute',
    right: 16,
    top: 97,
    width: 60,
    color: 'rgba(121, 121, 121, 0.49)',
    fontFamily: designSystem.font.family,
    fontSize: 13,
    lineHeight: 25,
    fontWeight: '500',
    textAlign: 'right',
    includeFontPadding: false,
  },
  aiApplyButton: {
    position: 'absolute',
    left: 23,
    top: 676,
    width: designSystem.size.buttonWidth,
    height: designSystem.size.buttonHeight,
    borderRadius: designSystem.radius.button,
    backgroundColor: designSystem.color.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiApplyButtonText: {
    color: '#fff',
    fontFamily: designSystem.font.family,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '600',
    includeFontPadding: false,
  },
  aiSkipButton: {
    position: 'absolute',
    left: 125,
    top: 741,
    width: 140,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiSkipText: {
    color: '#9f9f9f',
    fontFamily: designSystem.font.family,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    includeFontPadding: false,
  },
  celebrationImage: {
    position: 'absolute',
    left: 162,
    top: 87,
    width: 67,
    height: 100,
  },
  completeTitle: {
    position: 'absolute',
    left: 36,
    right: 36,
    top: 192,
    color: '#030303',
    fontSize: designSystem.font.hero,
    lineHeight: 40,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0,
  },
  completeTitleAccent: {
    color: designSystem.color.primary,
  },
  completeSubtitle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 234,
    color: designSystem.color.muted,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0,
  },
  completedPuzzleFrame: {
    position: 'absolute',
    left: 30,
    top: 285,
    width: 330,
    height: 330,
    borderRadius: designSystem.radius.card,
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
  shareButton: {
    position: 'absolute',
    left: 29,
    top: 637,
    width: designSystem.size.buttonWidth,
    height: designSystem.size.buttonHeight,
    borderRadius: designSystem.radius.button,
    backgroundColor: designSystem.color.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginNotice: {
    position: 'absolute',
    left: 30,
    top: 705,
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
