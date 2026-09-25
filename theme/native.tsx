/**
 * The app's copy of "react-native". Screens import from here (not from 'react-native' directly).
 * Most of it is the real library passed straight through; the components below are swapped for
 * versions that re-colour themselves when light mode is on. Nothing here depends on bundler settings.
 */
import React, { forwardRef, useContext } from 'react';
import * as RN from 'react-native';

import { isColoredSurface, lightColor, parseColor } from './colors';
import { KeepAsDrawnContext, ThemeContext } from './ThemeContext';

export * from 'react-native';

const SKIP = new Set(['shadowColor', 'textShadowColor', 'tintColor', 'overlayColor']);

/** A style with its colours turned to light mode. Returns the flattened style either way. */
function recolor(style: any): any {
  if (!style) return style;
  const flat = RN.StyleSheet.flatten(style) as any;
  if (!flat) return style;
  let out: any = null;
  for (const key in flat) {
    const value = flat[key];
    if (typeof value === 'string' && (key === 'color' || key.endsWith('Color')) && !SKIP.has(key)) {
      const next = lightColor(value, key === 'color' ? 'fg' : key.startsWith('border') ? 'border' : key === 'backgroundColor' ? 'bg' : 'fg');
      if (next !== value) { if (!out) out = { ...flat }; out[key] = next; }
    }
  }

  // A border with no colour is drawn black by default, which is invisible on dark but harsh on light.
  const hasBorder = flat.borderWidth > 0 || flat.borderTopWidth > 0 || flat.borderBottomWidth > 0 || flat.borderLeftWidth > 0 || flat.borderRightWidth > 0;
  if (hasBorder && flat.borderColor === undefined && flat.borderTopColor === undefined && flat.borderBottomColor === undefined) {
    if (!out) out = { ...flat };
    out.borderColor = 'rgba(148, 163, 184, 0.35)';
  }

  // A dim layer laid over the whole screen to darken the background picture has no job on the light background.
  const bg = flat.backgroundColor;
  if (flat.position === 'absolute' && flat.top === 0 && flat.left === 0 && flat.right === 0 && flat.bottom === 0 && typeof bg === 'string') {
    const parsed = parseColor(bg);
    if (parsed && parsed[3] > 0 && parsed[3] <= 0.6 && Math.max(parsed[0], parsed[1], parsed[2]) < 70) {
      if (!out) out = { ...flat };
      out.backgroundColor = 'transparent';
    }
  }
  return out ?? flat;
}

function backgroundOf(style: any): string | undefined {
  if (!style || typeof style === 'function') return undefined;
  const value = (RN.StyleSheet.flatten(style) as any)?.backgroundColor;
  return typeof value === 'string' ? value : undefined;
}

/** Whether this component should re-colour itself, and whether its children sit on a strong colour. */
function useMode(style: any) {
  const { isDark } = useContext(ThemeContext);
  const keep = useContext(KeepAsDrawnContext);
  const active = !isDark && !keep;
  const background = active ? backgroundOf(style) : undefined;
  // A strong colour that light mode leaves alone (a blue button). A dark navy that turns light is no longer a strong colour.
  return { active, coloured: Boolean(background && isColoredSurface(background) && lightColor(background, 'bg') === background) };
}

// The base component is looked up when it is drawn, so merely importing this file loads nothing extra.
function makeThemed(getBase: () => any, styleProps: string[] = ['style'], colourProps: string[] = [], holdsContent = true, alwaysKeepChildren = false): any {
  const Themed = forwardRef((props: any, ref: any) => {
    const Base = getBase();
    const { active, coloured } = useMode(props.style);
    let next = props;
    if (active) {
      next = { ...props };
      for (const name of styleProps) {
        const value = props[name];
        // Pressable styles can be functions of its pressed state.
        next[name] = typeof value === 'function' ? (state: any) => recolor(value(state)) : recolor(value);
      }
      for (const name of colourProps) if (typeof props[name] === 'string') next[name] = lightColor(props[name], 'fg');
    }
    const element = <Base ref={ref} {...next} />;
    return (coloured && holdsContent) || alwaysKeepChildren ? <KeepAsDrawnContext.Provider value>{element}</KeepAsDrawnContext.Provider> : element;
  });
  Themed.displayName = 'Themed';
  return Themed;
}

