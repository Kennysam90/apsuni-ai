import React from 'react';
import { ImageBackground, StyleSheet } from 'react-native';

export default function AppBackground() {
  return (
    <ImageBackground
      source={require('@/assets/images/tabs-icon/app_background_full.png')}
      style={StyleSheet.absoluteFillObject}
      resizeMode="cover"
    />
  );
}
