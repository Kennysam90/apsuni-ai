import Constants from 'expo-constants';

/**
 * Finds out whether a newer Apsuni app has been published.
 *
 * The source of truth is the latest GitHub release of the app's repository: its tag is the version
 * ("v1.0.1"), its notes are shown to people, and the attached APK is what "Update now" downloads.
 * To ship an update, raise "version" in app.json, build the APK, then publish a release whose tag
 * matches that version and attach the APK. Add [required] to the release notes to make the update
 * compulsory (people then cannot dismiss the popup).
 */

const RELEASE_API = 'https://api.github.com/repos/Kennysam90/apsuni-ai/releases/latest';
const RELEASES_PAGE = 'https://github.com/Kennysam90/apsuni-ai/releases/latest';

export type AppUpdate = {
  current: string;
  latest: string;
  notes: string[];
  url: string;
  required: boolean;
};

export const installedVersion = () => String(Constants.expoConfig?.version ?? '0.0.0');

const parts = (version: string) => version.replace(/^v/i, '').split(/[.-]/).map((piece) => Number.parseInt(piece, 10) || 0);

/** True when `candidate` is a higher version than `base`. */
export function isNewer(candidate: string, base: string): boolean {
  const a = parts(candidate);
  const b = parts(base);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

// Release notes are Markdown; keep the plain sentences and drop the formatting.
const toBullets = (body: string): string[] => body
  .replace(/\[required\]/gi, '')
  .split(/\r?\n/)
  .map((line) => line.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '').replace(/^#+\s*/, '').replace(/[*_`>]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim())
  .filter((line) => line.length > 0 && !/^full changelog/i.test(line))
  .slice(0, 6);

/** The newer version, or null when the app is up to date or the check could not be made. */
export async function checkForUpdate(): Promise<AppUpdate | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const release = await response.json();
    const latest = String(release?.tag_name ?? '').replace(/^v/i, '');
    const current = installedVersion();
    if (!latest || !isNewer(latest, current)) return null;

    const apk = Array.isArray(release.assets) ? release.assets.find((asset: any) => /\.apk$/i.test(asset?.name ?? '')) : null;
    const body = String(release.body ?? '');
    return {
      current,
      latest,
      notes: toBullets(body),
      url: apk?.browser_download_url ?? release.html_url ?? RELEASES_PAGE,
      required: /\[required\]/i.test(body),
    };
  } catch {
    // Offline, rate limited or blocked: never bother the person about it.
    return null;
  }
}

// expo-router treats every file under app/ as a route and warns when it has no default export.
export default checkForUpdate;
