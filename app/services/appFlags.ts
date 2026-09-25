/**
 * Small yes/no facts about this install, kept on the phone.
 *
 * They live in app storage, which Android deletes when the app is uninstalled (automatic cloud backup
 * of app data is switched off in the manifest), so a fresh install starts with nothing set and the
 * customer sees the welcome tour again. AsyncStorage is optional so a build without it still runs.
 */

const HAS_LOGGED_IN = 'apsuni.hasLoggedIn';
const ONBOARDING_DONE = 'apsuni.onboardingDone';

// While the tour's design is being finished it shows on every launch. Set this to false to go back to
// showing it only on a fresh install (never for someone who has signed in or already finished it).
const ALWAYS_SHOW_ONBOARDING = false;

const memory: Record<string, string> = {};

function storage(): { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> } | null {
  try {
    return require('@react-native-async-storage/async-storage').default;
  } catch {
    return null;
  }
}

async function read(key: string): Promise<boolean> {
  try {
    const value = await storage()?.getItem(key);
    if (value != null) return value === '1';
  } catch {
    // fall through to the in-memory copy
  }
  return memory[key] === '1';
}

async function write(key: string) {
  memory[key] = '1';
  try {
    await storage()?.setItem(key, '1');
  } catch {
    // Storage is unavailable; the in-memory copy still covers this session.
  }
}

const THEME_KEY = 'apsuni.theme';

/** The light/dark choice made from the side menu, or null when none has been made yet. */
export async function getStoredTheme(): Promise<'dark' | 'light' | null> {
  try {
    const value = await storage()?.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export async function setStoredTheme(mode: 'dark' | 'light') {
  try {
    await storage()?.setItem(THEME_KEY, mode);
  } catch {
    // Not saved; the choice still applies until the app is closed.
  }
}

/** Called after every successful sign in: someone who has signed in never needs the tour. */
export const markLoggedIn = () => write(HAS_LOGGED_IN);
export const markOnboardingDone = () => write(ONBOARDING_DONE);

/** True when the welcome tour should be shown: a fresh install where nobody has signed in yet. */
export async function shouldShowOnboarding(): Promise<boolean> {
  if (ALWAYS_SHOW_ONBOARDING) return true;
  // Only signing in ends the tour for good; Skip or Get started just moves on to the sign-in screen.
  return !(await read(HAS_LOGGED_IN));
}

// expo-router treats every file under app/ as a route and warns when it has no default export.
export default shouldShowOnboarding;
