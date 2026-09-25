import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Feather } from '../../../theme/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
	ActivityIndicator,
	Animated,
	Image,
	Easing,
	KeyboardAvoidingView,
	Linking,
	Platform,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from '../../../theme/native';
import { Image as RNImage } from 'react-native';
import AppBackground from '../../components/AppBackground';
import AppHeader from '../../components/AppHeader';
import { useAppAlert } from '../../components/AppAlert';
import { getApiAssetUrl, checkDomain, listEditories, updateEditory, updateEditoryAttachments, type Editory, type PickedFile } from '../../services/api';
import { formatMoney } from '../../services/currency';

import { friendlyError } from '../../services/errors';
/* ========== DOMAIN EXTENSION PRICING (NGN) ========== */
const DOMAIN_EXTENSION_PRICES: Record<string, number> = {
	'.com': 30000,
	'.net': 25000,
	'.ng': 25000,
	'.org': 28000,
	'.co': 32000,
};

/* ========== HOSTING PROVIDER PLANS (NGN) ========== */
type HostingPlan = { key: string; name: string; price: number; description: string; url: string };

const HOSTING_PLANS: Record<string, HostingPlan[]> = {
	Hostinger: [
		{ key: 'hostinger_premium', name: 'Premium', price: 5985, description: 'Best for a single new site: 100 websites, 100GB SSD, free SSL & domain (1yr).', url: 'https://www.hostinger.com/web-hosting' },
		{ key: 'hostinger_business', name: 'Business', price: 7485, description: 'Faster NVMe storage, daily backups, free CDN - good for growing sites & stores.', url: 'https://www.hostinger.com/web-hosting' },
		{ key: 'hostinger_cloud_startup', name: 'Cloud Startup', price: 14985, description: 'Cloud-tier resources, dedicated IP & priority support for high-traffic sites.', url: 'https://www.hostinger.com/web-hosting' },
	],
	Namecheap: [
		{ key: 'namecheap_spark', name: 'Spark (VPS)', price: 5820, description: 'For small projects: 1 CPU core, 1 GB RAM, 20 GB SSD RAID 10, 1000 GB bandwidth.', url: 'https://www.namecheap.com/hosting/vps/' },
		{ key: 'namecheap_pulsar', name: 'Pulsar (VPS)', price: 10320, description: 'For growing projects: 2 CPU cores, 2 GB RAM, 40 GB SSD RAID 10, cPanel & Webuzo available.', url: 'https://www.namecheap.com/hosting/vps/' },
		{ key: 'namecheap_quasar', name: 'Quasar (VPS)', price: 19320, description: 'For business websites: 4 CPU cores, 6 GB RAM, 120 GB SSD RAID 10, 3000 GB bandwidth.', url: 'https://www.namecheap.com/hosting/vps/' },
	],
	Bluehost: [
		{ key: 'bluehost_basic', name: 'Basic', price: 4425, description: 'Single site, 10GB SSD, free domain for the first year - good for a personal project.', url: 'https://www.bluehost.com/hosting/shared' },
		{ key: 'bluehost_choice_plus', name: 'Choice Plus', price: 8175, description: 'Unlimited sites, domain privacy, and CodeGuard backups included.', url: 'https://www.bluehost.com/hosting/shared' },
		{ key: 'bluehost_pro', name: 'Pro', price: 20925, description: 'More CPU/RAM resources and priority support - for higher-traffic sites.', url: 'https://www.bluehost.com/hosting/shared' },
	],
	SiteGround: [
		{ key: 'siteground_startup', name: 'StartUp', price: 4485, description: '1 website, 10GB storage, ~10,000 monthly visits - good for a small site.', url: 'https://www.siteground.com/web-hosting' },
		{ key: 'siteground_growbig', name: 'GrowBig', price: 7485, description: 'Unlimited sites, staging environments, on-demand backups - best value for most.', url: 'https://www.siteground.com/web-hosting' },
		{ key: 'siteground_gogeek', name: 'GoGeek', price: 11985, description: 'Highest shared-hosting resources, Git integration, white-label hosting for agencies.', url: 'https://www.siteground.com/web-hosting' },
	],
	GoDaddy: [
		{ key: 'godaddy_economy', name: 'Economy', price: 8985, description: '1 website, 100GB storage, unmetered bandwidth - a straightforward starter plan.', url: 'https://www.godaddy.com/hosting/web-hosting' },
		{ key: 'godaddy_deluxe', name: 'Deluxe', price: 13485, description: 'Unlimited websites and storage - good once you are managing more than one site.', url: 'https://www.godaddy.com/hosting/web-hosting' },
		{ key: 'godaddy_ultimate', name: 'Ultimate', price: 19485, description: '2x processing power/memory and free SSL for busier sites.', url: 'https://www.godaddy.com/hosting/web-hosting' },
	],
	AWS: [
		{ key: 'aws_lightsail_nano', name: 'Lightsail Nano', price: 7500, description: '512 MB RAM, 1 vCPU, 20 GB SSD, 1TB transfer - simple bundled VPS pricing.', url: 'https://aws.amazon.com/lightsail/pricing/' },
		{ key: 'aws_lightsail_micro', name: 'Lightsail Micro', price: 10500, description: '1 GB RAM, 2 vCPU, 40 GB SSD, 2TB transfer - good for a small production site.', url: 'https://aws.amazon.com/lightsail/pricing/' },
		{ key: 'aws_lightsail_small', name: 'Lightsail Small', price: 18000, description: '2 GB RAM, 2 vCPU, 60 GB SSD, 3TB transfer - more headroom for growing traffic.', url: 'https://aws.amazon.com/lightsail/pricing/' },
	],
	'Google Cloud': [
		{ key: 'gcp_e2_micro', name: 'e2-micro', price: 10500, description: 'Shared-core VM, 1GB memory - free-tier eligible entry instance.', url: 'https://cloud.google.com/compute/vm-instance-pricing' },
		{ key: 'gcp_e2_small', name: 'e2-small', price: 18000, description: 'Shared-core VM, 2GB memory - a step up for light production workloads.', url: 'https://cloud.google.com/compute/vm-instance-pricing' },
		{ key: 'gcp_e2_medium', name: 'e2-medium', price: 37500, description: '2 vCPU, 4GB memory - the most commonly used general-purpose size.', url: 'https://cloud.google.com/compute/vm-instance-pricing' },
	],
	DigitalOcean: [
		{ key: 'do_basic_4', name: 'Basic $4', price: 6000, description: '512 MB RAM, 1 shared vCPU - enough for a tiny service or test environment.', url: 'https://www.digitalocean.com/pricing/droplets' },
		{ key: 'do_basic_6', name: 'Basic $6', price: 9000, description: '1 GB RAM - a credible minimum for a small live server/side project.', url: 'https://www.digitalocean.com/pricing/droplets' },
		{ key: 'do_basic_12', name: 'Basic $12', price: 18000, description: '2 GB RAM - more room for traffic spikes and background processes.', url: 'https://www.digitalocean.com/pricing/droplets' },
	],
	Vultr: [
		{ key: 'vultr_regular_5', name: 'Cloud Compute $5', price: 7500, description: '1 vCPU, 1 GB RAM, 25 GB SSD - standard entry-level Cloud Compute plan.', url: 'https://www.vultr.com/pricing/' },
		{ key: 'vultr_hp_6', name: 'High Performance $6', price: 9000, description: '1 vCPU, 1 GB RAM on NVMe storage - faster disk I/O than the Regular tier.', url: 'https://www.vultr.com/pricing/' },
		{ key: 'vultr_hf_12', name: 'High Frequency $12', price: 18000, description: '1 vCPU, 2 GB RAM, 50 GB NVMe - for CPU-intensive apps and small databases.', url: 'https://www.vultr.com/pricing/' },
	],
	Netlify: [
		{ key: 'netlify_starter', name: 'Starter (Free)', price: 0, description: '100GB bandwidth, 300 build minutes/month - fine for a small static site.', url: 'https://www.netlify.com/pricing/' },
		{ key: 'netlify_personal', name: 'Personal', price: 13500, description: 'More build minutes and bandwidth for a single-developer project.', url: 'https://www.netlify.com/pricing/' },
		{ key: 'netlify_pro', name: 'Pro', price: 30000, description: 'Unlimited team seats, 1TB bandwidth, priority support - for teams shipping regularly.', url: 'https://www.netlify.com/pricing/' },
	],
};

