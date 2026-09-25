import React, { useContext } from 'react';
import { ImageBackground, StyleSheet, View } from '../../theme/native';
import { LinearGradient } from '../../theme/linear-gradient';

import { KeepAsDrawn, KeepAsDrawnContext, useTheme } from '../../theme/ThemeContext';

/** The picture behind most screens. Dark mode shows the app's usual background; light mode swaps it for a soft light one. */
export default function AppBackground() {
  const { isDark } = useTheme();
  const keep = useContext(KeepAsDrawnContext); // the splash and the welcome tour are always dark

  if (isDark || keep) {
    return (
      <ImageBackground
        source={require('@/assets/images/tabs-icon/app_background_full.png')}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
    );
  }

  return (
    <KeepAsDrawn>
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#F4F7FB' }]}>
        <LinearGradient colors={['#E4EDFF', '#F4F7FB', '#F4F7FB']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.55 }} style={StyleSheet.absoluteFillObject} />
      </View>
    </KeepAsDrawn>
  );
}
