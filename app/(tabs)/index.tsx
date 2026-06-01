import { BlinkingCursor } from '@/components/blinking-cursor';
import { CameraScanner } from '@/components/camera-scanner';
import { CasioAuth, CasioAuthHandle } from '@/components/casio-auth';
import { CasioChart } from '@/components/casio-chart';
import { CasioGallery } from '@/components/casio-gallery';
import { CasioSettings } from '@/components/casio-settings';
import { CasioSketch } from '@/components/casio-sketch';
import { CasioTelegram } from '@/components/casio-telegram';
import { CasioStatusBar } from '@/components/casio-status-bar';
import { CasioTable } from '@/components/casio-table';
import { LCDGrid } from '@/components/lcd-grid';
import { MathRenderer } from '@/components/math-renderer';
import { RadialMenu } from '@/components/radial-menu';
import { SidebarKeyboard } from '@/components/sidebar-keyboard';
import { isChartLikePayload, normalizeChartData } from '@/lib/ai-chart';
import { normalizeTableData, parseMarkdownTable, splitMarkdownTables } from '@/lib/ai-table';
import { CASIO_AI_URL } from '@/lib/casio-ai';
import { supabase } from '@/lib/supabase';
import { DotGothic16_400Regular, useFonts } from '@expo-google-fonts/dotgothic16';
import { Ionicons } from '@expo/vector-icons';
import { addBatteryLevelListener, getBatteryLevelAsync, type Subscription } from 'expo-battery';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Keyboard, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

const SCREEN_WIDTH = 374;
const SCREEN_HEIGHT = 160;

