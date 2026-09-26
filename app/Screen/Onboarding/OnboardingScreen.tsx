import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, Pressable, StatusBar, StyleSheet, Text, View } from '../../../theme/native';
import { Feather } from '../../../theme/vector-icons';
import { LinearGradient } from '../../../theme/linear-gradient';
import { useRouter } from 'expo-router';

import AppBackground from '../../components/AppBackground';
import { markOnboardingDone } from '../../services/appFlags';
import { KeepAsDrawn } from '../../../theme/ThemeContext';

/**
 * The welcome tour a new install sees before signing in: four swipeable pages; the last one is the Get started page.
 * Each page has one clear picture (a glowing icon with smaller icons orbiting it), a headline and a
 * short line. Everything moves with the swipe position, so it stays smooth at any finger speed.
 * Only transforms and opacity are animated, which is what the native animation driver supports.
 */

const { width: W, height: H } = Dimensions.get('window');

// Everything is laid out from the screen size, so the tour fits a small phone, a tall phone and a tablet.
// The picture is drawn 292 wide and scaled to whatever room is left above the text and the button.
const TOP_SAFE = (StatusBar.currentHeight ?? 30) + 56; // room for the logo and Skip
const SHORT = H < 700; // small phones get a tighter layout
const BOTTOM_GAP = SHORT ? 36 : 72;
const TEXT_ROOM = SHORT ? 380 : 450; // the headline, the line under it and the bottom controls
const HERO_SCALE = Math.max(0.4, Math.min(1.3, (H - TOP_SAFE - TEXT_ROOM) / 292, W / 320));
const CENTER_Y = TOP_SAFE + 146 * HERO_SCALE + 8;
const TEXT_TOP = CENTER_Y + 146 * HERO_SCALE + 18;
const TYPE = Math.max(0.8, Math.min(1.25, W / 390, H / 760)); // text grows a little on big screens and eases on small ones
const AnimatedScrollView = Animated.ScrollView;

type Icon = keyof typeof Feather.glyphMap;
type Slide = { key: string; eyebrow: string; title: string; highlight: string; text: string; center: Icon; colors: [string, string]; orbit: Icon[] };

const SLIDES: Slide[] = [
  {
    key: 'idea', eyebrow: 'AI ASSISTANT', title: 'Turn your idea into', highlight: 'a real app',
    text: 'Tell our AI assistant what you want. It helps you plan, design and get it built.',
    center: 'message-circle', colors: ['#2563EB', '#38BDF8'], orbit: ['mic', 'smartphone', 'globe', 'edit-3'],
  },
  {
    key: 'template', eyebrow: 'DESIGNS', title: 'Pick a design,', highlight: 'make it yours',
    text: 'Start from ready-made websites and apps, then customise them with a simple prompt.',
    center: 'layout', colors: ['#4F46E5', '#8B5CF6'], orbit: ['image', 'code', 'grid', 'type'],
  },
  {
    key: 'track', eyebrow: 'WALLET & PROGRESS', title: 'Pay easily, follow', highlight: 'every step',
    text: 'Fund your wallet, place your order and watch your project go live, step by step.',
    center: 'credit-card', colors: ['#0EA5E9', '#10B981'], orbit: ['shield', 'check-circle', 'activity', 'clock'],
  },
  {
    key: 'start', eyebrow: 'READY WHEN YOU ARE', title: 'Ready to build', highlight: 'with Apsuni?',
    text: 'Create your free account or sign in and bring your first project to life today.',
    center: 'zap', colors: ['#1D4ED8', '#38BDF8'], orbit: ['smartphone', 'globe', 'star', 'send'],
  },
];
const LAST = SLIDES.length - 1;

// The first page is repeated at the end. Sliding on from the last page reaches this copy, and the tour then
// quietly jumps to the real first page, so the loop never visibly rewinds.
const PAGES: Slide[] = [...SLIDES, SLIDES[0]];


/** A value that follows page `index` through the swipe: `output[1]` when it is the current page. */
const across = (scrollX: Animated.Value, index: number, output: [number, number, number], span = 1) =>
  scrollX.interpolate({ inputRange: [(index - span) * W, index * W, (index + span) * W], outputRange: output, extrapolate: 'clamp' });

