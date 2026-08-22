import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { ConversationProvider, useConversation } from '@elevenlabs/react-native';

import BackButton from '../../components/BackButton';
import AppBackground from '../../components/AppBackground';
import { CenterButton } from '../../components/CustomTabBar';
import VoiceOrb from '../../components/VoiceOrb';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLLAPSED_OFFSET = SCREEN_HEIGHT;

const ORB_COLORS = {
  center: '#60A5FA',
  mid: '#3B82F6',
  outer: '#1D4ED8',
};

// ---------------------------------------------------------------------------
// CONFIG — update these for your setup
// ---------------------------------------------------------------------------
const AGENT_ID = 'YOUR_AGENT_ID';

// Your Django backend endpoint that exchanges your ElevenLabs API key for a
// short-lived conversation token — see voiceagent_views.py's
// get_conversation_token. The SDK calls this itself.
const TOKEN_FETCH_URL = 'https://api.apsuni.com/api/voice-agent/token/';

// If nobody has spoken and the agent hasn't replied for this long, we end
// the session ourselves. Safety net on top of whatever silence timeout you
// set on the agent in the ElevenLabs dashboard — stops you being billed
// for a connection nobody is using.
const IDLE_TIMEOUT_MS = 45 * 1000;

interface VoiceAssessmentScreenProps {
  onBack?: () => void;
  onEdit?: () => void;
  onBookmark?: () => void;
  onMicPress?: () => void;
  onSendPrompt?: (prompt: string) => void;
}

const CREATIVE_TOOLS = [
  {
    id: '1',
    label: 'Copywriter GPT - Marketing, Branding, Ads',
    icon: 'pen-tool',
  },
  {
    id: '2',
    label: 'CV Writer - the CV Expert',
    icon: 'file-text',
  },
  {
    id: '3',
    label: 'Write For Me',
    icon: 'edit-3',
  },
  {
    id: '4',
    label: 'Automated Writer',
    icon: 'sliders',
  },
  {
    id: '5',
    label: 'AI Humanizer Pro',
    icon: 'user-check',
  },
  {
    id: '6',
    label: 'Text to Video Maker',
    icon: 'video',
  },
  {
    id: '7',
    label: 'Humanize AI',
    icon: 'cpu',
  },
  {
    id: '8',
    label: "Fully SEO Optimized Article including FAQ's",
    icon: 'search',
  },
];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

// ---------------------------------------------------------------------------
// Default export — just wires up the ConversationProvider and renders the
// actual screen inside it, since useConversation must be called from a
// component that sits underneath the provider.
// ---------------------------------------------------------------------------
export default function VoiceAssessmentScreen(props: VoiceAssessmentScreenProps) {
  return (
    <ConversationProvider tokenFetchUrl={TOKEN_FETCH_URL}>
      <VoiceAssessmentScreenInner {...props} />
    </ConversationProvider>
  );
}

