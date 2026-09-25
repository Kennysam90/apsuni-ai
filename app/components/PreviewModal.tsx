import React, { useEffect, useRef, useState } from 'react';
import { Feather } from '../../theme/vector-icons';
import {
	ActivityIndicator,
	Animated,
	Dimensions,
	Easing,
	Image,
	Linking,
	Modal,
	NativeScrollEvent,
	NativeSyntheticEvent,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from '../../theme/native';
import { WebView } from 'react-native-webview';
import { getApiAssetUrl, getProductImages } from '../services/api';

import { friendlyError } from '../services/errors';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type PreviewModalProps = {
	visible: boolean;
	/** Product id used to pull the screenshot gallery. */
	productId?: string | number | null;
	/** Demo site, used for website products (and as a fallback). */
	url?: string | null;
	title?: string | null;
	subtitle?: string | null;
	/** Mobile-app products preview as screenshots instead of the demo site. */
	isMobileApp?: boolean;
	onClose: () => void;
};

/**
 * Turns whatever the API stored in `demo` into something loadable.
 * Returns null when the value is not a usable link - prefixing "https://"
 * onto a relative path or a label produces a host that cannot resolve
 * (net::ERR_NAME_NOT_RESOLVED), so those are rejected instead.
 */
function normalizeUrl(url?: string | null): string | null {
	const value = String(url ?? '').trim();
	if (!value || value.toLowerCase() === 'null' || value.toLowerCase() === 'undefined') return null;
	if (/^https?:\/\//i.test(value)) return value;
	if (value.startsWith('//')) return `https:${value}`;
	if (value.startsWith('/')) return getApiAssetUrl(value);

	const host = value.split(/[/?#]/)[0];
	if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host)) return `https://${value}`;
	return null;
}

function hostOf(url: string) {
	const match = url.match(/^https?:\/\/([^/?#]+)/i);
	return match ? match[1] : url;
}

export default function PreviewModal({ visible, productId, url, title, subtitle, isMobileApp, onClose }: PreviewModalProps) {
	const target = normalizeUrl(url);

	const [isMounted, setIsMounted] = useState(visible);

	/* Screenshot gallery (mobile products). */
	const [shots, setShots] = useState<string[]>([]);
	const [shotsLoading, setShotsLoading] = useState(false);
	const [shotsError, setShotsError] = useState<string | null>(null);
	const [shotIndex, setShotIndex] = useState(0);

	/* Demo site (website products). */
	const [isLoading, setIsLoading] = useState(true);
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [canGoBack, setCanGoBack] = useState(false);

	const webViewRef = useRef<WebView | null>(null);
	const galleryRef = useRef<ScrollView | null>(null);
	const backdrop = useRef(new Animated.Value(0)).current;
	const sheet = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

	useEffect(() => {
		if (visible) {
			setIsMounted(true);
			setIsLoading(true);
			setProgress(0);
			setError(null);
			setCanGoBack(false);
			setShotIndex(0);
			backdrop.setValue(0);
			sheet.setValue(SCREEN_HEIGHT);
			Animated.parallel([
				Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
				Animated.spring(sheet, { toValue: 0, useNativeDriver: true, friction: 9, tension: 70 }),
			]).start();
			return;
		}

		Animated.parallel([
			Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
			Animated.timing(sheet, { toValue: SCREEN_HEIGHT, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
		]).start(({ finished }) => {
			if (finished) setIsMounted(false);
		});
	}, [visible, backdrop, sheet]);

	/* Pull the screenshots for mobile-app products. */
	useEffect(() => {
		if (!visible || !isMobileApp || !productId) return;

		let isActive = true;
		setShots([]);
		setShotsError(null);
		setShotsLoading(true);

		getProductImages(productId)
			.then((images) => {
				if (!isActive) return;
				setShots(images.map((image) => getApiAssetUrl(image) ?? image).filter(Boolean) as string[]);
			})
			.catch((requestError) => {
				if (isActive) setShotsError(friendlyError(requestError, 'Could not load the screenshots.'));
			})
			.finally(() => {
				if (isActive) setShotsLoading(false);
			});

		return () => { isActive = false; };
	}, [visible, isMobileApp, productId]);

	const goToShot = (index: number) => {
		const target = Math.max(0, Math.min(shots.length - 1, index));
		if (target === shotIndex) return;
		setShotIndex(target);
		galleryRef.current?.scrollTo({ x: target * SCREEN_WIDTH, animated: true });
	};

	const goBackOrClose = () => {
		if (canGoBack && !isMobileApp) {
			webViewRef.current?.goBack();
			return;
		}
		onClose();
	};

	const openExternally = () => {
		if (target) Linking.openURL(target).catch(() => undefined);
	};

	const reload = () => {
		setError(null);
		setIsLoading(true);
		webViewRef.current?.reload();
	};

	const onShotScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		setShotIndex(Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH));
	};

	const webView = target ? (
		<WebView
			ref={webViewRef}
			source={{ uri: target }}
			style={styles.webView}
			containerStyle={styles.webViewContainer}
			originWhitelist={['*']}
			javaScriptEnabled
			domStorageEnabled
			allowsInlineMediaPlayback
			allowsBackForwardNavigationGestures
			setSupportMultipleWindows={false}
			startInLoadingState={false}
			onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
			onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
			onLoadStart={() => setIsLoading(true)}
			onLoadEnd={() => setIsLoading(false)}
			onError={({ nativeEvent }) => {
				setIsLoading(false);
				const description = nativeEvent.description || '';
				setError(
					/NAME_NOT_RESOLVED|CANNOT_FIND_HOST|ADDRESS_UNREACHABLE/i.test(description)
						? `${hostOf(target)} could not be reached. The demo link saved on this product may be wrong, or the site is offline.`
						: description || 'This page could not be loaded here.',
				);
			}}
			onHttpError={({ nativeEvent }) => {
				if (nativeEvent.statusCode >= 400) {
					setIsLoading(false);
					setError(`The site responded with error ${nativeEvent.statusCode}.`);
				}
			}}
		/>
	) : (
		<View style={styles.stateContainer}>
			<Feather name="link-2" size={22} color="#475569" />
			<Text style={styles.stateText}>This product has no demo link yet.</Text>
		</View>
	);

	/* Mobile products show screenshots; websites load the live demo. */
	const renderBody = () => {
		if (!isMobileApp) {
			if (error) {
				return (
					<View style={styles.stateContainer}>
						<Feather name="alert-circle" size={22} color="#FB7185" />
						<Text style={styles.stateText}>{error}</Text>
						<View style={styles.stateActions}>
							<TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={reload}>
								<Text style={styles.secondaryButtonText}>Try again</Text>
							</TouchableOpacity>
							<TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={openExternally}>
								<Feather name="external-link" size={14} color="#FFFFFF" />
								<Text style={styles.primaryButtonText}>Open in browser</Text>
							</TouchableOpacity>
						</View>
					</View>
				);
			}
			return webView;
		}

		if (shotsLoading) {
			return (
				<View style={styles.stateContainer}>
					<ActivityIndicator size="large" color="#38BDF8" />
					<Text style={styles.stateText}>Loading screenshots…</Text>
				</View>
			);
		}

		if (shots.length === 0) {
			return (
				<View style={styles.stateContainer}>
					<Feather name="image" size={22} color="#475569" />
					<Text style={styles.stateText}>{shotsError || 'No screenshots have been uploaded for this app yet.'}</Text>
					{target && (
						<TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={openExternally}>
							<Feather name="external-link" size={14} color="#FFFFFF" />
							<Text style={styles.primaryButtonText}>Open demo site</Text>
						</TouchableOpacity>
					)}
				</View>
			);
		}

		return (
			<ScrollView
				ref={galleryRef}
				horizontal
				pagingEnabled
				showsHorizontalScrollIndicator={false}
				onMomentumScrollEnd={onShotScroll}
				style={styles.gallery}
			>
				{shots.map((shot, index) => (
					<View key={`${shot}-${index}`} style={styles.shotPage}>
						<Image source={{ uri: shot }} style={styles.shotImage} resizeMode="contain" />
					</View>
				))}
			</ScrollView>
		);
	};

	const showWebProgress = !isMobileApp && isLoading && !error && !!target;
	const hasGallery = isMobileApp && shots.length > 0;

	return (
		<Modal visible={isMounted} transparent statusBarTranslucent animationType="none" onRequestClose={goBackOrClose}>
			<View style={styles.root}>
				<Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
					<Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} accessibilityLabel="Close preview" />
				</Animated.View>

				<Animated.View style={[styles.sheet, { transform: [{ translateY: sheet }] }]}>
					<View style={styles.header}>
						<View style={styles.headerCopy}>
							<Text style={styles.headerTitle} numberOfLines={1}>{title || 'Preview'}</Text>
							<Text style={styles.headerSubtitle} numberOfLines={1}>
								{hasGallery
									? `Screenshot ${shotIndex + 1} of ${shots.length}`
									: subtitle || (target ? hostOf(target) : '')}
							</Text>
						</View>

						{!isMobileApp && (
							<TouchableOpacity style={styles.headerButton} activeOpacity={0.8} onPress={reload} accessibilityLabel="Reload preview">
								<Feather name="rotate-cw" size={16} color="#E2E8F0" />
							</TouchableOpacity>
						)}
						{target && (
							<TouchableOpacity style={styles.headerButton} activeOpacity={0.8} onPress={openExternally} accessibilityLabel="Open in browser">
								<Feather name="external-link" size={16} color="#E2E8F0" />
							</TouchableOpacity>
						)}
						<TouchableOpacity style={[styles.headerButton, styles.closeButton]} activeOpacity={0.8} onPress={goBackOrClose} accessibilityLabel={canGoBack && !isMobileApp ? 'Go back' : 'Close preview'}>
							<Feather name={canGoBack && !isMobileApp ? 'chevron-left' : 'x'} size={18} color="#FFFFFF" />
						</TouchableOpacity>
					</View>

					{showWebProgress && (
						<View style={styles.progressTrack}>
							<View style={[styles.progressFill, { width: `${Math.max(6, progress * 100)}%` }]} />
						</View>
					)}

					<View style={[styles.viewport, isMobileApp && styles.viewportDark]}>
						{renderBody()}

						{showWebProgress && (
							<View style={styles.loadingOverlay} pointerEvents="none">
								<ActivityIndicator size="large" color="#38BDF8" />
								<Text style={styles.loadingText}>Loading preview…</Text>
							</View>
						)}

						{/* Previous / next screenshot. */}
						{hasGallery && shots.length > 1 && (
							<>
								<TouchableOpacity
									style={[styles.arrow, styles.arrowLeft, shotIndex === 0 && styles.arrowDisabled]}
									activeOpacity={0.8}
									disabled={shotIndex === 0}
									onPress={() => goToShot(shotIndex - 1)}
									accessibilityLabel="Previous screenshot"
								>
									<Feather name="chevron-left" size={24} color="#FFFFFF" />
								</TouchableOpacity>

								<TouchableOpacity
									style={[styles.arrow, styles.arrowRight, shotIndex === shots.length - 1 && styles.arrowDisabled]}
									activeOpacity={0.8}
									disabled={shotIndex === shots.length - 1}
									onPress={() => goToShot(shotIndex + 1)}
									accessibilityLabel="Next screenshot"
								>
									<Feather name="chevron-right" size={24} color="#FFFFFF" />
								</TouchableOpacity>

								<View style={styles.counter}>
									<Text style={styles.counterText}>{shotIndex + 1} / {shots.length}</Text>
								</View>
							</>
						)}
					</View>
				</Animated.View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, justifyContent: 'flex-end' },
	backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3, 9, 18, 0.9)' },
	sheet: { flex: 1, backgroundColor: '#05090F' },

	header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 46, paddingBottom: 12, backgroundColor: '#0B1422' },
	headerButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#172235', borderWidth: 1, borderColor: '#24334A' },
	closeButton: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
	headerCopy: { flex: 1, minWidth: 0, marginRight: 4 },
	headerTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
	headerSubtitle: { fontSize: 11, color: '#64748B', marginTop: 2 },

	progressTrack: { height: 2, backgroundColor: '#172235' },
	progressFill: { height: '100%', backgroundColor: '#2563EB' },

	viewport: { flex: 1, backgroundColor: '#FFFFFF' },
	viewportDark: { backgroundColor: '#05090F' },
	webView: { flex: 1, backgroundColor: '#FFFFFF' },
	webViewContainer: { flex: 1 },

	gallery: { flex: 1 },
	shotPage: { width: SCREEN_WIDTH, alignItems: 'center', justifyContent: 'center', backgroundColor: '#05090F' },
	shotImage: { width: SCREEN_WIDTH, height: '100%' },

	arrow: {
		position: 'absolute',
		top: '50%',
		marginTop: -22,
		width: 44,
		height: 44,
		borderRadius: 22,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(5, 11, 20, 0.72)',
		borderWidth: 1,
		borderColor: 'rgba(148, 163, 184, 0.3)',
	},
	arrowLeft: { left: 12 },
	arrowRight: { right: 12 },
	arrowDisabled: { opacity: 0.3 },

	counter: { position: 'absolute', bottom: 24, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(5, 11, 20, 0.78)', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.25)' },
	counterText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

	loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#0B1422' },
	loadingText: { fontSize: 12, color: '#94A3B8' },

	stateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 28, backgroundColor: '#0B1422' },
	stateText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19 },
	stateActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
	secondaryButton: { paddingHorizontal: 16, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#172235', borderWidth: 1, borderColor: '#24334A' },
	secondaryButtonText: { fontSize: 13, fontWeight: '700', color: '#CBD5E1' },
	primaryButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: 40, borderRadius: 12, backgroundColor: '#2563EB' },
	primaryButtonText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});
