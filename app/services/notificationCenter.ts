import { requireOptionalNativeModule } from 'expo-modules-core';

import { getAccessToken, getNotifications } from './api';

const POLL_MS = 30000;

type Listener = (count: number) => void;

const listeners = new Set<Listener>();
const knownIds = new Set<string>();
const unreadIds = new Set<string>();
let baselineTaken = false;
let timer: ReturnType<typeof setInterval> | null = null;
let subscribers = 0;
let player: { seekTo: (seconds: number) => unknown; play: () => void } | null = null;
let audioUnavailable = false;

const emit = () => listeners.forEach((listener) => listener(unreadIds.size));

export const notificationListFrom = (data: any): any[] => [data, data?.data, data?.notifications, data?.results].find(Array.isArray) || [];
export const notificationKey = (raw: any, index: number) => String(raw.id ?? index);
const flaggedUnread = (raw: any) => raw.is_read === false || raw.read === false || raw.seen === false;

async function playChime() {
  if (audioUnavailable) return;
  try {
    if (!player) {
      // Builds made before expo-audio was installed lack its native module; check quietly instead of letting it log an error.
      if (!requireOptionalNativeModule('ExpoAudio')) { audioUnavailable = true; return; }
      // Loaded on demand: builds made before expo-audio was installed lack the native module, and must still run.
      const { createAudioPlayer, setAudioModeAsync } = require('expo-audio');
      await setAudioModeAsync({ playsInSilentMode: false });
      player = createAudioPlayer(require('../../assets/sounds/notification.wav'));
    }
    player?.seekTo(0);
    player?.play();
  } catch {
    // A missing sound (or native module) should never break notifications.
    audioUnavailable = true;
  }
}

// What the user has seen and read survives restarts. AsyncStorage is optional so builds without it still run.
const STORAGE_KEY = 'apsuni.notifications.v1';
const readIds = new Set<string>();
let storage: { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> } | null = null;
let loaded: Promise<void> | null = null;

function loadState() {
  if (!loaded) {
    loaded = (async () => {
      try {
        storage = require('@react-native-async-storage/async-storage').default;
        const saved = JSON.parse((await storage?.getItem(STORAGE_KEY)) || 'null');
        if (saved) {
          (saved.known ?? []).forEach((id: string) => knownIds.add(id));
          (saved.read ?? []).forEach((id: string) => readIds.add(id));
          // A returning user already has a baseline, so anything unseen since last time is new.
          baselineTaken = true;
        }
      } catch {
        storage = null;
      }
    })();
  }
  return loaded;
}

function saveState() {
  storage?.setItem(STORAGE_KEY, JSON.stringify({ known: [...knownIds], read: [...readIds] })).catch(() => {});
}

/** Registers a fetched list. The very first list is the baseline; anything after it counts as new. Returns whether new items arrived. */
export async function ingestNotifications(items: any[]) {
  await loadState();
  let hasNew = false;
  items.forEach((raw, index) => {
    const key = notificationKey(raw, index);
    const isNew = !knownIds.has(key);
    knownIds.add(key);
    if (readIds.has(key)) { unreadIds.delete(key); return; }
    if (flaggedUnread(raw)) unreadIds.add(key);
    if (baselineTaken && isNew) { unreadIds.add(key); hasNew = true; }
  });
  baselineTaken = true;
  saveState();
  emit();
  return hasNew;
}

export async function refreshNotifications() {
  if (!getAccessToken()) return;
  try {
    const hasNew = await ingestNotifications(notificationListFrom(await getNotifications()));
    if (hasNew) playChime();
  } catch {
    // Keep the last known count when the network drops.
  }
}

export const isNotificationUnread = (key: string) => unreadIds.has(key);

/** Marks notifications as read for good: the badge drops and they stay read after a restart. */
export function markNotificationsRead(keys: string[]) {
  keys.forEach((key) => { readIds.add(key); unreadIds.delete(key); });
  saveState();
  emit();
}

/** Starts polling while at least one screen is listening. Returns a function that unsubscribes. */
export function subscribeToUnreadNotifications(listener: Listener) {
  listeners.add(listener);
  listener(unreadIds.size);
  subscribers += 1;
  if (!timer) {
    refreshNotifications();
    timer = setInterval(refreshNotifications, POLL_MS);
  }
  return () => {
    listeners.delete(listener);
    subscribers -= 1;
    if (subscribers <= 0 && timer) { clearInterval(timer); timer = null; }
  };
}

// expo-router treats every file under app/ as a route and warns when it has no default export.
export default subscribeToUnreadNotifications;