function VoiceAssessmentScreenInner({
  onBack,
  onMicPress,
  onSendPrompt,
}: VoiceAssessmentScreenProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isWaitingForReply, setIsWaitingForReply] = useState(false);

  const animation = useRef(new Animated.Value(0)).current;

  /*
   * ---------------------------------------------------------
   * VOICE CONVERSATION — @elevenlabs/react-native
   * ---------------------------------------------------------
   *
   * conversation.status: 'connecting' | 'connected' | 'disconnected'
   * conversation.isSpeaking: whether the agent is currently talking
   *
   * The session is always-on: it starts the moment this screen mounts,
   * and stays open (listening) until the mic button is pressed to pause
   * it, the screen is left, or the idle timer closes it.
   */

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

  const resetIdleTimer = useCallback(() => {
    clearIdleTimer();
    idleTimer.current = setTimeout(() => {
      // No activity for a while — close the session so the per-minute
      // billing clock stops running.
      conversation.endSession();
    }, IDLE_TIMEOUT_MS);
  }, [clearIdleTimer, conversation]);

  const startListening = useCallback(async () => {
    try {
      await conversation.startSession({
        agentId: AGENT_ID,
        onConnect: () => {
          resetIdleTimer();
        },
        onDisconnect: () => {
          clearIdleTimer();
        },
        // Agent's spoken reply, as text.
        onMessage: (message: any) => {
          resetIdleTimer();
          setIsWaitingForReply(false);
          if (message?.message) {
            setMessages((current) => [
              ...current,
              {
                id: Date.now().toString() + '-assistant',
                role: 'assistant',
                text: message.message,
              },
            ]);
          }
        },
        // Live transcript of what the user said out loud.
        onUserTranscript: (transcript: any) => {
          resetIdleTimer();
          if (transcript?.message) {
            setMessages((current) => [
              ...current,
              {
                id: Date.now().toString() + '-user',
                role: 'user',
                text: transcript.message,
              },
            ]);
          }
        },
        onError: (message: string) => {
          console.log('Voice agent error:', message);
          setIsWaitingForReply(false);
        },
      });
    } catch (err) {
      console.log('Failed to start voice session:', err);
    }
  }, [conversation, resetIdleTimer, clearIdleTimer]);

  // Auto-start listening the moment the screen mounts — no record button.
  useEffect(() => {
    startListening();
    return () => {
      clearIdleTimer();
      conversation.endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * ---------------------------------------------------------
   * MICROPHONE — now doubles as the pause/resume control
   * ---------------------------------------------------------
   *
   * Pressing it actually ends the session (not just mutes it) — that's
   * what stops the per-minute billing clock. Pressing it again resumes.
   */

  const handleMicPress = () => {
    if (isConnected) {
      clearIdleTimer();
      conversation.endSession();
    } else {
      startListening();
    }
    onMicPress?.();
  };

  /*
   * ---------------------------------------------------------
   * SEND PROMPT (typed text, sent into the same live session)
   * ---------------------------------------------------------
   */

  const sendPromptAndReply = async (prompt: string) => {
    if (!prompt.trim()) {
      return;
    }

    onSendPrompt?.(prompt);

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: Date.now().toString() + '-user',
        role: 'user',
        text: prompt,
      },
    ]);

    // If the session isn't connected (paused), resume it first.
    if (!isConnected) {
      await startListening();
    }

    setIsWaitingForReply(true);
    resetIdleTimer();

    // Sends the typed text into the conversation as if it were spoken —
    // the agent's reply arrives via the onMessage callback above.
    // Verify this method name against the current @elevenlabs/react-native
    // API reference if it doesn't resolve.
    conversation.sendUserMessage?.(prompt);
  };

  const handlePromptAction = () => {
    if (!promptText.trim() || isWaitingForReply) {
      return;
    }

    const prompt = promptText.trim();

    setPromptText('');

    sendPromptAndReply(prompt);
  };

  /*
   * ---------------------------------------------------------
   * BOTTOM SHEET
   * ---------------------------------------------------------
   */

  const toggleSheet = () => {
    const toValue = isExpanded ? 0 : 1;

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
        <View style={styles.header}>
          <BackButton onBack={onBack} />

          <Text style={styles.headerTitle}>
            Voice Assessment
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        {/* MAIN CONTENT */}
        <View style={styles.contentContainer}>
          <Text style={styles.listeningStatus}>
            {listeningStatusLabel}
          </Text>

          {/* ORB */}
          <View style={styles.orbWrapper}>
            <View style={styles.orbGlowHalo} />

            <VoiceOrb
              isTalking={isSpeaking}
              size={440}
              colors={ORB_COLORS}
            />
          </View>
        </View>

        {/* BOTTOM CONTROL */}
        <View style={styles.bottomBar}>
          <View style={styles.micOuterHalo}>

            {/* DOWN BUTTON */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.sideIconButton}
            >
              <Feather
                name="chevron-down"
                size={24}
                color="#CBD5E1"
              />
            </TouchableOpacity>

            {/* SHEET BUTTON */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={toggleSheet}
              style={styles.sideIconButton}
            >
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: arrowRotate,
                    },
                  ],
                  backgroundColor: '#2B352F',
                  width: 50,
                  height: 50,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: 25,
                }}
              >
                <Image
                  source={require('@/assets/images/tabs-icon/arrow (1).png')}
                  style={styles.arrowIcon}
                  resizeMode="contain"
                />
              </Animated.View>
            </TouchableOpacity>

            {/* MICROPHONE — pause / resume the live session */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleMicPress}
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
                {!isConnected ? (
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
              onFocus={() => setIsInputFocused(true)}
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
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
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

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 32,
    paddingTop: 16,
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

  micButtonWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#272B2E',
    borderWidth: 9,
    borderColor: '#272B2E',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },

  micGradient: {
    width: 62,
    height: 62,
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
});