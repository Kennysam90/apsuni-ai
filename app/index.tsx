import { useEffect, useState } from 'react';
import { View } from '../theme/native';
import { Redirect } from 'expo-router';

import { shouldShowOnboarding } from './services/appFlags';

// A fresh install goes through the welcome tour first; anyone who has already signed in goes straight to sign in.
export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    shouldShowOnboarding()
      .then((show) => { if (active) setTarget(show ? '/Screen/Onboarding/OnboardingScreen' : '/Screen/Auth/SignInScreen'); })
      .catch(() => { if (active) setTarget('/Screen/Auth/SignInScreen'); });
    return () => { active = false; };
  }, []);

  if (!target) return <View style={{ flex: 1, backgroundColor: '#0A1018' }} />;
  return <Redirect href={target as any} />;
}