/* ========== LLC / BUSINESS REGISTRATION (NGN) ========== */
const LLC_OPTIONS: Record<string, number> = {
	'Business Name Registration': 30000,
	'Company Limited Registration': 65000,
};

/* ========== OFFICIAL EMAIL PRICE (NGN per account) ========== */
const OFFICIAL_EMAIL_PRICE = 2000;

/* ========== AI OPTIONS (NGN) ========== */
const AI_OPTIONS: Record<string, number> = {
	'ChatGPT Plus': 15000,
	'Claude Pro': 18000,
	'Gemini Advanced': 12000,
};

const PRICE_LIST = {
	deploy_play_store: 40000,
	deploy_app_store: 50000,
	deploy_apsuni_playstore: 25000,
	deploy_apsuni_appstore: 35000,
	need_ios: 70000,
	need_android_app: 60000,
	deploy_server: 90000,
};

const CATEGORY_OPTIONS: Record<string, string[]> = {
	Blog: ['Content Blog', 'Personal Blog', 'Food Blog', 'Travel Blog'],
	Ecommerce: ['Clothing Store', 'Electronics Store', 'Health Store', 'Fashion Store'],
	'Management System': ['Inventory System', 'CRM System', 'HR System', 'Finance System'],
	'Social Network': ['Community Platform', 'Dating Network', 'Professional Network', 'Interest Group'],
	Betting: ['Sportsbook', 'Casino', 'Lottery', 'Esports Betting'],
	Networking: ['Event Network', 'Affiliate Network', 'Business Network', 'Social Network'],
	'Search Engine': ['Web Search', 'Image Search', 'Video Search', 'Local Search'],
	Streaming: ['Video Streaming', 'Audio Streaming', 'Live Streaming', 'Media Platform'],
	Digital: ['Digital Agency', 'Digital Product', 'Marketing Portal', 'Content Hub'],
	Gameing: ['Mobile Game', 'PC Game', 'Multiplayer Game', 'Puzzle Game'],
	Fintech: ['Payment Platform', 'Lending Service', 'Wallet App', 'Investment Platform'],
	Others: ['General Project', 'Custom Work', 'Consulting Request', 'Other'],
};

const STEPS = [
	{ key: 'project', label: 'Project details', hint: 'Tell us what you are building.' },
	{ key: 'contact', label: 'Company & contact', hint: 'Who should we reach about this project?' },
	{ key: 'tech', label: 'Tech & team', hint: 'The stack and the people behind it.' },
	{ key: 'infra', label: 'Domain & hosting', hint: 'Where the project will live.' },
	{ key: 'addons', label: 'Add-ons', hint: 'Extras that get added to your total.' },
	{ key: 'review', label: 'Review', hint: 'Check everything before you save.' },
];

type FormState = Record<string, any>;

const EMPTY_FORM: FormState = {
	selectedOption: '',
	company_type: '',
	status: 'Individual',
	title: '',
	company: '',
	project_name: '',
	description: '',
	specifications: '',
	sku: '',
	product_status: '',
	type: '',
	git_url: '',
	allow_usage: false,
	need_team: false,
	team_no: '',
	front_end_lan: '',
	back_end_lan: '',
	front_end_framw: '',
	back_end_framw: '',
	server_type: '',
	server_size: '',
	domain: '',
	domain_extension: '.com',
	domain_name: '',
	hosting_provider: '',
	hosting_plan: '',
	testing_server: false,
	ios: false,
	android: false,
	play_store: false,
	app_store: false,
	apsuni_play_store: false,
	apsuni_app_store: false,
	llc: '',
	ai_options: [] as string[],
	emails: [] as string[],
	company_email: '',
	company_phone: '',
	company_whatapp: '',
	company_faxline: '',
	company_address: '',
	company_country: '',
	company_state: '',
	company_for: '',
	country_code: '',
	instagram: '',
	twitter: '',
	facebook: '',
};

