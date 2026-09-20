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
  TextInput,
} from 'react-native';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import CustomTabBar from '../../components/CustomTabBar';
import AppHeader from '../../components/AppHeader';
import AppBackground from '../../components/AppBackground';
import { getAccessToken, getApiAssetUrl, listProjects, listTeams, Project, Team, TeamMember } from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProjectsFeedScreen() {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [activeMemberId, setActiveMemberId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isMounted = true;

    if (!getAccessToken()) {
      setError('Please sign in to view your projects.');
      setIsLoading(false);
      setTeamsError('Please sign in to view your teams.');
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

    listTeams()
      .then((response) => {
        if (isMounted) setTeams(response ?? []);
      })
      .catch((requestError) => {
        if (isMounted) setTeamsError(requestError instanceof Error ? requestError.message : 'Unable to load teams.');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Flatten every member across all of the user's teams into one list,
  // de-duplicated by member id (a person can be on more than one team).
  const teamMembers: TeamMember[] = React.useMemo(() => {
    const seen = new Map<number, TeamMember>();
    teams.forEach((team) => {
      (team.members ?? []).forEach((member) => {
        if (!seen.has(member.id)) seen.set(member.id, member);
      });
    });
    return Array.from(seen.values());
  }, [teams]);

  const filteredProjects = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return projects;

    return projects.filter((project) => {
      const searchableText = [
        project.id,
        project.name,
        project.description,
        project.logo,
        project.created_at,
        ...(project.team_members ?? []).flatMap((member) => [member.id, member.username, member.full_name, member.profile_image]),
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [projects, searchQuery]);

  return (
    <>
      <AppBackground />

      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <AppHeader/>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* --- TEAMS LIST (STORY BAR) --- */}
        <View style={styles.teamsSection}>
          <View style={styles.teamsHeader}>
            <View style={styles.teamsTitleGroup}>
              <Feather name="user" size={22} color="#FFFFFF" />
              <Text style={styles.teamsTitle}>My Teams</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamsScroll}>
            <View style={styles.teamItem}>
              <TouchableOpacity style={styles.addTeamCircle}>
                <Feather name="plus" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.teamNameText} numberOfLines={1}>
                New Team
              </Text>
            </View>

            {teamMembers.map((member) => {
              const memberAvatarUrl = member.profile_image ? getApiAssetUrl(member.profile_image) : null;
              const displayName = member.full_name || member.username;
              const initials = displayName.trim().slice(0, 2).toUpperCase();
              const isActive = member.id === activeMemberId;

              return (
                <TouchableOpacity
                  key={member.id}
                  style={styles.teamItem}
                  onPress={() => setActiveMemberId(member.id)}
                >
                  <View style={[styles.avatarGradientRing, isActive && styles.activeRing]}>
                    {memberAvatarUrl ? (
                      <Image source={{ uri: memberAvatarUrl }} style={styles.teamAvatarImg} />
                    ) : (
                      <View style={styles.teamInitialsCircle}>
                        <Text style={styles.teamInitialsText}>{initials}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.teamNameText} numberOfLines={1}>
                    {displayName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {teamsError && teamMembers.length === 0 && (
            <Text style={styles.teamsErrorText}>{teamsError}</Text>
          )}

          <View style={styles.projectSearchContainer}>
            <Feather name="search" size={17} color="#64748B" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search projects"
              placeholderTextColor="#64748B"
              style={styles.projectSearchInput}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7} accessibilityLabel="Clear project search">
                <Feather name="x-circle" size={17} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* View Mode Switchers: List & Column/Grid */}
          {/* <View style={styles.teamsViewToggleRow}>
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
          </View> */}
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
        ) : filteredProjects.length === 0 ? (
          <View style={styles.stateContainer}>
            <Text style={styles.stateText}>{searchQuery.trim() ? 'No matching projects found.' : 'No projects found.'}</Text>
          </View>
        ) : viewMode === 'list' ? (
          /* LIST VIEW FEED */
          filteredProjects.map((project) => {
            const imageUrl = getApiAssetUrl(project.logo);
            const description = project.description?.replace(/<[^>]*>/g, '').trim() || 'No description available.';
            const assignedTeams = project.team_members?.map((member) => member.full_name || member.username).join(', ') || 'Unassigned';
            const projectTeamMembers = project.team_members ?? [];
            const visibleMembers = projectTeamMembers.slice(0, 4);
            const extraMembersCount = projectTeamMembers.length - visibleMembers.length;

            return (
            <View key={project.id} style={styles.projectCard}>
              {/* Project Image */}

              {/* Project Profile */}
              <View style={styles.projectProfileRow}>
                <View style={styles.profileAvatarRing}>
                  {imageUrl && <Image source={{ uri: imageUrl }} style={styles.profileAvatar} />}
                </View>
                <View style={styles.profileTextGroup}>
                  <Text style={styles.profileName}>{project.name}</Text>
                </View>
              </View>

              {/* Project Details */}
              <View style={styles.cardDetails}>

                <Text style={styles.projectDescText}>
                  <Text style={styles.boldTeamName}>{project.name}</Text>{' '}
                  {description}
                </Text>

                {projectTeamMembers.length > 0 && (
                  <View style={styles.assignedRow}>
                    <Text style={styles.assignedToLabel}>Assigned to</Text>
                    <View style={styles.avatarStackRow}>
                      {visibleMembers.map((member, index) => {
                        const memberAvatarUrl = member.profile_image ? getApiAssetUrl(member.profile_image) : null;
                        const initials = (member.full_name || member.username || '?')
                          .trim()
                          .slice(0, 2)
                          .toUpperCase();

                        return (
                          <View
                            key={member.id ?? `${project.id}-member-${index}`}
                            style={[
                              styles.avatarStackItem,
                              index > 0 && styles.avatarStackOverlap,
                              { zIndex: visibleMembers.length - index },
                            ]}
                          >
                            {memberAvatarUrl ? (
                              <Image source={{ uri: memberAvatarUrl }} style={styles.avatarStackImg} />
                            ) : (
                              <View style={styles.avatarStackFallback}>
                                <Text style={styles.avatarStackInitials}>{initials}</Text>
                              </View>
                            )}
                          </View>
                        );
                      })}

                      {extraMembersCount > 0 && (
                        <View
                          style={[
                            styles.avatarStackItem,
                            styles.avatarStackOverlap,
                            styles.avatarStackMore,
                            { zIndex: 0 },
                          ]}
                        >
                          <Text style={styles.avatarStackMoreText}>+{extraMembersCount}</Text>
                          
                        </View>
                      )}
                      <Text style={styles.timeAgoText}>
                        {project.created_at ? new Date(project.created_at).toLocaleDateString() : ''}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
            );
          })
        ) : (
          /* GRID / COLUMN VIEW */
          <View style={styles.gridContainer}>
            {filteredProjects.map((project) => (
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
  teamsErrorText: {
    color: '#94A3B8',
    fontSize: 11,
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  projectSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    marginTop: 14,
    marginHorizontal: 14,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#24334A',
  },
  projectSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    marginLeft: 9,
    paddingVertical: 0,
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
  teamInitialsCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInitialsText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
    right: -100,
  },

  /* --- Avatar Stack (team members) --- */
  assignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assignedToLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  avatarStackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarStackItem: {
    width: 25,
    height: 25,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarStackOverlap: {
    marginLeft: -12,
  },
  avatarStackImg: {
    width: '100%',
    height: '100%',
  },
  avatarStackFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
  },
  avatarStackInitials: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  avatarStackMore: {
    backgroundColor: '#E2E8F0',
  },
  avatarStackMoreText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '700',
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