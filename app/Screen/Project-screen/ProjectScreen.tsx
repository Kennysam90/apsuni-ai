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
  Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import CustomTabBar from '../../components/CustomTabBar';
import BackButton from '../../components/BackButton';
import { getAccessToken, getApiAssetUrl, listProjects, Project } from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- Mock Data ---
const TEAMS_DATA = [
  {
    id: 'add',
    name: 'New Team',
    isAdd: true,
  },
  {
    id: '1',
    name: 'Chelsea FC',
    logo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=300&auto=format&fit=crop',
    active: true,
  },
  {
    id: '2',
    name: 'UI/UX Design',
    logo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: '3',
    name: 'Dev Engineering',
    logo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: '4',
    name: 'Marketing',
    logo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=300&auto=format&fit=crop',
  },
];

export default function ProjectsFeedScreen() {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!getAccessToken()) {
      setError('Please sign in to view your projects.');
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    listProjects()
      .then((response) => {
        if (isMounted) setProjects(response.projects ?? []);
      })
      .catch((requestError) => {
        if (isMounted) setError(requestError instanceof Error ? requestError.message : 'Unable to load projects.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* --- TOP HEADER --- */}
      <View style={styles.header}>
        <BackButton />

        <TouchableOpacity style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Projects</Text>
          <Feather name="chevron-down" size={18} color="#FFFFFF" />
        </TouchableOpacity>

      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* --- TEAMS LIST (STORY BAR) --- */}
        <View style={styles.teamsSection}>
          <View style={styles.teamsHeader}>
            <View style={styles.teamsTitleGroup}>
              <Feather name="users" size={18} color="#FFFFFF" />
              <Text style={styles.teamsTitle}>My Teams</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamsScroll}>
            {TEAMS_DATA.map((team) => {
              if (team.isAdd) {
                return (
                  <View key={team.id} style={styles.teamItem}>
                    <TouchableOpacity style={styles.addTeamCircle}>
                      <Feather name="plus" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.teamNameText} numberOfLines={1}>
                      {team.name}
                    </Text>
                  </View>
                );
              }

              return (
                <TouchableOpacity key={team.id} style={styles.teamItem}>
                  <View style={[styles.avatarGradientRing, team.active && styles.activeRing]}>
                    <Image source={{ uri: team.logo }} style={styles.teamAvatarImg} />
                  </View>
                  <Text style={styles.teamNameText} numberOfLines={1}>
                    {team.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* View Mode Switchers: List & Column/Grid */}
          <View style={styles.teamsViewToggleRow}>
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

        {/* --- PROJECTS FEED --- */}
        {isLoading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text style={styles.stateText}>Loading projects...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : projects.length === 0 ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateText}>No projects found.</Text>
          </View>
        ) : viewMode === 'list' ? (
          /* LIST VIEW FEED */
          projects.map((project) => {
            const imageUrl = getApiAssetUrl(project.logo);
            const description = project.description?.replace(/<[^>]*>/g, '').trim() || 'No description available.';
            const assignedTeams = project.team_members?.map((member) => member.full_name || member.username).join(', ') || 'Unassigned';

            return (
            <View key={project.id} style={styles.projectCard}>
              {/* Project Image */}
              <Image
                source={require('../../../assets/images/tabs-icon/File recover.gif')}
                style={styles.projectImage}
                resizeMode="cover"
              />

              {/* Project Profile */}
              <View style={styles.projectProfileRow}>
                <View style={styles.profileAvatarRing}>
                  {imageUrl && <Image source={{ uri: imageUrl }} style={styles.profileAvatar} />}
                </View>
                <View style={styles.profileTextGroup}>
                  <Text style={styles.profileName}>Teams</Text>
                  <Text style={styles.profileSubtitle}>{assignedTeams}</Text>
                </View>
              </View>

              {/* Project Details */}
              <View style={styles.cardDetails}>

                <Text style={styles.projectDescText}>
                  <Text style={styles.boldTeamName}>{project.name}</Text>{' '}
                  {description}
                </Text>

                <Text style={styles.timeAgoText}>
                  {project.created_at ? new Date(project.created_at).toLocaleDateString() : ''}
                </Text>
              </View>
            </View>
            );
          })
        ) : (
          /* GRID / COLUMN VIEW */
          <View style={styles.gridContainer}>
            {projects.map((project) => (
              <TouchableOpacity key={project.id} style={styles.gridCard} activeOpacity={0.8}>
                <Image source={{ uri: getApiAssetUrl(project.logo) ?? '' }} style={styles.gridImage} />
                <View style={styles.gridOverlay}>
                  <Text style={styles.gridTitle} numberOfLines={1}>
                    {project.name}
                  </Text>
                  <Text style={styles.gridSub} numberOfLines={1}>
                    {project.team_members?.map((member) => member.full_name || member.username).join(', ') || 'Unassigned'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
      </SafeAreaView>

      <CustomTabBar />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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

  /* --- Teams Bar Styling --- */
  teamsSection: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  teamsHeader: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  teamsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  teamsViewToggleRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  teamsScroll: {
    paddingHorizontal: 12,
    gap: 16,
  },
  teamItem: {
    alignItems: 'center',
    width: 72,
  },
  avatarGradientRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 2.5,
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
    borderRadius: 30,
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
    backgroundColor: '#0A0A0A',
  },
  projectImage: {
    width: SCREEN_WIDTH - 28,
    height: 220,
    marginHorizontal: 14,
    borderRadius: 14,
    resizeMode: 'cover',
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
  },
  profileAvatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#E11D48',
    padding: 1.5,
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
  },
  profileTextGroup: {
    marginLeft: 10,
    flex: 1,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 14,
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
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    padding: 8,
  },
  gridTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  gridSub: {
    color: '#94A3B8',
    fontSize: 10,
  },
});
