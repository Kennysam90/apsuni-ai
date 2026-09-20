import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
	ActivityIndicator,
	Animated,
	Dimensions,
	Easing,
	KeyboardAvoidingView,
	LayoutChangeEvent,
	Modal,
	Platform,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import AppBackground from '../../components/AppBackground';
import AppHeader from '../../components/AppHeader';
import {
	createWalletAccount,
	fundWithSavedCard,
	getAccessToken,
	initiateCardFunding,
	listSavedCards,
	listWalletAccounts,
	verifyCardFunding,
	type CardFundingResult,
	type SavedCard,
	type WalletAccount,
} from '../../services/api';
import { formatMoney, useCurrency } from '../../services/currency';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Flutterwave redirects here when checkout ends. The in-app checkout sheet
 * intercepts this address before it loads, so the page never has to exist.
 */
const CALLBACK_URL = 'https://studio.apsuni.com/app-wallet-callback/';
const QUICK_AMOUNTS = [1000, 5000, 10000, 50000];
const FAILED_STATUSES = ['failed', 'cancelled', 'canceled', 'declined', 'expired'];

type WalletType = 'personal' | 'team' | 'credit';

const TYPE_THEME: Record<WalletType, {
	label: string;
	icon: keyof typeof Feather.glyphMap;
	colors: [string, string];
	tint: string;
	description: string;
	perks: string[];
}> = {
	personal: {
		label: 'Personal',
		icon: 'user',
		colors: ['#1E3A8A', '#2563EB'],
		tint: '#60A5FA',
		description: 'A private balance for your own purchases.',
		perks: ['Pay for products and templates', 'Top up by card in seconds', 'Only you can use it'],
	},
	team: {
		label: 'Team',
		icon: 'users',
		colors: ['#4C1D95', '#7C3AED'],
		tint: '#A78BFA',
		description: 'One shared balance for up to 15 members.',
		perks: ['40 downloads per day', 'Access to all products or bundles', 'Early access to new and beta features'],
	},
	credit: {
		label: 'Credit',
		icon: 'trending-up',
		colors: ['#064E3B', '#059669'],
		tint: '#34D399',
		description: 'For big teams that need withdrawals.',
		perks: ['Withdrawals enabled', 'Shared with a co-owner', 'Built for larger budgets'],
	},
};

const themeFor = (type?: string) => TYPE_THEME[type as WalletType] ?? TYPE_THEME.personal;

type PaymentMethod = { kind: 'new' } | { kind: 'saved'; card: SavedCard };

type ResultState =
	| { kind: 'processing'; title: string; message: string }
	| { kind: 'success'; title: string; message: string; amount?: string; details: { label: string; value: string }[] }
	| { kind: 'failed'; title: string; message: string; canRetry: boolean };

/** Keeps a typed amount to digits with at most one point and two decimals. */
function sanitizeAmount(text: string) {
	const digits = text.replace(/[^\d.]/g, '');
	const [whole, ...rest] = digits.split('.');
	const trimmedWhole = whole.replace(/^0+(?=\d)/, '').slice(0, 9);
	if (rest.length === 0) return trimmedWhole;
	return `${trimmedWhole || '0'}.${rest.join('').slice(0, 2)}`;
}

function parseQuery(url: string) {
	const query = url.split('?')[1]?.split('#')[0] ?? '';
	const params: Record<string, string> = {};
	for (const pair of query.split('&')) {
		if (!pair) continue;
		const [key, value = ''] = pair.split('=');
		try {
			params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
		} catch {
			params[key] = value;
		}
	}
	return params;
}

function brandLabel(brand?: string) {
	const value = (brand ?? '').toLowerCase();
	if (value.includes('visa')) return 'Visa';
	if (value.includes('master')) return 'Mastercard';
	if (value.includes('verve')) return 'Verve';
	return 'Card';
}

function cardExpiry(card: SavedCard) {
	const month = card.expiry_month ?? '';
	if (month.includes('/')) return month; // Flutterwave stores "MM/YY" here
	if (month && card.expiry_year) return `${month.padStart(2, '0')}/${String(card.expiry_year).slice(-2)}`;
	return '';
}

const errorMessage = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

/* ------------------------------------------------------------------ */
/* Animated building blocks                                            */
/* ------------------------------------------------------------------ */

