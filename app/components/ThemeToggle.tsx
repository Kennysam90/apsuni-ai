import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from '../../theme/native';
import { Feather } from '../../theme/vector-icons';

import { useTheme } from '../../theme/ThemeContext';

/** A sliding switch: moon and dark blue for dark mode, sun and amber for light mode. */
export default function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  const knob = useRef(new Animated.Value(isDark ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(knob, { toValue: isDark ? 0 : 1, useNativeDriver: true, friction: 7, tension: 130 }).start();
  }, [isDark, knob]);

  return (
    <Pressable onPress={toggle} hitSlop={8} accessibilityRole="switch" accessibilityLabel="Light mode" accessibilityState={{ checked: !isDark }}>
      <View style={[styles.track, { backgroundColor: isDark ? '#1E3A8A' : '#F59E0B' }]}>
        <View style={[styles.iconSlot, { left: 6 }]}><Feather name="moon" size={12} color="#DBEAFE" /></View>
        <View style={[styles.iconSlot, { right: 6 }]}><Feather name="sun" size={12} color="#FFF7ED" /></View>
        <Animated.View style={[styles.knob, { transform: [{ translateX: knob.interpolate({ inputRange: [0, 1], outputRange: [0, 26] }) }] }]}>
          <Feather name={isDark ? 'moon' : 'sun'} size={14} color={isDark ? '#1E3A8A' : '#D97706'} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 58, height: 26, borderRadius: 17, justifyContent: 'center' },
  iconSlot: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  knob: { position: 'absolute', left: 3, width: 26, height: 15, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3 },
});
