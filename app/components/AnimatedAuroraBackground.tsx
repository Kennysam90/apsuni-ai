import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function AnimatedAuroraBackground() {
  const drift = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 7000, useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 7000, useNativeDriver: true }),
      ])
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2600, useNativeDriver: true }),
      ])
    );
    driftLoop.start();
    pulseLoop.start();
    return () => { driftLoop.stop(); pulseLoop.stop(); };
  }, [drift, pulse]);

  const translateX = drift.interpolate({ inputRange: [0, 1], outputRange: [-35, 35] });
  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [20, -20] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.65] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <LinearGradient colors={['#071124', '#03060D', '#091735']} style={StyleSheet.absoluteFillObject} />
      <Animated.View style={[styles.blueGlow, { opacity, transform: [{ translateX }, { translateY }] }]} />
      <Animated.View style={[styles.violetGlow, { opacity, transform: [{ translateX: Animated.multiply(translateX, -0.65) }, { translateY: Animated.multiply(translateY, -0.6) }] }]} />
      <View style={styles.grid} />
    </View>
  );
}

const styles = StyleSheet.create({
  blueGlow: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: '#155EEF', top: -100, right: -90 },
  violetGlow: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: '#6D5DFB', bottom: 40, left: -130 },
  grid: { ...StyleSheet.absoluteFillObject, opacity: 0.035, borderWidth: 1, borderColor: '#FFFFFF' },
});