/** The values that keep moving in the background. One set is shared by every page, which is cheaper than each page running its own and keeps the repeated first page identical to the real one. */
type Ambient = { clock: Animated.Value; twinkle: Animated.Value; float: Animated.Value; pulse: Animated.Value };
const CLOCK_SECONDS = 520; // a whole number of turns for both orbit speeds (26 s and 40 s), so it loops without a jump

/** One turning ring of small icons. The icons turn the opposite way so they always stay upright. */
function Orbit({ radius, icons, seconds, reverse, colors, start, clock }: { radius: number; icons: Icon[]; seconds: number; reverse?: boolean; colors: [string, string]; start: number; clock: Animated.Value }) {
  const turns = (CLOCK_SECONDS / seconds) * 360;
  const sign = reverse ? -1 : 1;
  const forward = clock.interpolate({ inputRange: [0, CLOCK_SECONDS], outputRange: ['0deg', `${sign * turns}deg`] });
  const backward = clock.interpolate({ inputRange: [0, CLOCK_SECONDS], outputRange: ['0deg', `${-sign * turns}deg`] });
  const box = radius * 2;

  return (
    <Animated.View pointerEvents="none" style={[styles.orbit, { width: box, height: box, transform: [{ rotate: forward }] }]}>
      {icons.map((icon, index) => {
        const angle = start + (index * 2 * Math.PI) / icons.length;
        return (
          <Animated.View
            key={icon}
            style={[styles.chip, { left: radius + Math.cos(angle) * radius - 22, top: radius + Math.sin(angle) * radius - 22, transform: [{ rotate: backward }] }]}
          >
            <LinearGradient colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.05)']} style={styles.chipFill}>
              <Feather name={icon} size={19} color={colors[1]} />
            </LinearGradient>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

/* ─────────── Glass cards that give each page a taste of the real app ─────────── */

const Glass = ({ children, style }: { children: React.ReactNode; style?: object }) => (
  <View style={[styles.glass, style]}>
    <LinearGradient colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.glassSheen} pointerEvents="none" />
    {children}
  </View>
);

const Bar = ({ w, color = 'rgba(255,255,255,0.22)', h = 6 }: { w: number | string; color?: string; h?: number }) => (
  <View style={{ width: w as any, height: h, borderRadius: h / 2, backgroundColor: color }} />
);

function IdeaCards({ colors }: { colors: [string, string] }) {
  return (
    <>
      <Glass style={{ width: 148, right: -36, top: 6, transform: [{ rotate: '5deg' }] }}>
        <View style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: colors[0] }]}><Feather name="user" size={11} color="#FFFFFF" /></View>
          <Text style={styles.cardLabel}>You</Text>
        </View>
        <Text style={styles.cardText}>Build me a website for my coffee shop</Text>
      </Glass>
      <Glass style={{ width: 176, left: -40, bottom: 4, transform: [{ rotate: '-4deg' }] }}>
        <View style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: colors[1] }]}><Feather name="zap" size={11} color="#0B1B3A" /></View>
          <Text style={styles.cardLabel}>Apsuni AI</Text>
        </View>
        <View style={{ gap: 5, marginTop: 7 }}><Bar w="92%" /><Bar w="64%" /></View>
        <View style={[styles.row, { marginTop: 9, gap: 5 }]}>
          {['Design', 'Pages', 'Launch'].map((tag) => (
            <View key={tag} style={[styles.tag, { borderColor: `${colors[1]}88` }]}><Text style={[styles.tagText, { color: colors[1] }]}>{tag}</Text></View>
          ))}
        </View>
      </Glass>
    </>
  );
}

function TemplateCards({ colors }: { colors: [string, string] }) {
  return (
    <>
      <Glass style={{ width: 132, left: -34, top: 2, padding: 0, overflow: 'hidden', transform: [{ rotate: '-6deg' }] }}>
        <LinearGradient colors={['#4F46E5', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 46, padding: 10 }}>
          <Bar w={54} color="rgba(255,255,255,0.9)" h={7} />
          <View style={{ marginTop: 6 }}><Bar w={34} color="rgba(255,255,255,0.5)" /></View>
        </LinearGradient>
        <View style={{ padding: 10, gap: 6 }}>
          <View style={styles.row}><View style={styles.block} /><View style={styles.block} /></View>
          <Bar w="80%" />
        </View>
        <Text style={[styles.cardLabel, { paddingHorizontal: 10, paddingBottom: 9 }]}>Bakery · Website</Text>
      </Glass>
      <Glass style={{ width: 158, right: -38, bottom: 6, transform: [{ rotate: '4deg' }] }}>
        <View style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: colors[1] }]}><Feather name="edit-3" size={11} color="#1E1B4B" /></View>
          <Text style={styles.cardLabel}>Customise with AI</Text>
        </View>
        <View style={styles.promptBox}><Text style={styles.cardText}>Make the header dark blue</Text></View>
        <View style={[styles.row, { marginTop: 8, justifyContent: 'space-between' }]}>
          <View style={styles.row}>{['#2563EB', '#8B5CF6', '#10B981', '#F59E0B'].map((c) => <View key={c} style={[styles.swatch, { backgroundColor: c }]} />)}</View>
          <Feather name="check-circle" size={14} color={colors[1]} />
        </View>
      </Glass>
    </>
  );
}

