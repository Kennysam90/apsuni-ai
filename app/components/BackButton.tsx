import React from 'react';
import { StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type BackButtonProps = {
  onBack?: () => void;
  style?: ViewStyle;
};

export default function BackButton({ onBack, style }: BackButtonProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onBack ?? (() => router.back())}
      activeOpacity={0.7}
    >
      <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
