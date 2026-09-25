import React, { useEffect, useMemo, useState } from 'react';
import { Feather } from '../../../theme/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import {
	ActivityIndicator,
	Image,
	Linking,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from '../../../theme/native';
import AppBackground from '../../components/AppBackground';
import BackButton from '../../components/BackButton';
import {
	getApiAssetUrl,
	getOrderProducts,
	type CustomerOrderProduct,
} from '../../services/api';
import AppHeader from '@/app/components/AppHeader';
import { formatMoney, useCurrency } from '../../services/currency';

import { friendlyError } from '../../services/errors';
type TimelineStep = {
	label: string;
	timestamp?: string;
	done: boolean;
};

function stripHtml(html?: string | null) {
	if (!html) return '';
	return html
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

function formatDate(value?: string | null) {
	if (!value) return '—';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
}

function titleCase(value?: string | null) {
	if (!value) return '—';
	return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildTimeline(productStatus: string, paymentStatus: string, orderDate?: string | null): TimelineStep[] {
	const status = productStatus.trim().toLowerCase();
	const paid = paymentStatus.trim().toLowerCase() === 'completed';
	const cancelled = status.includes('cancel');
	const delivered = status.includes('deliver') || status.includes('complete');
	const processing = delivered || status.includes('process');

	if (cancelled) {
		return [
			{ label: 'Order Placed', timestamp: formatDate(orderDate), done: true },
			{ label: 'Payment Completed', timestamp: paid ? formatDate(orderDate) : undefined, done: paid },
			{ label: 'Order Cancelled', done: true },
		];
	}

	return [
		{ label: 'Order Placed', timestamp: formatDate(orderDate), done: true },
		{ label: 'Payment Completed', timestamp: paid ? formatDate(orderDate) : undefined, done: paid },
		{ label: 'Processing', done: processing },
		{ label: 'Delivered', done: delivered },
	];
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
	return (
		<View style={[styles.detailRow, last && styles.detailRowLast]}>
			<Text style={styles.detailLabel}>{label}</Text>
			<Text style={styles.detailValue} numberOfLines={2}>{value}</Text>
		</View>
	);
}

export default function OrderDetailsScreen() {
	const params = useLocalSearchParams<{
		orderId?: string;
		sku?: string;
		email?: string;
		buyerName?: string;
		totalPrice?: string;
		productStatus?: string;
		paymentStatus?: string;
		paymentType?: string;
		orderDate?: string;
	}>();

	const orderId = Number(params.orderId);
	const [products, setProducts] = useState<CustomerOrderProduct[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let isMounted = true;

		if (!Number.isFinite(orderId)) {
			setError('This order could not be found.');
			setIsLoading(false);
			return () => {
				isMounted = false;
			};
		}

		setIsLoading(true);
		getOrderProducts(orderId)
			.then((response) => {
				if (isMounted) setProducts(response.products ?? []);
			})
			.catch((requestError) => {
				if (isMounted) setError(friendlyError(requestError, 'Unable to load this order.'));
			})
			.finally(() => {
				if (isMounted) setIsLoading(false);
			});

		return () => {
			isMounted = false;
		};
	}, [orderId]);

	const productStatus = params.productStatus ?? '';
	const paymentStatus = params.paymentStatus ?? '';
	const timeline = useMemo(
		() => buildTimeline(productStatus, paymentStatus, params.orderDate),
		[productStatus, paymentStatus, params.orderDate],
	);

	const currency = useCurrency();
	const computedTotal = useMemo(() => {
		if (params.totalPrice) return currency.format(params.totalPrice);
		const sum = products.reduce((acc, product) => acc + (product.total_product_price ?? Number(product.total) ?? 0), 0);
		return currency.format(sum);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [params.totalPrice, products, currency.code]);

	const statusTone = productStatus.toLowerCase().includes('cancel')
		? styles.badgeDanger
		: productStatus.toLowerCase().includes('process') || productStatus.toLowerCase().includes('pending')
			? styles.badgeWarning
			: styles.badgeSuccess;

	const openDemo = (url?: string | null) => {
		if (url) Linking.openURL(url).catch(() => undefined);
	};

	return (
		<View style={styles.container}>
			<AppBackground />
			<AppHeader />


			{isLoading ? (
				<View style={styles.stateContainer}><ActivityIndicator size="large" color="#38BDF8" /></View>
			) : error ? (
				<View style={styles.stateContainer}><Text style={styles.stateText}>{error}</Text></View>
			) : (
				<ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
					<View style={styles.summaryCard}>
						<View style={styles.summaryTop}>
							<View>
								<Text style={styles.summaryLabel}>Order</Text>
								<Text style={styles.summaryOrderId}>#{Number.isFinite(orderId) ? orderId : '—'}</Text>
							</View>
							<View style={[styles.badge, statusTone]}>
								<Text style={[styles.badgeText, statusTone === styles.badgeDanger && styles.badgeTextDanger, statusTone === styles.badgeWarning && styles.badgeTextWarning]}>
									{titleCase(productStatus) || 'Unknown'}
								</Text>
							</View>
						</View>
						<Text style={styles.summaryTotal}>{computedTotal}</Text>
						<Text style={styles.summaryDate}>Placed {formatDate(params.orderDate)}</Text>
					</View>

					<View style={styles.card}>
						<Text style={styles.cardTitle}>Customer Information</Text>
						<DetailRow label="Name" value={params.buyerName?.trim() || 'Not provided'} />
						<DetailRow label="Email" value={params.email?.trim() || 'Not provided'} />
						<DetailRow label="Order SKU" value={params.sku?.trim() || '—'} />
						<DetailRow label="Payment" value={`${titleCase(paymentStatus)} · ${titleCase(params.paymentType)}`} last />
					</View>

					<View style={styles.card}>
						<Text style={styles.cardTitle}>
							Product Details{products.length > 1 ? ` (${products.length})` : ''}
						</Text>

						{products.length === 0 ? (
							<Text style={styles.stateText}>No products on this order.</Text>
						) : products.map((product, index) => {
							const image = getApiAssetUrl(product.product_image) ?? product.product_image;
							const logo = getApiAssetUrl(product.product_company_logo) ?? product.product_company_logo;
							const summary = stripHtml(product.description);

							return (
								<View key={product.id} style={[styles.productBlock, index === products.length - 1 && styles.productBlockLast]}>
									<View style={styles.productHeader}>
										<View style={styles.productImageContainer}>
											{image ? (
												<Image source={{ uri: image }} style={styles.productImage} resizeMode="cover" />
											) : (
												<Feather name="package" size={22} color="#64748B" />
											)}
										</View>
										<View style={styles.productHeaderText}>
											<Text style={styles.productName} numberOfLines={3}>{product.product_name}</Text>
											<View style={styles.companyRow}>
												{logo ? <Image source={{ uri: logo }} style={styles.companyLogo} resizeMode="contain" /> : null}
												<Text style={styles.companyName}>{product.company_name || 'Apsuni'}</Text>
											</View>
										</View>
									</View>

									{summary ? <Text style={styles.productDescription} numberOfLines={4}>{summary}</Text> : null}

									<DetailRow label="Unit Price" value={formatMoney(product.price)} />
									<DetailRow label="Quantity" value={String(product.qty ?? 1)} />
									<DetailRow label="Line Total" value={formatMoney(product.total ?? product.total_product_price)} last={!product.product_demo} />

									{product.product_demo ? (
										<TouchableOpacity style={styles.demoButton} activeOpacity={0.8} onPress={() => openDemo(product.product_demo)}>
											<Feather name="external-link" size={15} color="#60A5FA" />
											<Text style={styles.demoButtonText}>View demo</Text>
										</TouchableOpacity>
									) : null}
								</View>
							);
						})}
					</View>

					<View style={styles.card}>
						<Text style={styles.cardTitle}>Order Timeline</Text>
						{timeline.map((step, index) => (
							<View key={step.label} style={styles.timelineRow}>
								<View style={styles.timelineIndicator}>
									<View style={[styles.timelineDot, step.done && styles.timelineDotDone]}>
										{step.done ? <Feather name="check" size={12} color="#FFFFFF" /> : null}
									</View>
									{index < timeline.length - 1 ? (
										<View style={[styles.timelineLine, step.done && styles.timelineLineDone]} />
									) : null}
								</View>
								<View style={styles.timelineContent}>
									<Text style={[styles.timelineLabel, !step.done && styles.timelineLabelPending]}>{step.label}</Text>
									{step.timestamp ? <Text style={styles.timelineTime}>{step.timestamp}</Text> : null}
								</View>
							</View>
						))}
					</View>
				</ScrollView>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: 'transparent' },
	header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
	headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
	headerSpacer: { width: 40 },
	scrollContent: { paddingHorizontal: 20, paddingBottom: 48 },
	stateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
	stateText: { fontSize: 13, color: '#64748B', textAlign: 'center' },

	summaryCard: { backgroundColor: '#111A28', borderRadius: 20, borderWidth: 1, borderColor: '#24334A', padding: 18, marginBottom: 14 },
	summaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
	summaryLabel: { fontSize: 11, fontWeight: '600', color: '#64748B', letterSpacing: 0.6, textTransform: 'uppercase' },
	summaryOrderId: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },
	summaryTotal: { fontSize: 26, fontWeight: '800', color: '#60A5FA', marginTop: 14 },
	summaryDate: { fontSize: 12, color: '#94A3B8', marginTop: 4 },

	badge: { backgroundColor: '#123B2B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
	badgeSuccess: { backgroundColor: '#123B2B' },
	badgeWarning: { backgroundColor: '#3A2A12' },
	badgeDanger: { backgroundColor: '#3B1D27' },
	badgeText: { fontSize: 11, fontWeight: '700', color: '#4ADE80' },
	badgeTextWarning: { color: '#FBBF24' },
	badgeTextDanger: { color: '#FB7185' },

	card: { backgroundColor: '#111A28', borderRadius: 20, borderWidth: 1, borderColor: '#24334A', padding: 18, marginBottom: 14 },
	cardTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },

	detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1C2941', gap: 16 },
	detailRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
	detailLabel: { fontSize: 13, color: '#94A3B8' },
	detailValue: { flex: 1, textAlign: 'right', fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

	productBlock: { paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#1C2941' },
	productBlockLast: { borderBottomWidth: 0, paddingBottom: 0 },
	productHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
	productImageContainer: { width: 68, height: 68, borderRadius: 16, backgroundColor: '#172235', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 14 },
	productImage: { width: '100%', height: '100%' },
	productHeaderText: { flex: 1, minWidth: 0 },
	productName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', lineHeight: 20 },
	companyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
	companyLogo: { width: 16, height: 16, borderRadius: 4, marginRight: 6 },
	companyName: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
	productDescription: { fontSize: 12, color: '#94A3B8', lineHeight: 18, marginBottom: 4 },

	demoButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 14, backgroundColor: '#172235', borderWidth: 1, borderColor: '#24334A', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
	demoButtonText: { fontSize: 12, fontWeight: '700', color: '#60A5FA', marginLeft: 8 },

	timelineRow: { flexDirection: 'row', marginTop: 12 },
	timelineIndicator: { width: 24, alignItems: 'center' },
	timelineDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#172235', borderWidth: 1, borderColor: '#24334A', alignItems: 'center', justifyContent: 'center' },
	timelineDotDone: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
	timelineLine: { flex: 1, width: 2, backgroundColor: '#1C2941', marginTop: 4, minHeight: 20 },
	timelineLineDone: { backgroundColor: '#2563EB' },
	timelineContent: { flex: 1, paddingLeft: 14, paddingBottom: 10 },
	timelineLabel: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
	timelineLabelPending: { color: '#64748B' },
	timelineTime: { fontSize: 11, color: '#64748B', marginTop: 3 },
});