function TrackCards({ colors }: { colors: [string, string] }) {
  return (
    <>
      <Glass style={{ width: 150, right: -36, top: 4, transform: [{ rotate: '5deg' }] }}>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={styles.cardLabel}>Wallet</Text>
          <Feather name="shield" size={13} color={colors[1]} />
        </View>
        <Text style={styles.amount}>$1,250.00</Text>
        <View style={[styles.row, { marginTop: 4, gap: 5 }]}>
          <View style={[styles.tag, { borderColor: `${colors[1]}88` }]}><Text style={[styles.tagText, { color: colors[1] }]}>+ Fund</Text></View>
          <View style={styles.tag}><Text style={styles.tagText}>Pay</Text></View>
        </View>
      </Glass>
      <Glass style={{ width: 158, left: -38, bottom: 4, transform: [{ rotate: '-4deg' }] }}>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <Text style={styles.cardLabel}>Your project</Text>
          <Text style={[styles.cardLabel, { color: colors[1] }]}>75%</Text>
        </View>
        <View style={styles.track}><LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: '75%', height: '100%', borderRadius: 3 }} /></View>
        <View style={[styles.row, { marginTop: 9, justifyContent: 'space-between' }]}>
          {['Design', 'Build', 'Live'].map((step, index) => (
            <View key={step} style={{ alignItems: 'center', gap: 4 }}>
              <View style={[styles.stepDot, index < 2 && { backgroundColor: colors[0] }]}>{index < 2 && <Feather name="check" size={9} color="#FFFFFF" />}</View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </Glass>
    </>
  );
}

function StartCards({ colors }: { colors: [string, string] }) {
  return (
    <>
      <Glass style={{ width: 142, left: -36, top: 6, transform: [{ rotate: '-5deg' }] }}>
        <View style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: colors[1] }]}><Feather name="gift" size={11} color="#0B1B3A" /></View>
          <Text style={styles.cardLabel}>Free to start</Text>
        </View>
        <Text style={styles.cardText}>Browse designs before you pay</Text>
      </Glass>
      <Glass style={{ width: 150, right: -36, bottom: 6, transform: [{ rotate: '4deg' }] }}>
        <View style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: colors[0] }]}><Feather name="check" size={11} color="#FFFFFF" /></View>
          <Text style={styles.cardLabel}>Your project</Text>
        </View>
        <View style={styles.track}><LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: '100%', height: '100%', borderRadius: 3 }} /></View>
        <Text style={[styles.cardText, { marginTop: 7 }]}>Live and ready</Text>
      </Glass>
    </>
  );
}

const CARDS = [IdeaCards, TemplateCards, TrackCards, StartCards];

/** Tiny stars that twinkle around the picture. */
const STARS = [
  { x: 16, y: 40, s: 3 }, { x: 250, y: 24, s: 2 }, { x: 274, y: 150, s: 3 }, { x: 8, y: 190, s: 2 },
  { x: 220, y: 270, s: 3 }, { x: 60, y: 268, s: 2 }, { x: 132, y: 6, s: 2 }, { x: 288, y: 250, s: 2 },
];
function Stars({ color, t }: { color: string; t: Animated.Value }) {
  return (
    <>
      {STARS.map((star, i) => {
        // Each star peaks at a different moment of the loop, so they twinkle out of step.
        const base = [0.15, 0.9, 0.15, 0.15];
        const shifted = [0, 1, 2, 3].map((j) => base[(j - (i % 4) + 4) % 4]);
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute', left: star.x, top: star.y, width: star.s * 2, height: star.s * 2, borderRadius: star.s, backgroundColor: color,
              opacity: t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [...shifted, shifted[0]] }),
            }}
          />
        );
      })}
    </>
  );
}

