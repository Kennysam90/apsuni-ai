import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, TouchableOpacityProps } from '../../theme/native';

type LoadingButtonProps = TouchableOpacityProps & { loading?: boolean; label: string; color?: string };

export default function LoadingButton({ loading = false, label, color = '#2563EB', disabled, style, ...props }: LoadingButtonProps) {
  return (
    <TouchableOpacity {...props} disabled={disabled || loading} style={[styles.button, { backgroundColor: color }, style]} activeOpacity={0.85}>
      {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.label}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 50, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  label: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});

