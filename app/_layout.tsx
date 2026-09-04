import { Stack } from "expo-router";
import { AppAlertProvider } from './components/AppAlert';

export default function RootLayout() {
  return (
    <AppAlertProvider>
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", animationDuration: 350 }} />
    </AppAlertProvider>
  );
}