function normalizeProductType(value?: string | null) {
	const raw = String(value || '').trim().toLowerCase();
	if (!raw) return '';
	if (/mobile|android|ios/.test(raw)) return 'Mobile App';
	if (/web(site)?|site|webapp/.test(raw)) return 'Website';
	return raw.split(/[_\s-]+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function money(value: number) {
	return formatMoney(value, { decimals: false });
}

type DomainState = { status: 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error'; message: string };
type SavedAttachment = { id: number; name: string; size: number; url?: string };

const ATTACHMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'png', 'jpg', 'jpeg', 'webp', 'zip'];
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const extensionOf = (name: string) => (name.split('.').pop() || '').toLowerCase();
const fileIcon = (name: string): keyof typeof Feather.glyphMap => {
	const extension = extensionOf(name);
	if (['png', 'jpg', 'jpeg', 'webp'].includes(extension)) return 'image';
	if (extension === 'zip') return 'archive';
	return 'file-text';
};
const fileSize = (bytes?: number) => {
	if (!bytes) return '';
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function Field({
	label,
	value,
	onChange,
	placeholder,
	keyboardType,
	multiline,
	hint,
	autoCapitalize,
	status,
	message,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric' | 'url';
	multiline?: boolean;
	hint?: string;
	autoCapitalize?: 'none' | 'sentences' | 'words';
	status?: 'checking' | 'success' | 'error' | 'warning';
	message?: string;
}) {
	const [focused, setFocused] = useState(false);
	return (
		<View style={styles.field}>
			<Text style={styles.fieldLabel}>{label}</Text>
			<TextInput
				value={value}
				onChangeText={onChange}
				placeholder={placeholder}
				placeholderTextColor="#64748B"
				keyboardType={keyboardType}
				autoCapitalize={autoCapitalize ?? 'sentences'}
				multiline={multiline}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				style={[
					styles.input,
					multiline && styles.inputMultiline,
					focused && styles.inputFocused,
					status === 'success' && styles.inputSuccess,
					status === 'error' && styles.inputError,
				]}
			/>
			{status && message ? (
				<View style={styles.statusRow}>
					{status === 'checking' ? (
						<ActivityIndicator size="small" color="#60A5FA" />
					) : (
						<Feather
							name={status === 'success' ? 'check-circle' : status === 'warning' ? 'alert-triangle' : 'x-circle'}
							size={14}
							color={status === 'success' ? '#4ADE80' : status === 'warning' ? '#FBBF24' : '#F87171'}
						/>
					)}
					<Text style={[styles.statusText, status === 'success' && { color: '#86EFAC' }, status === 'error' && { color: '#FCA5A5' }, status === 'warning' && { color: '#FCD34D' }]}>{message}</Text>
				</View>
			) : hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
		</View>
	);
}

function ChipGroup({
	label,
	options,
	value,
	onSelect,
	hint,
	allowClear,
}: {
	label: string;
	options: string[];
	value: string;
	onSelect: (value: string) => void;
	hint?: string;
	allowClear?: boolean;
}) {
	return (
		<View style={styles.field}>
			<Text style={styles.fieldLabel}>{label}</Text>
			<View style={styles.chipWrap}>
				{options.map((option) => {
					const active = value === option;
					return (
						<TouchableOpacity
							key={option}
							style={[styles.chip, active && styles.chipActive]}
							activeOpacity={0.8}
							onPress={() => onSelect(allowClear && active ? '' : option)}
						>
							{active && <Feather name="check" size={12} color="#FFFFFF" />}
							<Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
						</TouchableOpacity>
					);
				})}
			</View>
			{hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
		</View>
	);
}

function ToggleRow({
	label,
	description,
	value,
	onChange,
	price,
	disabled,
}: {
	label: string;
	description?: string;
	value: boolean;
	onChange: (value: boolean) => void;
	price?: number;
	disabled?: boolean;
}) {
	return (
		<View style={[styles.toggleRow, disabled && styles.toggleRowDisabled]}>
			<View style={styles.toggleCopy}>
				<Text style={[styles.toggleLabel, disabled && styles.mutedText]}>{label}</Text>
				{description ? <Text style={styles.toggleDescription}>{description}</Text> : null}
				{price ? <Text style={styles.togglePrice}>+{money(price)}</Text> : null}
			</View>
			<Switch
				value={value}
				onValueChange={onChange}
				disabled={disabled}
				trackColor={{ false: '#24334A', true: '#2563EB' }}
				thumbColor={value ? '#FFFFFF' : '#94A3B8'}
			/>
		</View>
	);
}

function SectionCard({ title, icon, children }: { title: string; icon: keyof typeof Feather.glyphMap; children: React.ReactNode }) {
	return (
		<View style={styles.sectionCard}>
			<View style={styles.sectionHeader}>
				<View style={styles.sectionIcon}><Feather name={icon} size={14} color="#60A5FA" /></View>
				<Text style={styles.sectionTitle}>{title}</Text>
			</View>
			{children}
		</View>
	);
}

export default function EditProjectScreen() {
	const router = useRouter();
	const { showAlert } = useAppAlert();
	const params = useLocalSearchParams<{ editoryId?: string; title?: string; productType?: string; price?: string }>();
	const editoryId = Number(params.editoryId);

	const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
	const [baseTotal, setBaseTotal] = useState(Number(params.price ?? 0) || 0);
	const [rawProductType, setRawProductType] = useState(String(params.productType ?? ''));
	const [emailDraft, setEmailDraft] = useState('');
	const [step, setStep] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [domainState, setDomainState] = useState<DomainState>({ status: 'idle', message: '' });
	const [savedFiles, setSavedFiles] = useState<SavedAttachment[]>([]);
	const [pendingFiles, setPendingFiles] = useState<PickedFile[]>([]);
	const [logoFile, setLogoFile] = useState<PickedFile | null>(null); // a new logo chosen on this screen
	const [savedLogo, setSavedLogo] = useState<string | null>(null); // the logo already saved on the project
	const [removedIds, setRemovedIds] = useState<number[]>([]);
	const domainTicket = useRef(0);

	const stepAnim = useRef(new Animated.Value(1)).current;
	const scrollRef = useRef<ScrollView | null>(null);

	const set = useCallback((key: string, value: any) => setForm((current) => ({ ...current, [key]: value })), []);

	/* Prefill from the bucket item this screen was opened for. */
	useEffect(() => {
		let isMounted = true;

		if (!Number.isFinite(editoryId)) {
			setLoadError('This project could not be found.');
			setIsLoading(false);
			return () => { isMounted = false; };
		}

		listEditories()
			.then((result) => {
				if (!isMounted) return;
				const product = (result.products ?? []).find((item: Editory) => Number(item.id) === editoryId);
				if (!product) {
					setLoadError('This project is no longer in your bucket.');
					return;
				}

				const rawType = String(product.product_type || product.project_type || product.type || params.productType || '').trim();
				setRawProductType(rawType);
				setSavedFiles(Array.isArray(product.attachments) ? product.attachments.map((file: any) => ({ id: Number(file.id), name: String(file.name), size: Number(file.size) || 0, url: file.url })) : []);
				setSavedLogo(product.company_logo ? (getApiAssetUrl(String(product.company_logo)) ?? String(product.company_logo)) : null);
				setBaseTotal(Number(product.total_amount || product.price || params.price || 0) || 0);
				setForm((current) => ({
					...current,
					selectedOption: product.selected_option || product.category || '',
					company_type: product.company_type || '',
					status: product.status || 'Individual',
					title: product.title || String(params.title ?? ''),
					company: product.company || '',
					project_name: product.project_name || '',
					description: String(product.description || '').replace(/<[^>]*>/g, '').trim(),
					specifications: product.specifications || '',
					sku: product.sku || `sku-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
					product_status: product.product_status || '',
					type: product.type || '',
					git_url: product.git_url || '',
					allow_usage: Boolean(product.allow_usage),
					need_team: Boolean(product.need_team),
					team_no: String(product.team_no || ''),
					front_end_lan: product.front_end_lan || '',
					back_end_lan: product.back_end_lan || '',
					front_end_framw: product.front_end_framw || '',
					back_end_framw: product.back_end_framw || '',
					server_type: product.server_type || '',
					server_size: product.server_size || '',
					domain: product.domain || '',
					domain_extension: product.domain_extension || '.com',
					domain_name: product.domain_name || '',
					hosting_provider: product.hosting_provider || '',
					hosting_plan: product.hosting_plan || '',
					testing_server: Boolean(product.testing_server),
					ios: Boolean(product.ios),
					android: Boolean(product.android),
					play_store: Boolean(product.play_store),
					app_store: Boolean(product.app_store),
					apsuni_play_store: Boolean(product.apsuni_play_store),
					apsuni_app_store: Boolean(product.apsuni_app_store),
					llc: product.llc || '',
					company_email: product.company_email || '',
					company_phone: product.company_phone || '',
					company_whatapp: product.company_whatapp || '',
					company_faxline: product.company_faxline || '',
					company_address: product.company_address || '',
					company_country: product.company_country || '',
					company_state: product.company_state || '',
					company_for: product.company_for || '',
					country_code: product.country_code || '',
					instagram: product.instagram || '',
					twitter: product.twitter || '',
					facebook: product.facebook || '',
				}));
			})
			.catch((error) => {
				if (isMounted) setLoadError(friendlyError(error, 'Unable to load this project.'));
			})
			.finally(() => {
				if (isMounted) setIsLoading(false);
			});

		return () => { isMounted = false; };
	}, [editoryId, params.price, params.productType, params.title]);

	const isMobileApp = /mobile|android|ios/.test(String(rawProductType || '').toLowerCase());

	/* Mobile-only extras cannot stay on for a website project. */
	useEffect(() => {
		if (isMobileApp) return;
		setForm((current) => ({
			...current,
			ios: false,
			android: false,
			play_store: false,
			app_store: false,
			apsuni_play_store: false,
			apsuni_app_store: false,
		}));
	}, [isMobileApp]);

	/* Ask the server whether the domain is free, a moment after the person stops typing. */
	useEffect(() => {
		const name = String(form.domain || '').trim().toLowerCase();
		if (!name) { setDomainState({ status: 'idle', message: '' }); return undefined; }

		const full = `${name}${form.domain_extension}`;
		if (name.includes('.')) { setDomainState({ status: 'invalid', message: 'Type the name only, without .com or .net. Pick the extension from the list below.' }); return undefined; }
		if (/^-|-$/.test(name)) { setDomainState({ status: 'invalid', message: 'A domain name cannot start or end with a hyphen.' }); return undefined; }
		if (!/^[a-z0-9-]+$/.test(name)) { setDomainState({ status: 'invalid', message: 'Use only letters, numbers and hyphens. Spaces and symbols are not allowed.' }); return undefined; }
		if (name.length < 2) { setDomainState({ status: 'invalid', message: 'A domain name needs at least 2 characters.' }); return undefined; }

		setDomainState({ status: 'checking', message: `Checking ${full}…` });
		const ticket = ++domainTicket.current;
		const timer = setTimeout(async () => {
			try {
				const free = await checkDomain(full);
				if (ticket !== domainTicket.current) return;
				setDomainState(free
					? { status: 'available', message: `${full} is available.` }
					: { status: 'taken', message: `${full} is already registered to someone else. Choose a different name, or try another extension such as .net or .ng.` });
			} catch (error) {
				if (ticket !== domainTicket.current) return;
				setDomainState({ status: 'error', message: friendlyError(error, 'We could not check this domain right now.') + ' You can still continue and we will confirm it for you.' });
			}
		}, 600);
		return () => clearTimeout(timer);
	}, [form.domain, form.domain_extension]);

	const attachmentCount = savedFiles.length + pendingFiles.length;

	const pickFiles = async () => {
		if (attachmentCount >= MAX_ATTACHMENTS) {
			showAlert({ title: 'Attachment limit', message: `You can attach up to ${MAX_ATTACHMENTS} files to a project.` });
			return;
		}
		let picker: any;
		try {
			// Loaded on demand so older builds without the picker still open this screen.
			picker = require('expo-document-picker');
		} catch {
			showAlert({ title: 'Update needed', message: 'Attaching files needs the latest version of the Apsuni app. Please update the app and try again.' });
			return;
		}
		try {
			const result = await picker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: '*/*' });
			if (result.canceled) return;
			const accepted: PickedFile[] = [];
			const skipped: string[] = [];
			for (const asset of result.assets ?? []) {
				const name = String(asset.name || 'file');
				if (!ATTACHMENT_EXTENSIONS.includes(extensionOf(name))) { skipped.push(`${name} (this file type is not supported)`); continue; }
				if ((asset.size ?? 0) > MAX_ATTACHMENT_BYTES) { skipped.push(`${name} (larger than 10 MB)`); continue; }
				if (pendingFiles.some((file) => file.name === name) || savedFiles.some((file) => file.name === name)) { skipped.push(`${name} (already attached)`); continue; }
				if (attachmentCount + accepted.length >= MAX_ATTACHMENTS) { skipped.push(`${name} (limit of ${MAX_ATTACHMENTS} files reached)`); continue; }
				accepted.push({ uri: asset.uri, name, type: asset.mimeType || 'application/octet-stream', size: asset.size ?? undefined });
			}
			if (accepted.length) setPendingFiles((current) => [...current, ...accepted]);
			if (skipped.length) showAlert({ title: 'Some files were not added', message: skipped.join('\n') });
		} catch {
			showAlert({ title: 'Could not open your files', message: 'Please try again.' });
		}
	};

	// The logo box takes the logo's own shape, so the border hugs it whatever side it is wider on.
	const [logoRatio, setLogoRatio] = useState(1);
	const logoUri = logoFile ? logoFile.uri : savedLogo;
	useEffect(() => { if (!logoUri) setLogoRatio(1); }, [logoUri]);
	const logoBox = logoUri
		? { width: logoRatio >= 1 ? 150 : Math.max(56, Math.round(110 * logoRatio)), height: logoRatio >= 1 ? Math.max(56, Math.round(150 / logoRatio)) : 110, borderStyle: 'solid' as const, padding: 6 }
		: {};

	const pickLogo = async () => {
		let picker: any;
		try {
			picker = require('expo-document-picker');
		} catch {
			showAlert({ title: 'Update needed', message: 'Uploading a logo needs the latest version of the Apsuni app. Please update the app and try again.' });
			return;
		}
		try {
			const result = await picker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true, type: 'image/*' });
			if (result.canceled || !result.assets?.length) return;
			const asset = result.assets[0];
			if ((asset.size ?? 0) > MAX_ATTACHMENT_BYTES) {
				showAlert({ title: 'Logo is too large', message: 'Please choose a picture smaller than 10 MB.' });
				return;
			}
			setLogoFile({ uri: asset.uri, name: String(asset.name || 'logo.png'), type: asset.mimeType || 'image/png', size: asset.size ?? undefined });
		} catch {
			showAlert({ title: 'Could not open your pictures', message: 'Please try again.' });
		}
	};

	const removeSaved = (file: SavedAttachment) => {
		setSavedFiles((current) => current.filter((item) => item.id !== file.id));
		setRemovedIds((current) => [...current, file.id]);
	};

	const domainPrice = DOMAIN_EXTENSION_PRICES[form.domain_extension] || 0;
	const selectedHostingPlan = useMemo(() => {
		if (!form.hosting_provider || !form.hosting_plan) return null;
		return (HOSTING_PLANS[form.hosting_provider] || []).find((plan) => plan.key === form.hosting_plan) || null;
	}, [form.hosting_provider, form.hosting_plan]);
	const llcPrice = LLC_OPTIONS[form.llc] || 0;
	const officialEmailCost = form.emails.length * OFFICIAL_EMAIL_PRICE;
	const aiOptionsCost = form.ai_options.reduce((sum: number, name: string) => sum + (AI_OPTIONS[name] || 0), 0);

	const lineItems = useMemo(() => {
		const items: { label: string; amount: number }[] = [{ label: 'Current project price', amount: baseTotal }];
		if (selectedHostingPlan) items.push({ label: `${form.hosting_provider} ${selectedHostingPlan.name}`, amount: selectedHostingPlan.price });
		if (form.domain) items.push({ label: `Domain ${form.domain}${form.domain_extension}`, amount: domainPrice });
		if (isMobileApp) {
			if (form.ios) items.push({ label: 'iOS build', amount: PRICE_LIST.need_ios });
			if (form.android) items.push({ label: 'Android build', amount: PRICE_LIST.need_android_app });
			if (form.play_store) items.push({ label: 'Play Store deployment', amount: PRICE_LIST.deploy_play_store });
			if (form.apsuni_play_store) items.push({ label: 'Apsuni Play Store deployment', amount: PRICE_LIST.deploy_apsuni_playstore });
			if (form.app_store) items.push({ label: 'App Store deployment', amount: PRICE_LIST.deploy_app_store });
			if (form.apsuni_app_store) items.push({ label: 'Apsuni App Store deployment', amount: PRICE_LIST.deploy_apsuni_appstore });
		}
		if (form.testing_server) items.push({ label: 'Test server deployment', amount: PRICE_LIST.deploy_server });
		if (form.llc) items.push({ label: form.llc, amount: llcPrice });
		form.ai_options.forEach((name: string) => items.push({ label: name, amount: AI_OPTIONS[name] || 0 }));
		if (form.emails.length > 0) items.push({ label: `Official email x${form.emails.length}`, amount: officialEmailCost });
		return items;
	}, [baseTotal, selectedHostingPlan, form, domainPrice, isMobileApp, llcPrice, officialEmailCost]);

	const totalAmount = useMemo(() => lineItems.reduce((sum, item) => sum + item.amount, 0), [lineItems]);

	const goToStep = (next: number) => {
		const target = Math.max(0, Math.min(STEPS.length - 1, next));
		if (target === step) return;
		stepAnim.setValue(0);
		setStep(target);
		scrollRef.current?.scrollTo({ y: 0, animated: true });
		Animated.timing(stepAnim, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
	};

	const addEmail = () => {
		const value = emailDraft.trim();
		if (!value || form.emails.includes(value)) return;
		set('emails', [...form.emails, value]);
		setEmailDraft('');
	};

	const toggleAiOption = (name: string) => {
		const current: string[] = form.ai_options;
		set('ai_options', current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
	};

	const submit = async () => {
		if (!Number.isFinite(editoryId)) return;
		if (domainState.status === 'taken' || domainState.status === 'invalid') {
			showAlert({ title: 'Check your domain', message: domainState.message });
			goToStep(3);
			return;
		}
		if (domainState.status === 'checking') {
			showAlert({ title: 'One moment', message: 'We are still checking your domain name. Please try again in a second.' });
			return;
		}
		setIsSaving(true);
		try {
			const payload = {
				title: form.title,
				company: form.company,
				company_type: form.company_type,
				project_name: form.project_name,
				description: form.description,
				specifications: form.specifications,
				sku: form.sku,
				status: form.status,
				type: form.type,
				product_status: form.product_status,
				need_team: form.need_team,
				team_no: form.team_no,
				allow_usage: form.allow_usage,
				git_url: form.git_url,
				front_end_lan: form.front_end_lan,
				back_end_lan: form.back_end_lan,
				front_end_framw: form.front_end_framw,
				back_end_framw: form.back_end_framw,
				server_type: form.server_type,
				server_size: form.server_size,
				domain: form.domain,
				domain_name: form.domain ? `${String(form.domain).trim().toLowerCase()}${form.domain_extension}` : form.domain_name,
				domain_extension: form.domain_extension,
				domain_price: domainPrice,
				hosting_provider: form.hosting_provider,
				hosting_plan: form.hosting_plan,
				testing_server: form.testing_server,
				ios: form.ios,
				android: form.android,
				play_store: form.play_store,
				app_store: form.app_store,
				apsuni_play_store: form.apsuni_play_store,
				apsuni_app_store: form.apsuni_app_store,
				llc: form.llc,
				llc_price: llcPrice,
				ai_options: form.ai_options,
				official_emails: form.emails,
				company_email: form.company_email,
				company_phone: form.company_phone,
				company_whatapp: form.company_whatapp,
				company_faxline: form.company_faxline,
				company_address: form.company_address,
				company_country: form.company_country,
				company_state: form.company_state,
				company_for: form.company_for,
				country_code: form.country_code,
				instagram: form.instagram,
				twitter: form.twitter,
				facebook: form.facebook,
				project_type: normalizeProductType(rawProductType),
				base_total: baseTotal,
				price: totalAmount,
				total_amount: totalAmount,
			};

			const result = await updateEditory(editoryId, payload);
			if (pendingFiles.length || removedIds.length || logoFile) {
				try {
					await updateEditoryAttachments(editoryId, pendingFiles, removedIds, logoFile);
				} catch (attachError) {
					// The project itself saved; only the files failed, so stay here so they can be retried.
					showAlert({ title: 'Project saved, files not uploaded', message: friendlyError(attachError, 'Your attachments could not be uploaded. Please try again.') });
					return;
				}
			}
			showAlert(result.message || 'Project updated successfully.');
			router.back();
		} catch (error) {
			showAlert(friendlyError(error, 'Could not save this project.'));
		} finally {
			setIsSaving(false);
		}
	};

	const categoryChoices = form.selectedOption ? CATEGORY_OPTIONS[form.selectedOption] || [] : [];

	if (isLoading) {
		return (
			<View style={styles.container}>
				<AppBackground />
				<AppHeader />
				<View style={styles.stateContainer}><ActivityIndicator size="large" color="#38BDF8" /></View>
			</View>
		);
	}

	if (loadError) {
		return (
			<View style={styles.container}>
				<AppBackground />
				<AppHeader />
				<View style={styles.stateContainer}>
					<Feather name="alert-circle" size={22} color="#FB7185" />
					<Text style={styles.stateText}>{loadError}</Text>
				</View>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<AppBackground />
			<AppHeader />

			{/* Step indicator */}
			<View style={styles.stepper}>
				{STEPS.map((item, index) => {
					const done = index < step;
					const active = index === step;
					return (
						<React.Fragment key={item.key}>
							<TouchableOpacity
								style={[styles.stepDot, (active || done) && styles.stepDotActive]}
								activeOpacity={0.8}
								onPress={() => goToStep(index)}
								accessibilityLabel={`Go to ${item.label}`}
							>
								{done ? <Feather name="check" size={12} color="#FFFFFF" /> : <Text style={[styles.stepDotText, active && styles.stepDotTextActive]}>{index + 1}</Text>}
							</TouchableOpacity>
							{index < STEPS.length - 1 && <View style={[styles.stepLine, done && styles.stepLineDone]} />}
						</React.Fragment>
					);
				})}
			</View>

			<KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
				<ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
					<Animated.View style={{ opacity: stepAnim, transform: [{ translateY: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
						<Text style={styles.stepTitle}>{STEPS[step].label}</Text>
						<Text style={styles.stepHint}>{STEPS[step].hint}</Text>

						{step === 0 && (
							<>
								<SectionCard title="Project category" icon="grid">
									<ChipGroup
										label="Pick the category this project belongs to"
										options={Object.keys(CATEGORY_OPTIONS)}
										value={form.selectedOption}
										onSelect={(value) => { set('selectedOption', value); set('company_type', ''); }}
									/>
									{categoryChoices.length > 0 && (
										<ChipGroup
											label={`${form.selectedOption} type`}
											options={categoryChoices}
											value={form.company_type}
											onSelect={(value) => set('company_type', value)}
											allowClear
											hint="Or type your own below."
										/>
									)}
									<Field label="Custom category" value={form.company_type} onChange={(value) => set('company_type', value)} placeholder="e.g. Subscription Store" />
								</SectionCard>

								<SectionCard title="Ownership" icon="user">
									<ChipGroup label="This project belongs to" options={['Individual', 'Company']} value={form.status} onSelect={(value) => set('status', value)} />
									<Field label="Project title" value={form.title} onChange={(value) => set('title', value)} placeholder="Project title" />
									<Field label="Project name" value={form.project_name} onChange={(value) => set('project_name', value)} placeholder="Internal project name" />
									<View style={styles.field}>
										<Text style={styles.fieldLabel}>Prompt</Text>
										<View>
											<TextInput
												value={form.description}
												onChangeText={(value) => set('description', value)}
												placeholder="Tell us what you want built. Write it out, or paste bullet points and notes."
												placeholderTextColor="#64748B"
												multiline
												style={[styles.input, styles.inputMultiline, styles.promptInput]}
											/>
											<TouchableOpacity style={styles.attachButton} activeOpacity={0.85} onPress={pickFiles} accessibilityLabel="Attach files">
												<Feather name="plus" size={18} color="#FFFFFF" />
											</TouchableOpacity>
										</View>
										<Text style={styles.fieldHint}>Tap + to attach documents such as PDF, Word, Excel, images or a zip. Up to {MAX_ATTACHMENTS} files, 10 MB each.</Text>
										{(savedFiles.length > 0 || pendingFiles.length > 0) && (
											<View style={styles.fileList}>
												{savedFiles.map((file) => (
													<View key={`saved-${file.id}`} style={styles.fileChip}>
														<View style={styles.fileIcon}><Feather name={fileIcon(file.name)} size={15} color="#60A5FA" /></View>
														<TouchableOpacity style={styles.fileInfo} activeOpacity={file.url ? 0.7 : 1} onPress={() => file.url && Linking.openURL(file.url).catch(() => undefined)}>
															<Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
															<Text style={styles.fileMeta}>Saved{file.size ? ` · ${fileSize(file.size)}` : ''}</Text>
														</TouchableOpacity>
														<TouchableOpacity onPress={() => removeSaved(file)} hitSlop={8} accessibilityLabel={`Remove ${file.name}`}><Feather name="trash-2" size={15} color="#94A3B8" /></TouchableOpacity>
													</View>
												))}
												{pendingFiles.map((file) => (
													<View key={`new-${file.name}`} style={[styles.fileChip, styles.fileChipNew]}>
														<View style={[styles.fileIcon, styles.fileIconNew]}><Feather name={fileIcon(file.name)} size={15} color="#4ADE80" /></View>
														<View style={styles.fileInfo}>
															<Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
															<Text style={[styles.fileMeta, { color: '#86EFAC' }]}>Ready to upload{file.size ? ` · ${fileSize(file.size)}` : ''}</Text>
														</View>
														<TouchableOpacity onPress={() => setPendingFiles((current) => current.filter((item) => item.name !== file.name))} hitSlop={8} accessibilityLabel={`Remove ${file.name}`}><Feather name="x" size={16} color="#94A3B8" /></TouchableOpacity>
													</View>
												))}
											</View>
										)}
									</View>
									<Field label="SKU" value={form.sku} onChange={(value) => set('sku', value)} placeholder="sku-000" autoCapitalize="none" hint="Auto-generated when the project has none." />
								</SectionCard>
							</>
						)}

						{step === 1 && (
							<>
								<SectionCard title="Company" icon="briefcase">
									<View style={logoStyles.row}>
										<TouchableOpacity activeOpacity={0.8} onPress={pickLogo} accessibilityLabel="Upload company logo" style={[logoStyles.box, logoBox]}>
											{logoFile || savedLogo ? (
												<RNImage source={{ uri: logoUri as string }} style={logoStyles.image} resizeMode="contain" onLoad={(event) => { const { width, height } = event.nativeEvent.source; if (width > 0 && height > 0) setLogoRatio(Math.min(4, Math.max(0.25, width / height))); }} />
											) : (
												<Feather name="image" size={26} color="#94A3B8" />
											)}
										</TouchableOpacity>
										<View style={{ flex: 1 }}>
											<Text style={logoStyles.title}>Company logo</Text>
											<Text style={logoStyles.hint}>{logoFile ? 'New logo ready. It is saved when you save the project.' : 'A square picture works best.'}</Text>
											<View style={logoStyles.actions}>
												<TouchableOpacity onPress={pickLogo} style={logoStyles.button}>
													<Feather name="upload" size={14} color="#FFFFFF" />
													<Text style={logoStyles.buttonText}>{logoFile || savedLogo ? 'Change logo' : 'Upload logo'}</Text>
												</TouchableOpacity>
												{logoFile ? (
													<TouchableOpacity onPress={() => setLogoFile(null)} style={logoStyles.ghost}><Text style={logoStyles.ghostText}>Undo</Text></TouchableOpacity>
												) : null}
											</View>
										</View>
									</View>
									<Field label="Company name" value={form.company} onChange={(value) => set('company', value)} placeholder="Company name" />
									<Field label="Company is for" value={form.company_for} onChange={(value) => set('company_for', value)} placeholder="What the company does" />
									<Field label="Company email" value={form.company_email} onChange={(value) => set('company_email', value)} placeholder="hello@company.com" keyboardType="email-address" autoCapitalize="none" />
									<Field label="Phone number" value={form.company_phone} onChange={(value) => set('company_phone', value)} placeholder="080 0000 0000" keyboardType="phone-pad" />
									<Field label="WhatsApp" value={form.company_whatapp} onChange={(value) => set('company_whatapp', value)} placeholder="WhatsApp number" keyboardType="phone-pad" />
									<Field label="Fax line" value={form.company_faxline} onChange={(value) => set('company_faxline', value)} placeholder="Fax line" keyboardType="phone-pad" />
								</SectionCard>

								<SectionCard title="Address" icon="map-pin">
									<Field label="Address" value={form.company_address} onChange={(value) => set('company_address', value)} placeholder="Street address" multiline />
									<Field label="Country" value={form.company_country} onChange={(value) => set('company_country', value)} placeholder="Country" />
									<Field label="State" value={form.company_state} onChange={(value) => set('company_state', value)} placeholder="State" />
									<Field label="Country code" value={form.country_code} onChange={(value) => set('country_code', value)} placeholder="+234" keyboardType="phone-pad" />
								</SectionCard>

								<SectionCard title="Social links" icon="share-2">
									<Field label="Instagram" value={form.instagram} onChange={(value) => set('instagram', value)} placeholder="instagram.com/..." keyboardType="url" autoCapitalize="none" />
									<Field label="Twitter / X" value={form.twitter} onChange={(value) => set('twitter', value)} placeholder="x.com/..." keyboardType="url" autoCapitalize="none" />
									<Field label="Facebook" value={form.facebook} onChange={(value) => set('facebook', value)} placeholder="facebook.com/..." keyboardType="url" autoCapitalize="none" />
								</SectionCard>
							</>
						)}

						{step === 2 && (
							<>
								<SectionCard title="Stack" icon="code">
									<Field label="Front-end language" value={form.front_end_lan} onChange={(value) => set('front_end_lan', value)} placeholder="e.g. TypeScript" />
									<Field label="Front-end framework" value={form.front_end_framw} onChange={(value) => set('front_end_framw', value)} placeholder="e.g. React Native" />
									<Field label="Back-end language" value={form.back_end_lan} onChange={(value) => set('back_end_lan', value)} placeholder="e.g. Python" />
									<Field label="Back-end framework" value={form.back_end_framw} onChange={(value) => set('back_end_framw', value)} placeholder="e.g. Django" />
									<Field label="Git repository" value={form.git_url} onChange={(value) => set('git_url', value)} placeholder="https://github.com/..." keyboardType="url" autoCapitalize="none" />
									<Field label="Specifications" value={form.specifications} onChange={(value) => set('specifications', value)} placeholder="Anything the build team should know" multiline />
								</SectionCard>

								<SectionCard title="Server" icon="server">
									<Field label="Server type" value={form.server_type} onChange={(value) => set('server_type', value)} placeholder="e.g. Shared, VPS, Dedicated" />
									<Field label="Server size" value={form.server_size} onChange={(value) => set('server_size', value)} placeholder="e.g. 2 vCPU / 4GB" />
									<Field label="Product status" value={form.product_status} onChange={(value) => set('product_status', value)} placeholder="e.g. In progress" />
									<Field label="Project type" value={form.type} onChange={(value) => set('type', value)} placeholder="e.g. Website, Mobile App" />
								</SectionCard>

								<SectionCard title="Team" icon="users">
									<ToggleRow label="I need a team" description="Apsuni assigns developers to this project." value={form.need_team} onChange={(value) => set('need_team', value)} />
									{form.need_team && (
										<Field label="How many people?" value={form.team_no} onChange={(value) => set('team_no', value)} placeholder="e.g. 3" keyboardType="numeric" />
									)}
									<ToggleRow label="Allow Apsuni to showcase this project" description="We can use it as a portfolio reference." value={form.allow_usage} onChange={(value) => set('allow_usage', value)} />
								</SectionCard>
							</>
						)}

						{step === 3 && (
							<>
								<SectionCard title="Domain" icon="globe">
									<Field
										label="Domain name"
										value={form.domain}
										onChange={(value) => set('domain', value.toLowerCase().replace(/\s/g, ''))}
										placeholder="yourbrand"
										autoCapitalize="none"
										hint="Type the name only - pick the extension below."
										status={domainState.status === 'available' ? 'success' : domainState.status === 'taken' || domainState.status === 'invalid' ? 'error' : domainState.status === 'checking' ? 'checking' : domainState.status === 'error' ? 'warning' : undefined}
										message={domainState.message}
									/>
									<ChipGroup
										label="Extension"
										options={Object.keys(DOMAIN_EXTENSION_PRICES)}
										value={form.domain_extension}
										onSelect={(value) => set('domain_extension', value)}
									/>
									{form.domain && domainState.status === 'available' ? (
										<View style={styles.inlineNotice}>
											<Feather name="tag" size={13} color="#60A5FA" />
											<Text style={styles.inlineNoticeText}>
												{form.domain}{form.domain_extension} costs {money(domainPrice)} per year.
											</Text>
										</View>
									) : null}
									<Field label="Existing domain (if you already own one)" value={form.domain_name} onChange={(value) => set('domain_name', value)} placeholder="www.yourbrand.com" autoCapitalize="none" />
								</SectionCard>

								<SectionCard title="Hosting" icon="cloud">
									<ChipGroup
										label="Provider"
										options={Object.keys(HOSTING_PLANS)}
										value={form.hosting_provider}
										onSelect={(value) => { set('hosting_provider', value); set('hosting_plan', ''); }}
										allowClear
									/>

									{form.hosting_provider ? (HOSTING_PLANS[form.hosting_provider] || []).map((plan) => {
										const active = form.hosting_plan === plan.key;
										return (
											<TouchableOpacity
												key={plan.key}
												style={[styles.planCard, active && styles.planCardActive]}
												activeOpacity={0.85}
												onPress={() => set('hosting_plan', active ? '' : plan.key)}
											>
												<View style={styles.planTop}>
													<Text style={styles.planName}>{plan.name}</Text>
													<Text style={[styles.planPrice, active && styles.planPriceActive]}>{plan.price === 0 ? 'Free' : money(plan.price)}</Text>
												</View>
												<Text style={styles.planDescription}>{plan.description}</Text>
												<View style={styles.planFooter}>
													<TouchableOpacity onPress={() => Linking.openURL(plan.url).catch(() => undefined)} activeOpacity={0.7}>
														<Text style={styles.planLink}>Provider pricing</Text>
													</TouchableOpacity>
													{active && (
														<View style={styles.selectedPill}>
															<Feather name="check" size={11} color="#FFFFFF" />
															<Text style={styles.selectedPillText}>Selected</Text>
														</View>
													)}
												</View>
											</TouchableOpacity>
										);
									}) : (
										<Text style={styles.fieldHint}>Pick a provider to see its plans.</Text>
									)}

									<ToggleRow
										label="Deploy a test server"
										description="A staging environment before going live."
										price={PRICE_LIST.deploy_server}
										value={form.testing_server}
										onChange={(value) => set('testing_server', value)}
									/>
								</SectionCard>
							</>
						)}

						{step === 4 && (
							<>
								<SectionCard title="Mobile builds & stores" icon="smartphone">
									{!isMobileApp && (
										<View style={styles.inlineNotice}>
											<Feather name="info" size={13} color="#FBBF24" />
											<Text style={styles.inlineNoticeText}>These only apply to mobile app projects.</Text>
										</View>
									)}
									<ToggleRow label="iOS build" price={PRICE_LIST.need_ios} value={form.ios} onChange={(value) => set('ios', value)} disabled={!isMobileApp} />
									<ToggleRow label="Android build" price={PRICE_LIST.need_android_app} value={form.android} onChange={(value) => set('android', value)} disabled={!isMobileApp} />
									<ToggleRow label="Play Store deployment" price={PRICE_LIST.deploy_play_store} value={form.play_store} onChange={(value) => set('play_store', value)} disabled={!isMobileApp} />
									<ToggleRow label="App Store deployment" price={PRICE_LIST.deploy_app_store} value={form.app_store} onChange={(value) => set('app_store', value)} disabled={!isMobileApp} />
									<ToggleRow label="Apsuni Play Store" description="Publish under the Apsuni developer account." price={PRICE_LIST.deploy_apsuni_playstore} value={form.apsuni_play_store} onChange={(value) => set('apsuni_play_store', value)} disabled={!isMobileApp} />
									<ToggleRow label="Apsuni App Store" description="Publish under the Apsuni developer account." price={PRICE_LIST.deploy_apsuni_appstore} value={form.apsuni_app_store} onChange={(value) => set('apsuni_app_store', value)} disabled={!isMobileApp} />
								</SectionCard>

								<SectionCard title="Business registration" icon="shield">
									{Object.entries(LLC_OPTIONS).map(([name, price]) => {
										const active = form.llc === name;
										return (
											<TouchableOpacity key={name} style={[styles.optionRow, active && styles.optionRowActive]} activeOpacity={0.85} onPress={() => set('llc', active ? '' : name)}>
												<View style={[styles.radio, active && styles.radioActive]}>{active && <View style={styles.radioDot} />}</View>
												<Text style={styles.optionLabel}>{name}</Text>
												<Text style={styles.optionPrice}>{money(price)}</Text>
											</TouchableOpacity>
										);
									})}
								</SectionCard>

								<SectionCard title="Official email accounts" icon="mail">
									<Text style={styles.fieldHint}>{money(OFFICIAL_EMAIL_PRICE)} per account.</Text>
									<View style={styles.emailRow}>
										<TextInput
											value={emailDraft}
											onChangeText={setEmailDraft}
											placeholder="name@yourbrand.com"
											placeholderTextColor="#64748B"
											style={[styles.input, styles.emailInput]}
											keyboardType="email-address"
											autoCapitalize="none"
											onSubmitEditing={addEmail}
											returnKeyType="done"
										/>
										<TouchableOpacity style={styles.addEmailButton} activeOpacity={0.85} onPress={addEmail}>
											<Feather name="plus" size={18} color="#FFFFFF" />
										</TouchableOpacity>
									</View>
									<View style={styles.tagWrap}>
										{form.emails.map((email: string, index: number) => (
											<View key={email} style={styles.tag}>
												<Text style={styles.tagText}>{email}</Text>
												<TouchableOpacity onPress={() => set('emails', form.emails.filter((_: string, i: number) => i !== index))} accessibilityLabel={`Remove ${email}`}>
													<Feather name="x" size={13} color="#94A3B8" />
												</TouchableOpacity>
											</View>
										))}
									</View>
								</SectionCard>

								<SectionCard title="AI subscriptions" icon="cpu">
									{Object.entries(AI_OPTIONS).map(([name, price]) => {
										const active = form.ai_options.includes(name);
										return (
											<TouchableOpacity key={name} style={[styles.optionRow, active && styles.optionRowActive]} activeOpacity={0.85} onPress={() => toggleAiOption(name)}>
												<View style={[styles.checkbox, active && styles.checkboxActive]}>{active && <Feather name="check" size={12} color="#FFFFFF" />}</View>
												<Text style={styles.optionLabel}>{name}</Text>
												<Text style={styles.optionPrice}>{money(price)}</Text>
											</TouchableOpacity>
										);
									})}
								</SectionCard>
							</>
						)}

						{step === 5 && (
							<>
								<SectionCard title="Cost breakdown" icon="file-text">
									{lineItems.map((item, index) => (
										<View key={`${item.label}-${index}`} style={styles.summaryRow}>
											<Text style={styles.summaryLabel} numberOfLines={2}>{item.label}</Text>
											<Text style={styles.summaryValue}>{item.amount === 0 ? 'Free' : money(item.amount)}</Text>
										</View>
									))}
									<View style={styles.summaryTotalRow}>
										<Text style={styles.summaryTotalLabel}>Total</Text>
										<Text style={styles.summaryTotalValue}>{money(totalAmount)}</Text>
									</View>
								</SectionCard>

								<SectionCard title="Project summary" icon="check-circle">
									<View style={styles.summaryRow}><Text style={styles.summaryLabel}>Title</Text><Text style={styles.summaryValue} numberOfLines={2}>{form.title || 'Not set'}</Text></View>
									<View style={styles.summaryRow}><Text style={styles.summaryLabel}>Category</Text><Text style={styles.summaryValue}>{form.selectedOption || 'Not set'}</Text></View>
									<View style={styles.summaryRow}><Text style={styles.summaryLabel}>Owner</Text><Text style={styles.summaryValue}>{form.status}</Text></View>
									<View style={styles.summaryRow}><Text style={styles.summaryLabel}>Project type</Text><Text style={styles.summaryValue}>{normalizeProductType(rawProductType) || 'Not set'}</Text></View>
									<View style={styles.summaryRow}><Text style={styles.summaryLabel}>Domain</Text><Text style={styles.summaryValue}>{form.domain ? `${form.domain}${form.domain_extension}` : 'None'}</Text></View>
									<View style={styles.summaryRow}><Text style={styles.summaryLabel}>Hosting</Text><Text style={styles.summaryValue}>{selectedHostingPlan ? `${form.hosting_provider} ${selectedHostingPlan.name}` : 'None'}</Text></View>
									<View style={styles.summaryRow}><Text style={styles.summaryLabel}>Emails</Text><Text style={styles.summaryValue}>{form.emails.length || 'None'}</Text></View>
								</SectionCard>
							</>
						)}
					</Animated.View>
				</ScrollView>

				{/* Sticky footer */}
				<View style={styles.footer}>
					<View style={styles.footerTotal}>
						<Text style={styles.footerTotalLabel}>Total</Text>
						<Text style={styles.footerTotalValue}>{money(totalAmount)}</Text>
					</View>
					<View style={styles.footerButtons}>
						{step > 0 && (
							<TouchableOpacity style={styles.backButton} activeOpacity={0.85} onPress={() => goToStep(step - 1)}>
								<Feather name="chevron-left" size={16} color="#CBD5E1" />
								<Text style={styles.backButtonText}>Back</Text>
							</TouchableOpacity>
						)}
						{step < STEPS.length - 1 ? (
							<TouchableOpacity style={styles.nextButton} activeOpacity={0.85} onPress={() => goToStep(step + 1)}>
								<Text style={styles.nextButtonText}>Next</Text>
								<Feather name="chevron-right" size={16} color="#FFFFFF" />
							</TouchableOpacity>
						) : (
							<TouchableOpacity style={[styles.nextButton, styles.saveButton]} activeOpacity={0.85} onPress={submit} disabled={isSaving}>
								{isSaving ? <ActivityIndicator size="small" color="#FFFFFF" /> : (
									<>
										<Feather name="check" size={16} color="#FFFFFF" />
										<Text style={styles.nextButtonText}>Save changes</Text>
									</>
								)}
							</TouchableOpacity>
						)}
					</View>
				</View>
			</KeyboardAvoidingView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: 'transparent' },
	flex: { flex: 1 },

	stepper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14 },
	stepDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#172235', borderWidth: 1, borderColor: '#24334A' },
	stepDotActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
	stepDotText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
	stepDotTextActive: { color: '#FFFFFF' },
	stepLine: { flex: 1, height: 2, backgroundColor: '#1C2941', marginHorizontal: 4 },
	stepLineDone: { backgroundColor: '#2563EB' },

	scrollContent: { paddingHorizontal: 16, paddingBottom: 130 },
	stepTitle: { fontSize: 21, fontWeight: '800', color: '#FFFFFF' },
	stepHint: { fontSize: 12, color: '#94A3B8', marginTop: 5, marginBottom: 16 },

	sectionCard: { backgroundColor: '#111A28', borderRadius: 18, borderWidth: 1, borderColor: '#24334A', padding: 16, marginBottom: 14 },
	sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
	sectionIcon: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(37, 99, 235, 0.18)' },
	sectionTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

	field: { marginBottom: 14 },
	fieldLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.4 },
	fieldHint: { fontSize: 11, color: '#64748B', marginTop: 6, lineHeight: 16 },
	input: { backgroundColor: '#0E1726', borderRadius: 12, borderWidth: 1, borderColor: '#24334A', paddingHorizontal: 13, paddingVertical: 11, color: '#FFFFFF', fontSize: 13 },
	inputMultiline: { minHeight: 84, textAlignVertical: 'top' },
	inputFocused: { borderColor: '#2563EB' },
	inputSuccess: { borderColor: '#22C55E', backgroundColor: 'rgba(34, 197, 94, 0.08)' },
	inputError: { borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.08)' },
	statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 8 },
	statusText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600', color: '#94A3B8' },
	promptInput: { minHeight: 120, paddingBottom: 52 },
	attachButton: { position: 'absolute', right: 10, bottom: 10, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563EB', elevation: 4, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
	fileList: { gap: 8, marginTop: 12 },
	fileChip: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: '#0E1726', borderWidth: 1, borderColor: '#24334A' },
	fileChipNew: { borderColor: 'rgba(74, 222, 128, 0.4)', backgroundColor: 'rgba(22, 163, 74, 0.08)' },
	fileIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(37, 99, 235, 0.16)' },
	fileIconNew: { backgroundColor: 'rgba(34, 197, 94, 0.16)' },
	fileInfo: { flex: 1, minWidth: 0 },
	fileName: { fontSize: 12.5, fontWeight: '600', color: '#F1F5F9' },
	fileMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },

	chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
	chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#172235', borderWidth: 1, borderColor: '#24334A' },
	chipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
	chipText: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
	chipTextActive: { color: '#FFFFFF', fontWeight: '700' },

	toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#1C2941' },
	toggleRowDisabled: { opacity: 0.5 },
	toggleCopy: { flex: 1, minWidth: 0 },
	toggleLabel: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
	toggleDescription: { fontSize: 11, color: '#64748B', marginTop: 3, lineHeight: 16 },
	togglePrice: { fontSize: 11, fontWeight: '700', color: '#4ADE80', marginTop: 4 },
	mutedText: { color: '#64748B' },

	inlineNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#172235', borderRadius: 11, borderWidth: 1, borderColor: '#24334A', paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
	inlineNoticeText: { flex: 1, fontSize: 11, color: '#CBD5E1', lineHeight: 16 },

	planCard: { backgroundColor: '#0E1726', borderRadius: 14, borderWidth: 1, borderColor: '#24334A', padding: 13, marginBottom: 10 },
	planCardActive: { borderColor: '#2563EB', backgroundColor: '#122038' },
	planTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
	planName: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
	planPrice: { fontSize: 13, fontWeight: '800', color: '#94A3B8' },
	planPriceActive: { color: '#60A5FA' },
	planDescription: { fontSize: 11, color: '#94A3B8', lineHeight: 17, marginTop: 6 },
	planFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
	planLink: { fontSize: 11, fontWeight: '700', color: '#60A5FA', textDecorationLine: 'underline' },
	selectedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2563EB', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
	selectedPillText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },

	optionRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#24334A', backgroundColor: '#0E1726', marginBottom: 9 },
	optionRowActive: { borderColor: '#2563EB', backgroundColor: '#122038' },
	optionLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
	optionPrice: { fontSize: 12, fontWeight: '700', color: '#4ADE80' },
	radio: { width: 19, height: 19, borderRadius: 10, borderWidth: 2, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' },
	radioActive: { borderColor: '#2563EB' },
	radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#2563EB' },
	checkbox: { width: 19, height: 19, borderRadius: 6, borderWidth: 2, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' },
	checkboxActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },

	emailRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 10 },
	emailInput: { flex: 1 },
	addEmailButton: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563EB' },
	tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
	tag: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, backgroundColor: '#172235', borderWidth: 1, borderColor: '#24334A' },
	tagText: { fontSize: 11, color: '#E2E8F0', fontWeight: '600' },

	summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1C2941' },
	summaryLabel: { flex: 1, fontSize: 12, color: '#94A3B8' },
	summaryValue: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', textAlign: 'right', flexShrink: 1 },
	summaryTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14 },
	summaryTotalLabel: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
	summaryTotalValue: { fontSize: 20, fontWeight: '800', color: '#4ADE80' },

	footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 22, backgroundColor: '#0B1422', borderTopWidth: 1, borderTopColor: '#24334A' },
	footerTotal: { minWidth: 0 },
	footerTotalLabel: { fontSize: 9, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
	footerTotalValue: { fontSize: 17, fontWeight: '800', color: '#4ADE80', marginTop: 2 },
	footerButtons: { flexDirection: 'row', alignItems: 'center', gap: 9 },
	backButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 13, height: 42, borderRadius: 12, backgroundColor: '#172235', borderWidth: 1, borderColor: '#24334A' },
	backButtonText: { fontSize: 13, fontWeight: '700', color: '#CBD5E1' },
	nextButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 17, height: 42, borderRadius: 12, backgroundColor: '#2563EB' },
	saveButton: { backgroundColor: '#16A34A' },
	nextButtonText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },

	stateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
	stateText: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
});

const logoStyles = StyleSheet.create({
	row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
	box: { width: 84, height: 84, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(148,163,184,0.5)', backgroundColor: 'rgba(148,163,184,0.1)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
	image: { width: '100%', height: '100%' },
	title: { fontSize: 15, fontWeight: '700', color: '#F8FAFC' },
	hint: { marginTop: 3, fontSize: 12, lineHeight: 17, color: '#94A3B8' },
	actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
	button: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: '#1E40AF' },
	buttonText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
	ghost: { paddingHorizontal: 10, paddingVertical: 8 },
	ghostText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
});
