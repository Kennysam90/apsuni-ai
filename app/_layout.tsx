import { useCallback, useState } from 'react';
import { Stack } from "expo-router";
import { AppAlertProvider } from './components/AppAlert';
import AnimatedSplash from './components/AnimatedSplash';
import UpdatePrompt from './components/UpdatePrompt';
import { KeepAsDrawn, ThemeProvider } from '../theme/ThemeContext';

export default function RootLayout() {
  // The opening animation plays once per launch, on top of the app while it loads underneath.
  const [splashDone, setSplashDone] = useState(false);
  const finishSplash = useCallback(() => setSplashDone(true), []);

  return (
    <ThemeProvider>
      <AppAlertProvider>
        <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", animationDuration: 350 }} />
        {splashDone && <KeepAsDrawn><UpdatePrompt /></KeepAsDrawn>}
        {!splashDone && <KeepAsDrawn><AnimatedSplash onFinish={finishSplash} /></KeepAsDrawn>}
      </AppAlertProvider>
    </ThemeProvider>
  );
}
