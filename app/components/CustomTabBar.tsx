import React, { useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Dimensions,
  Image,
  ImageSourcePropType,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import SideMenuCard from './SideMenuCard';

const { width } = Dimensions.get('window');

const TAB_WIDTH = Math.min(width - 28, 470);

type CustomTabBarProps = {
  state?: any;
  descriptors?: any;
  navigation?: any;
};

export function CenterButton({
  onPress,
  style,
  iconSource,
  iconSize = 30,
}: {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  iconSource?: ImageSourcePropType;
  iconSize?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.centerWrapper,
        style,
        pressed && styles.centerPressed,
      ]}
    >
      <LinearGradient
        colors={[
          '#FF4D4D',
          '#FFB13B',
          '#FFB13B',
          '#FFB13B',
          '#FF4D4D',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientRing}
      >
        <View style={styles.centerCircle}>
          <Image
            source={
              iconSource ??
              require('@/assets/images/tabs-icon/recording.gif')
            }
            style={[
              styles.audioIcon,
              { width: iconSize, height: iconSize },
            ]}
            resizeMode="contain"
          />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export default function CustomTabBar({
  state,
  navigation,
}: CustomTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSideMenuVisible, setIsSideMenuVisible] = useState(false);
  const activeRouteName = state?.routes[state.index]?.name ?? pathname;
  const isHomeActive = activeRouteName === 'index' || pathname === '/' || pathname === '/(tabs)';
  const isProjectsActive = pathname.includes('Project-screen/ProjectScreen');
  const isVoiceActive = pathname.includes('VoiceAssessmentScreen');
  const isSearchActive = pathname.includes('Search-Screen/Search');
  const isMenuActive =
    activeRouteName === 'menu' ||
    pathname.includes('/menu') ||
    pathname.includes('SideMenuCardScreen');

  const navigate = (routeName: string) => {
    if (!state || !navigation) {
      if (routeName === 'index') {
        router.replace('/(tabs)');
      } else {
        router.push(('/(tabs)/' + routeName) as any);
      }
      return;
    }

    const route = state.routes.find(
      (item: any) => item.name === routeName
    );

    if (!route) return;

    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.tabBar}>

        {/* HOME */}
        <Pressable
          style={[
            styles.tabItem,
            isHomeActive && styles.activeTab,
          ]}
          onPress={() => navigate('index')}
        >
          <Image
            source={require('@/assets/images/tabs-icon/home.png')}
            style={styles.homeIcon}
            resizeMode="contain"
          />
        </Pressable>

        {/* GRID */}
        <Pressable
          style={[styles.tabItem, isProjectsActive && styles.activeTab]}
          onPress={() => router.push('/Screen/Project-screen/ProjectScreen')}
        >
          <Image
            source={require('@/assets/images/tabs-icon/menu (1).png')}
            style={styles.gridIcon}
            resizeMode="contain"
          />
        </Pressable>

        {/* CENTER */}
        <CenterButton
          style={isVoiceActive && styles.activeCenterWrapper}
          onPress={() => {
            router.push('/Screen/VoiceAssessmentScreen/VoiceAssessmentScreen');
          }}
        />

        {/* SEARCH */}
        <Pressable
          style={[styles.tabItem, isSearchActive && styles.activeTab]}
          onPress={() => router.push('/Screen/Search-Screen/Search')}
        >
          <Image
            source={require('@/assets/images/tabs-icon/search.png')}
            style={styles.searchIcon}
            resizeMode="contain"
          />
        </Pressable>

        {/* MENU */}
        <Pressable
          style={[styles.tabItem, (isMenuActive || isSideMenuVisible) && styles.activeTab]}
          onPress={() => setIsSideMenuVisible(true)}
        >
          <Image
            source={require('@/assets/images/tabs-icon/menu.png')}
            style={styles.menuIcon}
            resizeMode="contain"
          />
        </Pressable>

      </View>

      <SideMenuCard
        visible={isSideMenuVisible}
        onClose={() => setIsSideMenuVisible(false)}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,

    alignItems: 'center',
    justifyContent: 'flex-end',

    // Lift the floating tab bar slightly above the bottom edge.
    paddingBottom: 48,
    paddingHorizontal: 14,
  },

  tabBar: {
    width: TAB_WIDTH,
    height: 76,

    backgroundColor: '#0B1B2E',

    borderRadius: 40,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',

    paddingHorizontal: 9,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.35,
    shadowRadius: 20,

    elevation: 15,
  },

  tabItem: {
    width: 60,
    height: 60,

    alignItems: 'center',
    justifyContent: 'center',

    borderRadius: 30,
  },

  activeTab: {
    backgroundColor: 'rgba(255,255,255,0.10)',
  },

  centerWrapper: {
    width: 68,
    height: 68,

    marginTop: -5,

    alignItems: 'center',
    justifyContent: 'center',
  },

  activeCenterWrapper: {
    transform: [{ scale: 1.06 }],
  },

  centerPressed: {
    transform: [{ scale: 0.94 }],
  },

  gradientRing: {
    width: 68,
    height: 68,

    borderRadius: 34,

    padding: 2,
  },

  centerCircle: {
    flex: 1,

    borderRadius: 34,

    backgroundColor: 'black',

    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.4,
    shadowRadius: 10,

    elevation: 8,
  },

  audioIcon: {
    width: 30,
    height: 30,
    tintColor: '#FFFFFF',
  },

  homeIcon: {
    width: 20,
    height: 20,
  },

  gridIcon: {
    width: 20,
    height: 20,
  },

  searchIcon: {
    width: 20,
    height: 20,
  },

  menuIcon: {
    width: 20,
    height: 20,
  },
});
