import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from '../../theme/native';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  ShoppingCart,
  X,
} from 'lucide-react-native';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

type Design = {
  id: string;
  title: string;
  description: string;
  images: ImageSourcePropType[];
};

// These are sample designs for the first presentation of the gallery.
// The `images` array is intentionally per-design so it can later be
// populated by the API without changing the preview experience.
const DESIGNS: Design[] = [
  {
    id: 'voice-room',
    title: 'Voice room concept',
    description:
      'A calm, focused space for thoughtful conversations.',
    images: [
      require('@/assets/images/tabs-icon/Preview.jpg'),
      require('@/assets/images/tabs-icon/01_brighthub-preview.__large_preview.png'),
      require('@/assets/images/tabs-icon/Preview.jpg'),
      require('@/assets/images/tabs-icon/01_brighthub-preview.__large_preview.png'),
    ],
  },
  {
    id: 'creative-workspace',
    title: 'Creative workspace',
    description:
      'A warm visual direction for making ideas feel effortless.',
    images: [
      require('@/assets/images/tabs-icon/01_brighthub-preview.__large_preview.png'),
      require('@/assets/images/tabs-icon/Preview.jpg'),
      require('@/assets/images/tabs-icon/01_brighthub-preview.__large_preview.png'),
      require('@/assets/images/tabs-icon/Preview.jpg'),
      require('@/assets/images/tabs-icon/01_brighthub-preview.__large_preview.png'),
    ],
  },
  {
    id: 'minimal-dashboard',
    title: 'Minimal dashboard',
    description:
      'Simple, useful surfaces designed to keep you moving.',
    images: [
      require('@/assets/images/tabs-icon/Preview.jpg'),
      require('@/assets/images/tabs-icon/01_brighthub-preview.__large_preview.png'),
      require('@/assets/images/tabs-icon/Preview.jpg'),
    ],
  },
  {
    id: 'modern-lounge',
    title: 'Modern Lounge',
    description:
      'Contemporary design for relaxed social interactions.',
    images: [
      require('@/assets/images/tabs-icon/01_brighthub-preview.__large_preview.png'),
      require('@/assets/images/tabs-icon/Preview.jpg'),
    ],
  },
  {
    id: 'tech-studio',
    title: 'Tech Studio',
    description:
      'High-tech workspace for creative professionals.',
    images: [
      require('@/assets/images/tabs-icon/Preview.jpg'),
      require('@/assets/images/tabs-icon/01_brighthub-preview.__large_preview.png'),
      require('@/assets/images/tabs-icon/Preview.jpg'),
      require('@/assets/images/tabs-icon/01_brighthub-preview.__large_preview.png'),
    ],
  },
  {
    id: 'zen-garden',
    title: 'Zen Garden',
    description:
      'Peaceful environment inspired by Japanese minimalism.',
    images: [
      require('@/assets/images/tabs-icon/01_brighthub-preview.__large_preview.png'),
      require('@/assets/images/tabs-icon/Preview.jpg'),
    ],
  },
  {
    id: 'urban-loft',
    title: 'Urban Loft',
    description:
      'Industrial-chic space for creative collaboration.',
    images: [
      require('@/assets/images/tabs-icon/Preview.jpg'),
      require('@/assets/images/tabs-icon/01_brighthub-preview.__large_preview.png'),
      require('@/assets/images/tabs-icon/Preview.jpg'),
    ],
  },
  {
    id: 'nature-retreat',
    title: 'Nature Retreat',
    description:
      'Organic design inspired by natural elements.',
    images: [
      require('@/assets/images/tabs-icon/01_brighthub-preview.__large_preview.png'),
      require('@/assets/images/tabs-icon/Preview.jpg'),
      require('@/assets/images/tabs-icon/01_brighthub-preview.__large_preview.png'),
      require('@/assets/images/tabs-icon/Preview.jpg'),
      require('@/assets/images/tabs-icon/01_brighthub-preview.__large_preview.png'),
    ],
  },
];

type DesignGalleryPopupProps = {
  visible: boolean;
  onClose: () => void;
};