export default function HomeScreen() {
  const [fontsLoaded] = useFonts({
    DotGothic16: DotGothic16_400Regular,
  });

  const [powerOn, setPowerOn] = useState(false);
  const [showCursor, setShowCursor] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string, image?: string | null }[]>([]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string, username: string } | null>(null);
  const [currentView, setCurrentView] = useState<'chat' | 'more' | 'history' | 'gallery' | 'imagePicker' | 'settings' | 'auth' | 'subjects' | 'subjectPapers' | 'attachmentOptions' | 'telegram'>('chat');
  const [telegramInput, setTelegramInput] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isSplash, setIsSplash] = useState(false);
  const [appMode, setAppMode] = useState<'calculator' | 'chat'>('calculator');
  const [isFrozen, setIsFrozen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [processingIndex, setProcessingIndex] = useState(-1);
  const [totalInBatch, setTotalInBatch] = useState(1);
  const [keyboardMode, setKeyboardMode] = useState<'alpha' | 'num' | 'shorts' | 'mods'>('alpha');
  const [aiModel, setAiModel] = useState<'flash' | 'pro'>('flash');
  const [selectedSubjectNames, setSelectedSubjectNames] = useState<string[]>([]);
  const [subjectPapers, setSubjectPapers] = useState<any[]>([]);
  const [selectedPaperIds, setSelectedPaperIds] = useState<string[]>([]);
  const [isLoadingPapers, setIsLoadingPapers] = useState(false);
  const [subjectCounts, setSubjectCounts] = useState<Record<string, number>>({});

  const fetchSubjectCounts = async () => {
    const { data } = await supabase.from('papers').select('subject');
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((p: any) => {
        counts[p.subject] = (counts[p.subject] || 0) + 1;
      });
      setSubjectCounts(counts);
    }
  };

  useEffect(() => {
    if (currentView === 'subjects') {
      fetchSubjectCounts();
    }
  }, [currentView]);

  // Advanced System Settings
  const [lcdContrast, setLcdContrast] = useState(1.0); // 1.0 = MAX (Sharpest)
  const [systemBrightness, setSystemBrightness] = useState(0.0); // 0.0 = OFF
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [typewriterSpeed] = useState<'fast' | 'realistic'>('fast');



  const isFrozenRef = useRef(false);

  useEffect(() => {
    isFrozenRef.current = isFrozen;
  }, [isFrozen]);

  const keyboardAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const scrollRef = useRef<ScrollView>(null);
  const authRef = useRef<CasioAuthHandle>(null);

  const lastTap = useRef(0);
  const tapCount = useRef(0);
  const swipeCount = useRef(0);
  const swipeResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // PanResponder: detects 3 right swipes to freeze
  const swipePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isFrozenRef.current,
      onMoveShouldSetPanResponder: (_, gs) =>
        (isFrozenRef.current || (gs.dx > 20 && Math.abs(gs.dy) < 40)) &&
        (currentView === 'chat' || isFrozenRef.current), // Only swipe to lock/unlock on main screens
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > 25 && Math.abs(gs.dy) < 90) {
          // Valid right swipe
          if (swipeResetTimer.current) clearTimeout(swipeResetTimer.current);
          swipeCount.current += 1;
          if (swipeCount.current >= 3) {
            swipeCount.current = 0;
            const newFrozen = !isFrozenRef.current;
            if (newFrozen) {
              // Proper reset sequence: Wipe and Home
              handleClear();
              setMenuVisible(false);
              setIsScanning(false);
              toggleKeyboard(false);
            }
            setIsFrozen(newFrozen);
            return;
          }
          swipeResetTimer.current = setTimeout(() => {
            swipeCount.current = 0;
          }, 3000);
        }
      },
    })
  ).current;

  // Cleanup UI when locked
  useEffect(() => {
    if (isFrozen) {
      setMenuVisible(false);
      setIsScanning(false);
      toggleKeyboard(false);
      setCurrentView('chat');
      setAppMode('calculator');
    } else if (currentView === 'auth' || (['gallery', 'imagePicker'].includes(currentView) && !user)) {
      // Auto-show keyboard when in Auth mode
      toggleKeyboard(true);
    }
  }, [isFrozen, currentView, user]);

  const USER_STORE = FileSystem.documentDirectory + 'casio_user.json';

  useEffect(() => {
    // Startup Sequence
    const init = async () => {
      // Try to load saved user
      try {
        const info = await FileSystem.getInfoAsync(USER_STORE);
        if (info.exists) {
          const content = await FileSystem.readAsStringAsync(USER_STORE);
          const savedUser = JSON.parse(content);
          if (savedUser && savedUser.id) setUser(savedUser);
        }
      } catch (e) {
        console.error("Auth Load Fail", e);
      }

      setPowerOn(true);
      setShowCursor(true);
    };

    init();
  }, []);

  const handleSetUser = async (u: { id: string, username: string } | null) => {
    setUser(u);
    try {
      if (u) {
        await FileSystem.writeAsStringAsync(USER_STORE, JSON.stringify(u));
      } else {
        await FileSystem.deleteAsync(USER_STORE, { idempotent: true });
      }
    } catch (e) {
      console.error("Auth Save Fail", e);
    }
  };

  // Auto-scroll to bottom when text changes
  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, draftText]);

  useEffect(() => {
    if (currentView === 'history') {
      fetchHistory();
    }
  }, [currentView]);

  const handleScreenPress = () => {
    // DO NOT Unfreeze on tap
    if (isFrozen) return;

    if (isScanning || isProcessing) return;

    // If keyboard is visible, tap outside should close it
    if (keyboardVisible) {
      toggleKeyboard(false);
      return;
    }

    const now = Date.now();
    if (now - lastTap.current < 400) {
      tapCount.current += 1;
    } else {
      tapCount.current = 1;
    }
    lastTap.current = now;

    if (tapCount.current === 3) {
      if (!user) {
        setCurrentView('auth');
      } else {
        setMenuVisible(true);
      }
      tapCount.current = 0;
    }
  };

  const toggleKeyboard = (force?: boolean) => {
    const nextState = force !== undefined ? force : !keyboardVisible;
    const toValue = nextState ? 0 : SCREEN_WIDTH;

    Animated.spring(keyboardAnim, {
      toValue,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
    setKeyboardVisible(nextState);
  };

  const handleKeyTyping = (char: string) => {
    if (true) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentView === 'auth' || (['gallery', 'imagePicker'].includes(currentView) && !user)) {
      authRef.current?.typeKey(char);
    } else {
      setDraftText(prev => prev + char);
    }
  };

  const handleDelete = () => {
    if (true) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentView === 'auth' || (['gallery', 'imagePicker'].includes(currentView) && !user)) {
      authRef.current?.deleteKey();
    } else {
      setDraftText(prev => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    setDraftText('');
    setMessages([]);
    setSessionId(null);
    setSessionName('MATH');
    setAppMode('calculator');
    setCurrentView('chat');
    setSelectedImages([]);
    setProcessingIndex(-1);
  };

  const handleClearDraft = () => {
    setDraftText('');
  };

  const pickImage = async () => {
    // This function is now superseded by currentView === 'imagePicker'
    setCurrentView('imagePicker');
  };

  const handleEnter = async () => {
    if (currentView === 'auth' || (['gallery', 'imagePicker'].includes(currentView) && !user)) {
      authRef.current?.enterKey();
      return;
    }
    if (!draftText.trim() && selectedImages.length === 0) return;
    const content = draftText.trim();
    const imagesToProcess = [...selectedImages];

    // Dismiss keyboard when sending
    Keyboard.dismiss();
    if (keyboardVisible) toggleKeyboard(false);

    // Clear UI state for next input
    setDraftText('');
    setSelectedImages([]);

    if (appMode === 'chat') {
      if (imagesToProcess.length > 0) {
        // Send ALL images at once for full context
        await sendMessageToAI(
          content || "Analyze these pages.",
          imagesToProcess
        );
      } else {
        sendMessageToAI(content);
      }
    }
  };

  // Persist manual typing/clearing
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        saveToSupabase(JSON.stringify(messages), sessionName || 'MATH AI');
      }, 1000); // Debounce saves
      return () => clearTimeout(timer);
    }
  }, [messages, sessionName]);

  const handleCapture = async (base64: string) => {
    setIsScanning(false);
    setIsProcessing(true);
    setTotalInBatch(1);

    const prompt = draftText.trim() || "Process this scan.";
    const currentMessages = [...messages, {
      role: 'user',
      content: prompt,
      image: `data:image/jpeg;base64,${base64}`
    } as const];
    setMessages(currentMessages);
    setDraftText('');
    setAppMode('chat');

    try {
      const response = await fetch(CASIO_AI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: `data:image/jpeg;base64,${base64.replace(/\s/g, '')}`,
          prompt: prompt,
          history: messages,
          system_rules: "You are an expert evaluator. If handling multiple exam sections (Practicals, Theory, Objectives), ensure continuity. Some questions/options may be split across images; look for context. SOLVE all objectives step-by-step internally FIRST, then provide a final TABULATED list of answers (Question | Answer). DO NOT hallucinate missing parts; state 'Partially captured' if unsure.",
          context: "casio_ai_chat"
        }),
      });

      handleAIResponse(response, currentMessages);
    } catch (error) {
      console.error("Fetch Error:", error);
      setMessages(prev => [...prev, { role: 'ai', content: "NETWORK ERROR" }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const sendMessageToAI = async (text: string, imagesUris?: string[], suffix: string = "", customHistory?: any[]) => {
    setIsProcessing(true);
    setTotalInBatch(imagesUris?.length || 1);
    setProcessingIndex(0);
    const combinedPrompt = text + suffix;
    
    // Convert multiple URIs to base64
    const base64Images: string[] = [];
    if (imagesUris && imagesUris.length > 0) {
      for (const uri of imagesUris) {
        try {
          let finalBase64 = "";
          if (uri.startsWith('http')) {
            // Handle remote URLs using FileSystem download for better RN reliability
            const cacheDir = FileSystem.cacheDirectory;
            if (!cacheDir) throw new Error("Cache directory not available");
            const fileName = uri.split('/').pop() || 'temp_img.jpg';
            const fileUri = cacheDir + fileName;
            const { uri: localUri } = await FileSystem.downloadAsync(uri, fileUri);
            const rawBase64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
            finalBase64 = `data:image/jpeg;base64,${rawBase64}`;
          } else {
            // Handle local URIs (ph:// or file://)
            let localUri = uri;
            if (uri.startsWith('ph://')) {
              const assetId = uri.replace('ph://', '').split('/')[0];
              const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId);
              if (assetInfo.localUri) localUri = assetInfo.localUri;
            }
            const rawBase64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
            finalBase64 = `data:image/jpeg;base64,${rawBase64}`;
          }
          base64Images.push(finalBase64);
        } catch (e) {
          console.error("Image processing error for " + uri, e);
        }
      }
    }

    const currentMessages = customHistory || [...messages, { 
      role: 'user', 
      content: combinedPrompt, 
      image: base64Images[0] // Preview first image in UI
    } as const];

    if (!customHistory) setMessages(currentMessages);

    try {
      const response = await fetch(CASIO_AI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: base64Images,
          prompt: combinedPrompt,
          history: currentMessages,
          model: aiModel,
          system_rules: `ROLE: Expert Exam Evaluator. \nRULES:\n1. Solve objectives mentally FIRST. \n2. You are processing ${base64Images.length} images at once. Maintain context across them.\n3. Identify questions that start on one page and end on another.\n4. Provide a Consolidated Table of ALL objective answers found (Q# | Ans).`,
          context: "casio_ai_chat"
        }),
      });

      const data = await response.json() as any;
      if (response.ok && data.status === 'success') {
        const fullResponse = data.result;

        // Add to UI
        await new Promise<void>((resolve) => {
          // If in Calculator (Stealth) mode, skip typewriter to prevent lag and flickering
          if (appMode === 'calculator') {
            setMessages([...currentMessages, { role: 'ai', content: fullResponse }]);
            resolve();
            return;
          }

          const tempMessages = [...currentMessages, { role: 'ai', content: '' }];
          setMessages(tempMessages);

          let typed = "";
          const CHUNK = 50;
          const type = (idx: number) => {
            if (idx < fullResponse.length) {
              typed += fullResponse.slice(idx, idx + CHUNK);
              setMessages([...currentMessages, { role: 'ai', content: typed }]);
              setTimeout(() => type(idx + CHUNK), typewriterSpeed === 'fast' ? 50 : 150);
            } else {
              resolve();
            }
          };
          type(0);
        });
        return fullResponse;
      }
      return null;
    } catch (error) {
      console.error("Fetch Error:", error);
      setMessages(prev => [...prev, { role: 'ai', content: "NETWORK ERROR" }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAIResponse = async (response: Response, currentMessages: any[]) => {
    if (response.status === 429) {
      setMessages(prev => [...prev, { role: 'ai', content: "RATE LIMIT EXCEEDED" }]);
      return;
    }

    const data = await response.json() as any;
    if (response.ok && data.status === 'success') {
      setAppMode('chat'); // Ensure mode is chat when response arrives

      // Determine the best title for this session
      const newTitle = data.title || sessionName || (currentMessages[0]?.content?.slice(0, 30) || "NEW CHAT");
      if (data.title || !sessionName) setSessionName(newTitle);

      const fullResponse = data.result;

      // Initial empty AI message
      setMessages([...currentMessages, { role: 'ai', content: '' }]);

      // Typewriter Effect - Optimized Chunking for Performance
      let typedContent = "";
      const CHUNK_SIZE = 50;
      const typeNextChars = (index: number) => {
        if (index < fullResponse.length) {
          const nextChunk = fullResponse.slice(index, index + CHUNK_SIZE);
          typedContent += nextChunk;
          setMessages([...currentMessages, { role: 'ai', content: typedContent }]);

          // Use longer delays to prevent JS thread saturation
          const delay = typewriterSpeed === 'fast' ? 100 : 250;
          setTimeout(() => typeNextChars(index + CHUNK_SIZE), delay);
        }
      };
      typeNextChars(0);
    } else {
      setMessages(prev => [...prev, { role: 'ai', content: data.message || "COULD NOT PROCESS" }]);
    }
  };

  const fetchHistory = async () => {
    if (!user) return;
    setIsHistoryLoading(true);

    // Phase 1: Load last 2 items immediately for speed
    const { data: recent, error: err1 } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(2);

    if (!err1 && recent) {
      setHistory(recent);
      setIsHistoryLoading(false); // Stop loading indicator early
    }

    // Phase 2: Load the rest in the background
    const { data: rest, error: err2 } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(2, 20); // Top 20 for scrolling comfort

    if (!err2 && rest && rest.length > 0) {
      setHistory(prev => {
        const ids = new Set(prev.map(p => p.id));
        const filteredRest = rest.filter(r => !ids.has(r.id));
        return [...prev, ...filteredRest];
      });
    }
    setIsHistoryLoading(false);
  };

  const loadChat = (chat: any) => {
    try {
      const parsed = typeof chat.content === 'string' ? JSON.parse(chat.content) : chat.content;
      if (Array.isArray(parsed)) {
        setMessages(parsed);
      } else {
        setMessages([{ role: 'ai', content: chat.content }]);
      }
    } catch {
      setMessages([{ role: 'ai', content: chat.content }]);
    }
    setDraftText('');
    setSessionName(chat.title || 'CHAT');
    setSessionId(chat.id);
    setAppMode('chat');
    setCurrentView('chat');
  };

  const deleteChat = async (id: string) => {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id);

    if (!error) {
      setDeletingId(null);
      fetchHistory();
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  const lastSavedContent = useRef<string>('');

  const saveToSupabase = async (content: string, title: string) => {
    if (isSaving || content === lastSavedContent.current || !user) return;

    setIsSaving(true);
    const upsertData: any = {
      content,
      title,
      user_id: user.id
    };

    if (sessionId) {
      upsertData.id = sessionId;
    }

    try {
      const { data, error } = await supabase
        .from('conversations')
        .upsert(upsertData, { onConflict: 'id' })
        .select('id')
        .single();

      if (!error && data) {
        setSessionId(data.id);
        lastSavedContent.current = content;
      } else if (error) {
        console.error("Supabase Save Error:", error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const resetHistory = async () => {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .neq('title', 'RESERVED_SYSTEM_CHAT');

    if (!error) {
      setHistory([]);
      setCurrentView('more');
    }
  };

  // Battery Monitoring
  useEffect(() => {
    let subscription: Subscription | null = null;

    const setupBattery = async () => {
      const level = await getBatteryLevelAsync();
      setBatteryLevel(level);

      subscription = addBatteryLevelListener((params) => {
        setBatteryLevel(params.batteryLevel);
      });
    };

    setupBattery();
    return () => {
      subscription?.remove();
    };
  }, []);


  return (
    <View style={styles.container}>
      {!fontsLoaded ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#e3f2e8" />
        </View>
      ) : (
        /* Outer Casing / Frame */
        <View style={styles.frame}>
          {/* LCD Screen Container */}
          <View style={styles.screen}>
             {/* 1. Dramatic Backlight Overlay (White Glow) */}
            <View
              style={[
                styles.backlightOverlay,
                { opacity: systemBrightness * 0.5, backgroundColor: '#e3f2e8' }
              ]}
              pointerEvents="none"
            />
            {/* 2. LCD Contrast Overlay (Washes out text/grid) */}
            <View
              style={[
                styles.contrastOverlay,
                { opacity: (1 - lcdContrast) * 0.9, backgroundColor: '#85a78f' }
              ]}
              pointerEvents="none"
            />
            {powerOn && (
              <View style={StyleSheet.absoluteFill} {...swipePanResponder.panHandlers}>
                <CasioStatusBar mode={appMode} sessionName={sessionName} isFrozen={isFrozen} />
                {/* Main Display Area */}
                <View style={[
                  styles.displayArea,
                  currentView === 'chat' && (!isSplash || showCursor) && styles.interactionArea,
                  isProcessing && { justifyContent: 'center', alignItems: 'center' },
                  keyboardVisible && { paddingRight: 220 } // Break at keyboard edge
                ]}>
                  {currentView === 'chat' ? (
                    <>
                      {/* Fixed "C" Clear Button - Top Right (Hidden when keyboard/menu or scnning active, or in calculator mode) */}
                      {powerOn && appMode === 'chat' && (messages.length > 0 || draftText !== '') && !isScanning && !isProcessing && !keyboardVisible && !menuVisible && (
                        <Pressable
                          style={({ pressed }) => [
                            styles.lcdClearButton,
                            pressed && styles.lcdClearButtonPressed
                          ]}
                          onPress={handleClear}
                        >
                          <Text style={styles.lcdClearText}>C</Text>
                        </Pressable>
                      )}

                      {
                        <View style={StyleSheet.absoluteFill}>
                          {!isScanning && (
                            <ScrollView
                              ref={scrollRef}
                              contentContainerStyle={styles.scrollContent}
                              showsVerticalScrollIndicator={false}
                              keyboardShouldPersistTaps="handled"
                            >
                              <Pressable onPress={handleScreenPress} style={styles.scrollPressable}>
                                {messages.map((msg, mIdx) => (
                                  <View
                                    key={mIdx}
                                    style={[
                                      styles.messageContainer,
                                      (appMode === 'chat' && msg.role === 'user')
                                        ? (keyboardVisible ? styles.userMessageContainerLeft : styles.userMessageContainer)
                                        : styles.aiMessageContainer
                                    ]}
                                  >
                                    <View style={[
                                      (appMode === 'chat' && msg.role === 'user') && styles.userMessageBlob,
                                      (appMode === 'chat' && msg.role === 'user') && keyboardVisible && { maxWidth: '100%' },
                                      appMode === 'calculator' && { width: '100%' },
                                      { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' } // Allow inline flow
                                    ]}>
                                      {msg.image && (
                                        <ExpoImage
                                          source={{ uri: msg.image }}
                                          style={{ width: 32, height: 32, borderRadius: 4, marginBottom: 4, marginRight: '100%', borderWidth: 1, borderColor: '#003399' }}
                                        />
                                      )}
                                      {msg.content.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|(?<!\$)\$[^\$]+?\$(?!\$)|```(?:chart|table|sketch|json)[\s\S]*?```)/g).map((part, pIdx) => {
                                        const isFencedBlock =
                                          (part.startsWith('```chart') ||
                                            part.startsWith('```table') ||
                                            part.startsWith('```sketch') ||
                                            part.startsWith('```json')) &&
                                          part.endsWith('```');

                                        if (isFencedBlock) {
                                          const isChart = part.startsWith('```chart');
                                          const isSketch = part.startsWith('```sketch');
                                          const isTable = part.startsWith('```table');
                                          const jsonStr = part.replace(/```\w+\n?|\n?```/g, '').trim();
                                          try {
                                            const data = JSON.parse(jsonStr);
                                            const chartData =
                                              isChart || isChartLikePayload(data)
                                                ? normalizeChartData(data)
                                                : null;
                                            if (chartData) {
                                              return (
                                                <View key={pIdx} style={{ width: '100%' }}>
                                                  <CasioChart data={chartData} />
                                                </View>
                                              );
                                            }
                                            const tableData = normalizeTableData(data);
                                            if (tableData) {
                                              return (
                                                <View key={pIdx} style={{ width: '100%' }}>
                                                  <CasioTable data={tableData} />
                                                </View>
                                              );
                                            }
                                            if (isSketch) {
                                              return (
                                                <View key={pIdx} style={{ width: '100%' }}>
                                                  <CasioSketch data={data} />
                                                </View>
                                              );
                                            }
                                            if (isChart) {
                                              return (
                                                <Text key={pIdx} style={{ color: '#003399', fontFamily: 'DotGothic16', fontSize: 10 }}>
                                                  [ERROR PARSING CHART]
                                                </Text>
                                              );
                                            }
                                            if (isTable) {
                                              return (
                                                <Text key={pIdx} style={{ color: '#003399', fontFamily: 'DotGothic16', fontSize: 10 }}>
                                                  [ERROR PARSING TABLE]
                                                </Text>
                                              );
                                            }
                                            // Non-table ```json — render below as markdown
                                            part = `\`\`\`\n${jsonStr}\n\`\`\``;
                                          } catch (e) {
                                            return (
                                              <Text key={pIdx} style={{ color: '#003399', fontFamily: 'DotGothic16', fontSize: 10 }}>
                                                [ERROR PARSING {isSketch ? 'SKETCH' : isChart ? 'CHART' : isTable ? 'TABLE' : 'JSON'}]
                                              </Text>
                                            );
                                          }
                                        }

                                        if ((part.startsWith('$$') && part.endsWith('$$')) ||
                                          (part.startsWith('\\[') && part.endsWith('\\]')) ||
                                          (part.startsWith('\\(') && part.endsWith('\\)')) ||
                                          (part.startsWith('$') && part.endsWith('$'))) {
                                          let latex = part;
                                          if (part.startsWith('$$')) latex = part.slice(2, -2);
                                          else if (part.startsWith('\\[')) latex = part.slice(2, -2);
                                          else if (part.startsWith('\\(')) latex = part.slice(2, -2);
                                          else if (part.startsWith('$')) latex = part.slice(1, -1);

                                          return (
                                            <View key={pIdx} style={part.startsWith('$$') || part.startsWith('\\[') ? { width: '100%', alignItems: 'flex-start', marginVertical: 4 } : { marginHorizontal: 4 }}>
                                              <MathRenderer latex={latex} />
                                            </View>
                                          );
                                        }
                                        if (part === '') return null;

                                        // Layout Fix: Prevent text cramping by forcing full width for title lines or multiline chunks
                                        const isBlock = part.includes('\n') || part.includes('[');

                                        if (part.endsWith(' ')) {
                                          part = part.slice(0, -1) + '\u00A0';
                                        }

                                        const markdownStyle = {
                                          body: {
                                            width: isBlock ? '100%' : 'auto',
                                            fontFamily: 'DotGothic16',
                                            fontSize: appMode === 'calculator' ? 44 : (msg.role === 'ai' ? 18 : 14),
                                            lineHeight: appMode === 'calculator' ? 48 : (msg.role === 'ai' ? 22 : 18),
                                            fontWeight: appMode === 'calculator' ? '900' : (msg.role === 'ai' ? '700' : '800'),
                                            color: '#003399',
                                          },
                                          text: {
                                            fontFamily: 'DotGothic16',
                                            fontSize: appMode === 'calculator' ? 44 : (msg.role === 'ai' ? 18 : 14),
                                            lineHeight: appMode === 'calculator' ? 48 : (msg.role === 'ai' ? 22 : 18),
                                            fontWeight: appMode === 'calculator' ? '900' : (msg.role === 'ai' ? '700' : '800'),
                                            color: '#003399',
                                          },
                                          paragraph: {
                                            marginTop: 0,
                                            marginBottom: 0,
                                            flexWrap: 'wrap',
                                            flexDirection: 'row',
                                            alignItems: 'flex-start',
                                            justifyContent: 'flex-start',
                                          },
                                          strong: {
                                            fontFamily: 'DotGothic16',
                                            fontWeight: '900',
                                            color: '#004de6',
                                          },
                                          em: {
                                            fontFamily: 'DotGothic16',
                                            fontStyle: 'italic',
                                            color: '#004de6',
                                          },
                                          block: {
                                            marginBottom: 10,
                                          },
                                          fence: {
                                            backgroundColor: 'transparent',
                                            borderColor: 'transparent',
                                            color: '#003399',
                                            fontFamily: 'DotGothic16',
                                            padding: 0,
                                            marginTop: 0,
                                          },
                                          code_block: {
                                            backgroundColor: 'transparent',
                                            borderColor: 'transparent',
                                            color: '#003399',
                                            fontFamily: 'DotGothic16',
                                            padding: 0,
                                          },
                                          code_inline: {
                                            backgroundColor: 'transparent',
                                            borderColor: 'transparent',
                                            color: '#003399',
                                            fontFamily: 'DotGothic16',
                                            padding: 0,
                                          },
                                        } as const;

                                        return (
                                          <React.Fragment key={pIdx}>
                                            {splitMarkdownTables(part).map((segment, sIdx) => {
                                              if (segment.type === 'table') {
                                                const tableData = parseMarkdownTable(segment.value);
                                                if (tableData) {
                                                  return (
                                                    <View key={`${pIdx}-${sIdx}`} style={{ width: '100%' }}>
                                                      <CasioTable data={tableData} />
                                                    </View>
                                                  );
                                                }
                                              }
                                              if (!segment.value) return null;
                                              return (
                                                <Markdown key={`${pIdx}-${sIdx}`} style={markdownStyle}>
                                                  {segment.value}
                                                </Markdown>
                                              );
                                            })}
                                          </React.Fragment>
                                        );
                                      })}
                                    </View>
                                  </View>
                                ))}

                                {draftText !== '' && (
                                  <View style={[
                                    styles.messageContainer,
                                    (appMode === 'chat' && keyboardVisible) ? styles.userMessageContainerLeft :
                                      (appMode === 'chat' ? styles.userMessageContainer : styles.aiMessageContainer)
                                  ]}>
                                    <View style={[
                                      appMode === 'chat' && styles.userMessageBlob,
                                      (appMode === 'chat' && keyboardVisible) && { maxWidth: '100%' },
                                      appMode === 'calculator' && { width: '100%', flexDirection: 'row', alignItems: 'center' },
                                      { flexDirection: 'row', alignItems: 'center' }
                                    ]}>
                                      {appMode === 'chat' && selectedImages.length === 0 && (
                                        <Pressable style={styles.attachButton} onPress={() => setCurrentView('attachmentOptions')}>
                                          <Ionicons name="add" size={16} color="#003399" />
                                        </Pressable>
                                      )}
                                      {selectedImages.length > 0 && (
                                        <View style={{ marginRight: 8, flexDirection: 'row', alignItems: 'center' }}>
                                          {selectedImages.slice(0, 3).map((uri, idx) => (
                                            <ExpoImage key={idx} source={{ uri }} style={[styles.attachmentThumbnail, { marginLeft: idx > 0 ? -15 : 0, borderWidth: 1, borderColor: '#003399' }]} />
                                          ))}
                                          {selectedImages.length > 3 && <Text style={{ fontSize: 8, color: '#003399', marginLeft: 4 }}>+{selectedImages.length - 3}</Text>}
                                          <Pressable onPress={() => setSelectedImages([])} style={[styles.attachmentRemoveBadge, { position: 'relative', top: -10, right: 10 }]}>
                                            <Ionicons name="close" size={8} color="#fff" />
                                          </Pressable>
                                        </View>
                                      )}
                                      <Text style={[
                                        appMode === 'chat' ? styles.userDraftText : styles.aiResultText,
                                        appMode === 'calculator' && styles.calculatorText
                                      ]}>{draftText}</Text>
                                      {showCursor && !isProcessing && !isFrozen && (
                                        <BlinkingCursor
                                          visible={true}
                                          style={appMode === 'chat'
                                            ? { height: 32, alignSelf: 'center' }
                                            : { height: 32, alignSelf: 'flex-start' }
                                          }
                                        />
                                      )}
                                    </View>
                                  </View>
                                )}

                                {isProcessing && (
                                  <View style={styles.aiMessageContainer}>
                                    <Text style={styles.processingIndicator}>
                                      {totalInBatch > 1 
                                        ? `ANALYZING BATCH (${totalInBatch} PAGES)...` 
                                        : 'PROCESSING...'}
                                    </Text>
                                  </View>
                                )}

                                {showCursor && !isProcessing && draftText === '' && !isFrozen && (
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {appMode === 'chat' && selectedImages.length === 0 && (
                                      <Pressable style={styles.attachButton} onPress={() => setCurrentView('attachmentOptions')}>
                                        <Ionicons name="add" size={16} color="#003399" />
                                      </Pressable>
                                    )}
                                    {selectedImages.length > 0 && (
                                      <View style={{ marginRight: 8, flexDirection: 'row', alignItems: 'center' }}>
                                        {selectedImages.slice(0, 3).map((uri, idx) => (
                                          <ExpoImage key={idx} source={{ uri }} style={[styles.attachmentThumbnail, { marginLeft: idx > 0 ? -15 : 0, borderWidth: 1, borderColor: '#003399' }]} />
                                        ))}
                                        {selectedImages.length > 3 && <Text style={{ fontSize: 8, color: '#003399', marginLeft: 4 }}>+{selectedImages.length - 3}</Text>}
                                        <Pressable onPress={() => setSelectedImages([])} style={[styles.attachmentRemoveBadge, { position: 'relative', top: -10, right: 10 }]}>
                                          <Ionicons name="close" size={8} color="#fff" />
                                        </Pressable>
                                      </View>
                                    )}
                                    <BlinkingCursor visible={true} style={{ height: 32, alignSelf: 'flex-start' }} />
                                  </View>
                                )}
                              </Pressable>
                            </ScrollView>
                          )}
                        </View>
                      }
                    </>
                  ) : currentView === 'more' ? (
                    <View style={styles.moreMenuContainer}>
                      <Pressable
                        style={styles.lcdCloseButton}
                        onPress={() => setCurrentView('chat')}
                      >
                        <Ionicons name="close" size={14} color="#003399" />
                      </Pressable>
                      <ScrollView
                        contentContainerStyle={styles.moreIconsGrid}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                      >
                        <Pressable style={styles.moreIconWrapper} onPress={() => {
                          handleClear();
                          setAppMode('chat');
                          setSessionName('CHAT');
                          setCurrentView('chat');
                        }}>
                          <View style={styles.moreIconCircle}>
                            <Ionicons name="add-outline" size={24} color="#003399" />
                          </View>
                          <Text style={styles.moreIconLabel}>NEW CHAT</Text>
                        </Pressable>
                        <Pressable style={styles.moreIconWrapper} onPress={() => setCurrentView('history')}>
                          <View style={styles.moreIconCircle}>
                            <Ionicons name="time-outline" size={24} color="#003399" />
                          </View>
                          <Text style={styles.moreIconLabel}>HISTORY</Text>
                        </Pressable>
                        <Pressable style={styles.moreIconWrapper} onPress={() => {
                          handleClear();
                          setCurrentView('chat');
                        }}>
                          <View style={styles.moreIconCircle}>
                            <Ionicons name="refresh-outline" size={24} color="#003399" />
                          </View>
                          <Text style={styles.moreIconLabel}>REFRESH</Text>
                        </Pressable>
                        <Pressable style={styles.moreIconWrapper} onPress={() => setCurrentView('subjects')}>
                          <View style={styles.moreIconCircle}>
                            <Ionicons name="school-outline" size={24} color="#003399" />
                          </View>
                          <Text style={styles.moreIconLabel}>SUBJECTS</Text>
                        </Pressable>
                        <Pressable style={styles.moreIconWrapper} onPress={() => setCurrentView('gallery')}>
                          <View style={styles.moreIconCircle}>
                            <Ionicons name="images-outline" size={24} color="#003399" />
                          </View>
                          <Text style={styles.moreIconLabel}>GALLERY</Text>
                        </Pressable>
                        <Pressable style={styles.moreIconWrapper} onPress={() => setCurrentView('telegram')}>
                          <View style={styles.moreIconCircle}>
                            <Ionicons name="paper-plane-outline" size={24} color="#003399" />
                          </View>
                          <Text style={styles.moreIconLabel}>TELEGRAM</Text>
                        </Pressable>
                        <Pressable style={styles.moreIconWrapper} onPress={() => setCurrentView('settings')}>
                          <View style={styles.moreIconCircle}>
                            <Ionicons name="settings-outline" size={24} color="#003399" />
                          </View>
                          <Text style={styles.moreIconLabel}>SETUP</Text>
                        </Pressable>
                      </ScrollView>
                    </View>
                  ) : currentView === 'attachmentOptions' ? (
                    <View style={styles.attachmentOptionsContainer}>
                       <Pressable style={styles.lcdCloseButton} onPress={() => setCurrentView('chat')}>
                          <Ionicons name="close" size={14} color="#003399" />
                       </Pressable>
                       <View style={styles.attachmentOptionsGrid}>
                          <Pressable style={styles.optionItem} onPress={() => {
                             setCurrentView('imagePicker');
                          }}>
                             <Ionicons name="images-outline" size={24} color="#003399" />
                             <Text style={styles.optionLabel}>GALLERY</Text>
                          </Pressable>
                          <Pressable style={styles.optionItem} onPress={() => {
                             setCurrentView('subjects');
                          }}>
                             <Ionicons name="school-outline" size={24} color="#003399" />
                             <Text style={styles.optionLabel}>SUBJECTS</Text>
                          </Pressable>
                       </View>
                    </View>
                  ) : currentView === 'subjects' ? (
                    <View style={styles.subjectsContainer}>
                      <View style={styles.papersHeader}>
                         <Pressable onPress={() => {
                            setSelectedSubjectNames([]);
                            setCurrentView('more');
                         }}>
                            <Ionicons name="chevron-back" size={16} color="#003399" />
                         </Pressable>
                         <Text style={styles.papersTitle}>ACADEMIC SUBJECTS</Text>
                         <Pressable onPress={() => setCurrentView('more')}>
                            <Ionicons name="close" size={16} color="#003399" />
                         </Pressable>
                      </View>
                      <ScrollView contentContainerStyle={styles.subjectsGrid}>
                        {['Physics', 'Chemistry', 'Elective Maths', 'Core Maths', 'Integrated Science', 'Elective ICT', 'Social Studies', 'English'].map((sub) => {
                          return (
                            <Pressable 
                              key={sub} 
                              style={styles.subjectCard}
                              onPress={async () => {
                                setSelectedSubjectNames([sub]);
                                setCurrentView('subjectPapers');
                                setIsLoadingPapers(true);
                                const { data } = await supabase
                                  .from('papers')
                                  .select('*')
                                  .eq('subject', sub)
                                  .order('created_at', { ascending: false });
                                setSubjectPapers(data || []);
                                setIsLoadingPapers(false);
                              }}
                            >
                              <Text style={styles.subjectCardText}>{sub.toUpperCase()} ({subjectCounts[sub] || 0})</Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  ) : currentView === 'subjectPapers' ? (
                    <View style={styles.papersContainer}>
                      <View style={styles.papersHeader}>
                         <Pressable onPress={() => {
                            setSelectedPaperIds([]);
                            setCurrentView('subjects');
                         }}>
                            <Ionicons name="chevron-back" size={16} color="#003399" />
                         </Pressable>
                         <Text style={styles.papersTitle}>
                           {selectedSubjectNames.length === 1 ? selectedSubjectNames[0].toUpperCase() : 'MIXED PAPERS'}
                         </Text>
                         {selectedPaperIds.length > 0 ? (
                           <Pressable 
                             style={styles.analyzeButton}
                             onPress={() => {
                               const selectedUris = subjectPapers
                                 .filter(p => selectedPaperIds.includes(p.id))
                                 .map(p => p.url);
                               setSelectedImages(selectedUris);
                               setSelectedPaperIds([]);
                               setCurrentView('chat');
                               setAppMode('chat');
                             }}
                           >
                             <Text style={styles.analyzeButtonText}>ANALYZE ({selectedPaperIds.length})</Text>
                           </Pressable>
                         ) : (
                           <Pressable onPress={() => setCurrentView('more')}>
                              <Ionicons name="close" size={16} color="#003399" />
                           </Pressable>
                         )}
                      </View>
                      <ScrollView contentContainerStyle={styles.papersGrid}>
                        {isLoadingPapers ? (
                          <ActivityIndicator size="small" color="#003399" style={{ marginTop: 20 }} />
                        ) : subjectPapers.length > 0 ? (
                          subjectPapers.map((p) => {
                            const isSelected = selectedPaperIds.includes(p.id);
                            return (
                              <Pressable 
                                key={p.id} 
                                style={[styles.paperTile, isSelected && styles.paperTileSelected]}
                                onPress={() => {
                                  setSelectedPaperIds(prev => 
                                    prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                                  );
                                }}
                              >
                                 <ExpoImage source={{ uri: p.url }} style={styles.paperImage} contentFit="cover" />
                                 {isSelected && (
                                   <View style={styles.selectedBadge}>
                                      <Ionicons name="checkmark-circle" size={12} color="#003399" />
                                   </View>
                                 )}
                                 <Text style={styles.paperLabel} numberOfLines={1}>{p.name.slice(0, 10)}</Text>
                              </Pressable>
                            );
                          })
                        ) : (
                          <Text style={styles.noPapersText}>NO PAPERS FOUND</Text>
                        )}
                      </ScrollView>
                    </View>
                  ) : currentView === 'gallery' ? (
                    !user ? (
                      <CasioAuth
                        ref={authRef}
                        keyboardVisible={keyboardVisible}
                        onStepChange={(step) => setKeyboardMode(step === 'username' ? 'alpha' : 'num')}
                        onLogin={(u) => {
                          handleSetUser(u);
                          setCurrentView('gallery');
                          toggleKeyboard(false);
                        }}
                      />
                    ) : <CasioGallery onClose={() => setCurrentView('more')} />
                  ) : currentView === 'imagePicker' ? (
                    !user ? (
                      <CasioAuth
                        ref={authRef}
                        keyboardVisible={keyboardVisible}
                        onStepChange={(step) => setKeyboardMode(step === 'username' ? 'alpha' : 'num')}
                        onLogin={(u) => {
                          handleSetUser(u);
                          setCurrentView('imagePicker');
                          toggleKeyboard(false);
                        }}
                      />
                    ) : (
                      <CasioGallery
                        onClose={() => setCurrentView('chat')}
                        onSelect={(uri, extra) => {
                          setSelectedImages([uri, ...(extra || [])]);
                          setCurrentView('chat');
                          setAppMode('chat');
                        }}
                      />
                    )
                  ) : currentView === 'telegram' ? (
                    <CasioTelegram onClose={() => setCurrentView('more')} />
                  ) : currentView === 'settings' ? (
                    <CasioSettings
                      onClose={() => setCurrentView('more')}
                      settings={{ lcdContrast, typewriterSpeed, systemBrightness }}
                      batteryLevel={batteryLevel}
                      onUpdate={(key: any, val) => {
                        if (key === 'lcdContrast') setLcdContrast(val);
                        if (key === 'systemBrightness') setSystemBrightness(val);
                      }}
                      onResetHistory={resetHistory}
                    />
                  ) : currentView === 'auth' ? (
                    <CasioAuth
                      ref={authRef}
                      keyboardVisible={keyboardVisible}
                      onStepChange={(step) => setKeyboardMode(step === 'username' ? 'alpha' : 'num')}
                      onLogin={(u) => {
                        handleSetUser(u);
                        setCurrentView('chat');
                        setMenuVisible(true);
                        toggleKeyboard(false);
                      }} />
                  ) : (
                    <View style={styles.historyContainer}>
                      <Pressable
                        style={styles.lcdCloseButton}
                        onPress={() => setCurrentView('more')}
                      >
                        <Ionicons name="close" size={14} color="#003399" />
                      </Pressable>
                      <ScrollView contentContainerStyle={styles.historyGrid}>
                        {isHistoryLoading ? (
                          <View style={{ flex: 1, height: 100, alignItems: 'center', justifyContent: 'center', width: SCREEN_WIDTH - 20 }}>
                            <ActivityIndicator size="large" color="#003399" />
                          </View>
                        ) : history.length > 0 ? (
                          history.map((item) => (
                            <Pressable
                              key={item.id}
                              style={[
                                styles.historyTile,
                                deletingId === item.id && styles.historyTileDeleting
                              ]}
                              onPress={() => loadChat(item)}
                              onLongPress={() => setDeletingId(item.id)}
                            >
                              {deletingId === item.id ? (
                                <Pressable
                                  style={styles.deleteOverlay}
                                  onPress={() => deleteChat(item.id)}
                                >
                                  <Ionicons name="trash" size={20} color="#fff" />
                                  <Text style={styles.deleteText}>DELETE</Text>
                                </Pressable>
                              ) : (
                                <>
                                  <Text style={styles.historyTileTitle} numberOfLines={1}>
                                    {item.title || 'Untitled'}
                                  </Text>
                                  <Text style={styles.historyTilePreview} numberOfLines={2}>
                                    {item.content?.startsWith('[') ?
                                      JSON.parse(item.content).map((m: any) => m.content).join(' ').replace(/\[MATH\].*?\[\/MATH\]/g, '[MATH]').slice(0, 50) :
                                      item.content?.replace(/\[MATH\].*?\[\/MATH\]/g, '[MATH]').slice(0, 50)}
                                  </Text>
                                </>
                              )}
                            </Pressable>
                          ))
                        ) : (
                          <Text style={styles.noHistoryText}>NO HISTORY SAVED</Text>
                        )}
                      </ScrollView>
                    </View>
                  )}

                </View>

                {/* Camera Scanner View - Bottom Layer */}
                {isScanning && (
                  <CameraScanner
                    onCapture={handleCapture}
                    onClose={() => {
                      setIsScanning(false);
                      setIsProcessing(false); // Fix frozen cursor/processing state on exit
                    }}
                  />
                )}

                {/* Dotted Keyboard - Inside Screen */}
                <SidebarKeyboard
                  visible={keyboardVisible}
                  animValue={keyboardAnim}
                  onKeyTyping={handleKeyTyping}
                  onDelete={handleDelete}
                  onClear={handleClearDraft}
                  onEnter={handleEnter}
                  mode={keyboardMode}
                  onModeChange={setKeyboardMode}
                  currentModel={aiModel}
                  onModelSelect={setAiModel}
                />

                {/* Radial Menu Triggered by Triple Tap */}
                <RadialMenu
                  visible={menuVisible}
                  onClose={() => {
                    setMenuVisible(false);
                    toggleKeyboard(false);
                  }}
                  onSelectKeyboard={() => {
                    setMenuVisible(false);
                    toggleKeyboard(true);
                  }}
                  onSelectMore={() => {
                    setMenuVisible(false);
                    setCurrentView('more');
                  }}
                  onSelectCamera={() => {
                    setMenuVisible(false);
                    setIsScanning(true); // Switch to Camera Mode
                  }}
                />

                {/* LCD Dot Matrix Grid Overlay - Top Layer */}
                <LCDGrid width={SCREEN_WIDTH} height={SCREEN_HEIGHT} />

                {/* Glass Depth Layers */}
                <View style={styles.glassReflection} pointerEvents="none" />
                <View style={styles.blueTintOverlay} pointerEvents="none" />
                <View style={styles.innerShadowOverlay} pointerEvents="none" />

                {/* Freeze Lockscreen */}
                {isFrozen && (
                  <View style={styles.freezeOverlay} pointerEvents="none">
                    <View style={styles.freezeLogoContainer}>
                      {/* XX-Extreme Thickness Layering (16 passes) */}
                      <Text style={[styles.freezeLogo, styles.logoLayer]}>CASIO</Text>
                      <Text style={[styles.freezeLogo, styles.logoLayer, { marginLeft: -1 }]}>CASIO</Text>
                      <Text style={[styles.freezeLogo, styles.logoLayer, { marginLeft: 1 }]}>CASIO</Text>
                      <Text style={[styles.freezeLogo, styles.logoLayer, { marginLeft: -2 }]}>CASIO</Text>
                      <Text style={[styles.freezeLogo, styles.logoLayer, { marginLeft: 2 }]}>CASIO</Text>
                      <Text style={[styles.freezeLogo, styles.logoLayer, { marginLeft: -3 }]}>CASIO</Text>
                      <Text style={[styles.freezeLogo, styles.logoLayer, { marginLeft: 3 }]}>CASIO</Text>
                      <Text style={[styles.freezeLogo, styles.logoLayer, { marginLeft: -4.5 }]}>CASIO</Text>
                      <Text style={[styles.freezeLogo, styles.logoLayer, { marginLeft: 4.5 }]}>CASIO</Text>
                      <Text style={[styles.freezeLogo, styles.logoLayer, { marginLeft: -6 }]}>CASIO</Text>
                      <Text style={[styles.freezeLogo, styles.logoLayer, { marginLeft: 6 }]}>CASIO</Text>
                      <Text style={[styles.freezeLogo, styles.logoLayer, { marginLeft: -8 }]}>CASIO</Text>
                      <Text style={[styles.freezeLogo, styles.logoLayer, { marginLeft: 8 }]}>CASIO</Text>
                      <Text style={[styles.freezeLogo, styles.logoLayer, { marginTop: -1 }]}>CASIO</Text>
                      <Text style={[styles.freezeLogo, styles.logoLayer, { marginTop: 1 }]}>CASIO</Text>
                      <Text style={[styles.freezeLogo, styles.logoLayer, { marginTop: 0.5, marginLeft: 0.5 }]}>CASIO</Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 450, // Move screen back up
  },
  frame: {
    padding: 2,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  screen: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#85a78f',
    borderRadius: 2,
    overflow: 'hidden',
  },
  contrastOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 998,
  },
  backlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  displayArea: {
    flex: 1,
    paddingHorizontal: 0,
    justifyContent: 'center', // Center for Splash
    alignItems: 'center',
  },
  interactionArea: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: 0,
    paddingHorizontal: 10,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    justifyContent: 'flex-start',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 0,
    paddingHorizontal: 6,
  },
  scrollPressable: {
    flexGrow: 1,
    width: '100%',
  },
  casioCenterContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 6,
  },
  casioText: {
    fontSize: 64,
    fontFamily: 'DotGothic16',
    fontWeight: '900',
    color: '#003399',
    letterSpacing: 8,
  },
  typingText: {
    fontSize: 32,
    fontFamily: 'DotGothic16',
    fontWeight: '900',
    color: '#003399',
    letterSpacing: 2,
    lineHeight: 34,
    marginTop: -2,
  },
  cursor: {
    width: 8,
    height: 32,
    backgroundColor: '#004de6',
    marginLeft: 2,
    marginTop: 4,
  },
  processingView: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    fontSize: 12,
    fontFamily: 'System',
    fontWeight: '800',
    color: '#2d332f',
    marginTop: 8,
    letterSpacing: 1,
  },
  lcdClearButton: {
    position: 'absolute',
    top: 8,
    right: 12,
    width: 24,
    height: 24,
    backgroundColor: 'rgba(45, 51, 47, 0.05)',
    borderWidth: 0.8,
    borderColor: '#2d332f',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200, // Ensure it's clickable above display text
    elevation: 3,
  },
  lcdClearButtonPressed: {
    backgroundColor: 'rgba(45, 51, 47, 0.2)',
    transform: [{ scale: 0.95 }],
  },
  lcdClearText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#2d332f',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreMenuContainer: {
    padding: 12,
    flex: 1,
    width: '100%',
  },
  lcdCloseButton: {
    position: 'absolute',
    top: 8,
    right: 12,
    width: 24,
    height: 24,
    backgroundColor: 'rgba(45, 51, 47, 0.05)',
    borderWidth: 0.8,
    borderColor: '#003399',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300,
  },
  moreIconsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 8,
  },
  moreIconWrapper: {
    alignItems: 'center',
    width: 60,
  },
  moreIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#74967e',
    borderWidth: 1,
    borderColor: '#003399',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  moreIconLabel: {
    fontFamily: 'DotGothic16',
    fontSize: 8,
    color: '#003399',
    textAlign: 'center',
  },
  historyContainer: {
    padding: 12,
    flex: 1,
    width: '100%',
  },
  historyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 20,
  },
  historyTile: {
    width: (SCREEN_WIDTH - 44) / 2,
    height: 60,
    backgroundColor: '#74967e',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#4a554f',
  },
  historyTileTitle: {
    fontFamily: 'DotGothic16',
    fontSize: 10,
    fontWeight: '900',
    color: '#003399',
    marginBottom: 2,
  },
  historyTilePreview: {
    fontFamily: 'DotGothic16',
    fontSize: 7,
    color: '#003399',
    lineHeight: 9,
  },
  noHistoryText: {
    fontFamily: 'DotGothic16',
    fontSize: 14,
    color: '#003399',
    textAlign: 'center',
    marginTop: 20,
    width: '100%',
  },
  messageContainer: {
    width: '100%',
    marginVertical: 8,
    flexDirection: 'row',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  userMessageContainerLeft: {
    justifyContent: 'flex-start',
  },
  aiMessageContainer: {
    justifyContent: 'flex-start',
  },
  userMessageBlob: {
    backgroundColor: 'rgba(0, 77, 230, 0.1)',
    padding: 6,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#004de6',
    maxWidth: '85%',
  },
  calculatorText: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '900',
    color: '#003399',
    letterSpacing: 2,
  },
  aiResultText: {
    fontFamily: 'DotGothic16',
    fontSize: 18,
    fontWeight: '700',
    color: '#003399',
    lineHeight: 22,
    letterSpacing: 1,
  },
  userDraftText: {
    fontFamily: 'DotGothic16',
    fontSize: 14,
    fontWeight: '800',
    color: '#003399',
    lineHeight: 18,
    letterSpacing: 1,
  },
  historyTileDeleting: {
    opacity: 0.4,
    backgroundColor: '#999',
  },
  deleteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  deleteText: {
    color: '#fff',
    fontFamily: 'DotGothic16',
    fontSize: 8,
    fontWeight: '900',
    marginTop: 2,
  },
  glassReflection: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 2,
  },
  blueTintOverlay: {
    position: 'absolute',
    top: 16,
    left: 8,
    right: 8,
    bottom: 12,
    backgroundColor: 'rgba(0, 77, 230, 0.08)',
    borderRadius: 2,
  },
  innerShadowOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.05)',
    borderRadius: 2,
  },
  freezeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  freezeLogo: {
    fontFamily: 'DotGothic16',
    fontSize: 86,
    fontWeight: '900',
    color: '#003399',
    letterSpacing: 6,
  },
  freezeLogoContainer: {
    width: '100%',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLayer: {
    position: 'absolute',
  },
  attachButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    backgroundColor: 'rgba(0, 51, 153, 0.05)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 51, 153, 0.1)',
  },
  attachmentPreviewContainer: {
    position: 'relative',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#003399',
    borderRadius: 4,
    padding: 2,
    backgroundColor: 'rgba(0, 51, 153, 0.05)',
  },
  attachmentThumbnail: {
    width: 28,
    height: 28,
    borderRadius: 2,
  },
  attachmentRemoveBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ff4444',
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  processingIndicator: {
    fontFamily: 'DotGothic16',
    fontSize: 10,
    color: '#003399',
    opacity: 0.6,
  },
  subjectsContainer: {
    padding: 12,
    flex: 1,
    width: '100%',
  },
  subjectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 20,
  },
  subjectCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    height: 44,
    backgroundColor: '#74967e',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#4a554f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subjectCardSelected: {
    backgroundColor: '#8eb399',
    borderColor: '#003399',
  },
  selectedBadgeSub: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  subjectCardText: {
    fontFamily: 'DotGothic16',
    fontSize: 10,
    fontWeight: '900',
    color: '#003399',
  },
  papersContainer: {
    flex: 1,
    width: '100%',
    padding: 8,
  },
  papersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  papersTitle: {
    fontFamily: 'DotGothic16',
    fontSize: 12,
    fontWeight: '900',
    color: '#003399',
  },
  papersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 20,
  },
  paperTile: {
    width: (SCREEN_WIDTH - 40) / 3,
    alignItems: 'center',
    gap: 2,
  },
  paperImage: {
    width: '100%',
    height: 60,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#003399',
  },
  paperTileSelected: {
    opacity: 0.8,
  },
  selectedBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 6,
  },
  analyzeButton: {
    backgroundColor: 'rgba(0, 51, 153, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#003399',
  },
  analyzeButtonText: {
    fontFamily: 'DotGothic16',
    fontSize: 8,
    fontWeight: '900',
    color: '#003399',
  },
  paperLabel: {
    fontFamily: 'DotGothic16',
    fontSize: 6,
    color: '#003399',
  },
  noPapersText: {
    fontFamily: 'DotGothic16',
    fontSize: 10,
    color: '#003399',
    textAlign: 'center',
    width: '100%',
    marginTop: 20,
  },
  attachmentOptionsContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  attachmentOptionsGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
  },
  optionItem: {
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: 'rgba(0, 51, 153, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#003399',
  },
  optionLabel: {
    fontFamily: 'DotGothic16',
    fontSize: 10,
    fontWeight: '900',
    color: '#003399',
  },
});