const Hero = React.memo(function Hero({ slide, index, scrollX, ambient }: { slide: Slide; index: number; scrollX: Animated.Value; ambient: Ambient }) {
  const { float, pulse } = ambient;
  // The whole picture drifts, shrinks and fades a little as you swipe away from this page.
  const group = {
    opacity: across(scrollX, index, [0, 1, 0], 0.7),
    transform: [
      { translateX: across(scrollX, index, [W * 0.45, 0, -W * 0.45]) },
      { scale: across(scrollX, index, [0.7, 1, 0.7]) },
    ],
  };
  const tileScale = across(scrollX, index, [0.4, 1, 0.4]);
  const Cards = CARDS[index % CARDS.length]; // the repeated last page reuses the first page's cards
  const cardsFloat = float.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });

  return (
    <Animated.View style={[styles.hero, group]} pointerEvents="none">
      {/* soft glow, rings, then the two orbits */}
      <Animated.View style={[styles.glowWrap, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] }) }] }]}>
        {[250, 200, 156].map((size) => (
          <View key={size} style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: slide.colors[0], opacity: 0.1 }} />
        ))}
      </Animated.View>
      <View style={[styles.ring, { width: 208, height: 208, borderRadius: 104 }]} />
      <View style={[styles.ring, { width: 292, height: 292, borderRadius: 146, borderColor: 'rgba(255,255,255,0.07)' }]} />
      <Orbit radius={104} icons={slide.orbit.slice(0, 2)} seconds={26} colors={slide.colors} start={0.5} clock={ambient.clock} />
      <Orbit radius={146} icons={slide.orbit.slice(2)} seconds={40} reverse colors={slide.colors} start={2.2} clock={ambient.clock} />

      <Stars color={slide.colors[1]} t={ambient.twinkle} />

      <Animated.View style={{ transform: [{ scale: tileScale }, { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }}>
        <LinearGradient colors={slide.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tile}>
          <View style={styles.tileShine} />
          <Feather name={slide.center} size={46} color="#FFFFFF" />
        </LinearGradient>
      </Animated.View>

      {/* the two cards drift a little faster than the rest while you swipe, which adds depth */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transform: [{ translateX: across(scrollX, index, [W * 0.35, 0, -W * 0.35]) }, { translateY: cardsFloat }] }]}>
        <Cards colors={slide.colors} />
      </Animated.View>
    </Animated.View>
  );
});

/** The tour is drawn for the dark look, so it stays that way whichever theme the app is in. */
export default function OnboardingScreen() {
  return <KeepAsDrawn><Onboarding /></KeepAsDrawn>;
}

