import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
	ActivityIndicator,
	Image,
	NativeScrollEvent,
	NativeSyntheticEvent,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import AppBackground from '../../components/AppBackground';
import AppHeader from '../../components/AppHeader';
import { useAppAlert } from '../../components/AppAlert';
import {
	cancelOrder,
	getAccessToken,
	getApiAssetUrl,
	listCustomerOrders,
	type CustomerOrder,
	type CustomerOrderProduct,
} from '../../services/api';
import { formatMoney, useCurrency } from '../../services/currency';

type OrderTab = 'Completed' | 'Pending' | 'Cancel';
type SortMode = 'newest' | 'oldest' | 'highest';

const ORDERS_PER_LOAD = 5;
const TABS: OrderTab[] = ['Completed', 'Pending', 'Cancel'];
const SORT_LABELS: Record<SortMode, string> = { newest: 'Newest', oldest: 'Oldest', highest: 'Highest total' };

function normalizeStatus(rawStatus: string): OrderTab {
	const value = rawStatus.trim().toLowerCase();
	if (value.includes('cancel')) return 'Cancel';
	if (value.includes('pending') || value.includes('process')) return 'Pending';
	return 'Completed';
}

function titleCase(value?: string | null) {
	if (!value) return 'Not set';
	return value.charAt(0).toUpperCase() + value.slice(1);
}


