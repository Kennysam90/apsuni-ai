/** The app's copy of "@expo/vector-icons": each icon family re-colours its icon for light mode. */
import React, { forwardRef, useContext } from 'react';
import * as Real from '@expo/vector-icons';

import { lightColor } from './colors';
import { KeepAsDrawnContext, ThemeContext } from './ThemeContext';

export * from '@expo/vector-icons';

const SKIP = new Set(['prototype', 'length', 'name', 'render', '$$typeof', 'displayName', 'defaultProps']);

function themedFamily(Family: any): any {
  const Themed: any = forwardRef((props: any, ref: any) => {
    const { isDark } = useContext(ThemeContext);
    const keep = useContext(KeepAsDrawnContext);
    const color = !isDark && !keep && typeof props.color === 'string' ? lightColor(props.color, 'fg') : props.color;
    return <Family ref={ref} {...props} color={color} />;
  });
  Themed.displayName = 'ThemedIcon';
  for (const key of Object.getOwnPropertyNames(Family)) {
    if (SKIP.has(key)) continue;
    try { Object.defineProperty(Themed, key, Object.getOwnPropertyDescriptor(Family, key)!); } catch { /* read-only */ }
  }
  return Themed; // glyphMap and the font helpers are carried over
}

export const Feather = themedFamily(Real.Feather) as typeof Real.Feather;
export const FontAwesome5 = themedFamily(Real.FontAwesome5) as typeof Real.FontAwesome5;
export const Ionicons = themedFamily(Real.Ionicons) as typeof Real.Ionicons;
export const MaterialCommunityIcons = themedFamily(Real.MaterialCommunityIcons) as typeof Real.MaterialCommunityIcons;
export const MaterialIcons = themedFamily(Real.MaterialIcons) as typeof Real.MaterialIcons;
export const Octicons = themedFamily(Real.Octicons) as typeof Real.Octicons;