export const View = makeThemed(() => RN.View) as unknown as typeof RN.View;
export type View = RN.View;
export const Text = makeThemed(() => RN.Text, ['style'], [], false) as unknown as typeof RN.Text;
export type Text = RN.Text;
export const TextInput = makeThemed(() => RN.TextInput, ['style'], ['placeholderTextColor', 'selectionColor'], false) as unknown as typeof RN.TextInput;
export type TextInput = RN.TextInput;
export const TouchableOpacity = makeThemed(() => RN.TouchableOpacity) as unknown as typeof RN.TouchableOpacity;
export const Pressable = makeThemed(() => RN.Pressable) as unknown as typeof RN.Pressable;
export const ScrollView = makeThemed(() => RN.ScrollView, ['style', 'contentContainerStyle']) as unknown as typeof RN.ScrollView;
export type ScrollView = RN.ScrollView;
export const FlatList = makeThemed(() => RN.FlatList, ['style', 'contentContainerStyle']) as unknown as typeof RN.FlatList;
export type FlatList<T = any> = RN.FlatList<T>;
export const SectionList = makeThemed(() => RN.SectionList, ['style', 'contentContainerStyle']) as unknown as typeof RN.SectionList;
export const SafeAreaView = makeThemed(() => RN.SafeAreaView) as unknown as typeof RN.SafeAreaView;
export const KeyboardAvoidingView = makeThemed(() => RN.KeyboardAvoidingView) as unknown as typeof RN.KeyboardAvoidingView;
export const Image = makeThemed(() => RN.Image, ['style'], [], false) as unknown as typeof RN.Image;
// Whatever is written on top of a picture was drawn to suit that picture, so it keeps its colours.
export const ImageBackground = makeThemed(() => RN.ImageBackground, ['style', 'imageStyle'], [], true, true) as unknown as typeof RN.ImageBackground;

export const ActivityIndicator = forwardRef((props: any, ref: any) => {
  const { active, coloured } = useMode(undefined);
  const inColour = useContext(KeepAsDrawnContext);
  const color = active && !inColour && !coloured && typeof props.color === 'string' ? lightColor(props.color, 'fg') : props.color;
  return <RN.ActivityIndicator ref={ref} {...props} color={color} />;
}) as unknown as typeof RN.ActivityIndicator;

export const Switch = forwardRef((props: any, ref: any) => {
  const { active } = useMode(undefined);
  if (!active) return <RN.Switch ref={ref} {...props} />;
  const track = props.trackColor && typeof props.trackColor === 'object'
    ? { false: props.trackColor.false && lightColor(props.trackColor.false, 'bg'), true: props.trackColor.true }
    : props.trackColor;
  return <RN.Switch ref={ref} {...props} trackColor={track} thumbColor={typeof props.thumbColor === 'string' ? lightColor(props.thumbColor, 'bg') : props.thumbColor} />;
}) as unknown as typeof RN.Switch;

/** Status bar icons turn dark on the light background. */
function ThemedStatusBar(props: any) {
  const { isDark } = useContext(ThemeContext);
  const keep = useContext(KeepAsDrawnContext);
  const style = !isDark && !keep && props.barStyle === 'light-content' ? 'dark-content' : props.barStyle;
  return <RN.StatusBar {...props} barStyle={style} />;
}
Object.defineProperty(ThemedStatusBar, 'currentHeight', { get: () => RN.StatusBar.currentHeight });
for (const name of ['setBarStyle', 'setBackgroundColor', 'setHidden', 'setNetworkActivityIndicatorVisible', 'setTranslucent', 'pushStackEntry', 'popStackEntry', 'replaceStackEntry']) {
  (ThemedStatusBar as any)[name] = (...args: any[]) => (RN.StatusBar as any)[name](...args);
}
export const StatusBar = ThemedStatusBar as unknown as typeof RN.StatusBar;

// Types such as Animated.Value keep working next to the value below.
// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace Animated {
  type Value = RN.Animated.Value;
  type ValueXY = RN.Animated.ValueXY;
  type AnimatedInterpolation<T extends string | number = string | number> = RN.Animated.AnimatedInterpolation<T>;
  type CompositeAnimation = RN.Animated.CompositeAnimation;
}

// Animated.View / Text / ScrollView / Image are built from the themed versions above.
export const Animated = {
  ...RN.Animated,
  View: RN.Animated.createAnimatedComponent(View),
  Text: RN.Animated.createAnimatedComponent(Text),
  ScrollView: RN.Animated.createAnimatedComponent(ScrollView),
  Image: RN.Animated.createAnimatedComponent(Image),
  FlatList: RN.Animated.createAnimatedComponent(FlatList),
} as unknown as typeof RN.Animated;