export default function DesignGalleryPopup({
  visible,
  onClose,
}: DesignGalleryPopupProps) {
  const slideY = useRef(
    new Animated.Value(-SCREEN_HEIGHT)
  ).current;

  const backdropOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const isClosing = useRef(false);
  const flatListRef = useRef<FlatList>(null);

  const [previewDesign, setPreviewDesign] =
    useState<Design | null>(null);

  const [previewIndex, setPreviewIndex] =
    useState(0);

  const [savedDesigns, setSavedDesigns] =
    useState<string[]>([]);

  const designs = DESIGNS;

  // Calculate image size with reduced equal padding
  const paddingHorizontal = 12; // Reduced from 22 to 12
  const imageSize = (SCREEN_WIDTH - (paddingHorizontal * 2) - 12) / 2; // screen width - (left padding + right padding) - gap 12

  useEffect(() => {
    if (visible) {
      isClosing.current = false;

      Animated.parallel([
        Animated.timing(slideY, {
          toValue: 0,
          duration: 850,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset state when modal is hidden
      slideY.setValue(-SCREEN_HEIGHT);
      backdropOpacity.setValue(0);
      setPreviewDesign(null);
      setPreviewIndex(0);
    }
  }, [visible]);

  const handleClose = () => {
    if (isClosing.current || !visible) return;

    isClosing.current = true;
    setPreviewDesign(null);

    Animated.parallel([
      Animated.timing(slideY, {
        toValue: -SCREEN_HEIGHT,
        duration: 850, // Same as opening
        easing: Easing.out(Easing.cubic), // Same as opening
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 700, // Same as opening
        easing: Easing.out(Easing.cubic), // Same as opening
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
        isClosing.current = false;
      }
    });
  };

  const toggleSaved = (id: string) => {
    setSavedDesigns((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const openPreview = (design: Design) => {
    setPreviewIndex(0);
    setPreviewDesign(design);
  };

  const handlePrevImage = () => {
    if (previewIndex > 0) {
      setPreviewIndex(previewIndex - 1);
      // Scroll to previous image
      if (flatListRef.current) {
        flatListRef.current.scrollToIndex({
          index: previewIndex - 1,
          animated: true,
        });
      }
    }
  };

  const handleNextImage = () => {
    if (previewDesign && previewIndex < previewDesign.images.length - 1) {
      setPreviewIndex(previewIndex + 1);
      // Scroll to next image
      if (flatListRef.current) {
        flatListRef.current.scrollToIndex({
          index: previewIndex + 1,
          animated: true,
        });
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.modalRoot}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleClose}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                {
                  translateY: slideY,
                },
              ],
            },
          ]}
        >
          <View style={styles.header}>

            <Pressable
              accessibilityLabel="Close gallery"
              onPress={handleClose}
              style={styles.closeButton}
            >
              <X
                size={21}
                color="#172B40"
              />
            </Pressable>
          </View>

          {/* MAIN GALLERY - 2 COLUMNS */}
          <FlatList
            key="gallery-flatlist"
            data={designs}
            numColumns={2}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            initialNumToRender={4}
            maxToRenderPerBatch={4}
            windowSize={5}
            removeClippedSubviews={true}
            renderItem={({ item, index }) => {
              const isSaved = savedDesigns.includes(item.id);
              const isLastItem = index === designs.length - 1;
              const isOddLast = isLastItem && designs.length % 2 !== 0;

              return (
                <View style={[
                  styles.designCard,
                  isOddLast && styles.designCardFullWidth
                ]}>
                  <View style={[
                    styles.imageContainer,
                    isOddLast && styles.imageContainerFullWidth
                  ]}>
                    <Image
                      source={item.images[0]}
                      style={[
                        styles.designImage,
                        { 
                          width: isOddLast ? '100%' : imageSize,
                          height: imageSize,
                        }
                      ]}
                      resizeMode="cover"
                    />

                    <View
                      style={styles.imageActions}
                    >
                      <Pressable
                        accessibilityLabel={`Preview ${item.title}`}
                        onPress={() =>
                          openPreview(item)
                        }
                        style={styles.actionButton}
                      >
                        <Eye
                          size={19}
                          color="#FFFFFF"
                        />
                      </Pressable>

                      <Pressable
                        accessibilityLabel={`${isSaved ? 'Remove' : 'Save'} ${item.title}`}
                        onPress={() =>
                          toggleSaved(item.id)
                        }
                        style={[
                          styles.actionButton,
                          isSaved &&
                            styles.savedButton,
                        ]}
                      >
                        <ShoppingCart
                          size={19}
                          color="#FFFFFF"
                        />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        </Animated.View>

        {/* PREVIEW MODAL */}
        <Modal
          visible={previewDesign !== null}
          transparent
          animationType="fade"
          onRequestClose={() =>
            setPreviewDesign(null)
          }
        >
          <View style={styles.previewRoot}>
            <Pressable
              style={styles.previewBackdrop}
              onPress={() =>
                setPreviewDesign(null)
              }
            />

            {previewDesign && (
              <View
                style={styles.previewContent}
              >
                <View
                  style={styles.previewHeader}
                >
                  <View>
                    <Text
                      style={styles.eyebrow}
                    >
                      PREVIEW
                    </Text>

                    <Text
                      style={styles.previewTitle}
                    >
                      {previewDesign.title}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() =>
                      setPreviewDesign(null)
                    }
                    style={styles.closeButton}
                  >
                    <X
                      size={21}
                      color="#D9E4F2"
                    />
                  </Pressable>
                </View>

                <FlatList
                  ref={flatListRef}
                  data={previewDesign.images}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={
                    false
                  }
                  keyExtractor={(_, index) =>
                    `${previewDesign.id}-${index}`
                  }
                  initialScrollIndex={
                    previewIndex
                  }
                  getItemLayout={(
                    _,
                    index
                  ) => ({
                    length: 300,
                    offset: 300 * index,
                    index,
                  })}
                  onMomentumScrollEnd={(
                    event
                  ) => {
                    const nextIndex =
                      Math.round(
                        event.nativeEvent
                          .contentOffset.x / 300
                      );
                    setPreviewIndex(
                      nextIndex
                    );
                  }}
                  renderItem={({ item }) => (
                    <Image
                      source={item}
                      style={
                        styles.previewImage
                      }
                      resizeMode="contain"
                    />
                  )}
                  style={styles.previewList}
                />

                {previewDesign.images.length >
                  1 && (
                  <>
                    <Pressable
                      disabled={
                        previewIndex === 0
                      }
                      onPress={handlePrevImage}
                      style={[
                        styles.carouselButton,
                        styles.carouselLeft,
                        previewIndex ===
                          0 &&
                          styles.disabledButton,
                      ]}
                    >
                      <ChevronLeft
                        size={25}
                        color="#FFFFFF"
                      />
                    </Pressable>

                    <Pressable
                      disabled={
                        previewIndex ===
                        previewDesign
                          .images.length -
                          1
                      }
                      onPress={handleNextImage}
                      style={[
                        styles.carouselButton,
                        styles.carouselRight,
                        previewIndex ===
                          previewDesign
                            .images.length -
                            1 &&
                          styles.disabledButton,
                      ]}
                    >
                      <ChevronRight
                        size={25}
                        color="#FFFFFF"
                      />
                    </Pressable>

                    <Text
                      style={
                        styles.pageCount
                      }
                    >
                      {previewIndex + 1} /{' '}
                      {
                        previewDesign
                          .images.length
                      }
                    </Text>
                  </>
                )}

                <Text
                  style={styles.swipeHint}
                >
                  Swipe to browse this design
                </Text>
              </View>
            )}
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

// ====================================================
// STYLES
// ====================================================

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:
      'rgba(2, 10, 20, 0.62)',
  },

  card: {
    position: 'absolute',
    top: 0,
    left: 22,
    right: 22,
    bottom: 80, // Changed from 34 to 80 to bring the card up
    backgroundColor: '#060B11',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingTop: 24,
    overflow: 'hidden',
    elevation: 20,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },

  eyebrow: {
    color: '#8FA4BC',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.7,
  },

  heading: {
    color: '#10243A',
    fontSize: 25,
    fontWeight: '800',
    marginTop: 3,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF3F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  listContent: {
    paddingHorizontal: 12, // Equal left and right padding
    paddingBottom: 34,
  },

  columnWrapper: {
    gap: 12,
    marginBottom: 12,
  },

  designCard: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 16,
    overflow: 'hidden',
  },

  designCardFullWidth: {
    flex: 1,
    width: '100%',
  },

  imageContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },

  imageContainerFullWidth: {
    width: '100%',
  },

  designImage: {
    borderRadius: 16,
  },

  imageActions: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },

  actionButton: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor:
      'rgba(5, 15, 28, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  savedButton: {
    backgroundColor: '#E85D4A',
  },

  previewRoot: {
    flex: 1,
    backgroundColor:
      'rgba(2, 8, 16, 0.96)',
    justifyContent: 'center',
  },

  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  previewContent: {
    marginHorizontal: 18,
    borderRadius: 25,
    backgroundColor: '#0B1B2E',
    padding: 18,
    overflow: 'hidden',
  },

  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },

  previewTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 20,
    marginTop: 3,
  },

  previewImage: {
    width: '100%',
    height: 390,
    borderRadius: 17,
    backgroundColor: '#142941',
  },

  previewList: {
    width: 300,
    alignSelf: 'center',
  },

  carouselButton: {
    position: 'absolute',
    top: 215,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor:
      'rgba(5,15,28,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  carouselLeft: {
    left: 27,
  },

  carouselRight: {
    right: 27,
  },

  disabledButton: {
    opacity: 0.25,
  },

  pageCount: {
    alignSelf: 'center',
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
  },

  swipeHint: {
    color: '#8FA4BC',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 7,
  },
});