function Onboarding() {
  const router = useRouter();
  const scrollX = useRef(new Animated.Value(0)).current;
  const scroller = useRef<any>(null);
  const [page, setPage] = useState(0);
  const intro = useRef(new Animated.Value(0)).current;
  const ambient = useRef<Ambient>({ clock: new Animated.Value(0), twinkle: new Animated.Value(0), float: new Animated.Value(0), pulse: new Animated.Value(0) }).current;
  const lastTouch = useRef(0); // when the person last dragged the pages, so the auto-slide can wait for them
  const pageRef = useRef(0);

  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [intro]);

  // Four looping values drive all the background motion, on the native side, for every page at once.
  useEffect(() => {
    const { clock, twinkle, float, pulse } = ambient;
    const loops = [
      Animated.loop(Animated.timing(clock, { toValue: CLOCK_SECONDS, duration: CLOCK_SECONDS * 1000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.timing(twinkle, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])),
    ];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [ambient]);

  const settleAt = (next: number) => {
    const real = next % SLIDES.length;
    pageRef.current = real;
    setPage(real);
  };

  // The tour plays itself and never stops: after the Get started page it carries on to the repeated first
  // page, then quietly jumps back. It waits after a swipe.
  useEffect(() => {
    let jump: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      if (Date.now() - lastTouch.current < 12000) return;
      const next = pageRef.current + 1;
      scroller.current?.scrollTo({ x: next * W, animated: true });
      settleAt(next);
      if (next >= SLIDES.length) {
        jump = setTimeout(() => scroller.current?.scrollTo({ x: 0, animated: false }), 900);
      }
    }, 7000);
    return () => { clearInterval(timer); if (jump) clearTimeout(jump); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tick = () => {
    try { require('expo-haptics').selectionAsync(); } catch { /* haptics are optional */ }
  };

  const finish = async () => {
    await markOnboardingDone();
    router.replace('/Screen/Auth/SignInScreen');
  };

  // Get started and Skip both leave the tour for the sign-in screen.
  const press = useRef(new Animated.Value(1)).current;
  const buttonDown = () => Animated.spring(press, { toValue: 0.97, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const buttonUp = () => Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <AppBackground />
      {SLIDES.map((slide, index) => (
        <Animated.View key={slide.key} pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: index === 0 ? Animated.add(across(scrollX, 0, [0, 1, 0]), across(scrollX, SLIDES.length, [0, 1, 0])) : across(scrollX, index, [0, 1, 0]) }]}>
          <LinearGradient colors={[`${slide.colors[0]}55`, `${slide.colors[0]}14`, 'transparent']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.62 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ))}

      <AnimatedScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="fast"
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        onScrollBeginDrag={() => { lastTouch.current = Date.now(); }}
        onMomentumScrollEnd={(event) => {
          let next = Math.round(event.nativeEvent.contentOffset.x / W);
          if (next >= SLIDES.length) { scroller.current?.scrollTo({ x: 0, animated: false }); next = 0; }
          if (next !== pageRef.current) { settleAt(next); tick(); }
        }}
      >
        {PAGES.map((slide, index) => (
          <View key={`${slide.key}-${index}`} style={{ width: W, height: H }}>
            <Animated.View style={{ height: CENTER_Y + 146, opacity: intro, transform: [{ translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }}>
              <View style={{ position: 'absolute', left: 0, right: 0, top: CENTER_Y - 146, height: 292, alignItems: 'center', justifyContent: 'center', transform: [{ scale: HERO_SCALE }] }}>
                <Hero slide={slide} index={index} scrollX={scrollX} ambient={ambient} />
              </View>
            </Animated.View>

            <View style={styles.textBlock}>
              <Animated.View style={[styles.eyebrow, { borderColor: `${slide.colors[1]}55`, backgroundColor: `${slide.colors[0]}22`, opacity: across(scrollX, index, [0, 1, 0], 0.5), transform: [{ translateY: across(scrollX, index, [22, 0, 22], 0.6) }] }]}>
                <View style={[styles.eyebrowDot, { backgroundColor: slide.colors[1] }]} />
                <Text allowFontScaling={false} style={[styles.eyebrowText, { color: slide.colors[1] }]}>{slide.eyebrow}</Text>
              </Animated.View>
              <Animated.Text
                allowFontScaling={false}
                style={[styles.title, { opacity: across(scrollX, index, [0, 1, 0], 0.55), transform: [{ translateY: across(scrollX, index, [34, 0, 34], 0.6) }] }]}
              >
                {slide.title}{'\n'}<Text style={{ color: slide.colors[1] }}>{slide.highlight}</Text>
              </Animated.Text>
              <Animated.Text
                allowFontScaling={false}
                numberOfLines={4}
                style={[styles.subtitle, { opacity: across(scrollX, index, [0, 1, 0], 0.4), transform: [{ translateY: across(scrollX, index, [46, 0, 46], 0.5) }] }]}
              >
                {slide.text}
              </Animated.Text>
            </View>
          </View>
        ))}
      </AnimatedScrollView>

      <View style={styles.topBar} pointerEvents="box-none">
        <View style={styles.brand}>
          <Image source={require('../../../assets/images/APlogo5-light.png')} style={styles.brandImage} resizeMode="contain" />
        </View>
        <Animated.View style={{ opacity: across(scrollX, LAST, [1, 0, 1]) }} pointerEvents={page === LAST ? 'none' : 'auto'}>
          <Pressable onPress={finish} hitSlop={12} style={styles.skip}><Text style={styles.skipText}>Skip</Text></Pressable>
        </Animated.View>
      </View>

      <View style={styles.controls} pointerEvents="box-none">
        {/* the dots fade away on the Get started page; they keep their space so the button stays where it is */}
        <Animated.View style={[styles.dots, { opacity: across(scrollX, LAST, [1, 0, 1]), transform: [{ translateY: 22 }] }]}>
          {SLIDES.map((slide, index) => (
            <Animated.View
              key={slide.key}
              style={[styles.dot, {
                // width cannot be animated natively, so each dot is drawn wide and squeezed with scaleX
                // the first dot is also lit while the repeated first page is on screen
                opacity: index === 0 ? Animated.subtract(Animated.add(across(scrollX, 0, [0.3, 1, 0.3]), across(scrollX, SLIDES.length, [0.3, 1, 0.3])), 0.3) : across(scrollX, index, [0.3, 1, 0.3]),
                transform: [{ scaleX: index === 0 ? Animated.subtract(Animated.add(across(scrollX, 0, [0.28, 1, 0.28]), across(scrollX, SLIDES.length, [0.28, 1, 0.28])), 0.28) : across(scrollX, index, [0.28, 1, 0.28]) }],
              }]}
            />
          ))}
        </Animated.View>

        {/* only the last page has the Get started button; it fades in as that page slides into view */}
        <Animated.View
          pointerEvents={page === LAST ? 'auto' : 'none'}
          style={{ alignSelf: 'center', width: Math.min(W - 48, 200), marginTop: 14, opacity: across(scrollX, LAST, [0, 1, 0]), transform: [{ scale: press }, { translateY: across(scrollX, LAST, [24, 0, 24]) }] }}
        >
          <Pressable onPress={finish} onPressIn={buttonDown} onPressOut={buttonUp} accessibilityRole="button" accessibilityLabel="Get started">
            <LinearGradient colors={['#1E40AF', '#172554']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
              <Text allowFontScaling={false} style={styles.buttonText}>Get started</Text>
              <Feather name="arrow-right" size={17} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A1018' },

  hero: { width: 292, height: 292, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  glowWrap: { position: 'absolute', width: 250, height: 250, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  orbit: { position: 'absolute' },
  chip: { position: 'absolute', width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  chipFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tile: { width: 108, height: 108, borderRadius: 34, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', elevation: 14, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.5, shadowRadius: 24 },
  tileShine: { position: 'absolute', top: -30, left: -20, width: 120, height: 70, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.18)', transform: [{ rotate: '-20deg' }] },

  glass: { position: 'absolute', padding: 11, borderRadius: 16, backgroundColor: 'rgba(14, 24, 42, 0.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', elevation: 8, shadowColor: '#000000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 16, overflow: 'hidden' },
  glassSheen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 11, fontWeight: '700', color: '#E2E8F0' },
  cardText: { marginTop: 6, fontSize: 11.5, lineHeight: 16, color: '#CBD5E1' },
  tag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  tagText: { fontSize: 9.5, fontWeight: '700', color: '#CBD5E1' },
  block: { flex: 1, height: 26, borderRadius: 6, backgroundColor: 'rgba(139, 92, 246, 0.25)' },
  promptBox: { marginTop: 7, paddingHorizontal: 9, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  swatch: { width: 14, height: 14, borderRadius: 7, marginRight: -3, borderWidth: 1.5, borderColor: '#0E182A' },
  amount: { marginTop: 5, fontSize: 21, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)', marginTop: 9, overflow: 'hidden' },
  stepDot: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  stepText: { fontSize: 9, fontWeight: '700', color: '#94A3B8' },

  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, marginBottom: 14 },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3 },
  eyebrowText: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4 },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, height: (StatusBar.currentHeight ?? 30) + 10 + 36, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, position: 'absolute', left: 24, bottom: 0 },
  brandImage: { width: 98, height: 31 },
  brandText: { fontSize: 19, fontWeight: '800', color: '#FFFFFF', fontStyle: 'italic', letterSpacing: -0.3 },
  skip: { paddingHorizontal: 15, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  skipText: { fontSize: 13, fontWeight: '700', color: '#CBD5E1' },

  textBlock: { position: 'absolute', top: TEXT_TOP, left: 0, right: 0, paddingHorizontal: 30, alignItems: 'center' },
  title: { fontSize: Math.round(30 * TYPE), lineHeight: Math.round(38 * TYPE), maxWidth: 560, fontWeight: '800', color: '#F8FAFC', textAlign: 'center', letterSpacing: -0.6 },
  subtitle: { marginTop: 14, fontSize: Math.round(15 * TYPE), lineHeight: Math.round(23 * TYPE), maxWidth: 460, color: '#94A3B8', textAlign: 'center' },

  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingBottom: BOTTOM_GAP, alignItems: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  button: { height: 46, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, elevation: 5, shadowColor: '#1E40AF', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 14 },
  buttonText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  dot: { width: 26, height: 6, borderRadius: 3, backgroundColor: '#3B82F6' },
});
