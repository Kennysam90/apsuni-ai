import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
  Animated,
  Dimensions,
  Platform, PermissionsAndroid, ActivityIndicator, Switch, Easing
  , Modal, FlatList
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ConversationProvider, useConversation } from '@elevenlabs/react-native';

import AppHeader from '../../components/AppHeader';
import AppBackground from '../../components/AppBackground';
import CustomTabBar, { CenterButton } from '../../components/CustomTabBar';
import VoiceOrb, { VoiceOrbHandle } from '../../components/VoiceOrb';
import {
  fetchConversationToken, getAuthUserId, sendAssistantMessageRealtime, closeRestAISocket, searchDesigns, createEditory,
  updateEditory, addEditoryToCart, viewCart, listWallets, checkoutWithWallet,
  getBusinessChecklist, getConversationHistory,
  type DesignResult,
} from '../../services/api';
import { useAppAlert } from '../../components/AppAlert';
import { formatMoney } from '../../services/currency';
import DesignGalleryPopup from '@/app/components/DesignGalleryPopup';

import { friendlyError } from '../../services/errors';
const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const COLLAPSED_OFFSET = SCREEN_HEIGHT;

const ORB_COLORS = {
  center: '#60A5FA',
  mid: '#3B82F6',
  outer: '#1D4ED8',
};

// ---------------------------------------------------------------------------
// CONFIG — update these for your setup
// ---------------------------------------------------------------------------
const DEFAULT_CHAT_GREETING = 'Good day. I’m Apsuni AI. Tell me about the business, brand, website, or mobile app you want to build.';

interface VoiceAssessmentScreenProps {
  onBack?: () => void;
  onEdit?: () => void;
  onBookmark?: () => void;
  onMicPress?: () => void;
  onSendPrompt?: (prompt: string) => void;
}

const CREATIVE_TOOLS = [
  { id: '1', label: 'Copywriter GPT - Marketing, Branding, Ads', icon: 'pen-tool' },
  { id: '2', label: 'CV Writer - the CV Expert', icon: 'file-text' },
  { id: '3', label: 'Write For Me', icon: 'edit-3' },
  { id: '4', label: 'Automated Writer', icon: 'sliders' },
  { id: '5', label: 'AI Humanizer Pro', icon: 'user-check' },
  { id: '6', label: 'Text to Video Maker', icon: 'video' },
  { id: '7', label: 'Humanize AI', icon: 'cpu' },
  { id: '8', label: "Fully SEO Optimized Article including FAQ's", icon: 'search' },
];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

type FlowCategory = 'Mobile App' | 'Website';
type ChecklistStep = { label?: string; title?: string; done?: boolean; completed?: boolean; [key: string]: any };
type AssistantMode = 'Thinking' | 'Expert' | 'Vision';

const getCartItems = (cart: Record<string, any> | null): Record<string, any>[] => {
  if (!cart) return [];
  const items = [cart.items, cart.cart_items, cart.products, cart.data].find(Array.isArray);
  return items || [];
};

const getCartItemName = (item: Record<string, any>, index: number) =>
  item.title || item.name || item.product?.title || item.product?.name || `Project ${index + 1}`;

const ASSISTANT_MODES: { label: AssistantMode; icon: string; description: string }[] = [
  { label: 'Thinking', icon: 'cpu', description: 'Careful reasoning and balanced answers' },
  { label: 'Expert', icon: 'award', description: 'Detailed, professional guidance' },
  { label: 'Vision', icon: 'eye', description: 'Focus on images and visual ideas' },
];

// ---------------------------------------------------------------------------
export default function VoiceAssessmentScreen(props: VoiceAssessmentScreenProps) {
  return <ConversationProvider><VoiceAssessmentScreenInner {...props} /></ConversationProvider>;
}