function usePulse() {
	const value = useRef(new Animated.Value(0.45)).current;
	useEffect(() => {
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(value, { toValue: 0.9, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
				Animated.timing(value, { toValue: 0.45, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
			]),
		);
		loop.start();
		return () => loop.stop();
	}, [value]);
	return value;
}

/** A sheet that springs up from the bottom and slides away on close. */
function BottomSheet({
	visible,
	onClose,
	tall,
	children,
}: {
	visible: boolean;
	onClose: () => void;
	tall?: boolean;
	children: React.ReactNode;
}) {
	const [mounted, setMounted] = useState(visible);
	const backdrop = useRef(new Animated.Value(0)).current;
	const translate = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

	useEffect(() => {
		if (visible) {
			setMounted(true);
			backdrop.setValue(0);
			translate.setValue(SCREEN_HEIGHT);
			Animated.parallel([
				Animated.timing(backdrop, { toValue: 1, duration: 240, useNativeDriver: true }),
				Animated.spring(translate, { toValue: 0, useNativeDriver: true, friction: 10, tension: 68 }),
			]).start();
			return;
		}
		Animated.parallel([
			Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
			Animated.timing(translate, { toValue: SCREEN_HEIGHT, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
		]).start(({ finished }) => {
			if (finished) setMounted(false);
		});
	}, [visible, backdrop, translate]);

	if (!mounted) return null;

	return (
		<Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
			<View style={styles.sheetRoot}>
				<Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
					<Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} accessibilityLabel="Close" />
				</Animated.View>
				<Animated.View style={[styles.sheet, tall && styles.sheetTall, { transform: [{ translateY: translate }] }]}>
					<View style={styles.sheetHandle} />
					{children}
				</Animated.View>
			</View>
		</Modal>
	);
}

/** Centered popup for verifying / success / failure, each with its own motion. */
function ResultModal({
	result,
	onClose,
	onRetry,
}: {
	result: ResultState | null;
	onClose: () => void;
	onRetry: () => void;
}) {
	const [shown, setShown] = useState<ResultState | null>(result);
	const [mounted, setMounted] = useState(!!result);
	const backdrop = useRef(new Animated.Value(0)).current;
	const cardScale = useRef(new Animated.Value(0.86)).current;
	const iconPop = useRef(new Animated.Value(0)).current;
	const ring = useRef(new Animated.Value(0)).current;
	const shake = useRef(new Animated.Value(0)).current;
	const spin = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (result) {
			setShown(result);
			if (!mounted) {
				setMounted(true);
				backdrop.setValue(0);
				cardScale.setValue(0.86);
				Animated.parallel([
					Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
					Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, friction: 7, tension: 80 }),
				]).start();
			}
			return;
		}
		if (!mounted) return;
		Animated.parallel([
			Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
			Animated.timing(cardScale, { toValue: 0.9, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
		]).start(({ finished }) => {
			if (finished) setMounted(false);
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [result]);

	// Each state change replays its own icon animation.
	useEffect(() => {
		if (!shown) return undefined;
		iconPop.setValue(0);
		Animated.spring(iconPop, { toValue: 1, useNativeDriver: true, friction: 5, tension: 90 }).start();

		if (shown.kind === 'processing') {
			spin.setValue(0);
			const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
			loop.start();
			return () => loop.stop();
		}

		if (shown.kind === 'success') {
			ring.setValue(0);
			const loop = Animated.loop(
				Animated.sequence([
					Animated.timing(ring, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
					Animated.delay(250),
				]),
			);
			loop.start();
			return () => loop.stop();
		}

		shake.setValue(0);
		Animated.sequence([
			Animated.delay(120),
			...[10, -10, 8, -8, 4, -4, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 55, useNativeDriver: true })),
		]).start();
		return undefined;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shown?.kind, shown?.title]);

	if (!mounted || !shown) return null;

	const isProcessing = shown.kind === 'processing';
	const palette = shown.kind === 'success'
		? { colors: ['#16A34A', '#22C55E'] as [string, string], ring: 'rgba(34, 197, 94, 0.35)', icon: 'check' as const }
		: shown.kind === 'failed'
			? { colors: ['#DC2626', '#F43F5E'] as [string, string], ring: 'rgba(244, 63, 94, 0.3)', icon: 'x' as const }
			: { colors: ['#1D4ED8', '#3B82F6'] as [string, string], ring: 'rgba(59, 130, 246, 0.3)', icon: 'shield' as const };

	return (
		<Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={() => { if (!isProcessing) onClose(); }}>
			<View style={styles.resultRoot}>
				<Animated.View style={[styles.backdrop, { opacity: backdrop }]} />
				<Animated.View style={[styles.resultCard, { opacity: backdrop, transform: [{ scale: cardScale }] }]}>
					<View style={styles.resultIconWrap}>
						{shown.kind === 'success' && (
							<Animated.View
								style={[
									styles.resultRing,
									{
										borderColor: palette.ring,
										opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
										transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
									},
								]}
							/>
						)}
						{isProcessing && (
							<Animated.View
								style={[
									styles.spinnerRing,
									{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
								]}
							/>
						)}
						<Animated.View style={{ transform: [{ scale: iconPop }, { translateX: shake }] }}>
							<LinearGradient colors={palette.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.resultIcon}>
								<Feather name={palette.icon} size={isProcessing ? 26 : 32} color="#FFFFFF" />
							</LinearGradient>
						</Animated.View>
					</View>

					<Text style={styles.resultTitle}>{shown.title}</Text>
					{shown.kind === 'success' && shown.amount ? <Text style={styles.resultAmount}>{shown.amount}</Text> : null}
					<Text style={styles.resultMessage}>{shown.message}</Text>

					{shown.kind === 'success' && shown.details.length > 0 && (
						<View style={styles.resultDetails}>
							{shown.details.map((row, index) => (
								<View key={row.label} style={[styles.resultDetailRow, index === shown.details.length - 1 && styles.resultDetailRowLast]}>
									<Text style={styles.resultDetailLabel}>{row.label}</Text>
									<Text style={styles.resultDetailValue} numberOfLines={1}>{row.value}</Text>
								</View>
							))}
						</View>
					)}

					{shown.kind === 'success' && (
						<TouchableOpacity style={styles.resultPrimary} activeOpacity={0.88} onPress={onClose}>
							<LinearGradient colors={['#16A34A', '#22C55E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.resultPrimaryFill}>
								<Text style={styles.resultPrimaryText}>Done</Text>
							</LinearGradient>
						</TouchableOpacity>
					)}

					{shown.kind === 'failed' && (
						<View style={styles.resultActions}>
							<TouchableOpacity style={styles.resultSecondary} activeOpacity={0.85} onPress={onClose}>
								<Text style={styles.resultSecondaryText}>Close</Text>
							</TouchableOpacity>
							{shown.canRetry && (
								<TouchableOpacity style={[styles.resultPrimary, styles.resultActionFlex]} activeOpacity={0.88} onPress={onRetry}>
									<LinearGradient colors={['#2563EB', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.resultPrimaryFill}>
										<Feather name="refresh-cw" size={15} color="#FFFFFF" />
										<Text style={styles.resultPrimaryText}>Try again</Text>
									</LinearGradient>
								</TouchableOpacity>
							)}
						</View>
					)}

					{isProcessing && (
						<View style={styles.processingNote}>
							<Feather name="lock" size={12} color="#64748B" />
							<Text style={styles.processingNoteText}>Please keep the app open</Text>
						</View>
					)}
				</Animated.View>
			</View>
		</Modal>
	);
}

function WalletCard({ wallet, selected, onPress }: { wallet: WalletAccount; selected: boolean; onPress: () => void }) {
	const theme = themeFor(wallet.account_type);
	const scale = useRef(new Animated.Value(selected ? 1 : 0.95)).current;

	useEffect(() => {
		Animated.spring(scale, { toValue: selected ? 1 : 0.95, useNativeDriver: true, friction: 8, tension: 90 }).start();
	}, [selected, scale]);

	const members = wallet.members?.length ?? 0;
	const meta = wallet.account_type === 'team'
		? `${members} of ${wallet.max_members ?? members} members`
		: wallet.account_type === 'credit'
			? 'Withdrawals enabled'
			: 'Only you';

	return (
		<Animated.View style={{ transform: [{ scale }] }}>
			<Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={`${wallet.name}, ${formatMoney(wallet.balance)}`}>
				<LinearGradient colors={theme.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.walletCard, selected && styles.walletCardSelected]}>
					<View style={styles.walletOrbLarge} />
					<View style={styles.walletOrbSmall} />

					<View style={styles.walletCardTop}>
						<View style={styles.walletTypeBadge}>
							<Feather name={theme.icon} size={11} color="#FFFFFF" />
							<Text style={styles.walletTypeText}>{theme.label.toUpperCase()}</Text>
						</View>
						<View style={[styles.walletCheck, selected && styles.walletCheckOn]}>
							{selected && <Feather name="check" size={12} color={theme.colors[0]} />}
						</View>
					</View>

					<Text style={styles.walletBalanceLabel}>Available balance</Text>
					<Text style={styles.walletBalance} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(wallet.balance)}</Text>

					<View style={styles.walletCardBottom}>
						<Text style={styles.walletName} numberOfLines={1}>{wallet.name}</Text>
						<Text style={styles.walletMeta}>{meta}</Text>
					</View>
				</LinearGradient>
			</Pressable>
		</Animated.View>
	);
}

/** Sits above the amount so it is always clear which wallet is being topped up. */
function FundingTarget({ wallet, onChange }: { wallet: WalletAccount; onChange: () => void }) {
	const theme = themeFor(wallet.account_type);
	const enter = useRef(new Animated.Value(1)).current;
	const firstRender = useRef(true);

	useEffect(() => {
		if (firstRender.current) {
			firstRender.current = false;
			return;
		}
		enter.setValue(0);
		Animated.spring(enter, { toValue: 1, useNativeDriver: true, friction: 8, tension: 80 }).start();
	}, [wallet.id, enter]);

	return (
		<Animated.View
			style={[
				styles.fundingTarget,
				{ borderColor: `${theme.tint}55` },
				{
					opacity: enter.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
					transform: [
						{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
						{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
					],
				},
			]}
		>
			<LinearGradient colors={[`${theme.tint}24`, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFillObject} />
			<LinearGradient colors={theme.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fundingTargetIcon}>
				<Feather name={theme.icon} size={17} color="#FFFFFF" />
			</LinearGradient>
			<View style={styles.fundingTargetCopy}>
				<Text style={[styles.fundingTargetEyebrow, { color: theme.tint }]}>FUNDING</Text>
				<Text style={styles.fundingTargetName} numberOfLines={1}>{wallet.name}</Text>
				<Text style={styles.fundingTargetMeta} numberOfLines={1}>{theme.label} wallet · {formatMoney(wallet.balance)} available</Text>
			</View>
			<TouchableOpacity style={styles.fundingTargetChange} activeOpacity={0.8} onPress={onChange} accessibilityLabel="Change wallet">
				<Feather name="repeat" size={13} color="#CBD5E1" />
			</TouchableOpacity>
		</Animated.View>
	);
}

/**
 * Flutterwave's hosted checkout. Memoised with a stable `source` so parent
 * re-renders never hand the WebView a new source object — on Android that
 * reloads the original payment link and the checkout never finishes loading.
 */
const CheckoutWebView = memo(function CheckoutWebView({ url, onIntercept }: { url: string; onIntercept: (url: string) => boolean }) {
	const source = useMemo(() => ({ uri: url }), [url]);
	const [attempt, setAttempt] = useState(0);
	const [progress, setProgress] = useState(0);
	const [ready, setReady] = useState(false);
	const [slow, setSlow] = useState(false);
	const [failed, setFailed] = useState<string | null>(null);

	useEffect(() => {
		setReady(false);
		setSlow(false);
		setFailed(null);
		setProgress(0);
		const timer = setTimeout(() => setSlow(true), 15000);
		return () => clearTimeout(timer);
	}, [url, attempt]);

	const reload = () => setAttempt((value) => value + 1);

	return (
		<View style={styles.checkoutBody}>
			{progress < 1 && !failed && (
				<View style={styles.checkoutProgressTrack}>
					<View style={[styles.checkoutProgressFill, { width: `${Math.max(8, progress * 100)}%` }]} />
				</View>
			)}
			<WebView
				key={attempt}
				source={source}
				style={styles.checkoutWebView}
				originWhitelist={['*']}
				javaScriptEnabled
				domStorageEnabled
				thirdPartyCookiesEnabled
				sharedCookiesEnabled
				setSupportMultipleWindows={false}
				onShouldStartLoadWithRequest={(request) => !onIntercept(request.url)}
				onNavigationStateChange={(state) => { onIntercept(state.url); }}
				onLoadProgress={({ nativeEvent }) => {
					setProgress(nativeEvent.progress);
					// The checkout is usable well before every tracker script finishes.
					if (nativeEvent.progress >= 0.8) setReady(true);
				}}
				onLoadEnd={() => setReady(true)}
				onError={({ nativeEvent }) => setFailed(nativeEvent.description || 'The checkout page could not be opened.')}
				onHttpError={({ nativeEvent }) => { if (nativeEvent.statusCode >= 500) setFailed(`Flutterwave returned an error (${nativeEvent.statusCode}).`); }}
			/>
			{(!ready || failed) && (
				<View style={styles.checkoutLoading}>
					{failed ? (
						<>
							<View style={styles.checkoutErrorIcon}><Feather name="wifi-off" size={22} color="#FB7185" /></View>
							<Text style={styles.checkoutLoadingTitle}>Checkout didn’t load</Text>
							<Text style={styles.checkoutLoadingText}>{failed}</Text>
							<TouchableOpacity style={styles.ghostButton} activeOpacity={0.85} onPress={reload}>
								<Text style={styles.ghostButtonText}>Try again</Text>
							</TouchableOpacity>
						</>
					) : (
						<>
							<ActivityIndicator size="large" color="#38BDF8" />
							<Text style={styles.checkoutLoadingTitle}>Loading secure checkout…</Text>
							{slow && (
								<>
									<Text style={styles.checkoutLoadingText}>This is taking longer than usual. Check your connection.</Text>
									<TouchableOpacity style={styles.ghostButton} activeOpacity={0.85} onPress={reload}>
										<Text style={styles.ghostButtonText}>Reload checkout</Text>
									</TouchableOpacity>
								</>
							)}
						</>
					)}
				</View>
			)}
		</View>
	);
});

function MethodRow({
	selected,
	icon,
	title,
	subtitle,
	badge,
	onPress,
}: {
	selected: boolean;
	icon: keyof typeof Feather.glyphMap;
	title: string;
	subtitle: string;
	badge?: string;
	onPress: () => void;
}) {
	return (
		<TouchableOpacity style={[styles.methodRow, selected && styles.methodRowSelected]} activeOpacity={0.85} onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}>
			<View style={[styles.methodIcon, selected && styles.methodIconSelected]}>
				<Feather name={icon} size={17} color={selected ? '#FFFFFF' : '#93C5FD'} />
			</View>
			<View style={styles.methodCopy}>
				<View style={styles.methodTitleRow}>
					<Text style={styles.methodTitle} numberOfLines={1}>{title}</Text>
					{badge ? <View style={styles.methodBadge}><Text style={styles.methodBadgeText}>{badge}</Text></View> : null}
				</View>
				<Text style={styles.methodSubtitle} numberOfLines={1}>{subtitle}</Text>
			</View>
			<View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
		</TouchableOpacity>
	);
}

function WalletSkeleton() {
	const pulse = usePulse();
	return (
		<Animated.View style={{ opacity: pulse }}>
			<View style={[styles.skeleton, { height: 64, marginBottom: 18 }]} />
			<View style={styles.skeletonRow}>
				<View style={[styles.skeleton, { width: 250, height: 156 }]} />
				<View style={[styles.skeleton, { width: 250, height: 156 }]} />
			</View>
			<View style={[styles.skeleton, { height: 150, marginTop: 20 }]} />
			<View style={[styles.skeleton, { height: 180, marginTop: 14 }]} />
		</Animated.View>
	);
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default function FundWalletScreen() {
	const [tab, setTab] = useState<'fund' | 'create'>('fund');
	const [tabsWidth, setTabsWidth] = useState(0);
	const tabX = useRef(new Animated.Value(0)).current;
	const contentFade = useRef(new Animated.Value(1)).current;

	const [wallets, setWallets] = useState<WalletAccount[]>([]);
	const [cards, setCards] = useState<SavedCard[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);

	const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
	const [amountText, setAmountText] = useState('');
	const [method, setMethod] = useState<PaymentMethod>({ kind: 'new' });

	const [reviewVisible, setReviewVisible] = useState(false);
	const [isPaying, setIsPaying] = useState(false);
	const [checkout, setCheckout] = useState<{ url: string; txRef: string } | null>(null);
	const [result, setResult] = useState<ResultState | null>(null);
	const currency = useCurrency();
	const walletScrollRef = useRef<ScrollView>(null);
	const checkoutRef = useRef<{ url: string; txRef: string } | null>(null);
	const handledTxRef = useRef<string | null>(null);

	const [newType, setNewType] = useState<WalletType>('personal');
	const [newName, setNewName] = useState('');
	const [isCreating, setIsCreating] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);

	const loadData = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
		if (!getAccessToken()) {
			setLoadError('Sign in to view and fund your wallets.');
			setIsLoading(false);
			return;
		}
		if (mode === 'initial') setIsLoading(true);
		if (mode === 'refresh') setIsRefreshing(true);

		const [walletResult, cardResult] = await Promise.allSettled([listWalletAccounts(), listSavedCards()]);

		if (walletResult.status === 'fulfilled') {
			const list = walletResult.value ?? [];
			setWallets(list);
			setLoadError(null);
			setSelectedWalletId((current) => (current && list.some((wallet) => wallet.id === current) ? current : list[0]?.id ?? null));
		} else if (mode !== 'silent') {
			setLoadError(errorMessage(walletResult.reason, 'Unable to load your wallets.'));
		}

		if (cardResult.status === 'fulfilled') {
			const list = cardResult.value;
			setCards(list);
			setMethod((current) => (current.kind === 'saved' && !list.some((card) => card.id === current.card.id) ? { kind: 'new' } : current));
		}

		setIsLoading(false);
		setIsRefreshing(false);
	}, []);

	useEffect(() => {
		loadData('initial');
	}, [loadData]);

	useEffect(() => {
		Animated.spring(tabX, { toValue: tab === 'fund' ? 0 : 1, useNativeDriver: true, friction: 9, tension: 80 }).start();
		contentFade.setValue(0);
		Animated.timing(contentFade, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
	}, [tab, tabX, contentFade]);

	const selectedWallet = wallets.find((wallet) => wallet.id === selectedWalletId) ?? null;
	const amount = Number(amountText) || 0;
	const totalBalance = wallets.reduce((sum, wallet) => sum + (Number(wallet.balance) || 0), 0);
	const canContinue = !!selectedWallet && amount > 0;

	const methodLabel = method.kind === 'saved'
		? `${brandLabel(method.card.brand)} •••• ${method.card.last4}`
		: 'Card via Flutterwave';

	const notify = (type: Haptics.NotificationFeedbackType) => {
		Haptics.notificationAsync(type).catch(() => undefined);
	};

	const showSuccess = (response: CardFundingResult, txRef: string, fallbackWallet: WalletAccount | null) => {
		const wallet = response.wallet ?? fallbackWallet;
		const credited = response.amount ?? String(amount);
		setResult({
			kind: 'success',
			title: response.status === 'already_processed' ? 'Already credited' : 'Wallet funded',
			amount: formatMoney(credited),
			message: response.status === 'already_processed'
				? 'This payment was already added to your wallet earlier.'
				: `Added to ${wallet?.name ?? 'your wallet'}. You can start paying right away.`,
			details: [
				...(wallet ? [{ label: 'New balance', value: formatMoney(wallet.balance) }] : []),
				...(wallet ? [{ label: 'Wallet', value: wallet.name }] : []),
				...(txRef ? [{ label: 'Reference', value: txRef }] : []),
			],
		});
		setAmountText('');
		notify(Haptics.NotificationFeedbackType.Success);
		loadData('silent');
	};

	const showFailure = (title: string, message: string) => {
		setResult({ kind: 'failed', title, message, canRetry: true });
		notify(Haptics.NotificationFeedbackType.Error);
	};

	const openReview = () => {
		if (!canContinue) return;
		setReviewVisible(true);
	};

	const pay = async () => {
		if (!selectedWallet || amount <= 0 || isPaying) return;
		setIsPaying(true);

		try {
			if (method.kind === 'saved') {
				const response = await fundWithSavedCard({ wallet_id: selectedWallet.id, saved_card_id: method.card.id, amount });
				setReviewVisible(false);
				if (response.status === 'success' || response.status === 'already_processed') {
					showSuccess(response, response.tx_ref ?? '', selectedWallet);
				} else {
					showFailure('Payment failed', response.detail ?? 'Your saved card could not be charged.');
				}
				return;
			}

			const session = await initiateCardFunding({ wallet_id: selectedWallet.id, amount, redirect_url: CALLBACK_URL });
			if (!session.payment_link) throw new Error('The payment link was not returned. Please try again.');

			handledTxRef.current = null;
			const next = { url: session.payment_link, txRef: session.tx_ref };
			checkoutRef.current = next;
			setReviewVisible(false);
			// Let the review sheet finish sliding away before the checkout rises.
			setTimeout(() => setCheckout(next), 280);
		} catch (error) {
			setReviewVisible(false);
			showFailure('Could not start payment', errorMessage(error, 'Something went wrong. Please try again.'));
		} finally {
			setIsPaying(false);
		}
	};

	const verifyCheckout = async (txRef: string, transactionId: string, status: string) => {
		if (FAILED_STATUSES.includes(status) || !transactionId) {
			const cancelled = status === 'cancelled' || status === 'canceled' || !status;
			showFailure(
				cancelled ? 'Payment cancelled' : 'Payment not completed',
				cancelled ? 'No money was taken. You can try again whenever you are ready.' : `Flutterwave reported this payment as ${status}. No money was added.`,
			);
			return;
		}

		setResult({ kind: 'processing', title: 'Confirming payment', message: 'We are verifying your payment with Flutterwave. This only takes a moment.' });

		try {
			const response = await verifyCardFunding({ transaction_id: transactionId, tx_ref: txRef, status: status || 'successful', save_card: true });
			if (response.status === 'success' || response.status === 'already_processed') {
				showSuccess(response, txRef, selectedWallet);
			} else if (response.status === 'cancelled') {
				showFailure('Payment cancelled', response.detail ?? 'The payment was not completed.');
			} else {
				showFailure('Payment failed', response.detail ?? 'We could not verify this payment.');
			}
		} catch (error) {
			showFailure('Verification failed', errorMessage(error, 'We could not verify your payment. If you were charged, it will be credited once confirmed.'));
		} finally {
			loadData('silent');
		}
	};

	/** Runs for every checkout navigation; returns true when it consumed the callback. */
	const interceptCheckout = (url: string) => {
		if (!url.startsWith(CALLBACK_URL)) return false;
		const params = parseQuery(url);
		const txRef = params.tx_ref || checkoutRef.current?.txRef || '';
		if (handledTxRef.current === txRef) return true; // verify exactly once per payment
		handledTxRef.current = txRef;

		setCheckout(null);
		checkoutRef.current = null;
		const status = (params.status || params.payment_status || params.tx_status || '').toLowerCase();
		setTimeout(() => verifyCheckout(txRef, params.transaction_id || '', status), 300);
		return true;
	};

	// A stable callback keeps the memoised checkout WebView from re-rendering.
	const interceptRef = useRef(interceptCheckout);
	interceptRef.current = interceptCheckout;
	const onCheckoutNavigate = useCallback((url: string) => interceptRef.current(url), []);

	const cancelCheckout = () => {
		handledTxRef.current = checkoutRef.current?.txRef ?? 'cancelled';
		checkoutRef.current = null;
		setCheckout(null);
		setTimeout(() => showFailure('Payment cancelled', 'You closed the checkout. No money was taken.'), 300);
	};

	const retry = () => {
		setResult(null);
		setTimeout(() => setReviewVisible(true), 260);
	};

	const existingTypes = new Set(wallets.map((wallet) => wallet.account_type));
	const alreadyHasType = existingTypes.has(newType);

	const createWallet = async () => {
		if (alreadyHasType || isCreating) return;
		setIsCreating(true);
		setCreateError(null);
		try {
			const wallet = await createWalletAccount({ account_type: newType, name: newName.trim() || undefined });
			setNewName('');
			await loadData('silent');
			setSelectedWalletId(wallet.id);
			setTab('fund');
			setResult({
				kind: 'success',
				title: 'Wallet created',
				message: `${wallet.name} is ready. Add money to start paying with it.`,
				details: [
					{ label: 'Type', value: `${themeFor(wallet.account_type).label} wallet` },
					{ label: 'Balance', value: formatMoney(wallet.balance) },
				],
			});
			notify(Haptics.NotificationFeedbackType.Success);
		} catch (error) {
			setCreateError(errorMessage(error, 'Could not create the wallet.'));
			notify(Haptics.NotificationFeedbackType.Error);
		} finally {
			setIsCreating(false);
		}
	};

	const onTabsLayout = (event: LayoutChangeEvent) => setTabsWidth(event.nativeEvent.layout.width);
	const indicatorWidth = tabsWidth > 0 ? (tabsWidth - 8) / 2 : 0;

	return (
		<View style={styles.container}>
			<AppBackground />
			<AppHeader />

			<KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
				<ScrollView
					contentContainerStyle={styles.scrollContent}
					showsVerticalScrollIndicator={false}
					keyboardShouldPersistTaps="handled"
					refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadData('refresh')} tintColor="#60A5FA" colors={['#60A5FA']} />}
				>
					{/* ---- Title + tabs ---- */}
					<View style={styles.titleRow}>
						<View>
							<Text style={styles.eyebrow}>WALLET</Text>
							<Text style={styles.title}>{tab === 'fund' ? 'Fund your wallet' : 'Create a wallet'}</Text>
						</View>
						<View style={styles.securePill}>
							<Feather name="shield" size={11} color="#4ADE80" />
							<Text style={styles.securePillText}>Secured</Text>
						</View>
					</View>

					<View style={styles.tabs} onLayout={onTabsLayout}>
						{indicatorWidth > 0 && (
							<Animated.View
								style={[
									styles.tabIndicator,
									{ width: indicatorWidth, transform: [{ translateX: tabX.interpolate({ inputRange: [0, 1], outputRange: [0, indicatorWidth] }) }] },
								]}
							/>
						)}
						{(['fund', 'create'] as const).map((key) => (
							<TouchableOpacity key={key} style={styles.tab} activeOpacity={0.85} onPress={() => setTab(key)} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}>
								<Feather name={key === 'fund' ? 'plus-circle' : 'layers'} size={14} color={tab === key ? '#FFFFFF' : '#94A3B8'} />
								<Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{key === 'fund' ? 'Fund wallet' : 'Create wallet'}</Text>
							</TouchableOpacity>
						))}
					</View>

					<Animated.View style={{ opacity: contentFade, transform: [{ translateY: contentFade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
						{isLoading ? (
							<WalletSkeleton />
						) : loadError ? (
							<View style={styles.stateCard}>
								<View style={styles.stateIcon}><Feather name="alert-circle" size={20} color="#FB7185" /></View>
								<Text style={styles.stateTitle}>Wallets unavailable</Text>
								<Text style={styles.stateText}>{loadError}</Text>
								<TouchableOpacity style={styles.ghostButton} activeOpacity={0.85} onPress={() => loadData('initial')}>
									<Text style={styles.ghostButtonText}>Try again</Text>
								</TouchableOpacity>
							</View>
						) : tab === 'fund' ? (
							<>
								{/* ---- Total balance ---- */}
								<LinearGradient colors={['#13233D', '#0B1524']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.totalCard}>
									<View>
										<Text style={styles.totalLabel}>Total balance</Text>
										<Text style={styles.totalValue}>{formatMoney(totalBalance)}</Text>
									</View>
									<View style={styles.totalMeta}>
										<Text style={styles.totalMetaValue}>{wallets.length}</Text>
										<Text style={styles.totalMetaLabel}>{wallets.length === 1 ? 'wallet' : 'wallets'}</Text>
									</View>
								</LinearGradient>

								{wallets.length === 0 ? (
									<View style={styles.stateCard}>
										<View style={styles.stateIcon}><Feather name="credit-card" size={20} color="#60A5FA" /></View>
										<Text style={styles.stateTitle}>No wallet yet</Text>
										<Text style={styles.stateText}>Create a wallet first, then come back to add money.</Text>
										<TouchableOpacity style={styles.ghostButton} activeOpacity={0.85} onPress={() => setTab('create')}>
											<Text style={styles.ghostButtonText}>Create a wallet</Text>
										</TouchableOpacity>
									</View>
								) : (
									<>
										{/* ---- Wallet selector ---- */}
										<View style={styles.sectionHeader}>
											<Text style={styles.sectionTitle}>Choose a wallet</Text>
											<Text style={styles.sectionHint}>Swipe</Text>
										</View>
										<ScrollView
											ref={walletScrollRef}
											horizontal
											showsHorizontalScrollIndicator={false}
											contentContainerStyle={styles.walletRow}
											style={styles.walletScroller}
											decelerationRate="fast"
											snapToInterval={262}
										>
											{wallets.map((wallet) => (
												<WalletCard key={wallet.id} wallet={wallet} selected={wallet.id === selectedWalletId} onPress={() => setSelectedWalletId(wallet.id)} />
											))}
										</ScrollView>

										{/* ---- Amount ---- */}
										<View style={styles.panel}>
											{selectedWallet && (
												<FundingTarget wallet={selectedWallet} onChange={() => walletScrollRef.current?.scrollTo({ x: 0, animated: true })} />
											)}
											<Text style={styles.panelLabel}>Amount to add</Text>
											<View style={styles.amountRow}>
												<Text style={[styles.amountCurrency, amount > 0 && styles.amountCurrencyActive]}>{currency.symbol}</Text>
												<TextInput
													value={amountText}
													onChangeText={(text) => setAmountText(sanitizeAmount(text))}
													placeholder="0.00"
													placeholderTextColor="#334155"
													keyboardType="decimal-pad"
													style={styles.amountInput}
													accessibilityLabel="Amount to add"
												/>
											</View>
											<View style={styles.quickRow}>
												{QUICK_AMOUNTS.map((value) => {
													const active = amount === value;
													return (
														<TouchableOpacity key={value} style={[styles.quickChip, active && styles.quickChipActive]} activeOpacity={0.85} onPress={() => setAmountText(String(value))}>
															<Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{formatMoney(value).replace('.00', '')}</Text>
														</TouchableOpacity>
													);
												})}
											</View>
										</View>

										{/* ---- Payment method ---- */}
										<View style={styles.panel}>
											<View style={styles.panelHeaderRow}>
												<Text style={styles.panelLabel}>Payment method</Text>
												<View style={styles.flwTag}><Text style={styles.flwTagText}>Flutterwave</Text></View>
											</View>
											<MethodRow
												selected={method.kind === 'new'}
												icon="credit-card"
												title="Pay with card"
												subtitle="Visa, Mastercard or Verve"
												badge={cards.length === 0 ? 'Secure' : undefined}
												onPress={() => setMethod({ kind: 'new' })}
											/>
											{cards.map((card) => {
												const expiry = cardExpiry(card);
												return (
													<MethodRow
														key={card.id}
														selected={method.kind === 'saved' && method.card.id === card.id}
														icon="zap"
														title={`${brandLabel(card.brand)} •••• ${card.last4}`}
														subtitle={expiry ? `Saved card · expires ${expiry}` : 'Saved card · instant charge'}
														badge={card.is_default ? 'Default' : undefined}
														onPress={() => setMethod({ kind: 'saved', card })}
													/>
												);
											})}
											{cards.length === 0 && (
												<Text style={styles.panelFootnote}>Cards you pay with are saved for one-tap top-ups next time.</Text>
											)}
										</View>

										{/* ---- Continue ---- */}
										<TouchableOpacity style={[styles.cta, !canContinue && styles.ctaDisabled]} activeOpacity={0.88} disabled={!canContinue} onPress={openReview}>
											<LinearGradient colors={['#2563EB', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaFill}>
												<Text style={styles.ctaText}>{amount > 0 ? `Continue · ${formatMoney(amount)}` : 'Enter an amount'}</Text>
												<Feather name="arrow-right" size={17} color="#FFFFFF" />
											</LinearGradient>
										</TouchableOpacity>
									</>
								)}
							</>
						) : (
							<>
								{/* ---- Create wallet ---- */}
								{(Object.keys(TYPE_THEME) as WalletType[]).map((type) => {
									const theme = TYPE_THEME[type];
									const selected = newType === type;
									const owned = existingTypes.has(type);
									return (
										<TouchableOpacity key={type} style={[styles.typeCard, selected && { borderColor: theme.tint }]} activeOpacity={0.88} onPress={() => { setNewType(type); setCreateError(null); }}>
											<View style={styles.typeHead}>
												<LinearGradient colors={theme.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.typeIcon}>
													<Feather name={theme.icon} size={18} color="#FFFFFF" />
												</LinearGradient>
												<View style={styles.typeCopy}>
													<View style={styles.typeTitleRow}>
														<Text style={styles.typeTitle}>{theme.label} wallet</Text>
														{owned && <View style={styles.ownedTag}><Text style={styles.ownedTagText}>Created</Text></View>}
													</View>
													<Text style={styles.typeDescription}>{theme.description}</Text>
												</View>
												<View style={[styles.radio, selected && { borderColor: theme.tint }]}>{selected && <View style={[styles.radioDot, { backgroundColor: theme.tint }]} />}</View>
											</View>
											{selected && (
												<View style={styles.perks}>
													{theme.perks.map((perk) => (
														<View key={perk} style={styles.perkRow}>
															<Feather name="check-circle" size={13} color={theme.tint} />
															<Text style={styles.perkText}>{perk}</Text>
														</View>
													))}
												</View>
											)}
										</TouchableOpacity>
									);
								})}

								<View style={styles.panel}>
									<Text style={styles.panelLabel}>{newType === 'team' ? 'Team wallet name' : 'Wallet name'}</Text>
									<View style={styles.nameField}>
										<Feather name="tag" size={15} color="#64748B" />
										<TextInput
											value={newName}
											onChangeText={(text) => { setNewName(text); setCreateError(null); }}
											placeholder={newType === 'team' ? 'Design Team Wallet' : `${TYPE_THEME[newType].label} Wallet`}
											placeholderTextColor="#475569"
											style={styles.nameInput}
											maxLength={60}
										/>
									</View>
									<Text style={styles.panelFootnote}>Optional. We name it for you if you leave this empty.</Text>
								</View>

								{alreadyHasType && (
									<View style={styles.noticeInfo}>
										<Feather name="info" size={14} color="#93C5FD" />
										<Text style={styles.noticeInfoText}>You already have a {TYPE_THEME[newType].label.toLowerCase()} wallet. Each account can hold one of each type.</Text>
									</View>
								)}
								{createError && (
									<View style={styles.noticeError}>
										<Feather name="alert-circle" size={14} color="#FB7185" />
										<Text style={styles.noticeErrorText}>{createError}</Text>
									</View>
								)}

								<TouchableOpacity style={[styles.cta, (alreadyHasType || isCreating) && styles.ctaDisabled]} activeOpacity={0.88} disabled={alreadyHasType || isCreating} onPress={createWallet}>
									<LinearGradient colors={TYPE_THEME[newType].colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaFill}>
										{isCreating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Feather name={alreadyHasType ? 'check' : 'plus'} size={17} color="#FFFFFF" />}
										<Text style={styles.ctaText}>
											{isCreating ? 'Creating wallet…' : alreadyHasType ? 'Already created' : `Create ${TYPE_THEME[newType].label.toLowerCase()} wallet`}
										</Text>
									</LinearGradient>
								</TouchableOpacity>
							</>
						)}
					</Animated.View>
				</ScrollView>
			</KeyboardAvoidingView>

			{/* ---- Review / pay sheet ---- */}
			<BottomSheet visible={reviewVisible} onClose={() => { if (!isPaying) setReviewVisible(false); }}>
				<View style={styles.sheetBody}>
					<View style={styles.sheetTitleRow}>
						<Text style={styles.sheetTitle}>Confirm top-up</Text>
						<TouchableOpacity style={styles.iconButton} activeOpacity={0.8} onPress={() => { if (!isPaying) setReviewVisible(false); }} accessibilityLabel="Close">
							<Feather name="x" size={18} color="#E2E8F0" />
						</TouchableOpacity>
					</View>

					<LinearGradient colors={selectedWallet ? themeFor(selectedWallet.account_type).colors : ['#1E3A8A', '#2563EB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.reviewHero}>
						<View style={styles.walletOrbLarge} />
						<Text style={styles.reviewHeroLabel}>You're adding</Text>
						<Text style={styles.reviewHeroAmount} numberOfLines={1} adjustsFontSizeToFit>{formatMoney(amount)}</Text>
						<Text style={styles.reviewHeroWallet}>to {selectedWallet?.name ?? 'your wallet'}</Text>
					</LinearGradient>

					<View style={styles.reviewRows}>
						<View style={styles.reviewRow}>
							<Text style={styles.reviewRowLabel}>Wallet</Text>
							<Text style={styles.reviewRowValue} numberOfLines={1}>{selectedWallet ? `${themeFor(selectedWallet.account_type).label} · ${selectedWallet.name}` : '—'}</Text>
						</View>
						<View style={styles.reviewRow}>
							<Text style={styles.reviewRowLabel}>Pay with</Text>
							<Text style={styles.reviewRowValue} numberOfLines={1}>{methodLabel}</Text>
						</View>
						<View style={styles.reviewRow}>
							<Text style={styles.reviewRowLabel}>Current balance</Text>
							<Text style={styles.reviewRowValue}>{formatMoney(selectedWallet?.balance)}</Text>
						</View>
						<View style={[styles.reviewRow, styles.reviewRowLast]}>
							<Text style={[styles.reviewRowLabel, styles.reviewRowStrong]}>Balance after top-up</Text>
							<Text style={[styles.reviewRowValue, styles.reviewRowTotal]}>{formatMoney((Number(selectedWallet?.balance) || 0) + amount)}</Text>
						</View>
					</View>

					<View style={styles.secureNote}>
						<Feather name="lock" size={13} color="#4ADE80" />
						<Text style={styles.secureNoteText}>
							{method.kind === 'saved'
								? 'Your saved card is charged instantly through Flutterwave.'
								: 'You will enter card details on Flutterwave’s secure checkout. Apsuni never sees your card number.'}
						</Text>
					</View>

					<TouchableOpacity style={[styles.cta, isPaying && styles.ctaBusy]} activeOpacity={0.88} disabled={isPaying} onPress={pay}>
						<LinearGradient colors={['#16A34A', '#22C55E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaFill}>
							{isPaying ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Feather name="lock" size={16} color="#FFFFFF" />}
							<Text style={styles.ctaText}>
								{isPaying ? (method.kind === 'saved' ? 'Charging your card…' : 'Opening secure checkout…') : `Pay ${formatMoney(amount)}`}
							</Text>
						</LinearGradient>
					</TouchableOpacity>
				</View>
			</BottomSheet>

			{/* ---- In-app Flutterwave checkout ---- */}
			<BottomSheet visible={!!checkout} onClose={cancelCheckout} tall>
				<View style={styles.checkoutHeader}>
					<View style={styles.checkoutBrand}>
						<View style={styles.checkoutLock}><Feather name="lock" size={13} color="#4ADE80" /></View>
						<View>
							<Text style={styles.checkoutTitle}>Secure checkout</Text>
							<Text style={styles.checkoutSubtitle}>Powered by Flutterwave · {formatMoney(amount)}</Text>
						</View>
					</View>
					<TouchableOpacity style={styles.iconButton} activeOpacity={0.8} onPress={cancelCheckout} accessibilityLabel="Cancel payment">
						<Feather name="x" size={18} color="#E2E8F0" />
					</TouchableOpacity>
				</View>
				{checkout ? <CheckoutWebView url={checkout.url} onIntercept={onCheckoutNavigate} /> : <View style={styles.checkoutBody} />}
			</BottomSheet>

			<ResultModal result={result} onClose={() => setResult(null)} onRetry={retry} />
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: 'transparent' },
	flex: { flex: 1 },
	scrollContent: { paddingHorizontal: 18, paddingBottom: 48 },

	titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 },
	eyebrow: { fontSize: 10, fontWeight: '800', color: '#60A5FA', letterSpacing: 1.6 },
	title: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 4, letterSpacing: -0.4 },
	securePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(22, 163, 74, 0.12)', borderWidth: 1, borderColor: 'rgba(74, 222, 128, 0.22)' },
	securePillText: { fontSize: 11, fontWeight: '700', color: '#86EFAC' },

	tabs: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: 'rgba(13, 21, 35, 0.92)', borderWidth: 1, borderColor: '#1E2B3F', marginBottom: 18 },
	tabIndicator: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 12, backgroundColor: '#2563EB' },
	tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11 },
	tabText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
	tabTextActive: { color: '#FFFFFF', fontWeight: '700' },

	totalCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 16, borderWidth: 1, borderColor: '#1F3252', marginBottom: 20 },
	totalLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 },
	totalValue: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 4, letterSpacing: -0.3 },
	totalMeta: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(148, 163, 184, 0.08)' },
	totalMetaValue: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
	totalMetaLabel: { fontSize: 10, fontWeight: '600', color: '#64748B', marginTop: 1 },

	sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
	sectionTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
	sectionHint: { fontSize: 11, fontWeight: '600', color: '#475569' },

	walletScroller: { marginHorizontal: -18 },
	walletRow: { paddingHorizontal: 14, gap: 4, paddingVertical: 4 },
	walletCard: { width: 258, height: 158, borderRadius: 22, padding: 16, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
	walletCardSelected: { borderColor: 'rgba(255, 255, 255, 0.55)' },
	walletOrbLarge: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -60, top: -80, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
	walletOrbSmall: { position: 'absolute', width: 110, height: 110, borderRadius: 55, right: 30, bottom: -60, backgroundColor: 'rgba(255, 255, 255, 0.06)' },
	walletCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	walletTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.16)' },
	walletTypeText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.9 },
	walletCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: 'rgba(255, 255, 255, 0.5)', alignItems: 'center', justifyContent: 'center' },
	walletCheckOn: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
	walletBalanceLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255, 255, 255, 0.72)', marginTop: 16 },
	walletBalance: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginTop: 2, letterSpacing: -0.4 },
	walletCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', gap: 10 },
	walletName: { flex: 1, fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
	walletMeta: { fontSize: 11, fontWeight: '600', color: 'rgba(255, 255, 255, 0.72)' },

	panel: { marginTop: 16, padding: 16, borderRadius: 20, backgroundColor: 'rgba(13, 21, 35, 0.94)', borderWidth: 1, borderColor: '#1E2B3F' },
	panelHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	panelLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 },
	panelFootnote: { fontSize: 11, color: '#475569', marginTop: 10, lineHeight: 16 },

	amountRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1A2638' },
	amountCurrency: { fontSize: 30, fontWeight: '800', color: '#334155', marginRight: 6 },
	amountCurrencyActive: { color: '#60A5FA' },
	amountInput: { flex: 1, fontSize: 36, fontWeight: '800', color: '#FFFFFF', paddingVertical: 4, letterSpacing: -0.6 },
	quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
	quickChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 12, backgroundColor: '#101A2A', borderWidth: 1, borderColor: '#1E2B3F' },
	quickChipActive: { backgroundColor: 'rgba(37, 99, 235, 0.2)', borderColor: '#3B82F6' },
	quickChipText: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
	quickChipTextActive: { color: '#BFDBFE' },

	flwTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(245, 158, 11, 0.12)' },
	flwTagText: { fontSize: 10, fontWeight: '700', color: '#FCD34D' },

	methodRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, padding: 12, borderRadius: 16, backgroundColor: '#0E1726', borderWidth: 1, borderColor: '#1A2638' },
	methodRowSelected: { borderColor: '#3B82F6', backgroundColor: 'rgba(37, 99, 235, 0.08)' },
	methodIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(37, 99, 235, 0.14)' },
	methodIconSelected: { backgroundColor: '#2563EB' },
	methodCopy: { flex: 1, minWidth: 0 },
	methodTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	methodTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', flexShrink: 1 },
	methodBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(74, 222, 128, 0.14)' },
	methodBadgeText: { fontSize: 9, fontWeight: '800', color: '#86EFAC', letterSpacing: 0.4 },
	methodSubtitle: { fontSize: 12, color: '#64748B', marginTop: 3 },
	radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' },
	radioOn: { borderColor: '#3B82F6' },
	radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#3B82F6' },

	cta: { marginTop: 20, borderRadius: 16, overflow: 'hidden' },
	ctaDisabled: { opacity: 0.4 },
	ctaBusy: { opacity: 0.85 },
	ctaFill: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
	ctaText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },

	typeCard: { marginBottom: 12, padding: 16, borderRadius: 20, backgroundColor: 'rgba(13, 21, 35, 0.94)', borderWidth: 1.5, borderColor: '#1E2B3F' },
	typeHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
	typeIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
	typeCopy: { flex: 1, minWidth: 0 },
	typeTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	typeTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
	typeDescription: { fontSize: 12, color: '#94A3B8', marginTop: 3, lineHeight: 17 },
	ownedTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(148, 163, 184, 0.14)' },
	ownedTagText: { fontSize: 9, fontWeight: '800', color: '#CBD5E1', letterSpacing: 0.4 },
	perks: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1A2638', gap: 8 },
	perkRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
	perkText: { fontSize: 12.5, color: '#CBD5E1' },

	nameField: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, height: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#0E1726', borderWidth: 1, borderColor: '#1A2638' },
	nameInput: { flex: 1, fontSize: 14, color: '#FFFFFF', paddingVertical: 0 },

	noticeInfo: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: 'rgba(37, 99, 235, 0.1)', borderWidth: 1, borderColor: 'rgba(96, 165, 250, 0.2)' },
	noticeInfoText: { flex: 1, fontSize: 12, color: '#BFDBFE', lineHeight: 17 },
	noticeError: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: 'rgba(225, 29, 72, 0.1)', borderWidth: 1, borderColor: 'rgba(251, 113, 133, 0.22)' },
	noticeErrorText: { flex: 1, fontSize: 12, color: '#FECDD3', lineHeight: 17 },

	stateCard: { alignItems: 'center', gap: 10, paddingVertical: 34, paddingHorizontal: 20, borderRadius: 20, backgroundColor: 'rgba(13, 21, 35, 0.94)', borderWidth: 1, borderColor: '#1E2B3F' },
	stateIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(148, 163, 184, 0.1)' },
	stateTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
	stateText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19 },
	ghostButton: { marginTop: 4, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(37, 99, 235, 0.16)', borderWidth: 1, borderColor: 'rgba(96, 165, 250, 0.3)' },
	ghostButtonText: { fontSize: 13, fontWeight: '700', color: '#60A5FA' },

	skeleton: { borderRadius: 18, backgroundColor: '#152034' },
	skeletonRow: { flexDirection: 'row', gap: 12 },

	/* Sheets */
	sheetRoot: { flex: 1, justifyContent: 'flex-end' },
	backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2, 6, 14, 0.78)' },
	sheet: { backgroundColor: '#0A111D', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: '#1E2B3F', overflow: 'hidden' },
	sheetTall: { height: SCREEN_HEIGHT * 0.93 },
	sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#2A3A52', marginTop: 10 },
	sheetBody: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 30 },
	sheetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
	sheetTitle: { fontSize: 19, fontWeight: '800', color: '#FFFFFF' },
	iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(148, 163, 184, 0.12)' },

	reviewHero: { borderRadius: 22, padding: 20, overflow: 'hidden' },
	reviewHeroLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255, 255, 255, 0.75)' },
	reviewHeroAmount: { fontSize: 34, fontWeight: '800', color: '#FFFFFF', marginTop: 4, letterSpacing: -0.6 },
	reviewHeroWallet: { fontSize: 13, fontWeight: '600', color: 'rgba(255, 255, 255, 0.85)', marginTop: 4 },

	reviewRows: { marginTop: 16, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#0E1726', borderWidth: 1, borderColor: '#1A2638' },
	reviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#162234' },
	reviewRowLast: { borderBottomWidth: 0 },
	reviewRowLabel: { fontSize: 13, color: '#94A3B8' },
	reviewRowStrong: { color: '#FFFFFF', fontWeight: '700' },
	reviewRowValue: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', flexShrink: 1, textAlign: 'right' },
	reviewRowTotal: { fontSize: 15, color: '#4ADE80' },

	secureNote: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14, paddingHorizontal: 4 },
	secureNoteText: { flex: 1, fontSize: 11.5, color: '#64748B', lineHeight: 17 },

	checkoutHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12 },
	checkoutBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
	checkoutLock: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(22, 163, 74, 0.14)' },
	checkoutTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
	checkoutSubtitle: { fontSize: 11, color: '#64748B', marginTop: 2 },
	checkoutProgressTrack: { height: 2, backgroundColor: '#152034' },
	checkoutProgressFill: { height: '100%', backgroundColor: '#22C55E' },
	checkoutBody: { flex: 1, backgroundColor: '#FFFFFF' },
	checkoutWebView: { flex: 1, backgroundColor: '#FFFFFF' },
	checkoutLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32, backgroundColor: '#0A111D' },
	checkoutLoadingTitle: { fontSize: 14, fontWeight: '700', color: '#E2E8F0', marginTop: 4 },
	checkoutLoadingText: { fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },
	checkoutErrorIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(244, 63, 94, 0.12)' },

	fundingTarget: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1, backgroundColor: 'rgba(8, 14, 25, 0.7)', overflow: 'hidden', marginBottom: 16 },
	fundingTargetIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
	fundingTargetCopy: { flex: 1 },
	fundingTargetEyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
	fundingTargetName: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
	fundingTargetMeta: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
	fundingTargetChange: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(148, 163, 184, 0.12)' },

	/* Result popup */
	resultRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
	resultCard: { width: '100%', maxWidth: 380, alignItems: 'center', paddingHorizontal: 22, paddingTop: 30, paddingBottom: 22, borderRadius: 28, backgroundColor: '#0C1523', borderWidth: 1, borderColor: '#1E2B3F' },
	resultIconWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
	resultRing: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 3 },
	spinnerRing: { position: 'absolute', width: 92, height: 92, borderRadius: 46, borderWidth: 3, borderColor: 'rgba(59, 130, 246, 0.15)', borderTopColor: '#3B82F6' },
	resultIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
	resultTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
	resultAmount: { fontSize: 32, fontWeight: '800', color: '#4ADE80', marginTop: 8, letterSpacing: -0.5 },
	resultMessage: { fontSize: 13.5, color: '#94A3B8', textAlign: 'center', lineHeight: 20, marginTop: 8 },
	resultDetails: { alignSelf: 'stretch', marginTop: 18, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#0E1726', borderWidth: 1, borderColor: '#1A2638' },
	resultDetailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#162234' },
	resultDetailRowLast: { borderBottomWidth: 0 },
	resultDetailLabel: { fontSize: 12, color: '#64748B' },
	resultDetailValue: { fontSize: 12, fontWeight: '700', color: '#E2E8F0', flexShrink: 1, textAlign: 'right' },
	resultActions: { alignSelf: 'stretch', flexDirection: 'row', gap: 10, marginTop: 22 },
	resultActionFlex: { flex: 1, marginTop: 0 },
	resultPrimary: { alignSelf: 'stretch', marginTop: 22, borderRadius: 14, overflow: 'hidden' },
	resultPrimaryFill: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
	resultPrimaryText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
	resultSecondary: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(148, 163, 184, 0.12)' },
	resultSecondaryText: { fontSize: 15, fontWeight: '700', color: '#CBD5E1' },
	processingNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 },
	processingNoteText: { fontSize: 11, color: '#64748B' },
});
