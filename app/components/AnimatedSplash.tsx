import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet, View } from '../../theme/native';
import * as SplashScreen from 'expo-splash-screen';

import AppBackground from './AppBackground';

/**
 * The opening animation, shown once each time the app starts:
 *  1. The logo slides up out of a hidden slot at the middle of the screen.
 *  2. It rises, then drops back to the middle like a ball and bounces once.
 *  3. After a one second pause it slides to the left and shrinks.
 *  4. The full Apsuni logo is revealed to the right of the mark, wiping in from left to right.
 *  5. The whole screen fades away into the app.
 */

const LOGO = 96;
const RISE_TO = -150;
const BOUNCE_HEIGHT = -40;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CENTER = SCREEN_HEIGHT / 2;

// The full logo image is 209 x 66, with its own mark taking the first 55 px. It is the same picture as
// APlogo5.png with the black lettering recoloured white so it can be read on the dark background.
const WORDMARK_H = 58;
const WORDMARK_W = Math.round((WORDMARK_H * 209) / 66);
const WORDMARK_MARK_W = (55 / 209) * WORDMARK_W;
// Where the small logo comes to rest: exactly over the mark inside the full logo.
const MARK_TARGET_X = -WORDMARK_W / 2 + WORDMARK_MARK_W / 2;
// The logo image has empty margin around the "A" (the mark is about 68% of the image's width).
const MARK_VISIBLE = LOGO * (164 / 242);
const MARK_TARGET_SCALE = WORDMARK_MARK_W / MARK_VISIBLE;