function VoiceAssessmentScreenInner({
  onBack,
  onMicPress,
  onSendPrompt,
}: VoiceAssessmentScreenProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [{
    id: 'default-chat-greeting',
    role: 'assistant',
    text: DEFAULT_CHAT_GREETING,
  }]);
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const initialConversationId = typeof params.conversationId === 'string' ? params.conversationId : undefined;
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isWaitingForReply, setIsWaitingForReply] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [isStartingVoice, setIsStartingVoice] = useState(false);
  const [designModalVisible, setDesignModalVisible] = useState(false);
  const [designCategory, setDesignCategory] = useState<FlowCategory>('Mobile App');
  const [designQuery, setDesignQuery] = useState('');
  const [designPage, setDesignPage] = useState(1);
  const [designPages, setDesignPages] = useState(1);
  const [designs, setDesigns] = useState<DesignResult[]>([]);
  const [designLoading, setDesignLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [checklistVisible, setChecklistVisible] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistStep[]>([]);
  const [cartVisible, setCartVisible] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [activeMode, setActiveMode] = useState<AssistantMode | null>(null);
  const [cart, setCart] = useState<Record<string, any> | null>(null);
  const [address, setAddress] = useState('');
  const [mobile, setMobile] = useState('');
  const [flowProgress, setFlowProgress] = useState<string[]>([]);
  const { showAlert } = useAppAlert();
  const [isGalleryVisible, setIsGalleryVisible] = useState(false);
  const cartDrawerX = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const slideCartIn = () => {
    cartDrawerX.setValue(SCREEN_WIDTH);
    requestAnimationFrame(() => {
      Animated.timing(cartDrawerX, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  };

  useEffect(() => {
    if (!initialConversationId) return;
    getConversationHistory(initialConversationId).then((conversation) => {
      if (!conversation || Array.isArray(conversation)) return;
      setMessages((conversation.messages || []).map((message) => ({
        id: message.id,
        role: message.role,
        text: message.text,
      })));
    }).catch((error) => showAlert(friendlyError(error, 'Could not load this conversation.')));
  }, [initialConversationId, showAlert]);

  const markProgress = (step: string) => setFlowProgress((current) => current.includes(step) ? current : [...current, step]);

  const selectAssistantMode = (mode: AssistantMode | null) => {
    setActiveMode(mode);
    setSettingsVisible(false);
  };

  const openDesignSearch = async (category: FlowCategory, query = designQuery) => {
    setDesignCategory(category);
    setDesignQuery(query);
    setDesignPage(1);
    setDesignModalVisible(true);
    setDesignLoading(true);
    try {
      const result = await searchDesigns(query, category, 1);
      setDesigns(result.products || []);
      setDesignPages(result.pages || 1);
    } catch (error) {
      showAlert(friendlyError(error, 'Could not load designs.'));
    } finally {
      setDesignLoading(false);
    }
  };

  const designCategoryFromPrompt = (prompt: string): FlowCategory | null => {
    if (/\b(website|web site|web)\b/i.test(prompt)) return 'Website';
    if (/\b(mobile app|mobile application|mobile|app)\b/i.test(prompt)) return 'Mobile App';
    return null;
  };

  const openDesignPickerForBuildRequest = (prompt: string, intent?: string) => {
    if (intent && intent !== 'build') return;
    const category = designCategoryFromPrompt(prompt);
    if (category) {
      openDesignSearch(category, prompt);
    }
  };

  const loadDesignPage = async (page: number) => {
    setDesignLoading(true);
    try {
      const result = await searchDesigns(designQuery, designCategory, page);
      setDesigns(result.products || []);
      setDesignPage(result.page || page);
    } catch (error) {
      showAlert(friendlyError(error, 'Could not load designs.'));
    } finally {
      setDesignLoading(false);
    }
  };

  const chooseDesign = async (design: DesignResult) => {
    const productId = design.id ?? design.pid;
    if (!productId) {
      showAlert('This design is missing its product id.');
      return;
    }
    setDesignLoading(true);
    try {
      const created = await createEditory({
        product: productId,
        title: design.title || 'New project',
        company: companyName.trim() || 'Apsuni',
        company_logo: logoUrl.trim() || 'logo.png',
        type: designCategory,
        image: design.image || 'product.jpg',
      });
      const editory = created.data;
      if (companyName.trim() || logoUrl.trim()) {
        await updateEditory(editory.id, {
          ...(companyName.trim() ? { company: companyName.trim() } : {}),
          ...(logoUrl.trim() ? { company_logo: logoUrl.trim() } : {}),
        });
      }
      await addEditoryToCart(editory.id);
      setDesignModalVisible(false);
      openCart();
      markProgress('Design selected');
      markProgress('Project created');
      markProgress('Added to cart');
    } catch (error) {
      showAlert(friendlyError(error, 'Could not create this project.'));
    } finally {
      setDesignLoading(false);
    }
  };

  const closeCart = () => {
    Animated.timing(cartDrawerX, {
      toValue: SCREEN_WIDTH,
      duration: 460,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setCartVisible(false);
    });
  };

  const openChecklist = async (idea: string) => {
    setIsWaitingForReply(true);
    try {
      const result = await getBusinessChecklist(idea);
      setChecklist((result.checklist || []) as ChecklistStep[]);
      setChecklistVisible(true);
    } catch (error) {
      showAlert(friendlyError(error, 'Could not create the checklist.'));
    } finally {
      setIsWaitingForReply(false);
    }
  };

  const payFromWallet = async () => {
    if (!address.trim() || !mobile.trim()) {
      showAlert('Enter a delivery address and mobile number first.');
      return;
    }
    try {
      const wallets = await listWallets();
      const balance = wallets.reduce((sum, wallet) => sum + Number(wallet.balance || 0), 0);
      const total = Number(cart?.total_price || cart?.total || cart?.cart_total || 0);
      if (total > 0 && balance < total) {
        showAlert(`Insufficient wallet balance. Available: ${formatMoney(balance)}.`);
        return;
      }
      const result = await checkoutWithWallet({ address: address.trim(), mobile: mobile.trim(), status: true });
      markProgress('Checkout complete');
      setCartVisible(false);
      showAlert(result.message || 'Payment completed successfully.');
    } catch (error) {
      showAlert(friendlyError(error, 'Checkout could not be completed.'));
    }
  };

  // FIX: openCart now resets the drawer offscreen and animates it in,
  // the same way chooseDesign() does. Previously it only set state,
  // so tapping the header cart icon showed the modal with the drawer
  // stuck at its last transform value (usually fully off-screen).
  const openCart = async () => {
    setCart(null);
    setCartLoading(true);
    setCartVisible(true);
    slideCartIn();

    try {
      const currentCart = await viewCart();
      setCart(currentCart.data);
    } catch (error) {
      showAlert(friendlyError(error, 'Could not load your cart.'));
    } finally {
      setCartLoading(false);
    }
  };

  const animation = useRef(new Animated.Value(0)).current;
  const orbRef = useRef<VoiceOrbHandle>(null);
  const hasStartedRef = useRef(false);

  const requestMicPermission = async () => {
    if (Platform.OS !== 'android') {
      return true;
    }
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'This app needs access to your microphone to listen and respond to you.',
        buttonPositive: 'Allow',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const conversation = useConversation();
  const { status, isSpeaking } = conversation;
  const isConnected = status === 'connected';

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearIdleTimer = useCallback(() => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  }, []);

  const pauseVoiceSession = useCallback(() => {
    clearIdleTimer();
    if (hasStartedRef.current || isConnected) {
      conversation.endSession();
      hasStartedRef.current = false;
      setIsStartingVoice(false);
    }
  }, [clearIdleTimer, conversation, isConnected]);

  const resetIdleTimer = useCallback(() => {
    clearIdleTimer();
  }, [clearIdleTimer]);

  useEffect(() => {
    let rafId: number;

    const tick = () => {
      if (isSpeaking) {
        const volume = conversation.getOutputVolume?.() ?? 0;
        orbRef.current?.setAudioLevel(volume);
      } else {
        orbRef.current?.setAudioLevel(0);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isSpeaking, conversation]);

  const startListening = useCallback(async () => {
    if (hasStartedRef.current) {
      return;
    }
    hasStartedRef.current = true;
    setIsStartingVoice(true);

    const hasPermission = await requestMicPermission();
    if (!hasPermission) {
      console.log('Microphone permission denied');
      hasStartedRef.current = false;
      setIsStartingVoice(false);
      return;
    }
    try {
      const credential = await fetchConversationToken();
      const authUserId = getAuthUserId();
      if (!authUserId) {
        throw new Error('Your account identity is missing. Please sign in again before using voice AI.');
      }
      await conversation.startSession({
        ...(typeof credential === 'string' ? { conversationToken: credential } : { agentId: credential.agent_id }),
        userId: `apsuni-${authUserId}`,
        dynamicVariables: { apsuni_user_id: String(authUserId) },
        customLlmExtraBody: {
          apsuni_user_id: String(authUserId),
          user_id: `apsuni-${authUserId}`,
        },
        onConnect: () => {
          resetIdleTimer();
        },
        onDisconnect: () => {
          clearIdleTimer();
          hasStartedRef.current = false;
          setIsStartingVoice(false);
        },
        onMessage: (message: any) => {
          resetIdleTimer();
          setIsWaitingForReply(false);
          const text = message?.message ?? message?.text;
          if (text) {
            const source = message?.source ?? message?.role;
            const role = source === 'user' || source === 'human' ? 'user' : 'assistant';
            setMessages((current) => [
              ...current,
              {
                id: Date.now().toString() + `-${role}`,
                role,
                text,
              },
            ]);
            if (role === 'user' && designCategoryFromPrompt(text)) {
              sendAssistantMessageRealtime(text, conversationId)
                .then((result) => {
                  setConversationId(result.conversation_id);
                  openDesignPickerForBuildRequest(text, result.response?.intent);
                })
                .catch((error) => console.log('Build flow request failed:', error));
            }
          }
        },
      onModeChange: (mode: any) => {
        console.log('Voice mode:', mode);
      },
      onStatusChange: (statusEvent: any) => {
        console.log('Voice status:', statusEvent);
      },
      onVadScore: (vadEvent: any) => {
        console.log('Voice activity:', vadEvent);
      },
      onError: (message: any) => {
        const errorText = message?.message ?? message?.error ?? String(message);
        console.log('Voice agent error:', errorText);
        setIsWaitingForReply(false);
        showAlert(friendlyError(String(errorText), 'The voice assistant ran into a problem. Please try again.'));
      },
      });
    } catch (err) {
      console.log('Failed to start voice session:', err);
      hasStartedRef.current = false;
      setIsStartingVoice(false);
      showAlert(friendlyError(err, 'Could not start the voice session. Please try again.'));
    }
  }, [conversation, resetIdleTimer, clearIdleTimer, showAlert]);

  useEffect(() => {
    return () => {
      clearIdleTimer();
      conversation.endSession();
      closeRestAISocket();
      hasStartedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMicPress = () => {
    if (isConnected) {
      pauseVoiceSession();
    } else {
      startListening();
    }
    onMicPress?.();
  };

  const sendPromptAndReply = async (prompt: string) => {
    if (!prompt.trim()) {
      return;
    }

    pauseVoiceSession();
    onSendPrompt?.(prompt);

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: Date.now().toString() + '-user',
        role: 'user',
        text: prompt,
      },
    ]);

    setIsWaitingForReply(true);
    try {
      const socketResult = await sendAssistantMessageRealtime(prompt, conversationId);
      const result = socketResult.response;
      if (!result || !socketResult.conversation_id) throw new Error('The assistant returned an incomplete response.');
      setConversationId(socketResult.conversation_id);
      setMessages((current) => [...current, {
        id: Date.now().toString() + '-assistant-api',
        role: 'assistant',
        text: result.reply_text,
      }]);
      openDesignPickerForBuildRequest(prompt, result.intent);
      if (result.intent === 'business' && /\b(idea|business|launch|start|grow|company)\b/i.test(prompt)) {
        openChecklist(prompt);
      }
    } catch (error) {
      const message = friendlyError(error, 'I could not reach the assistant right now.');
      showAlert(message);
      setMessages((current) => [...current, {
        id: Date.now().toString() + '-assistant-error',
        role: 'assistant',
        text: friendlyError(error, 'I could not reach the assistant right now.'),
      }]);
    } finally {
      setIsWaitingForReply(false);
    }
  };

  const handlePromptAction = () => {
    if (!promptText.trim() || isWaitingForReply) {
      return;
    }

    const prompt = promptText.trim();

    setPromptText('');

    sendPromptAndReply(prompt);
  };

  const toggleSheet = () => {
    const toValue = isExpanded ? 0 : 1;

    if (!isExpanded) {
      pauseVoiceSession();
    }

    Animated.spring(animation, {
      toValue,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();

    setIsExpanded(!isExpanded);
  };

  const translateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [COLLAPSED_OFFSET, 0],
  });

  const arrowRotate = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const listeningStatusLabel = !isConnected
    ? 'Paused'
    : isSpeaking
    ? 'Speaking...'
    : "Go ahead, I'm listening...";

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <AppBackground />

      <SafeAreaView style={styles.safeArea}>
        {/* HEADER */}
        <AppHeader
          onBack={onBack}
          onCart={openCart}
          onNotification={() => showAlert('You have no new notifications.')}
        />

        {/* MAIN CONTENT */}
        <View style={styles.contentContainer}>
          <Text style={styles.listeningStatus}>
            {listeningStatusLabel}
          </Text>

          {/* ORB */}
          <View style={styles.orbWrapper}>
            <View style={styles.orbGlowHalo} />

            <VoiceOrb
              ref={orbRef}
              isTalking={isSpeaking}
              size={540}
              colors={ORB_COLORS}
            />
          </View>

          <Image
            source={require('@/assets/images/tabs-icon/Sound voice waves.gif')}
            style={styles.voiceWaves}
          />
        </View>

         <Pressable
                  style={[styles.tabItem]}
                  onPress={() => setIsGalleryVisible(true)}
                >
                  <Image
                    source={require('@/assets/images/tabs-icon/search.png')}
                    style={styles.searchIcon}
                    resizeMode="contain"
                  />
                </Pressable>

        {/* BOTTOM CONTROL */}
        <View style={styles.bottomBar}>
          <View style={styles.micOuterHalo}>

            {/* DOWN BUTTON */}
            <View style={styles.modeControl}>
              {activeMode && <Text style={styles.modeLabel}>{activeMode}</Text>}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setSettingsVisible(true)}
                style={styles.sideIconButton}
              >
                <LinearGradient
                  colors={['#3B82F6', '#2563EB', '#1D4ED8']}
                  style={styles.micGradient}
                >
                  {activeMode ? (
                    <Feather
                      name={ASSISTANT_MODES.find((mode) => mode.label === activeMode)?.icon as any}
                      size={24}
                      color="#FFFFFF"
                    />
                  ) : (
                    <Image
                      source={require('@/assets/images/tabs-icon/settings (1).png')}
                      style={{ width: 24, height: 24 }}
                      resizeMode="contain"
                    />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* SHEET BUTTON */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={toggleSheet}
              style={styles.sideIconButton}
            >
              <LinearGradient
                colors={[
                  '#3B82F6',
                  '#2563EB',
                  '#1D4ED8',
                ]}
                style={styles.micGradient}
              >
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: arrowRotate,
                    },
                  ],
                  width: 50,
                  height: 50,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Image
                  source={require('@/assets/images/tabs-icon/chat.png')}
                  style={styles.arrowIcon}
                  resizeMode="contain"
                />
              </Animated.View>
              </LinearGradient>
            </TouchableOpacity>

            {/* MICROPHONE — pause / resume the live session */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleMicPress}
              disabled={isStartingVoice}
              style={styles.micButtonWrapper}
            >
              <LinearGradient
                colors={[
                  '#3B82F6',
                  '#2563EB',
                  '#1D4ED8',
                ]}
                style={styles.micGradient}
              >
                {isStartingVoice ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : !isConnected ? (
                  <Image
                    source={require('@/assets/images/tabs-icon/mute.png')}
                    style={styles.muteIcon}
                    resizeMode="contain"
                  />
                ) : (
                  <Ionicons
                    name="mic-outline"
                    size={26}
                    color="#FFFFFF"
                  />
                )}
              </LinearGradient>
            </TouchableOpacity>

          </View>
        </View>
      </SafeAreaView>

      {/* Keep the app navigation available during voice sessions. */}
      <CustomTabBar />

      {/* =====================================================
          ANIMATED CARD
      ===================================================== */}

      <Animated.View
        style={[
          styles.sheetContainer,
          {
            transform: [
              {
                translateY,
              },
            ],
          },
        ]}
      >
        {/* HANDLE */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={toggleSheet}
          style={styles.sheetHandleContainer}
        >
          <Image
            source={require('@/assets/images/tabs-icon/arrow.png')}
            style={styles.arrowIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>

        <ScrollView
          style={styles.sheetScrollView}
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickAction} onPress={() => openDesignSearch('Mobile App')}>
              <Feather name="smartphone" size={15} color="#2563EB" />
              <Text style={styles.quickActionText}>Find app designs</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => openDesignSearch('Website')}>
              <Feather name="layout" size={15} color="#2563EB" />
              <Text style={styles.quickActionText}>Find website designs</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={() => openChecklist('My business idea')}>
              <Feather name="check-square" size={15} color="#2563EB" />
              <Text style={styles.quickActionText}>Business checklist</Text>
            </TouchableOpacity>
          </View>
          {flowProgress.length > 0 && (
            <View style={styles.progressCard}>
              <Text style={styles.progressTitle}>Project progress</Text>
              {['Design selected', 'Project created', 'Added to cart', 'Checkout complete'].map((step) => (
                <Text key={step} style={styles.progressStep}>
                  {flowProgress.includes(step) ? '✓' : '○'} {step}
                </Text>
              ))}
            </View>
          )}
          {messages.length > 0 ? (
            <View style={styles.conversationContainer}>

              {messages.map((message) =>
                message.role === 'user' ? (
                  <View
                    key={message.id}
                    style={styles.userPromptBubble}
                  >
                    <Text style={styles.userPromptText}>
                      {message.text}
                    </Text>
                  </View>
                ) : (
                  <View
                    key={message.id}
                    style={styles.assistantMessage}
                  >
                    <View style={styles.reasoningRow}>

                      <Image
                        source={{
                          uri:
                            'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=120&auto=format&fit=crop',
                        }}
                        style={styles.reasoningAvatar}
                      />

                      <Text style={styles.reasoningText}>
                        {message.text}
                      </Text>

                    </View>

                    <View style={styles.responseActions}>

                      <TouchableOpacity
                        style={styles.responseActionButton}
                      >
                        <Image
                          source={require('@/assets/images/tabs-icon/language.png')}
                          style={styles.responseLanguageIcon}
                          resizeMode="contain"
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.responseActionButton}
                      >
                        <Feather
                          name="copy"
                          size={17}
                          color="#64748B"
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.responseActionButton}
                      >
                        <Feather
                          name="share-2"
                          size={17}
                          color="#64748B"
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.responseActionButton}
                      >
                        <Feather
                          name="more-vertical"
                          size={18}
                          color="#64748B"
                        />
                      </TouchableOpacity>

                    </View>
                  </View>
                )
              )}

              {isWaitingForReply && (
                <View style={styles.reasoningRow}>

                  <Image
                    source={{
                      uri:
                        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=120&auto=format&fit=crop',
                    }}
                    style={styles.reasoningAvatar}
                  />

                  <Image
                    source={require('@/assets/images/tabs-icon/loading.gif')}
                    style={styles.loadingIcon}
                    resizeMode="contain"
                  />

                </View>
              )}

            </View>
          ) : (
            <>
              {/* ORB IMAGE */}
              <View style={styles.sheetOrbWrapper}>
                <Image
                  source={{
                    uri:
                      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop',
                  }}
                  style={styles.sheetOrbImage}
                />
              </View>

              {/* TITLE */}
              <Text style={styles.sheetTitle}>
                Enhance your writing{'\n'}
                with{' '}
                <Text style={styles.sheetTitleHighlight}>
                  creative tools
                </Text>
              </Text>

              {/* TOOLS */}
              <View style={styles.chipsContainer}>
                {CREATIVE_TOOLS.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.75}
                    style={styles.chipButton}
                  >
                    <Feather
                      name={item.icon as any}
                      size={15}
                      color="#475569"
                      style={styles.chipIcon}
                    />

                    <Text style={styles.chipText}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </ScrollView>

        {/* =====================================================
            PROMPT BAR
        ===================================================== */}

        <View style={styles.floatingInputBar}>

          <View style={styles.inputPill}>

            <Feather
              name="image"
              size={18}
              color="#94A3B8"
            />

            <TextInput
              value={promptText}
              onChangeText={setPromptText}
              onFocus={() => {
                setIsInputFocused(true);
                pauseVoiceSession();
              }}
              placeholder="write your prompt"
              placeholderTextColor="#64748B"
              style={styles.promptInput}
              multiline
            />

            {isWaitingForReply ? (
              <CenterButton
                onPress={handlePromptAction}
                iconSource={require('@/assets/images/tabs-icon/square.png')}
                iconSize={20}
                style={styles.promptCenterButton}
              />
            ) : isInputFocused ||
              promptText.trim().length > 0 ? (
              <CenterButton
                onPress={handlePromptAction}
                iconSource={require('@/assets/images/tabs-icon/send.png')}
                iconSize={20}
                style={styles.promptCenterButton}
              />
            ) : (
              <CenterButton
                onPress={() => onMicPress?.()}
                style={styles.promptCenterButton}
              />
            )}

          </View>

          {!isInputFocused && (
            <TouchableOpacity
              style={styles.promptLangButton}
              activeOpacity={0.85}
            >
              <Image
                source={require('@/assets/images/tabs-icon/language.png')}
                style={styles.languageIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}

        </View>
      </Animated.View>

      <Modal visible={designModalVisible} animationType="slide" transparent onRequestClose={() => setDesignModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a {designCategory.toLowerCase()} design</Text>
              <TouchableOpacity onPress={() => setDesignModalVisible(false)}><Feather name="x" size={22} color="#64748B" /></TouchableOpacity>
            </View>
            <TextInput value={designQuery} onChangeText={setDesignQuery} placeholder="Describe the design" placeholderTextColor="#94A3B8" style={styles.modalInput} />
            <TextInput value={companyName} onChangeText={setCompanyName} placeholder="Company / brand name (optional)" placeholderTextColor="#94A3B8" style={styles.modalInput} />
            <TextInput value={logoUrl} onChangeText={setLogoUrl} placeholder="Logo URL (optional)" placeholderTextColor="#94A3B8" style={styles.modalInput} autoCapitalize="none" />
            <TouchableOpacity style={styles.searchButton} onPress={() => openDesignSearch(designCategory)} disabled={designLoading}>
              {designLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.searchButtonText}>Search designs</Text>}
            </TouchableOpacity>
            <FlatList
              data={designs}
              keyExtractor={(item, index) => String(item.id ?? item.pid ?? index)}
              numColumns={2}
              columnWrapperStyle={styles.designGridRow}
              ListEmptyComponent={<Text style={styles.emptyText}>Search to see available designs.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.designRow} onPress={() => chooseDesign(item)} disabled={designLoading}>
                  {item.image ? <Image source={{ uri: item.image }} style={styles.designImage} /> : <View style={styles.designImagePlaceholder}><Feather name="image" size={20} color="#94A3B8" /></View>}
                  <View style={styles.designInfo}><Text style={styles.designTitle}>{item.title || 'Untitled design'}</Text><Text style={styles.designMeta}>{item.price ? `$${item.price}` : 'Select this design'}</Text></View>
                  <Feather name="chevron-right" size={18} color="#2563EB" />
                </TouchableOpacity>
              )}
            />
            <View style={styles.pagination}><TouchableOpacity disabled={designPage <= 1 || designLoading} onPress={() => loadDesignPage(designPage - 1)}><Text style={styles.pageText}>Previous</Text></TouchableOpacity><Text style={styles.pageNumber}>{designPage} / {designPages}</Text><TouchableOpacity disabled={designPage >= designPages || designLoading} onPress={() => loadDesignPage(designPage + 1)}><Text style={styles.pageText}>Next</Text></TouchableOpacity></View>
          </View>
        </View>
      </Modal>

      <Modal visible={checklistVisible} animationType="slide" transparent onRequestClose={() => setChecklistVisible(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>Your business checklist</Text><TouchableOpacity onPress={() => setChecklistVisible(false)}><Feather name="x" size={22} color="#64748B" /></TouchableOpacity></View>
          <Text style={styles.modalSubtitle}>Tap each step as you complete it.</Text>
          {checklist.map((step, index) => <TouchableOpacity key={index} style={styles.checklistRow} onPress={() => setChecklist((items) => items.map((item, i) => i === index ? { ...item, done: !item.done } : item))}><Feather name={step.done ? 'check-square' : 'square'} size={20} color={step.done ? '#2563EB' : '#94A3B8'} /><Text style={styles.checklistText}>{step.label || step.title || step.name || `Step ${index + 1}`}</Text></TouchableOpacity>)}
        </View></View>
      </Modal>

      <Modal visible={cartVisible} animationType="none" transparent onRequestClose={closeCart}>
        <View style={styles.cartDrawerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCart} />
          <Animated.View style={[styles.cartDrawer, { transform: [{ translateX: cartDrawerX }] }]}>
            <View style={styles.cartDrawerHeader}>
              <TouchableOpacity accessibilityLabel="Close cart" onPress={closeCart} style={styles.cartCloseButton}>
                <Feather name="x" size={22} color="#CBD5E1" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.cartItems} showsVerticalScrollIndicator={false}>
              {cartLoading ? (
                <View style={styles.cartLoadingState}>
                  <ActivityIndicator size="large" color="#86EFAC" />
                  <Text style={styles.cartLoadingText}>Loading your cart...</Text>
                </View>
              ) : getCartItems(cart).length === 0 ? (
                <View style={styles.emptyCart}>
                  <Feather name="shopping-cart" size={30} color="#64748B" />
                  <Text style={styles.emptyCartText}>Your cart is empty.</Text>
                </View>
              ) : getCartItems(cart).map((item, index) => (
                <View key={String(item.id ?? item.product_id ?? index)} style={styles.cartItem}>
                  <View style={styles.cartItemIcon}><Feather name="file-text" size={19} color="#86EFAC" /></View>
                  <View style={styles.cartItemInfo}>
                    <Text numberOfLines={2} style={styles.cartItemName}>{getCartItemName(item, index)}</Text>
                    <Text style={styles.cartItemMeta}>Quantity: {item.quantity ?? 1}</Text>
                  </View>
                  <Text style={styles.cartItemPrice}>{formatMoney(item.price ?? item.total ?? 0)}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.cartCheckoutSection}>
              <View style={styles.cartTotalRow}>
                <Text style={styles.cartTotalLabel}>Total</Text>
                <Text style={styles.cartTotal}>{formatMoney(cart?.total_price ?? cart?.total ?? cart?.cart_total ?? 0)}</Text>
              </View>
              <TouchableOpacity style={styles.checkoutButton} onPress={payFromWallet} activeOpacity={0.85}>
                <Text style={styles.checkoutButtonText}>Checkout</Text>
                <Feather name="arrow-right" size={18} color="#052E16" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={settingsVisible} animationType="fade" transparent onRequestClose={() => setSettingsVisible(false)}>
        <View style={styles.settingsBackdrop}>
          <View style={styles.settingsCard}>
            <Text style={styles.settingsModeHint}>Choose your assistant mode</Text>
            <View style={styles.settingsSection}>
              {ASSISTANT_MODES.map((mode, index) => (
                <React.Fragment key={mode.label}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    style={styles.settingsRow}
                    onPress={() => selectAssistantMode(mode.label)}
                  >
                    <View style={styles.settingsRowIcon}>
                      <Feather name={mode.icon as any} size={19} color="#2563EB" />
                    </View>
                    <View style={styles.settingsRowCopy}>
                      <Text style={styles.settingsRowTitle}>{mode.label}</Text>
                      <Text style={styles.settingsRowDescription}>{mode.description}</Text>
                    </View>
                    <Switch
                      value={activeMode === mode.label}
                      onValueChange={(enabled) => selectAssistantMode(enabled ? mode.label : null)}
                      trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
                      thumbColor={activeMode === mode.label ? '#2563EB' : '#F8FAFC'}
                    />
                  </TouchableOpacity>
                  {index < ASSISTANT_MODES.length - 1 && <View style={styles.settingsDivider} />}
                </React.Fragment>
              ))}
            </View>

          </View>
        </View>
      </Modal>
      <DesignGalleryPopup
              visible={isGalleryVisible}
              onClose={() => setIsGalleryVisible(false)}
            />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060B11',
  },

  safeArea: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 12,
    zIndex: 10,
  },

  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    justifyContent:"center",
    textAlign:"center",
  },

  headerLeftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },

  walletControl: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    right: -10,
  },

  walletDropdownButton: {
    width: 20,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  walletIconButton: {
    width: 'auto',
    minWidth: 36,
    flexDirection: 'row',
    paddingHorizontal: 9,
  },

  selectedWalletAmount: {
    maxWidth: 64,
    marginLeft: 4,
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '700',
  },

  walletDropdown: {
    position: 'absolute',
    top: 44,
    left: 0,
    width: 100,
    maxHeight: 260,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#132033',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.35)',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 20,
  },

  walletDropdownTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },

  walletLoader: {
    marginVertical: 14,
  },

  walletEmptyText: {
    color: '#94A3B8',
    fontSize: 13,
    paddingVertical: 8,
  },

  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },

  walletRowSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
  },

  walletName: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },

  walletBalance: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },

  headerSpacer: {
    width: 40,
  },

  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  listeningStatus: {
    fontSize: 15,
    color: '#94A3B8',
    marginBottom: 40,
    letterSpacing: 0.2,
  },

  orbWrapper: {
    width: 240,
    height: 240,
    borderRadius: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
    position: 'relative',
  },

  orbGlowHalo: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.2,
  },

  voiceWaves: {
    width: 200,
    height: 100,
    marginTop: -20,
    marginBottom: 16,
  },

  proPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 32,
    paddingTop: 16,
    marginBottom: 120,
  },

  modeControl: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },

  modeLabel: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },

  micOuterHalo: {
    width: 190,
    height: 88,
    left: 20,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 80,
  },

  sideIconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2B352F',
    width: 50,
    height: 50,
    borderRadius: 25,
  },

  arrowIcon: {
    width: 22,
    height: 22,
    tintColor: '#CBD5E1',
  },

  proText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  micButtonWrapper: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  micGradient: {
    width: 50,
    height: 50,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },

  muteIcon: {
    width: 26,
    height: 26,
  },

  sheetContainer: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },

  sheetScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 110,
    alignItems: 'center',
  },

  sheetScrollView: {
    flex: 1,
  },

  sheetHandleContainer: {
    position: 'absolute',
    top: -15,
    left: '50%',
    width: 36,
    height: 36,
    marginLeft: -18,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },

  sheetOrbWrapper: {
    width: 130,
    height: 130,
    borderRadius: 65,
    marginBottom: 16,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sheetOrbImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },

  sheetTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 24,
  },

  sheetTitleHighlight: {
    color: '#6366F1',
  },

  chipsContainer: {
    flexDirection: 'row',
    paddingBottom: 20,
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },

  conversationContainer: {
    alignSelf: 'stretch',
    paddingTop: 28,
    paddingHorizontal: 8,
  },

  userPromptBubble: {
    alignSelf: 'flex-end',
    maxWidth: '86%',
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 28,
  },

  userPromptText: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 22,
  },

  reasoningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  reasoningAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },

  reasoningText: {
    color: '#64748B',
    fontSize: 15,
    lineHeight: 22,
  },

  assistantMessage: {
    alignSelf: 'stretch',
    marginBottom: 24,
  },

  responseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginLeft: 44,
    marginTop: 10,
  },

  responseActionButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  responseLanguageIcon: {
    width: 17,
    height: 17,
  },

  loadingIcon: {
    width: 56,
    height: 32,
  },

  chipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  chipIcon: {
    marginRight: 8,
  },

  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },

  floatingInputBar: {
    position: 'absolute',
    bottom: 5,
    left: 20,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },

  inputPill: {
    flex: 1,
    height: 70,
    backgroundColor: '#F8FAFC',
    borderRadius: 35,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },

  promptInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 64,
    paddingVertical: 0,
    fontSize: 14,
    color: '#1E293B',
  },

  promptCenterButton: {
    width: 45,
    height: 45,
    right: -10,
    top: 3,
  },

  promptLangButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  languageIcon: {
    width: 22,
    height: 22,
  },

  searchIcon: {
    width: 24,
    height: 24,
  },

  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickActions: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  quickAction: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8 },
  quickActionText: { color: '#1D4ED8', fontSize: 12, fontWeight: '600' },
  progressCard: { width: '100%', backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, marginBottom: 16 },
  progressTitle: { color: '#0F172A', fontSize: 14, fontWeight: '700', marginBottom: 5 },
  progressStep: { color: '#475569', fontSize: 12, lineHeight: 20 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.65)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '88%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { flex: 1, color: '#0F172A', fontSize: 18, fontWeight: '800' },
  modalSubtitle: { color: '#64748B', fontSize: 13, marginBottom: 14 },
  modalInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, color: '#0F172A', paddingHorizontal: 13, paddingVertical: 11, marginBottom: 9 },
  searchButton: { backgroundColor: '#2563EB', borderRadius: 12, alignItems: 'center', justifyContent: 'center', minHeight: 44, marginBottom: 12 },
  searchButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  cartDrawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.68)',
    alignItems: 'flex-end',
  },
  cartDrawer: {
    width: '70%',
    maxWidth: 390,
    height: '95%',
    backgroundColor: '#0F1B2D',
    paddingTop: Platform.OS === 'ios' ? 56 : 28,
  },
  cartDrawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#26364E',
  },
  cartDrawerTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '800' },
  cartDrawerSubtitle: { color: '#94A3B8', fontSize: 12, marginTop: 3 },
  cartCloseButton: {
    width: 36,
    height: 36,
    top: 5,
    right: -190,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E2E45',
  },
  cartItems: { padding: 16, gap: 10, flexGrow: 1 },
  cartLoadingState: { flex: 1, minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: 12 },
  cartLoadingText: { color: '#CBD5E1', fontSize: 14 },
  emptyCart: { flex: 1, minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyCartText: { color: '#94A3B8', fontSize: 14 },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#17263B',
    gap: 10,
  },
  cartItemIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#153526',
  },
  cartItemInfo: { flex: 1 },
  cartItemName: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },
  cartItemMeta: { color: '#94A3B8', fontSize: 11, marginTop: 3 },
  cartItemPrice: { color: '#86EFAC', fontSize: 13, fontWeight: '700' },
  cartCheckoutSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#26364E',
    backgroundColor: '#112036',
  },
  cartInput: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  cartTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 10 },
  cartTotalLabel: { color: '#CBD5E1', fontSize: 15, fontWeight: '700' },
  cartTotal: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  checkoutButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#86EFAC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  checkoutButtonText: { color: '#052E16', fontSize: 15, fontWeight: '800' },
  emptyText: { textAlign: 'center', color: '#64748B', paddingVertical: 25 },
  settingsBackdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.35)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  settingsCard: { width: '100%', maxWidth: 320, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 12 },
  settingsHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 4, backgroundColor: '#CBD5E1', marginBottom: 18 },
  settingsTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingsTitleIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  settingsImage: { width: 25, height: 25 },
  settingsTitle: { color: '#0F172A', fontSize: 20, fontWeight: '800' },
  settingsModeHint: { color: '#64748B', fontSize: 12, marginBottom: 8 },
  settingsSubtitle: { color: '#64748B', fontSize: 12, marginTop: 3 },
  settingsCloseButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  settingsSectionLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 10, marginBottom: 8 },
  settingsSection: { backgroundColor: '#F8FAFC', borderRadius: 16, paddingHorizontal: 14 },
  settingsRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center' },
  settingsRowIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  settingsRowCopy: { flex: 1, paddingRight: 8 },
  settingsRowTitle: { color: '#1E293B', fontSize: 14, fontWeight: '700' },
  settingsRowDescription: { color: '#64748B', fontSize: 11, lineHeight: 16, marginTop: 3 },
  settingsDivider: { height: 1, backgroundColor: '#E2E8F0' },
  settingsInfoRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 11 },
  settingsInfoText: { flex: 1, color: '#64748B', fontSize: 12 },
  settingsDoneButton: { backgroundColor: '#2563EB', borderRadius: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: 18 },
  settingsDoneText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  designGridRow: { justifyContent: 'space-between', gap: 12 },
  designRow: { width: '48%', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 8, marginBottom: 12 },
  designImage: { width: '100%', height: 110, borderRadius: 10, backgroundColor: '#F1F5F9' },
  designImagePlaceholder: { width: '100%', height: 110, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  designInfo: { flex: 1 },
  designTitle: { color: '#0F172A', fontSize: 14, fontWeight: '700' },
  designMeta: { color: '#64748B', fontSize: 12, marginTop: 3 },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 },
  pageText: { color: '#2563EB', fontWeight: '700', fontSize: 13 },
  pageNumber: { color: '#64748B', fontSize: 12 },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  checklistText: { flex: 1, color: '#334155', fontSize: 14 },
});
