import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  Dimensions,
} from 'react-native';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import CustomTabBar from '../../components/CustomTabBar';
import AppHeader from '../../components/AppHeader';
import AppBackground from '../../components/AppBackground';
import PreviewModal from '../../components/PreviewModal';
import { addEditoryToCart, createEditory, deleteBucketItem, getAccessToken, getApiAssetUrl, listEditories, searchMarketplaceProducts, type DesignResult } from '../../services/api';
import { useCurrency } from '../../services/currency';

import { friendlyError } from '../../services/errors';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Mobile-app products preview inside a phone frame. */
const isMobileProduct = (product: DesignResult | null) => {
  if (!product) return false;
  const value = [product.product_type, product.category, product.type, product.file]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /mobile|android|ios|app/.test(value);
};

export default function SearchScreen() {
  const router = useRouter();
  useCurrency(); // re-render prices if the user's currency changes
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Mobile' | 'Web' | 'Figma'>('All');
  const [filterVisible, setFilterVisible] = useState(false);
  const [products, setProducts] = useState<DesignResult[]>([]);
  const [bucketProducts, setBucketProducts] = useState<DesignResult[]>([]);
  const [bucketAddingId, setBucketAddingId] = useState<string | null>(null);
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
  const [hasSetInitialSelection, setHasSetInitialSelection] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewProduct, setPreviewProduct] = useState<DesignResult | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!getAccessToken()) {
      setError('Please sign in to view your projects.');
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const loadProducts = async () => {
      const isFirstPage = page === 1;
      if (isFirstPage) setIsLoading(true); else setIsLoadingMore(true);
      setError(null);
      try {
        const categories: ('Mobile App' | 'Website')[] = activeFilter === 'Mobile' ? ['Mobile App'] : activeFilter === 'Web' ? ['Website'] : ['Mobile App', 'Website'];
        const file = activeFilter === 'Figma' ? 'figma' : '';
        const responses = await Promise.all(categories.map((category) => searchMarketplaceProducts(searchQuery, category, file, page)));
        if (isMounted) {
          const incoming = responses.flatMap((response) => response.products ?? []);
          // Later pages are appended to what is already shown; a new search or filter (page 1) starts over.
          setProducts((current) => {
            if (isFirstPage) return incoming;
            const seen = new Set(current.map((item) => String(item.id ?? item.pid)));
            return [...current, ...incoming.filter((item) => !seen.has(String(item.id ?? item.pid)))];
          });
          setPages(Math.max(1, ...responses.map((response) => response.pages || 1)));
        }
      } catch (requestError) {
        if (isMounted) setError(friendlyError(requestError, 'Unable to load products.'));
      } finally {
        if (isMounted) { setIsLoading(false); setIsLoadingMore(false); }
      }
    };

    const queryTimer = setTimeout(loadProducts, 250);

    return () => {
      isMounted = false;
      clearTimeout(queryTimer);
    };
  }, [activeFilter, page, searchQuery]);

  useEffect(() => {
    listEditories()
      .then((result) => setBucketProducts(result.products.map((product) => ({ ...product, editoryId: product.id }))))
      .catch(() => setBucketProducts([]));
  }, []);

  // Show the first bucket item's tooltip by default on first load only —
  // subsequent bucket updates (add/remove) shouldn't reopen a tooltip
  // the user may have deliberately closed.
  useEffect(() => {
    if (hasSetInitialSelection || bucketProducts.length === 0) return;
    const firstProduct = bucketProducts[0];
    setSelectedBucketId(String(firstProduct.id ?? firstProduct.pid ?? 0));
    setHasSetInitialSelection(true);
  }, [bucketProducts, hasSetInitialSelection]);

  // Only ask for the next page once the user nears the bottom, and only while more pages remain.
  const loadMoreIfNeeded = ({ nativeEvent }: { nativeEvent: { layoutMeasurement: { height: number }; contentOffset: { y: number }; contentSize: { height: number } } }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 240;
    if (nearBottom && !isLoading && !isLoadingMore && !error && page < pages) setPage((current) => current + 1);
  };

  const updateSearch = (value: string) => { setSearchQuery(value); setPage(1); };
  const updateFilter = (filter: 'All' | 'Mobile' | 'Web' | 'Figma') => { setActiveFilter(filter); setPage(1); setFilterVisible(false); };
  const addToBucket = async (product: DesignResult) => {
    const productId = product.id ?? product.pid;
    if (!productId) return;
    const id = String(productId);
    setBucketAddingId(id);
    try {
      const created = await createEditory({
        product: productId,
        title: product.title || 'New product',
        company: product.company || 'Apsuni',
        company_logo: product.company_logo || 'logo.png',
        demo: product.demo || '',
        type: product.product_type || product.category || 'Product',
        image: product.image || 'product.jpg',
      });
      setBucketProducts((current) => current.some((item) => String(item.id ?? item.pid) === id) ? current : [...current, { ...product, editoryId: created.data.id }]);
    } catch (error) {
      setError(friendlyError(error, 'Could not add this product to your bucket.'));
    } finally {
      setBucketAddingId(null);
    }
  };

  const openPreview = (product: DesignResult) => {
    setSelectedBucketId(null);
    setPreviewProduct(product);
  };

  const openEditor = (product: DesignResult) => {
    const editoryId = product.editoryId ?? product.id;
    if (!editoryId) return;
    setSelectedBucketId(null);
    router.push({
      pathname: '/Screen/Editory-Screen/EditProjectScreen',
      params: {
        editoryId: String(editoryId),
        title: String(product.title ?? ''),
        productType: String(product.product_type ?? product.category ?? ''),
        price: String(product.price ?? ''),
      },
    });
  };

  const deleteFromBucket = async (product: DesignResult) => {
    const editoryId = Number(product.editoryId ?? product.id);
    if (!editoryId) return;
    try {
      await deleteBucketItem(editoryId);
      setBucketProducts((current) => current.filter((item) => Number(item.editoryId ?? item.id) !== editoryId));
      setSelectedBucketId(null);
    } catch (deleteError) {
      setError(friendlyError(deleteError, 'Could not delete this bucket item.'));
    }
  };

  const addBucketItemToCart = async (product: DesignResult) => {
    const editoryId = Number(product.editoryId);
    if (!editoryId) return;
    try {
      await addEditoryToCart(editoryId);
    } catch (cartError) {
      setError(friendlyError(cartError, 'Could not add this item to your cart.'));
    }
  };

  return (
    <>
      <AppBackground />

      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <AppHeader />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        stickyHeaderIndices={[0]}
        onScroll={loadMoreIfNeeded}
        scrollEventThrottle={200}
      >
        {/* --- TEAMS LIST (STORY BAR) --- */}
        <View style={styles.teamsSection}>
          <View style={styles.teamsHeader}>
            <View style={styles.teamsTitleGroup}>
              <FontAwesome5 name="shopping-basket" size={17} color="#FFFFFF" />
              <Text style={styles.teamsTitle}>My bucket</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamsScroll}>
            {bucketProducts.map((product, index) => {
              const bucketItemId = String(product.id ?? product.pid ?? index);
              return (
                <TouchableOpacity key={bucketItemId} style={styles.teamItem} onPress={() => setSelectedBucketId((current) => current === bucketItemId ? null : bucketItemId)}>
                  {selectedBucketId === bucketItemId && (
                    <View style={styles.bucketTooltip}>
                      <TouchableOpacity style={styles.bucketTooltipButton} onPress={() => deleteFromBucket(product)}><Feather name="trash-2" size={14} color="#FCA5A5" /></TouchableOpacity>
                      <TouchableOpacity style={styles.bucketTooltipButton} onPress={() => openEditor(product)}><Feather name="edit-3" size={14} color="#BFDBFE" /></TouchableOpacity>
                      <TouchableOpacity style={styles.bucketTooltipButton} onPress={() => addBucketItemToCart(product)}><Feather name="shopping-cart" size={14} color="#86EFAC" /></TouchableOpacity>
                    </View>
                  )}
                  <View style={styles.avatarGradientRing}>
                    {product.image ? <Image source={{ uri: getApiAssetUrl(product.image) ?? product.image }} style={styles.teamAvatarImg} resizeMode="contain" /> : <Feather name="image" size={20} color="#94A3B8" />}
                  </View>
                  <Text style={styles.teamNameText} numberOfLines={1}>
                    {product.title || 'Untitled product'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* View Mode Switchers: List & Column/Grid */}
          <View style={styles.teamsViewToggleRow}>
            <View style={styles.filterControl}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Filter products"
                style={[styles.filterButton, activeFilter !== 'All' && styles.filterButtonActive]}
                onPress={() => setFilterVisible((visible) => !visible)}
              >
                <Feather name="filter" size={18} color={activeFilter === 'All' ? '#94A3B8' : '#FFFFFF'} />
              </TouchableOpacity>
              {filterVisible && (
                <View style={styles.filterMenu}>
                  {(['All', 'Mobile', 'Web'] as const).map((filter) => (
                    <TouchableOpacity key={filter} style={[styles.filterOption, activeFilter === filter && styles.filterOptionActive]} onPress={() => updateFilter(filter)}>
                      <Text style={styles.filterOptionText}>{filter}</Text>
                      {activeFilter === filter && <Feather name="check" size={15} color="#60A5FA" />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            <View style={styles.searchField}>
              <Feather name="search" size={16} color="#94A3B8" />
              <TextInput
                value={searchQuery}
                onChangeText={updateSearch}
                placeholder="Search products"
                placeholderTextColor="#64748B"
                style={styles.searchInput}
              />
            </View>
            <View style={styles.viewToggleGroup}>
              <TouchableOpacity
                style={[styles.toggleBtn, viewMode === 'list' && styles.activeToggle]}
                onPress={() => setViewMode('list')}
              >
                <Feather
                  name="list"
                  size={18}
                  color={viewMode === 'list' ? '#FFFFFF' : '#64748B'}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleBtn, viewMode === 'grid' && styles.activeToggle]}
                onPress={() => setViewMode('grid')}
              >
                <Feather
                  name="grid"
                  size={18}
                  color={viewMode === 'grid' ? '#FFFFFF' : '#64748B'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* --- PRODUCTS FEED --- */}
        {isLoading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color="#38BDF8" />
          </View>
        ) : error ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateText}>No products found.</Text>
          </View>
        ) : viewMode === 'list' ? (
          products.map((product, index) => {
            const description = String(product.description ?? product.category ?? 'Marketplace product').replace(/<[^>]*>/g, '').trim();

            return (
            <View key={String(product.id ?? product.pid ?? index)} style={styles.projectCard}>
              <View style={styles.productImageContainer}>
                <Image source={product.image ? { uri: getApiAssetUrl(product.image) ?? product.image } : require('../../../assets/images/tabs-icon/File recover.gif')} style={styles.projectImage} resizeMode="contain" />
              </View>

              <View style={styles.projectProfileRow}>
                <View style={styles.profileAvatarRing}>
                  {product.company_logo ? (
                    <Image
                      source={{ uri: getApiAssetUrl(product.company_logo) ?? product.company_logo }}
                      style={styles.companyLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <Feather name="package" size={18} color="#38BDF8" />
                  )}
                </View>
                <View style={styles.profileTextGroup}>
                  <Text numberOfLines={1} style={styles.profileName}>{product.title || 'Untitled product'}</Text>
                  {/* <Text style={styles.profileSubtitle}>{product.price ? `$${product.price}` : 'View product'}</Text> */}
                </View>
                <View style={styles.productRowActions}>
                  <TouchableOpacity style={styles.productRowActionButton} onPress={() => openPreview(product)} accessibilityLabel="Preview product"><Feather name="eye" size={18} color="#94A3B8" /></TouchableOpacity>
                  <TouchableOpacity style={styles.productRowActionButton} disabled={bucketAddingId === String(product.id ?? product.pid)} onPress={() => addToBucket(product)}>{bucketAddingId === String(product.id ?? product.pid) ? <ActivityIndicator size="small" color="#60A5FA" /> : <FontAwesome5 name="shopping-basket" size={16} color="#60A5FA" />}</TouchableOpacity>
                </View>
              </View>

              {/* Project Details */}
              <View style={styles.cardDetails}>

                <Text style={styles.projectDescText}>
                  <Text style={styles.boldTeamName}>{product.title || 'Untitled product'}</Text>{' '}
                  {description}
                </Text>

               
              </View>
            </View>
            );
          })
        ) : (
          /* GRID / COLUMN VIEW */
          <View style={styles.gridContainer}>
            {products.map((product, index) => (
              <View key={String(product.id ?? product.pid ?? index)} style={styles.gridCard}>
                {product.image ? <Image source={{ uri: getApiAssetUrl(product.image) ?? product.image }} style={styles.gridImage} resizeMode="contain" /> : <View style={styles.productImagePlaceholder}><Feather name="image" size={24} color="#94A3B8" /></View>}
                <View style={styles.gridOverlay}>
                  <View style={styles.gridOverlayRow}>
                    <View style={styles.gridCopy}>
                      <Text style={styles.gridTitle} numberOfLines={1}>{product.title || 'Untitled product'}</Text>
                      <Text style={styles.gridSub} numberOfLines={1}>{product.category || 'Product'}</Text>
                    </View>
                    <View style={styles.gridActions}>
                      <TouchableOpacity style={styles.gridActionButton} onPress={() => openPreview(product)} accessibilityLabel="Preview product"><Feather name="eye" size={16} color="#FFFFFF" /></TouchableOpacity>
                      <TouchableOpacity style={styles.gridActionButton} disabled={bucketAddingId === String(product.id ?? product.pid)} onPress={() => addToBucket(product)}>{bucketAddingId === String(product.id ?? product.pid) ? <ActivityIndicator size="small" color="#60A5FA" /> : <FontAwesome5 name="shopping-basket" size={14} color="#60A5FA" />}</TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
        {isLoadingMore && (
          <View style={styles.loadMore}>
            <ActivityIndicator size="small" color="#38BDF8" />
          </View>
        )}
      </ScrollView>
      </SafeAreaView>

      <CustomTabBar />

      <PreviewModal
        visible={!!previewProduct}
        url={previewProduct?.demo ? String(previewProduct.demo) : null}
        title={previewProduct?.title ? String(previewProduct.title) : 'Preview'}
        subtitle={previewProduct?.company ? String(previewProduct.company) : null}
        productId={previewProduct?.pid ?? previewProduct?.id ?? null}
        isMobileApp={isMobileProduct(previewProduct)}
        onClose={() => setPreviewProduct(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: 132,
  },
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  stateText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1E293B',
    paddingTop: 30,
  },
  iconBtn: {
    padding: 4,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  viewToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 2,
    gap: 4,
  },
  toggleBtn: {
    padding: 6,
    borderRadius: 6,
  },
  activeToggle: {
    backgroundColor: '#334155',
  },
  filterControl: { position: 'relative' },
  filterButton: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' },
  filterButtonActive: { backgroundColor: '#2563EB' },
  filterMenu: { position: 'absolute', top: 45, right: -60, width: 118, borderRadius: 12, padding: 6, backgroundColor: '#132033', borderWidth: 1, borderColor: '#334155', elevation: 12, zIndex: 20 },
  filterOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 9, borderRadius: 8 },
  filterOptionActive: { backgroundColor: '#1E3A5F' },
  filterOptionText: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },

  /* --- Teams Bar Styling --- */
  teamsSection: {
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#0F172A',
    zIndex: 10,
    elevation: 10,
  },
  teamsHeader: {
    paddingHorizontal: 14,
  },
  teamsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
    gap: 8,
  },
  teamsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  teamsViewToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 8,
  },
  searchField: { flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#0F172A' },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 13, paddingVertical: 0 },
  teamsScroll: {
    paddingHorizontal: 12,
    gap: 16,
  },
  teamItem: {
    alignItems: 'center',
    width: 82,
    position: 'relative',
    paddingTop: 30,
  },
  bucketTooltip: {
    position: 'absolute',
    top: 0,
    left: 2,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    padding: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 27, 45, 0.94)',
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 8,
  },
  bucketTooltipButton: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#1E2E45' },
  avatarGradientRing: {
    width: 78,
    height: 45,
    borderRadius: 10,
    padding: 1,
    borderWidth: 2,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeRing: {
    borderColor: '#E11D48',
  },
  teamAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#0F172A',
  },
  addTeamCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#475569',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamNameText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  divider: {
    height: 0.5,
    backgroundColor: '#1E293B',
  },

  /* --- List Project Card --- */
  projectCard: {
    marginBottom: 20,
    marginTop: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  teamInfoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  smallAvatarRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#E11D48',
    padding: 1.5,
  },
  smallAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
  },
  teamNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  locationText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  imageCarousel: {
    width: SCREEN_WIDTH,
    height: 380,
  },
  projectImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
  },
  productImageContainer: {
    position: 'relative',
    width: SCREEN_WIDTH - 28,
    height: 200,
    marginHorizontal: 14,
    overflow: 'hidden',
  },
  productRowActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  productRowActionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17263B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  dotsIndicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  indicatorDot: {
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 6,
    backgroundColor: '#38BDF8',
  },
  inactiveDot: {
    width: 6,
    backgroundColor: '#334155',
  },
  projectProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: -11,
  },
  profileAvatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#E11D48',
    padding: 1.5,
    overflow: 'hidden',
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
  },
  companyLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
  },
  profileTextGroup: {
    marginLeft: 10,
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  profileSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  cardDetails: {
    paddingHorizontal: 14,
    gap: 4,
  },
  likesText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  projectDescText: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 18,
  },
  boldTeamName: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  commentsLink: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  timeAgoText: {
    color: '#475569',
    fontSize: 10,
    textTransform: 'uppercase',
  },

  /* --- Grid / Column Styling --- */
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 8,
  },
  gridCard: {
    width: (SCREEN_WIDTH - 24) / 2,
    height: 200,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    padding: 8,
  },
  gridOverlayRow: { flexDirection: 'row', alignItems: 'center' },
  gridCopy: { flex: 1, minWidth: 0, paddingRight: 4 },
  gridActions: { flexDirection: 'row', gap: 5 },
  gridActionButton: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.9)' },
  gridTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  gridSub: {
    color: '#94A3B8',
    fontSize: 10,
  },
  loadMore: { alignItems: 'center', justifyContent: 'center', paddingVertical: 22 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 18 },
  paginationText: { color: '#60A5FA', fontSize: 14, fontWeight: '700' },
  paginationDisabled: { color: '#475569' },
  pageLabel: { color: '#CBD5E1', fontSize: 13 },
});