// Keep the (blank, dark) system splash up until this one has drawn its first frame.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const y = useRef(new Animated.Value(LOGO / 2 + 2)).current; // logo starts hidden just below the middle line
  const x = useRef(new Animated.Value(0)).current;
  const squash = useRef(new Animated.Value(1)).current;
  const shrink = useRef(new Animated.Value(1)).current;
  const clipHeight = useRef(new Animated.Value(CENTER)).current; // JS-driven: only opened once the logo is out
  const shadowFade = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current; // soft light behind the logo
  const smallLogo = useRef(new Animated.Value(1)).current; // the small logo's opacity
  const revealWidth = useRef(new Animated.Value(WORDMARK_MARK_W)).current; // JS-driven: the reveal starts as just the mark
  const wordmark = useRef(new Animated.Value(0)).current;
  const slideIn = useRef(new Animated.Value(-26)).current; // the lettering drifts in from the left as it is uncovered
  const pop = useRef(new Animated.Value(0.94)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const timing = (value: Animated.Value, toValue: number, duration: number, easing: (t: number) => number, useNativeDriver = true) =>
      Animated.timing(value, { toValue, duration, easing, useNativeDriver });

    Animated.sequence([
      Animated.delay(350),
      // 1. slide out of the middle and rise
      timing(y, RISE_TO, 760, Easing.out(Easing.cubic)),
      timing(clipHeight, SCREEN_HEIGHT, 1, Easing.linear, false),
      // 2. drop like a ball, squash on landing, bounce once, settle
      Animated.parallel([
        timing(y, 0, 470, Easing.in(Easing.quad)),
        timing(glow, 1, 470, Easing.in(Easing.quad)),
      ]),
      timing(squash, 0.88, 70, Easing.out(Easing.quad)),
      Animated.parallel([
        timing(y, BOUNCE_HEIGHT, 230, Easing.out(Easing.quad)),
        timing(squash, 1.04, 230, Easing.out(Easing.quad)),
      ]),
      Animated.parallel([
        timing(y, 0, 210, Easing.in(Easing.quad)),
        timing(squash, 1, 210, Easing.linear),
      ]),
      timing(squash, 0.96, 60, Easing.out(Easing.quad)),
      timing(squash, 1, 110, Easing.out(Easing.quad)),
      // 3. hold, then slide left and shrink to the size of the mark in the full logo
      Animated.delay(1000),
      Animated.parallel([
        timing(x, MARK_TARGET_X, 540, Easing.inOut(Easing.cubic)),
        timing(shrink, MARK_TARGET_SCALE, 540, Easing.inOut(Easing.cubic)),
        timing(shadowFade, 0, 300, Easing.linear),
      ]),
      // 4. the full logo is revealed to the right of the mark, wiping in from left to right
      Animated.parallel([
        timing(wordmark, 1, 200, Easing.out(Easing.quad)),
        timing(smallLogo, 0, 200, Easing.out(Easing.quad)),
        timing(glow, 0, 450, Easing.linear),
        timing(revealWidth, WORDMARK_W, 820, Easing.out(Easing.cubic), false),
        timing(slideIn, 0, 820, Easing.out(Easing.cubic)),
        Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
      ]),
      // a moment to take it in, then into the app
      Animated.delay(750),
      timing(fade, 0, 380, Easing.in(Easing.quad)),
    ]).start(({ finished }) => { if (finished) onFinish(); });
  }, [y, x, squash, shrink, clipHeight, shadowFade, glow, smallLogo, revealWidth, wordmark, slideIn, pop, fade, onFinish]);

  return (
    <Animated.View
      style={[styles.root, { opacity: fade }]}
      pointerEvents="auto"
      onLayout={() => { SplashScreen.hideAsync().catch(() => undefined); }}
    >
      <AppBackground />

      {/* Everything is clipped at the middle line until the logo has come out. */}
      <Animated.View style={[styles.clip, { height: clipHeight }]}>
        <Animated.View
          style={[
            styles.shadow,
            {
              opacity: Animated.multiply(shadowFade, y.interpolate({ inputRange: [RISE_TO, 0, LOGO / 2 + 2], outputRange: [0.06, 0.22, 0], extrapolate: 'clamp' })),
              transform: [
                { translateX: x },
                { scaleX: y.interpolate({ inputRange: [RISE_TO, 0, LOGO / 2 + 2], outputRange: [0.35, 1, 1], extrapolate: 'clamp' }) },
              ],
            },
          ]}
        />

        {/* the full logo, uncovered from left to right */}
        <Animated.View style={[styles.revealAnchor, { opacity: wordmark, transform: [{ scale: pop }] }]}>
          <Animated.View style={[styles.reveal, { width: revealWidth }]}>
            <Animated.Image
              source={require('../../assets/images/APlogo5-light.png')}
              resizeMode="contain"
              style={[styles.wordmark, { transform: [{ translateX: slideIn }] }]}
            />
          </Animated.View>
        </Animated.View>

        <View style={styles.row}>
          <Animated.View pointerEvents="none" style={[styles.glowInner, { opacity: glow, transform: [{ translateX: x }] }]} />
          <Animated.Image
            source={require('../../assets/images/AL3.png')}
            resizeMode="contain"
            style={[
              styles.logo,
              {
                opacity: smallLogo,
                transform: [
                  { translateX: x }, { translateY: y }, { scale: shrink }, { scaleY: squash },
                  { scaleX: squash.interpolate({ inputRange: [0.85, 1, 1.05], outputRange: [1.1, 1, 0.97] }) },
                ],
              },
            ]}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0A1018', zIndex: 9999, elevation: 9999 },
  clip: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  row: { position: 'absolute', top: CENTER - LOGO / 2, left: 0, right: 0, height: LOGO, alignItems: 'center', justifyContent: 'center' },
  logo: { width: LOGO, height: LOGO },
  shadow: {
    position: 'absolute',
    top: CENTER + LOGO / 2 + 10,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -LOGO * 0.35,
    width: LOGO * 0.7,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(96, 165, 250, 0.4)',
  },
  glowInner: { position: 'absolute', width: 124, height: 124, borderRadius: 62, backgroundColor: 'rgba(96, 165, 250, 0.10)' },

  revealAnchor: { position: 'absolute', top: CENTER - WORDMARK_H / 2, left: (SCREEN_WIDTH - WORDMARK_W) / 2, height: WORDMARK_H },
  reveal: { height: WORDMARK_H, overflow: 'hidden' },
  wordmark: { position: 'absolute', left: 0, top: 0, width: WORDMARK_W, height: WORDMARK_H },
});