function formatShortDate(value?: string | null) {
	if (!value) return 'No date';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return 'No date';
	return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(value?: string | null) {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	const diff = Date.now() - date.getTime();
	if (diff < 0) return 'Scheduled';
	const minutes = Math.floor(diff / 60000);
	if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	return `${Math.floor(days / 30)}mo ago`;
}

function orderItemCount(order: CustomerOrder) {
	const products = order.products ?? [];
	if (products.length === 0) return Number(order.quantity ?? 1);
	return products.reduce((total, product) => total + Number(product.qty ?? 1), 0);
}

function productThumb(product?: CustomerOrderProduct | null, order?: CustomerOrder) {
	const source = product?.product_image || product?.product_company_logo || order?.company_logo;
	if (!source) return null;
	return getApiAssetUrl(source) ?? source;
}

function StatTile({ icon, label, value, tone }: { icon: keyof typeof Feather.glyphMap; label: string; value: string; tone: string }) {
	return (
		<View style={styles.statTile}>
			<View style={[styles.statIcon, { backgroundColor: `${tone}22` }]}>
				<Feather name={icon} size={13} color={tone} />
			</View>
			<Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
			<Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
		</View>
	);
}

export default function OrderHistoryScreen() {
	useCurrency(); // re-render prices if the user's currency changes
	const router = useRouter();
	const { showAlert } = useAppAlert();

	const [activeTab, setActiveTab] = useState<OrderTab>('Completed');
	const [searchQuery, setSearchQuery] = useState('');
	const [sortMode, setSortMode] = useState<SortMode>('newest');
	const [sortVisible, setSortVisible] = useState(false);
	const [visibleOrderCount, setVisibleOrderCount] = useState(ORDERS_PER_LOAD);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const scrollViewportHeight = React.useRef(0);
	const [orders, setOrders] = useState<CustomerOrder[]>([]);
	const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
	const [cancellingId, setCancellingId] = useState<number | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const loadOrders = useCallback(async (mode: 'initial' | 'refresh') => {
		if (!getAccessToken()) {
			setError('Please sign in to view your orders.');
			setIsLoading(false);
			setIsRefreshing(false);
			return;
		}

		if (mode === 'refresh') setIsRefreshing(true);
		else setIsLoading(true);
		if (mode === 'refresh') setVisibleOrderCount(ORDERS_PER_LOAD);
		setError(null);

		try {
			const response = await listCustomerOrders();
			setOrders(response.orders ?? []);
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Unable to load orders.');
		} finally {
			setIsLoading(false);
			setIsRefreshing(false);
		}
	}, []);

	useEffect(() => {
		loadOrders('initial');
	}, [loadOrders]);

	useEffect(() => {
		setVisibleOrderCount(ORDERS_PER_LOAD);
	}, [activeTab, searchQuery, sortMode]);

	const tabCounts = useMemo(() => {
		const counts: Record<OrderTab, number> = { Completed: 0, Pending: 0, Cancel: 0 };
		orders.forEach((order) => { counts[normalizeStatus(order.product_status || '')] += 1; });
		return counts;
	}, [orders]);

	const stats = useMemo(() => {
		const spent = orders.reduce((total, order) => total + Number(order.total_price ?? 0), 0);
		const items = orders.reduce((total, order) => total + orderItemCount(order), 0);
		return { spent, items, total: orders.length };
	}, [orders]);

	const recentOrders = useMemo(
		() => [...orders]
			.sort((a, b) => new Date(b.order_date || 0).getTime() - new Date(a.order_date || 0).getTime())
			.slice(0, 10),
		[orders],
	);

	const filteredOrders = useMemo(() => {
		const query = searchQuery.trim().toLowerCase();

		const matching = orders.filter((order) => {
			if (normalizeStatus(order.product_status || '') !== activeTab) return false;
			if (!query) return true;
			const haystack = [
				String(order.id),
				order.sku ?? '',
				order.name ?? '',
				order.product_status ?? '',
				order.payment_type ?? '',
				...(order.products ?? []).map((product) => product.product_name ?? ''),
			];
			return haystack.some((value) => value.toLowerCase().includes(query));
		});

		return matching.sort((a, b) => {
			if (sortMode === 'highest') return Number(b.total_price ?? 0) - Number(a.total_price ?? 0);
			const left = new Date(a.order_date || 0).getTime();
			const right = new Date(b.order_date || 0).getTime();
			return sortMode === 'oldest' ? left - right : right - left;
		});
	}, [orders, activeTab, searchQuery, sortMode]);

	const visibleOrders = filteredOrders.slice(0, visibleOrderCount);
	const hasMoreOrders = visibleOrderCount < filteredOrders.length;

	const changeTab = (tab: OrderTab) => setActiveTab(tab);
	const updateSearch = (value: string) => setSearchQuery(value);
	const updateSort = (mode: SortMode) => { setSortMode(mode); setSortVisible(false); };
	const loadMoreOrders = async () => {
		if (isLoadingMore || !hasMoreOrders) return;
		setIsLoadingMore(true);
		await new Promise<void>((resolve) => setTimeout(resolve, 450));
		setVisibleOrderCount((count) => Math.min(count + ORDERS_PER_LOAD, filteredOrders.length));
		setIsLoadingMore(false);
	};
	const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
		const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
		const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
		if (distanceFromBottom < 240) loadMoreOrders();
	};
	const handleContentSizeChange = (_contentWidth: number, contentHeight: number) => {
		if (scrollViewportHeight.current > 0 && contentHeight <= scrollViewportHeight.current + 240) loadMoreOrders();
	};

	const openOrder = (order: CustomerOrder) => {
		router.push({
			pathname: '/Screen/Order-Screen/OrderDetailsScreen',
			params: {
				orderId: String(order.id),
				sku: order.sku ?? '',
				email: order.email ?? '',
				buyerName: order.buyer_name ?? '',
				totalPrice: order.total_price ?? '',
				productStatus: order.product_status ?? '',
				paymentStatus: order.payment_status ?? '',
				paymentType: order.payment_type ?? '',
				orderDate: order.order_date ?? '',
			},
		});
	};

	const requestCancel = async (order: CustomerOrder) => {
		setCancellingId(order.id);
		try {
			const result = await cancelOrder(order.id);
			showAlert(result.detail || `Order #${order.id} was cancelled.`);
			await loadOrders('refresh');
		} catch (cancelError) {
			showAlert(cancelError instanceof Error ? cancelError.message : 'Could not cancel this order.');
		} finally {
			setCancellingId(null);
		}
	};

	return (
		<View style={styles.container}>
			<AppBackground />
			<AppHeader />

			<ScrollView
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				onLayout={(event) => { scrollViewportHeight.current = event.nativeEvent.layout.height; }}
				onContentSizeChange={handleContentSizeChange}
				onScroll={handleScroll}
				onMomentumScrollEnd={handleScroll}
				scrollEventThrottle={160}
				refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadOrders('refresh')} tintColor="#60A5FA" colors={['#60A5FA']} />}
			>
				{/* --- INTRO --- */}
				<View style={styles.introRow}>
					<View style={styles.introIcon}><Feather name="shopping-bag" size={18} color="#60A5FA" /></View>
					<View style={styles.introCopy}>
						<Text style={styles.introSubtitle}>{stats.total} orders · {stats.items} items purchased</Text>
					</View>
					<View style={styles.introMetric}>
						<Text style={styles.introMetricValue}>{tabCounts.Completed}</Text>
						<Text style={styles.introMetricLabel}>complete</Text>
					</View>
				</View>

				{/* --- SUMMARY STATS --- */}
				{/* <View style={styles.statRow}>
					<StatTile icon="credit-card" label="Spent" value={formatMoney(stats.spent)} tone="#4ADE80" />
					<StatTile icon="package" label="Items" value={String(stats.items)} tone="#FBBF24" />
					<StatTile icon="clock" label="Pending" value={String(tabCounts.Pending)} tone="#FB7185" />
					<StatTile icon="x-octagon" label="Cancelled" value={String(tabCounts.Cancel)} tone="#94A3B8" />
				</View> */}

				{/* --- TABS --- */}
				<View style={styles.segmentRow}>
					{TABS.map((tab) => (
						<TouchableOpacity key={tab} style={[styles.segmentTab, activeTab === tab && styles.segmentTabActive]} onPress={() => changeTab(tab)} activeOpacity={0.8}>
							<Text style={[styles.segmentText, activeTab === tab && styles.segmentTextActive]}>{tab}</Text>
							<View style={[styles.segmentCount, activeTab === tab && styles.segmentCountActive]}>
								<Text style={[styles.segmentCountText, activeTab === tab && styles.segmentCountTextActive]}>{tabCounts[tab]}</Text>
							</View>
						</TouchableOpacity>
					))}
				</View>

				{/* --- SEARCH + SORT --- */}
				<View style={styles.toolbarRow}>
					<View style={styles.searchContainer}>
						<Feather name="search" size={16} color="#64748B" />
						<TextInput
							value={searchQuery}
							onChangeText={updateSearch}
							placeholder="Search order, SKU or product"
							placeholderTextColor="#64748B"
							style={styles.searchInput}
							autoCapitalize="none"
							returnKeyType="search"
						/>
						{searchQuery.length > 0 && (
							<TouchableOpacity onPress={() => updateSearch('')} activeOpacity={0.7} accessibilityLabel="Clear order search">
								<Feather name="x-circle" size={16} color="#94A3B8" />
							</TouchableOpacity>
						)}
					</View>

					<View style={styles.sortControl}>
						<TouchableOpacity
							style={[styles.sortButton, sortMode !== 'newest' && styles.sortButtonActive]}
							activeOpacity={0.8}
							onPress={() => setSortVisible((visible) => !visible)}
							accessibilityLabel="Sort orders"
						>
							<Feather name="sliders" size={17} color={sortMode === 'newest' ? '#94A3B8' : '#FFFFFF'} />
						</TouchableOpacity>
						{sortVisible && (
							<View style={styles.sortMenu}>
								{(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
									<TouchableOpacity key={mode} style={[styles.sortOption, sortMode === mode && styles.sortOptionActive]} onPress={() => updateSort(mode)}>
										<Text style={styles.sortOptionText}>{SORT_LABELS[mode]}</Text>
										{sortMode === mode && <Feather name="check" size={14} color="#60A5FA" />}
									</TouchableOpacity>
								))}
							</View>
						)}
					</View>
				</View>

				<View style={styles.resultRow}>
					<Text style={styles.resultText}>
						{filteredOrders.length} {activeTab.toLowerCase()} {filteredOrders.length === 1 ? 'order' : 'orders'}
					</Text>
					<Text style={styles.resultText}>Sorted by {SORT_LABELS[sortMode].toLowerCase()}</Text>
				</View>

				{/* --- ORDER LIST --- */}
				{isLoading ? (
					<View style={styles.stateContainer}><ActivityIndicator size="large" color="#38BDF8" /></View>
				) : error ? (
					<View style={styles.stateContainer}>
						<Feather name="alert-circle" size={22} color="#FB7185" />
						<Text style={styles.stateText}>{error}</Text>
						<TouchableOpacity style={styles.retryButton} activeOpacity={0.85} onPress={() => loadOrders('refresh')}>
							<Text style={styles.retryText}>Try again</Text>
						</TouchableOpacity>
					</View>
				) : visibleOrders.length === 0 ? (
					<View style={styles.stateContainer}>
						<Feather name="inbox" size={22} color="#475569" />
						<Text style={styles.stateText}>
							{searchQuery.trim() ? 'No matching orders found.' : `No ${activeTab.toLowerCase()} orders yet.`}
						</Text>
					</View>
				) : visibleOrders.map((order) => {
					const status = normalizeStatus(order.product_status || '');
					const products = order.products ?? [];
					const expanded = expandedOrderId === order.id;
					const visibleProducts = expanded ? products : products.slice(0, 2);
					const hiddenCount = products.length - visibleProducts.length;
					const paid = (order.payment_status || '').toLowerCase() === 'completed' || !!order.paid_status;
					const itemCount = orderItemCount(order);

					return (
						<View key={order.id} style={styles.orderCard}>
							{/* Card header */}
							<TouchableOpacity style={styles.orderHeader} activeOpacity={0.8} onPress={() => openOrder(order)}>
								<View style={styles.orderHeaderLeft}>
									<Text style={styles.orderId}>Order #{order.id}</Text>
									<View style={styles.orderMetaRow}>
										<Feather name="calendar" size={11} color="#64748B" />
										<Text style={styles.orderMetaText}>{formatShortDate(order.order_date)}</Text>
										<Text style={styles.orderMetaDot}>·</Text>
										<Text style={styles.orderMetaText}>{timeAgo(order.order_date)}</Text>
									</View>
								</View>
								<View style={[styles.statusBadge, status === 'Pending' && styles.statusPending, status === 'Cancel' && styles.statusCancel]}>
									<Text style={[styles.statusBadgeText, status === 'Pending' && styles.statusTextPending, status === 'Cancel' && styles.statusTextCancel]}>
										{titleCase(order.product_status)}
									</Text>
								</View>
							</TouchableOpacity>

							{/* Meta chips */}
							<View style={styles.chipRow}>
								<View style={styles.chip}>
									<Feather name="hash" size={11} color="#94A3B8" />
									<Text style={styles.chipText}>{order.sku || 'No SKU'}</Text>
								</View>
								<View style={[styles.chip, paid && styles.chipPaid]}>
									<Feather name={paid ? 'check-circle' : 'clock'} size={11} color={paid ? '#4ADE80' : '#FBBF24'} />
									<Text style={[styles.chipText, paid ? styles.chipTextPaid : styles.chipTextPending]}>
										{paid ? 'Paid' : titleCase(order.payment_status)}
									</Text>
								</View>
								<View style={styles.chip}>
									<Feather name="credit-card" size={11} color="#94A3B8" />
									<Text style={styles.chipText}>{titleCase(order.payment_type)}</Text>
								</View>
								<View style={styles.chip}>
									<Feather name="package" size={11} color="#94A3B8" />
									<Text style={styles.chipText}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
								</View>
							</View>

							<View style={styles.cardDivider} />

							{/* Product lines */}
							{visibleProducts.length === 0 ? (
								<Text style={styles.emptyLineText}>{order.name || 'No product details on this order.'}</Text>
							) : visibleProducts.map((product) => {
								const thumb = productThumb(product, order);
								return (
									<TouchableOpacity key={product.id} style={styles.productRow} activeOpacity={0.8} onPress={() => openOrder(order)}>
										<View style={styles.productImageContainer}>
											{thumb ? (
												<Image source={{ uri: thumb }} style={styles.productImage} resizeMode="contain" />
											) : (
												<Feather name="image" size={18} color="#64748B" />
											)}
										</View>
										<View style={styles.productBody}>
											<Text style={styles.productName} numberOfLines={2}>{product.product_name}</Text>
											<View style={styles.productMetaRow}>
												<Text style={styles.productCompany} numberOfLines={1}>{product.company_name || 'Apsuni'}</Text>
												<Text style={styles.orderMetaDot}>·</Text>
												<Text style={styles.productQty}>{product.qty ?? 1} × {formatMoney(product.price)}</Text>
											</View>
										</View>
										<Text style={styles.productTotal}>{formatMoney(product.total ?? product.total_product_price)}</Text>
									</TouchableOpacity>
								);
							})}

							{hiddenCount > 0 && (
								<TouchableOpacity style={styles.showMoreRow} activeOpacity={0.75} onPress={() => setExpandedOrderId(order.id)}>
									<Feather name="chevron-down" size={14} color="#60A5FA" />
									<Text style={styles.showMoreText}>Show {hiddenCount} more {hiddenCount === 1 ? 'product' : 'products'}</Text>
								</TouchableOpacity>
							)}
							{expanded && products.length > 2 && (
								<TouchableOpacity style={styles.showMoreRow} activeOpacity={0.75} onPress={() => setExpandedOrderId(null)}>
									<Feather name="chevron-up" size={14} color="#60A5FA" />
									<Text style={styles.showMoreText}>Show less</Text>
								</TouchableOpacity>
							)}

							<View style={styles.cardDivider} />

							{/* Footer: total + actions */}
							<View style={styles.orderFooter}>
								<View>
									<Text style={styles.totalLabel}>Order total</Text>
									<Text style={styles.totalValue}>{formatMoney(order.total_price)}</Text>
								</View>
								<View style={styles.footerActions}>
									{status === 'Pending' && (
										<TouchableOpacity
											style={[styles.footerButton, styles.cancelButton]}
											activeOpacity={0.85}
											disabled={cancellingId === order.id}
											onPress={() => requestCancel(order)}
										>
											{cancellingId === order.id ? (
												<ActivityIndicator size="small" color="#FB7185" />
											) : (
												<>
													<Feather name="x-circle" size={14} color="#FB7185" />
													<Text style={styles.cancelButtonText}>Cancel</Text>
												</>
											)}
										</TouchableOpacity>
									)}
									<TouchableOpacity style={[styles.footerButton, styles.detailsButton]} activeOpacity={0.85} onPress={() => openOrder(order)}>
										<Text style={styles.detailsButtonText}>View details</Text>
										<Feather name="arrow-up-right" size={14} color="#FFFFFF" />
									</TouchableOpacity>
								</View>
							</View>
						</View>
					);
				})}

				{hasMoreOrders && isLoadingMore && !isLoading && !error && (
					<View style={styles.loadMoreState}>
						<ActivityIndicator size="small" color="#60A5FA" />
						<Text style={styles.loadMoreText}>Loading more orders...</Text>
					</View>
				)}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: 'transparent' },
	scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

	introRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111A28', borderRadius: 16, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#24334A' },
	introIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#172B4D' },
	introCopy: { flex: 1, marginLeft: 11, minWidth: 0 },
	introTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
	introSubtitle: { color: '#94A3B8', fontSize: 11, marginTop: 3 },
	introMetric: { alignItems: 'flex-end', marginLeft: 8 },
	introMetricValue: { color: '#4ADE80', fontSize: 19, fontWeight: '800' },
	introMetricLabel: { color: '#64748B', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', marginTop: 1 },

	statRow: { flexDirection: 'row', gap: 7, marginBottom: 14 },
	statTile: { flex: 1, backgroundColor: '#111A28', borderRadius: 13, borderWidth: 1, borderColor: '#24334A', paddingVertical: 9, paddingHorizontal: 7 },
	statIcon: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
	statValue: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
	statLabel: { fontSize: 9, fontWeight: '700', color: '#64748B', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },

	recentSection: { marginBottom: 14 },
	recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
	recentTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	recentTitle: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
	recentCount: { fontSize: 11, color: '#64748B', fontWeight: '600' },
	recentScroll: { gap: 14, paddingRight: 4 },
	recentItem: { width: 58, alignItems: 'center' },
	recentRing: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#172235', borderWidth: 2, borderColor: '#4ADE80', overflow: 'hidden' },
	recentRingPending: { borderColor: '#FBBF24' },
	recentRingCancel: { borderColor: '#FB7185' },
	recentThumb: { width: 34, height: 34 },
	recentLabel: { fontSize: 10, fontWeight: '700', color: '#E2E8F0', marginTop: 6 },
	recentMeta: { fontSize: 9, color: '#64748B', marginTop: 1 },

	segmentRow: { flexDirection: 'row', backgroundColor: '#111A28', borderRadius: 14, padding: 4, marginBottom: 10, borderWidth: 1, borderColor: '#24334A' },
	segmentTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10 },
	segmentTabActive: { backgroundColor: '#2563EB' },
	segmentText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
	segmentTextActive: { color: '#FFFFFF', fontWeight: '700' },
	segmentCount: { minWidth: 20, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 7, backgroundColor: '#1C2941', alignItems: 'center' },
	segmentCountActive: { backgroundColor: 'rgba(255, 255, 255, 0.22)' },
	segmentCountText: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
	segmentCountTextActive: { color: '#FFFFFF' },

	toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#111A28', borderRadius: 12, minHeight: 42, paddingHorizontal: 12, borderWidth: 1, borderColor: '#24334A', gap: 8 },
	searchInput: { flex: 1, color: '#FFFFFF', fontSize: 13, paddingVertical: 0 },
	sortControl: { position: 'relative' },
	sortButton: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111A28', borderWidth: 1, borderColor: '#24334A' },
	sortButtonActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
	sortMenu: { position: 'absolute', top: 48, right: 0, width: 150, borderRadius: 12, padding: 6, backgroundColor: '#132033', borderWidth: 1, borderColor: '#334155', elevation: 12, zIndex: 20 },
	sortOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 9, borderRadius: 8 },
	sortOptionActive: { backgroundColor: '#1E3A5F' },
	sortOptionText: { color: '#E2E8F0', fontSize: 12, fontWeight: '600' },

	resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
	resultText: { fontSize: 11, color: '#64748B', fontWeight: '600' },

	orderCard: { backgroundColor: '#111A28', borderRadius: 18, borderWidth: 1, borderColor: '#24334A', padding: 14, marginBottom: 12 },
	orderHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
	orderHeaderLeft: { flex: 1, minWidth: 0 },
	orderId: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
	orderMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
	orderMetaText: { fontSize: 11, color: '#64748B' },
	orderMetaDot: { fontSize: 11, color: '#475569' },
	statusBadge: { backgroundColor: '#123B2B', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7 },
	statusBadgeText: { fontSize: 10, fontWeight: '700', color: '#4ADE80' },
	statusPending: { backgroundColor: '#3A2A12' },
	statusTextPending: { color: '#FBBF24' },
	statusCancel: { backgroundColor: '#3B1D27' },
	statusTextCancel: { color: '#FB7185' },

	chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 },
	chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, backgroundColor: '#172235', borderWidth: 1, borderColor: '#24334A' },
	chipPaid: { backgroundColor: '#10261D', borderColor: '#1C4534' },
	chipText: { fontSize: 10, fontWeight: '600', color: '#94A3B8' },
	chipTextPaid: { color: '#4ADE80' },
	chipTextPending: { color: '#FBBF24' },

	cardDivider: { height: 1, backgroundColor: '#1C2941', marginVertical: 12 },

	productRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 5 },
	productImageContainer: { width: 44, height: 44, borderRadius: 11,  alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
	productImage: { width: 45, height: 45, borderRadius: 11 },
	productBody: { flex: 1, minWidth: 0 },
	productName: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', lineHeight: 18 },
	productMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
	productCompany: { fontSize: 10, color: '#64748B', maxWidth: 100 },
	productQty: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
	productTotal: { fontSize: 13, fontWeight: '700', color: '#60A5FA' },
	emptyLineText: { fontSize: 12, color: '#64748B' },

	showMoreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8 },
	showMoreText: { fontSize: 11, fontWeight: '700', color: '#60A5FA' },

	orderFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
	totalLabel: { fontSize: 9, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
	totalValue: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginTop: 3 },
	footerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	footerButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 11 },
	cancelButton: { backgroundColor: '#3B1D27', borderWidth: 1, borderColor: '#5B2634' },
	cancelButtonText: { fontSize: 12, fontWeight: '700', color: '#FB7185' },
	detailsButton: { backgroundColor: '#2563EB' },
	detailsButtonText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

	stateContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 44, gap: 10 },
	stateText: { fontSize: 13, color: '#64748B', textAlign: 'center' },
	retryButton: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12, backgroundColor: 'rgba(37, 99, 235, 0.18)', borderWidth: 1, borderColor: 'rgba(96, 165, 250, 0.34)' },
	retryText: { fontSize: 12, fontWeight: '700', color: '#60A5FA' },

	loadMoreState: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, marginTop: 2, marginBottom: 12 },
	loadMoreText: { color: '#60A5FA', fontSize: 12, fontWeight: '700' },
});
