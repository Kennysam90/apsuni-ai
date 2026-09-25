import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Feather } from '../../../theme/vector-icons';
import * as Haptics from 'expo-haptics';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { LinearGradient } from '../../../theme/linear-gradient';
import type * as FileSystemModule from 'expo-file-system';
import type * as MailComposerModule from 'expo-mail-composer';
import type * as SharingModule from 'expo-sharing';
import {
	ActivityIndicator,
	Animated,
	Dimensions,
	Easing,
	Modal,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from '../../../theme/native';
import AppBackground from '../../components/AppBackground';
import AppHeader from '../../components/AppHeader';
import { getBusinessSuggestions, getProfile, sendAssistantMessage } from '../../services/api';
import { buildBusinessGuidePdf, guideFileName } from '../../services/businessGuidePdf';

import { friendlyError } from '../../services/errors';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type BusinessIdea = {
	id: string;
	title: string;
	summary: string;
	raw: string;
};

type IdeaSection = {
	title: string;
	icon: keyof typeof Feather.glyphMap;
	paragraphs: string[];
	bullets: string[];
	numbered: boolean;
};

type EmailState =
	| { status: 'idle' }
	| { status: 'sending' }
	| { status: 'sent'; mode: 'mail' | 'share'; email: string }
	| { status: 'error'; message: string };

/**
 * The only sections the guide shows, in render order. Anything else the
 * assistant replies with is dropped, so no extra topics leak in.
 */
const SECTION_PLAN = [
	{ key: 'about', title: 'About This Idea', icon: 'info', numbered: false, match: ['about', 'overview', 'description', 'what it is'] },
	{ key: 'startup', title: 'What You Need To Start', icon: 'package', numbered: false, match: ['need to start', 'requirement', 'capital', 'cost', 'equipment', 'tool'] },
	{ key: 'steps', title: 'Step By Step Startup Plan', icon: 'play-circle', numbered: true, match: ['step', 'plan', 'how to start', 'launch'] },
	{ key: 'manage', title: 'How To Manage The Business', icon: 'settings', numbered: false, match: ['manage', 'run', 'operat', 'daily'] },
	{ key: 'income', title: 'How You Make Money', icon: 'dollar-sign', numbered: false, match: ['money', 'income', 'revenue', 'profit', 'earn', 'price'] },
	{ key: 'risks', title: 'Risks And Challenges', icon: 'alert-triangle', numbered: false, match: ['risk', 'challenge', 'mistake', 'problem'] },
] as const;

function buildPrompt(idea: string, country: string) {
	return [
		`Business idea: ${idea}`,
		country ? `Country: ${country}` : 'Country: not specified',
		'',
		'Explain this business idea for a complete beginner.',
		'Use exactly these markdown headings, in this order, and nothing else:',
		...SECTION_PLAN.map((section) => `## ${section.title}`),
		'',
		'Put 3-5 short bullet points under each heading. Keep every bullet under 25 words.',
		'Do not add any other heading, preamble or closing remark.',
	].join('\n');
}

/** Map an arbitrary reply heading onto our fixed plan; null means discard it. */
function matchSection(heading: string) {
	const value = heading.toLowerCase();
	return SECTION_PLAN.find((section) => section.match.some((keyword) => value.includes(keyword))) ?? null;
}

function cleanInline(line: string) {
	return line
		.replace(/\*\*/g, '')
		.replace(/^[*_]+|[*_]+$/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function isHeading(line: string) {
	if (/^#{1,4}\s+/.test(line)) return cleanInline(line.replace(/^#{1,4}\s+/, '')).replace(/:$/, '');
	const bold = line.match(/^\*\*(.{3,70}?)\*\*:?\s*$/);
	if (bold) return cleanInline(bold[1]).replace(/:$/, '');
	const plain = line.match(/^([A-Z][A-Za-z0-9 &/'-]{3,60}):\s*$/);
	if (plain) return cleanInline(plain[1]);
	return null;
}

/**
 * Turn the assistant's markdown reply into our six fixed sections. Content
 * under an unrecognised heading is thrown away rather than shown.
 */
function parseSections(reply: string): IdeaSection[] {
	const collected = new Map<string, { paragraphs: string[]; bullets: string[] }>();
	let currentKey: string | null = 'about';

	for (const rawLine of reply.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line) continue;

		const heading = isHeading(line);
		if (heading) {
			currentKey = matchSection(heading)?.key ?? null;
			continue;
		}

		if (!currentKey) continue;

		const bucket = collected.get(currentKey) ?? { paragraphs: [], bullets: [] };
		const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
		if (bullet) bucket.bullets.push(cleanInline(bullet[1]));
		else bucket.paragraphs.push(cleanInline(line));
		collected.set(currentKey, bucket);
	}

	return SECTION_PLAN.flatMap((section) => {
		const bucket = collected.get(section.key);
		if (!bucket || (bucket.paragraphs.length === 0 && bucket.bullets.length === 0)) return [];
		return [{
			title: section.title,
			icon: section.icon as keyof typeof Feather.glyphMap,
			paragraphs: bucket.paragraphs,
			bullets: bucket.bullets,
			numbered: section.numbered,
		}];
	});
}

/** Ideas arrive as a single string. Split the headline from the explanation. */
function parseIdea(raw: string, index: number): BusinessIdea {
	const text = raw.replace(/^\s*\d+[.)]\s*/, '').replace(/\*\*/g, '').trim();
	const separator = text.match(/\s[–—-]\s|:\s/);

	let title = text;
	let summary = '';

	if (separator?.index != null) {
		title = text.slice(0, separator.index).trim();
		summary = text.slice(separator.index + separator[0].length).trim();
	} else {
		const sentenceEnd = text.indexOf('. ');
		if (sentenceEnd > 12 && sentenceEnd < 90) {
			title = text.slice(0, sentenceEnd).trim();
			summary = text.slice(sentenceEnd + 2).trim();
		}
	}

	return { id: `idea-${index}`, title, summary, raw: text };
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Native modules are loaded only when the PDF button is pressed. An app build
 * made before these packages were installed throws on import, so check that
 * the native side exists first (this check does not throw) and only then load
 * the JS packages. That avoids both a crash and the dev error overlay.
 */
function loadExportModules() {
	if (!requireOptionalNativeModule('ExpoMailComposer') || !requireOptionalNativeModule('ExpoSharing')) {
		return null;
	}
	try {
		return {
			FileSystem: require('expo-file-system') as typeof FileSystemModule,
			MailComposer: require('expo-mail-composer') as typeof MailComposerModule,
			Sharing: require('expo-sharing') as typeof SharingModule,
		};
	} catch {
		return null;
	}
}

/** A slow opacity pulse shared by the loading placeholders. */
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

function SkeletonCard() {
	const pulse = usePulse();
	return (
		<Animated.View style={[styles.card, { opacity: pulse }]}>
			<View style={styles.cardHead}>
				<View style={[styles.skeletonBar, { width: 26, height: 14 }]} />
				<View style={[styles.skeletonBar, { width: 90, height: 14, marginLeft: 10 }]} />
			</View>
			<View style={[styles.skeletonBar, { width: '82%', height: 18, marginTop: 16 }]} />
			<View style={[styles.skeletonBar, { width: '60%', height: 18, marginTop: 8 }]} />
			<View style={[styles.skeletonBar, { width: '95%', height: 11, marginTop: 14 }]} />
			<View style={[styles.skeletonBar, { width: '72%', height: 11, marginTop: 7 }]} />
		</Animated.View>
	);
}

function GuideSkeleton() {
	const pulse = usePulse();
	return (
		<Animated.View style={{ opacity: pulse, marginTop: 26 }}>
			{[0, 1, 2].map((block) => (
				<View key={block} style={styles.guideSection}>
					<View style={[styles.skeletonBar, { width: 64, height: 10 }]} />
					<View style={[styles.skeletonBar, { width: '58%', height: 16, marginTop: 10 }]} />
					<View style={[styles.skeletonBar, { width: '100%', height: 11, marginTop: 16 }]} />
					<View style={[styles.skeletonBar, { width: '88%', height: 11, marginTop: 8 }]} />
					<View style={[styles.skeletonBar, { width: '76%', height: 11, marginTop: 8 }]} />
				</View>
			))}
			<Text style={[styles.stateText, { marginTop: 4 }]}>Apsuni AI is writing your guide…</Text>
		</Animated.View>
	);
}

function IdeaCard({ idea, index, onPress }: { idea: BusinessIdea; index: number; onPress: () => void }) {
	const entrance = useRef(new Animated.Value(0)).current;
	const press = useRef(new Animated.Value(1)).current;

	useEffect(() => {
		Animated.timing(entrance, {
			toValue: 1,
			duration: 460,
			delay: Math.min(index, 8) * 70,
			easing: Easing.out(Easing.cubic),
			useNativeDriver: true,
		}).start();
	}, [entrance, index]);

	const animateTo = (value: number) =>
		Animated.spring(press, { toValue: value, useNativeDriver: true, friction: 7, tension: 120 }).start();

	return (
		<Animated.View
			style={{
				opacity: entrance,
				transform: [
					{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
					{ scale: press },
				],
			}}
		>
			<Pressable
				onPress={onPress}
				onPressIn={() => animateTo(0.98)}
				onPressOut={() => animateTo(1)}
				accessibilityRole="button"
				accessibilityLabel={`Open the guide for ${idea.title}`}
			>
				<View style={styles.card}>
					<View style={styles.cardHead}>
						<Text style={styles.cardIndex}>{pad(index + 1)}</Text>
						<View style={styles.cardTag}>
							<Feather name="zap" size={10} color="#93C5FD" />
							<Text style={styles.cardTagText}>AI GENERATED</Text>
						</View>
						<View style={styles.cardArrow}>
							<Feather name="arrow-up-right" size={16} color="#CBD5E1" />
						</View>
					</View>

					<Text style={styles.ideaTitle} numberOfLines={2}>{idea.title}</Text>
					<Text style={styles.ideaSummary} numberOfLines={3}>
						{idea.summary || 'Open the full launch guide for this idea.'}
					</Text>

					<View style={styles.cardDivider} />

					<View style={styles.cardFooter}>
						<View style={styles.cardMeta}>
							<Feather name="layers" size={12} color="#64748B" />
							<Text style={styles.cardMetaText}>{SECTION_PLAN.length}-part guide</Text>
						</View>
						<View style={styles.cardMeta}>
							<Feather name="file-text" size={12} color="#64748B" />
							<Text style={styles.cardMetaText}>PDF to email</Text>
						</View>
						<Text style={styles.readGuide}>Read guide</Text>
					</View>
				</View>
			</Pressable>
		</Animated.View>
	);
}

export default function BusinessIdeaScreen() {
	const [country, setCountry] = useState('');
	const [appliedCountry, setAppliedCountry] = useState('');
	const [ideas, setIdeas] = useState<BusinessIdea[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [selectedIdea, setSelectedIdea] = useState<BusinessIdea | null>(null);
	const [isSheetMounted, setIsSheetMounted] = useState(false);
	const [detailLoading, setDetailLoading] = useState(false);
	const [detailError, setDetailError] = useState<string | null>(null);
	const [sections, setSections] = useState<IdeaSection[]>([]);
	const [emailState, setEmailState] = useState<EmailState>({ status: 'idle' });

	const backdrop = useRef(new Animated.Value(0)).current;
	const sheetY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
	const detailScrollRef = useRef<ScrollView | null>(null);
	const sectionOffsets = useRef<number[]>([]);
	const detailRequestId = useRef(0);

	const loadIdeas = useCallback(async (requestedCountry: string, mode: 'initial' | 'refresh') => {
		if (mode === 'refresh') setIsRefreshing(true);
		else setIsLoading(true);
		setError(null);

		try {
			const response = await getBusinessSuggestions(requestedCountry.trim());
			setIdeas((response.ideas ?? []).filter(Boolean).map(parseIdea));
			setAppliedCountry(requestedCountry.trim());
		} catch (requestError) {
			setError(friendlyError(requestError, 'Unable to load business ideas.'));
		} finally {
			setIsLoading(false);
			setIsRefreshing(false);
		}
	}, []);

	useEffect(() => {
		loadIdeas('', 'initial');
	}, [loadIdeas]);

	const loadIdeaDetails = useCallback(async (idea: BusinessIdea, requestedCountry: string) => {
		const requestId = ++detailRequestId.current;
		setDetailError(null);
		setSections([]);
		sectionOffsets.current = [];
		setDetailLoading(true);

		try {
			const guide = await sendAssistantMessage(buildPrompt(idea.raw, requestedCountry));
			if (requestId !== detailRequestId.current) return;
			const parsed = parseSections(guide.reply_text || '');
			if (parsed.length === 0) setDetailError('Could not load the details for this idea.');
			else setSections(parsed);
		} catch (requestError) {
			if (requestId !== detailRequestId.current) return;
			setDetailError(friendlyError(requestError, 'Could not load the details for this idea.'));
		} finally {
			if (requestId === detailRequestId.current) setDetailLoading(false);
		}
	}, []);

	const openIdea = (idea: BusinessIdea) => {
		setSelectedIdea(idea);
		setEmailState({ status: 'idle' });
		setIsSheetMounted(true);

		backdrop.setValue(0);
		sheetY.setValue(SCREEN_HEIGHT);
		Animated.parallel([
			Animated.timing(backdrop, { toValue: 1, duration: 240, useNativeDriver: true }),
			Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, friction: 10, tension: 65 }),
		]).start();

		loadIdeaDetails(idea, appliedCountry);
	};

	const closeIdea = () => {
		detailRequestId.current += 1; // ignore a guide that is still generating
		Animated.parallel([
			Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
			Animated.timing(sheetY, { toValue: SCREEN_HEIGHT, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
		]).start(({ finished }) => {
			if (!finished) return;
			setIsSheetMounted(false);
			setSelectedIdea(null);
			setDetailLoading(false);
		});
	};

	const jumpToSection = (index: number) => {
		const offset = sectionOffsets.current[index];
		if (offset != null) detailScrollRef.current?.scrollTo({ y: Math.max(0, offset - 12), animated: true });
	};

	/**
	 * Builds the PDF on the device, then opens the email app with it attached and
	 * the user's address filled in. Falls back to the share sheet when no email
	 * app is set up. No server endpoint is involved.
	 */
	const emailPdf = async () => {
		if (!selectedIdea || sections.length === 0 || emailState.status === 'sending') return;
		setEmailState({ status: 'sending' });
		const modules = loadExportModules();
		if (!modules) {
			setEmailState({ status: 'error', message: 'PDF export needs the latest app build. Rebuild or update the app, then try again.' });
			return;
		}
		const { FileSystem, MailComposer, Sharing } = modules;
		try {
			const profile = await getProfile().catch(() => null);
			const name = profile?.first_name?.trim() || profile?.username || '';
			const email = profile?.email ?? '';

			const pdfBytes = buildBusinessGuidePdf({
				title: selectedIdea.title,
				summary: selectedIdea.summary,
				country: appliedCountry,
				preparedFor: name,
				sections: sections.map(({ title, paragraphs, bullets, numbered }) => ({ title, paragraphs, bullets, numbered })),
			});

			const file = new FileSystem.File(FileSystem.Paths.cache, `${guideFileName(selectedIdea.title)}.pdf`);
			file.write(pdfBytes);

			if (await MailComposer.isAvailableAsync()) {
				await MailComposer.composeAsync({
					recipients: email ? [email] : [],
					subject: `Your business guide: ${selectedIdea.title}`,
					body: `Hi ${name || 'there'},\n\nYour Apsuni AI business guide for "${selectedIdea.title}" is attached as a PDF.\n\nApsuni AI`,
					attachments: [file.uri],
				});
				setEmailState({ status: 'sent', mode: 'mail', email });
			} else if (await Sharing.isAvailableAsync()) {
				await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Send your business guide', UTI: 'com.adobe.pdf' });
				setEmailState({ status: 'sent', mode: 'share', email });
			} else {
				throw new Error('No email or sharing app is set up on this device.');
			}
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
		} catch (requestError) {
			setEmailState({ status: 'error', message: friendlyError(requestError, 'Could not create the PDF.') });
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
		}
	};

	const canEmail = !detailLoading && !detailError && sections.length > 0 && emailState.status !== 'sending';

	return (
		<View style={styles.container}>
			<AppBackground />
			<AppHeader />

			<ScrollView
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				keyboardShouldPersistTaps="handled"
				refreshControl={
					<RefreshControl refreshing={isRefreshing} onRefresh={() => loadIdeas(country, 'refresh')} tintColor="#60A5FA" colors={['#60A5FA']} />
				}
			>
				{/* ---- Market filter ---- */}
				<View style={styles.controlsRow}>
					<View style={styles.countryField}>
						<Feather name="map-pin" size={15} color="#64748B" />
						<TextInput
							value={country}
							onChangeText={setCountry}
							placeholder="Country or region (optional)"
							placeholderTextColor="#64748B"
							style={styles.countryInput}
							returnKeyType="search"
							onSubmitEditing={() => loadIdeas(country, 'refresh')}
						/>
						{country.length > 0 && (
							<TouchableOpacity onPress={() => setCountry('')} accessibilityLabel="Clear country">
								<Feather name="x-circle" size={15} color="#94A3B8" />
							</TouchableOpacity>
						)}
					</View>
					<TouchableOpacity
						style={styles.regenerateButton}
						activeOpacity={0.85}
						onPress={() => loadIdeas(country, 'refresh')}
						disabled={isRefreshing || isLoading}
						accessibilityLabel="Generate a new set of ideas"
					>
						{isRefreshing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Feather name="refresh-cw" size={17} color="#FFFFFF" />}
					</TouchableOpacity>
				</View>

				<View style={styles.listHeader}>
					<Text style={styles.listTitle}>Today's ideas</Text>
					{!isLoading && !error && <Text style={styles.listCount}>{ideas.length} {ideas.length === 1 ? 'idea' : 'ideas'}</Text>}
				</View>

				{/* ---- Ideas ---- */}
				{isLoading ? (
					[0, 1, 2].map((key) => <SkeletonCard key={key} />)
				) : error ? (
					<View style={styles.stateContainer}>
						<View style={styles.stateIcon}><Feather name="alert-circle" size={20} color="#FB7185" /></View>
						<Text style={styles.stateTitle}>Couldn't load ideas</Text>
						<Text style={styles.stateText}>{error}</Text>
						<TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={() => loadIdeas(country, 'refresh')}>
							<Text style={styles.secondaryButtonText}>Try again</Text>
						</TouchableOpacity>
					</View>
				) : ideas.length === 0 ? (
					<View style={styles.stateContainer}>
						<View style={styles.stateIcon}><Feather name="compass" size={20} color="#60A5FA" /></View>
						<Text style={styles.stateTitle}>No ideas yet</Text>
						<Text style={styles.stateText}>Pull down or tap refresh to generate a new set.</Text>
					</View>
				) : (
					ideas.map((idea, index) => (
						<IdeaCard key={idea.id} idea={idea} index={index} onPress={() => openIdea(idea)} />
					))
				)}
			</ScrollView>

			{/* ---- Guide sheet ---- */}
			<Modal visible={isSheetMounted} transparent statusBarTranslucent animationType="none" onRequestClose={closeIdea}>
				<View style={styles.sheetRoot}>
					<Animated.View style={[styles.sheetBackdrop, { opacity: backdrop }]}>
						<Pressable style={StyleSheet.absoluteFillObject} onPress={closeIdea} accessibilityLabel="Close guide" />
					</Animated.View>

					<Animated.View style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
						<View style={styles.sheetHandle} />

						<View style={styles.sheetTopBar}>
							<View style={styles.sheetBrand}>
								<LinearGradient colors={['#2563EB', '#60A5FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sheetBrandMark}>
									<Feather name="zap" size={12} color="#FFFFFF" />
								</LinearGradient>
								<Text style={styles.sheetEyebrow}>BUSINESS GUIDE</Text>
							</View>
							<TouchableOpacity style={styles.closeButton} activeOpacity={0.8} onPress={closeIdea} accessibilityLabel="Close guide">
								<Feather name="x" size={18} color="#E2E8F0" />
							</TouchableOpacity>
						</View>

						<ScrollView
							ref={detailScrollRef}
							style={styles.sheetScroll}
							contentContainerStyle={styles.sheetScrollContent}
							showsVerticalScrollIndicator={false}
						>
							<Text style={styles.detailTitle}>{selectedIdea?.title}</Text>
							{selectedIdea?.summary ? <Text style={styles.detailSummary}>{selectedIdea.summary}</Text> : null}

							<View style={styles.detailMetaRow}>
								<View style={styles.metaPill}>
									<Feather name="map-pin" size={11} color="#93C5FD" />
									<Text style={styles.metaPillText}>{appliedCountry || 'Global market'}</Text>
								</View>
								<View style={styles.metaPill}>
									<Feather name="layers" size={11} color="#93C5FD" />
									<Text style={styles.metaPillText}>{sections.length || SECTION_PLAN.length} sections</Text>
								</View>
								<View style={styles.metaPill}>
									<Feather name="cpu" size={11} color="#93C5FD" />
									<Text style={styles.metaPillText}>Apsuni AI</Text>
								</View>
							</View>

							{detailLoading ? (
								<GuideSkeleton />
							) : detailError ? (
								<View style={styles.stateContainer}>
									<View style={styles.stateIcon}><Feather name="alert-circle" size={20} color="#FB7185" /></View>
									<Text style={styles.stateText}>{detailError}</Text>
									<TouchableOpacity
										style={styles.secondaryButton}
										activeOpacity={0.85}
										onPress={() => selectedIdea && loadIdeaDetails(selectedIdea, appliedCountry)}
									>
										<Text style={styles.secondaryButtonText}>Retry</Text>
									</TouchableOpacity>
								</View>
							) : (
								<>
									{/* Contents: jump straight to a section. */}
									<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tocRow} style={styles.toc}>
										{sections.map((section, index) => (
											<TouchableOpacity key={section.title} style={styles.tocChip} activeOpacity={0.8} onPress={() => jumpToSection(index)}>
												<Text style={styles.tocIndex}>{pad(index + 1)}</Text>
												<Text style={styles.tocText}>{section.title}</Text>
											</TouchableOpacity>
										))}
									</ScrollView>

									{sections.map((section, sectionIndex) => (
										<View
											key={section.title}
											style={styles.guideSection}
											onLayout={(event) => { sectionOffsets.current[sectionIndex] = event.nativeEvent.layout.y; }}
										>
											<View style={styles.guideSectionHead}>
												<View style={styles.guideSectionHeadText}>
													<Text style={styles.guideSectionIndex}>SECTION {pad(sectionIndex + 1)}</Text>
													<Text style={styles.guideSectionTitle}>{section.title}</Text>
												</View>
												<View style={styles.guideSectionIcon}>
													<Feather name={section.icon} size={15} color="#93C5FD" />
												</View>
											</View>

											{section.paragraphs.map((paragraph, index) => (
												<Text key={`p-${index}`} style={styles.paragraph}>{paragraph}</Text>
											))}

											{section.bullets.map((bullet, index) =>
												section.numbered ? (
													<View key={`b-${index}`} style={styles.stepRow}>
														<View style={styles.stepRail}>
															<View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{index + 1}</Text></View>
															{index < section.bullets.length - 1 && <View style={styles.stepLine} />}
														</View>
														<Text style={styles.stepText}>{bullet}</Text>
													</View>
												) : (
													<View key={`b-${index}`} style={styles.bulletRow}>
														<View style={styles.bulletMark} />
														<Text style={styles.bulletText}>{bullet}</Text>
													</View>
												),
											)}
										</View>
									))}

									<Text style={styles.disclaimer}>
										AI-generated starting point. Check costs, licensing and local regulations before you invest.
									</Text>
								</>
							)}
						</ScrollView>

						{/* ---- Export bar ---- */}
						<View style={styles.actionBar}>
							{emailState.status === 'sent' && (
								<View style={styles.noticeSuccess}>
									<Feather name="check-circle" size={15} color="#4ADE80" />
									<Text style={styles.noticeSuccessText} numberOfLines={2}>
										{emailState.mode === 'mail'
											? `Your email app opened with the PDF attached${emailState.email ? ` and ${emailState.email} filled in` : ''}. Tap Send to deliver it.`
											: 'Pick Gmail or any email app in the share sheet to send the PDF.'}
									</Text>
								</View>
							)}
							{emailState.status === 'error' && (
								<View style={styles.noticeError}>
									<Feather name="alert-circle" size={15} color="#FB7185" />
									<Text style={styles.noticeErrorText} numberOfLines={2}>{emailState.message}</Text>
								</View>
							)}

							<TouchableOpacity
								style={[styles.primaryButton, !canEmail && styles.primaryButtonDisabled]}
								activeOpacity={0.88}
								onPress={emailPdf}
								disabled={!canEmail}
								accessibilityLabel="Email this guide to me as a PDF"
							>
								<LinearGradient colors={['#2563EB', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryButtonFill}>
									{emailState.status === 'sending' ? (
										<>
											<ActivityIndicator size="small" color="#FFFFFF" />
											<Text style={styles.primaryButtonText}>Creating your PDF…</Text>
										</>
									) : (
										<>
											<Feather name={emailState.status === 'sent' ? 'repeat' : 'mail'} size={16} color="#FFFFFF" />
											<Text style={styles.primaryButtonText}>
												{emailState.status === 'sent' ? 'Send it again' : 'Email me this guide as PDF'}
											</Text>
										</>
									)}
								</LinearGradient>
							</TouchableOpacity>

							{emailState.status !== 'sent' && (
								<Text style={styles.actionHint}>
									{detailLoading ? 'Available once the guide is ready.' : 'Opens your email app with the PDF attached, ready to send.'}
								</Text>
							)}
						</View>
					</Animated.View>
				</View>
			</Modal>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: 'transparent' },
	scrollContent: { paddingHorizontal: 18, paddingBottom: 48 },

	/* Controls */
	controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
	countryField: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(13, 21, 35, 0.92)', borderWidth: 1, borderColor: '#1E2B3F' },
	countryInput: { flex: 1, color: '#FFFFFF', fontSize: 13, paddingVertical: 0 },
	regenerateButton: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563EB' },

	listHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
	listTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
	listCount: { fontSize: 12, fontWeight: '600', color: '#64748B' },

	/* Idea card */
	card: { backgroundColor: 'rgba(13, 21, 35, 0.94)', borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#1E2B3F' },
	cardHead: { flexDirection: 'row', alignItems: 'center' },
	cardIndex: { fontSize: 13, fontWeight: '800', color: '#3B82F6', letterSpacing: 0.5 },
	cardTag: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 10, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(37, 99, 235, 0.14)' },
	cardTagText: { fontSize: 9, fontWeight: '800', color: '#93C5FD', letterSpacing: 0.8 },
	cardArrow: { marginLeft: 'auto', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(148, 163, 184, 0.1)' },
	ideaTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', lineHeight: 25, marginTop: 14, letterSpacing: -0.2 },
	ideaSummary: { fontSize: 13, color: '#94A3B8', lineHeight: 20, marginTop: 7 },
	cardDivider: { height: 1, backgroundColor: '#1A2638', marginVertical: 14 },
	cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 14 },
	cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
	cardMetaText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
	readGuide: { marginLeft: 'auto', fontSize: 12, fontWeight: '700', color: '#60A5FA' },

	skeletonBar: { borderRadius: 6, backgroundColor: '#1E2B3F' },

	/* States */
	stateContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10, paddingHorizontal: 20 },
	stateIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(148, 163, 184, 0.1)' },
	stateTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
	stateText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19 },
	secondaryButton: { marginTop: 4, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(37, 99, 235, 0.16)', borderWidth: 1, borderColor: 'rgba(96, 165, 250, 0.3)' },
	secondaryButtonText: { fontSize: 13, fontWeight: '700', color: '#60A5FA' },

	/* Sheet */
	sheetRoot: { flex: 1, justifyContent: 'flex-end' },
	sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2, 6, 14, 0.78)' },
	sheet: { height: SCREEN_HEIGHT * 0.94, backgroundColor: '#0A111D', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: '#1E2B3F', overflow: 'hidden' },
	sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#2A3A52', marginTop: 10 },
	sheetTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
	sheetBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	sheetBrandMark: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
	sheetEyebrow: { fontSize: 10, fontWeight: '800', color: '#93C5FD', letterSpacing: 1.4 },
	closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(148, 163, 184, 0.12)' },
	sheetScroll: { flex: 1 },
	sheetScrollContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },

	detailTitle: { fontSize: 25, fontWeight: '800', color: '#FFFFFF', lineHeight: 32, letterSpacing: -0.4 },
	detailSummary: { fontSize: 14, color: '#94A3B8', lineHeight: 22, marginTop: 10 },
	detailMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
	metaPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(37, 99, 235, 0.12)', borderWidth: 1, borderColor: 'rgba(96, 165, 250, 0.18)' },
	metaPillText: { fontSize: 11, fontWeight: '600', color: '#CBD5E1' },

	toc: { marginTop: 22, marginHorizontal: -20 },
	tocRow: { paddingHorizontal: 20, gap: 8 },
	tocChip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: '#101A2A', borderWidth: 1, borderColor: '#1E2B3F' },
	tocIndex: { fontSize: 10, fontWeight: '800', color: '#3B82F6' },
	tocText: { fontSize: 12, fontWeight: '600', color: '#CBD5E1' },

	guideSection: { marginTop: 14, padding: 18, borderRadius: 18, backgroundColor: '#0E1726', borderWidth: 1, borderColor: '#1A2638' },
	guideSectionHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
	guideSectionHeadText: { flex: 1, minWidth: 0 },
	guideSectionIndex: { fontSize: 9, fontWeight: '800', color: '#3B82F6', letterSpacing: 1.2 },
	guideSectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginTop: 5, lineHeight: 22 },
	guideSectionIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(37, 99, 235, 0.14)', marginLeft: 12 },

	paragraph: { fontSize: 13.5, color: '#CBD5E1', lineHeight: 21, marginBottom: 8 },
	bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 6 },
	bulletMark: { width: 5, height: 5, borderRadius: 1.5, backgroundColor: '#3B82F6', marginTop: 8 },
	bulletText: { flex: 1, fontSize: 13.5, color: '#CBD5E1', lineHeight: 21 },

	stepRow: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
	stepRail: { width: 24, alignItems: 'center' },
	stepBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D4ED8' },
	stepBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
	stepLine: { flex: 1, width: 1.5, backgroundColor: '#1E3A66', marginVertical: 3 },
	stepText: { flex: 1, fontSize: 13.5, color: '#CBD5E1', lineHeight: 21, paddingTop: 2, paddingBottom: 14 },

	disclaimer: { fontSize: 11, color: '#475569', lineHeight: 17, textAlign: 'center', marginTop: 20, paddingHorizontal: 12 },

	/* Export bar */
	actionBar: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 26, borderTopWidth: 1, borderTopColor: '#1A2638', backgroundColor: '#0A111D' },
	noticeSuccess: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, borderRadius: 12, backgroundColor: 'rgba(22, 163, 74, 0.12)', borderWidth: 1, borderColor: 'rgba(74, 222, 128, 0.25)', marginBottom: 10 },
	noticeSuccessText: { flex: 1, fontSize: 12, color: '#BBF7D0', lineHeight: 17 },
	noticeError: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, borderRadius: 12, backgroundColor: 'rgba(225, 29, 72, 0.12)', borderWidth: 1, borderColor: 'rgba(251, 113, 133, 0.25)', marginBottom: 10 },
	noticeErrorText: { flex: 1, fontSize: 12, color: '#FECDD3', lineHeight: 17 },
	primaryButton: { borderRadius: 16, overflow: 'hidden' },
	primaryButtonDisabled: { opacity: 0.45 },
	primaryButtonFill: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
	primaryButtonText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
	actionHint: { fontSize: 11, color: '#64748B', textAlign: 'center', marginTop: 9 },
});
