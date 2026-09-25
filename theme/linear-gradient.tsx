/** The app's copy of "expo-linear-gradient": neutral gradients turn light in light mode, strong ones stay. */
import React, { forwardRef, useContext } from 'react';
import * as Real from 'expo-linear-gradient';

import { isColoredSurface, lightColor } from './colors';
import { KeepAsDrawnContext, ThemeContext } from './ThemeContext';

export * from 'expo-linear-gradient';

export const LinearGradient = forwardRef((props: any, ref: any) => {
  const { isDark } = useContext(ThemeContext);
  const keep = useContext(KeepAsDrawnContext);
  const colors: string[] = props.colors ?? [];
  const active = !isDark && !keep;
  const strong = active && colors.some((color) => typeof color === 'string' && isColoredSurface(color) && lightColor(color, 'bg') === color);
  const next = active && !strong ? colors.map((color) => (typeof color === 'string' ? lightColor(color, 'bg') : color)) : colors;
  const element = <Real.LinearGradient ref={ref} {...props} colors={next} />;
  // Text and icons on a strong gradient (the blue buttons) stay as drawn.
  return strong ? <KeepAsDrawnContext.Provider value>{element}</KeepAsDrawnContext.Provider> : element;
}) as unknown as typeof Real.LinearGradient;
