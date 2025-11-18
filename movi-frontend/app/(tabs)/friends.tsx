import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';

type FriendProfile = {
  id: string;
  name?: string | null;
  username: string;
  accent: string;
  lastShared: string;
};

type SearchResult = {
  id: string;
  username: string;
};

const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ||
  'http://127.0.0.1:3000';

function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n${message}` : title;
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(text);
    } else {
      console.log('NOTIFY:', text);
    }
  } else {
    Alert.alert(title, message);
  }
}

const ACCENT_COLORS = ['#FF9F68', '#6A7FDB', '#32C6A6', '#F26B8A', '#FFB347', '#9B59B6'];

function normalizeText(value: any) {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return '';
  }
  try {
    return String(value);
  } catch {
    return '';
  }
}

function ensureHandle(username: any) {
  const clean = normalizeText(username).trim();
  if (!clean) return '@moviewatcher';
  return clean.startsWith('@') ? clean : `@${clean}`;
}

function displayNameFromHandle(username: any) {
  const clean = normalizeText(username).replace(/^@/, '').trim();
  if (!clean) return 'Movi Friend';
  if (clean.includes(' ')) return clean;
  return clean
    .split(/[\._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function initialsFromText(text: any) {
  const clean = normalizeText(text).replace('@', '').trim();
  if (!clean) return 'MV';
  return clean
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function pickAccent(seed: string) {
  const clean = seed || 'default';
  let hash = 0;
  for (let i = 0; i < clean.length; i += 1) {
    hash = (hash + clean.charCodeAt(i) * 31) % ACCENT_COLORS.length;
  }
  return ACCENT_COLORS[Math.abs(hash)] || ACCENT_COLORS[0];
}

function buildProfileFromApi(
  entry: any,
  relation: 'following' | 'follower'
): FriendProfile | null {
  if (!entry) return null;
  const rawId = entry.userId ?? entry._id ?? entry.id;
  if (!rawId) return null;
  const usernameInput = entry.username || entry.name || '';
  const username = ensureHandle(usernameInput);
  const rawName = normalizeText(entry.name);
  const displayName =
    rawName && rawName !== normalizeText(entry.username)
      ? rawName
      : displayNameFromHandle(username);
  return {
    id: String(rawId),
    name: displayName,
    username,
    accent: pickAccent(username),
    lastShared:
      relation === 'following'
        ? 'You are following this user'
        : 'Follows you on Movi',
  };
}

export default function FriendsScreen() {
  const { user } = useAuth();

  const activeUserId = user?.id ?? '68c9b2d573fbd318f36537ce';
  const [query, setQuery] = useState('');
  const [following, setFollowing] = useState<FriendProfile[]>([]);
  const [followers, setFollowers] = useState<FriendProfile[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState('');
  const [networkLoading, setNetworkLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [addingFriendId, setAddingFriendId] = useState<string | null>(null);
  const [removingFriendId, setRemovingFriendId] = useState<string | null>(null);

  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');
  const cardColor = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const borderColor = useThemeColor({ light: '#ececec', dark: '#2c2c2c' }, 'background');
  const inputColor = useThemeColor({ light: '#f7f7f7', dark: '#1f1f1f' }, 'background');

  const trimmedQuery = query.trim();
  const meetsMinChars = trimmedQuery.length >= 2;
  const friendIds = useMemo(() => new Set(following.map((friend) => friend.id)), [following]);

  const fetchNetwork = useCallback(async () => {
    if (!activeUserId) return;
    setNetworkLoading(true);
    setNetworkError(null);
    try {
      const [followingRes, followersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/following/user/${encodeURIComponent(activeUserId)}`),
        fetch(`${API_BASE_URL}/followers/user/${encodeURIComponent(activeUserId)}`),
      ]);

      if (!followingRes.ok) {
        throw new Error(`Following HTTP ${followingRes.status}`);
      }
      if (!followersRes.ok) {
        throw new Error(`Followers HTTP ${followersRes.status}`);
      }

      const followingPayload = await followingRes.json();
      const followersPayload = await followersRes.json();

      const mappedFollowing = Array.isArray(followingPayload?.following)
        ? (followingPayload.following as any[])
            .map((entry) => buildProfileFromApi(entry, 'following'))
            .filter(Boolean) as FriendProfile[]
        : [];

      const mappedFollowers = Array.isArray(followersPayload?.followers)
        ? (followersPayload.followers as any[])
            .map((entry) => buildProfileFromApi(entry, 'follower'))
            .filter(Boolean) as FriendProfile[]
        : [];

      setFollowing(mappedFollowing);
      setFollowers(mappedFollowers);
      setNetworkError(null);
    } catch (err: any) {
      setNetworkError(err?.message || 'Unable to load your network.');
    } finally {
      setNetworkLoading(false);
    }
  }, [activeUserId]);

  useEffect(() => {
    fetchNetwork();
  }, [fetchNetwork]);

  useEffect(() => {
    let cancelled = false;
    const q = trimmedQuery;
    if (!q || !meetsMinChars) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      return () => {
        cancelled = true;
      };
    }

    setSearching(true);
    setSearchError(null);

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/users/${encodeURIComponent(
            activeUserId
          )}/searchUsers/${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          const message = `Search failed (HTTP ${res.status})`;
          throw new Error(message);
        }

        const payload = await res.json();
        if (cancelled) return;
        const items: SearchResult[] = (payload.items || [])
          .map((item: any) => ({
            id: item._id || item.id,
            username: ensureHandle(item.username || ''),
          }))
          .filter((item: SearchResult) => item.id && !friendIds.has(item.id));

        setSearchResults(items);
        setLastQuery(q);
        setSearchError(null);
      } catch (error: any) {
        if (controller.signal.aborted || cancelled) return;
        const message = error?.message || 'Unable to search right now.';
        setSearchError(message);
        notify('Search failed', message);
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeUserId, friendIds, meetsMinChars, trimmedQuery]);

  const requestRelationshipChange = async (url: string, method: 'POST' | 'DELETE') => {
    const res = await fetch(url, { method });
    if (!res.ok) {
      let message: string | undefined;
      try {
        const body = await res.json();
        message = body?.detail || body?.error;
      } catch (e) {
        // ignore parsing issues
      }
      throw new Error(message || `Request failed (HTTP ${res.status})`);
    }
  };

  const followUser = useCallback(
    async (targetId: string, usernameForDisplay: string, options?: { resetSearch?: boolean }) => {
      if (!targetId || friendIds.has(targetId)) return;
      const formattedUsername = ensureHandle(usernameForDisplay);
      const display = displayNameFromHandle(formattedUsername);
      setAddingFriendId(targetId);
      try {
        const followUrl = `${API_BASE_URL}/following/user/${encodeURIComponent(
          activeUserId
        )}/usertoadd/${encodeURIComponent(targetId)}`;
        const followerUrl = `${API_BASE_URL}/followers/user/${encodeURIComponent(
          targetId
        )}/usertoadd/${encodeURIComponent(activeUserId)}`;

        await requestRelationshipChange(followUrl, 'POST');
        await requestRelationshipChange(followerUrl, 'POST');

        if (options?.resetSearch) {
          setQuery('');
          setSearchResults([]);
        }

        notify('Following', `You are now following ${display}.`);
        await fetchNetwork();
      } catch (err: any) {
        notify('Follow failed', err?.message || 'Unable to follow this user right now.');
      } finally {
        setAddingFriendId(null);
      }
    },
    [activeUserId, friendIds, fetchNetwork]
  );

  const handleUnfollow = useCallback(
    async (friend: FriendProfile) => {
      if (!friend?.id) return;
      setRemovingFriendId(friend.id);
      try {
        const followUrl = `${API_BASE_URL}/following/user/${encodeURIComponent(
          activeUserId
        )}/usertoremove/${encodeURIComponent(friend.id)}`;
        const followerUrl = `${API_BASE_URL}/followers/user/${encodeURIComponent(
          friend.id
        )}/usertoremove/${encodeURIComponent(activeUserId)}`;

        await requestRelationshipChange(followUrl, 'DELETE');
        await requestRelationshipChange(followerUrl, 'DELETE');

        notify(
          'Unfollowed',
          `You will no longer follow ${friend.name || displayNameFromHandle(friend.username)}.`
        );
        await fetchNetwork();
      } catch (err: any) {
        notify('Update failed', err?.message || 'Unable to update follow status.');
      } finally {
        setRemovingFriendId(null);
      }
    },
    [activeUserId, fetchNetwork]
  );

  const handleAddFriendFromSearch = (result: SearchResult) => {
    followUser(result.id, result.username, { resetSearch: true });
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps='handled'>
        <View style={styles.header}>
          <ThemedText type='title'>Friends</ThemedText>
          <ThemedText style={styles.subtitle}>
            Search for people on Movi and keep up with what your friends are watching and reading.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type='subtitle'>Find friends</ThemedText>
          <View
            style={[
              styles.searchField,
              { backgroundColor: inputColor, borderColor },
            ]}
          >
            <IconSymbol name='magnifyingglass' size={18} color={iconColor} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder='Search by name or username'
              placeholderTextColor={iconColor}
              style={styles.input}
              autoCapitalize='none'
              autoCorrect={false}
              returnKeyType='search'
            />
          </View>

          {trimmedQuery.length === 0 && (
            <ThemedText style={styles.placeholderText} lightColor='#6f7276' darkColor='#9da3aa'>
              Start typing to look for Movi friends.
            </ThemedText>
          )}

          {trimmedQuery.length > 0 && !meetsMinChars && (
            <ThemedText style={styles.placeholderText} lightColor='#6f7276' darkColor='#9da3aa'>
              Enter at least 2 characters to search for users.
            </ThemedText>
          )}

          {meetsMinChars && (
            <View style={styles.resultsContainer}>
              {searching && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size='small' color={tintColor} />
                  <ThemedText style={styles.loadingText}>
                    Searching for "{trimmedQuery}"...
                  </ThemedText>
                </View>
              )}

              {!searching && searchError && (
                <ThemedText style={[styles.placeholderText, styles.errorText]} lightColor='#c53030' darkColor='#f06272'>
                  {searchError}
                </ThemedText>
              )}

              {!searching && !searchError && searchResults.length === 0 && (
                <ThemedText style={styles.placeholderText} lightColor='#6f7276' darkColor='#9da3aa'>
                  No users match "{lastQuery || trimmedQuery}". Try a different search.
                </ThemedText>
              )}

              {!searching && !searchError && searchResults.length > 0 && (
                <>
                  {searchResults.map((result) => {
                    const displayName = displayNameFromHandle(result.username);
                    const accent = pickAccent(result.username);
                    return (
                      <View
                        key={result.id}
                        style={[
                          styles.resultCard,
                          { backgroundColor: cardColor, borderColor },
                        ]}
                      >
                        <View style={[styles.avatar, { backgroundColor: accent }]}>
                          <ThemedText style={styles.avatarInitials} lightColor='#ffffff' darkColor='#ffffff'>
                            {initialsFromText(displayName)}
                          </ThemedText>
                        </View>
                        <View style={styles.userMeta}>
                          <ThemedText style={styles.resultName}>{displayName}</ThemedText>
                          <ThemedText
                            style={styles.username}
                            lightColor='#6f7276'
                            darkColor='#b0b6bb'
                          >
                            {ensureHandle(result.username)}
                          </ThemedText>
                  <ThemedText style={styles.resultDescription} lightColor='#3d3f42' darkColor='#d4d7db'>
                    Ready to share their watchlist.
                  </ThemedText>
                </View>
                {friendIds.has(result.id) ? (
                  <View
                    style={[
                      styles.addButton,
                      { borderColor },
                      styles.buttonDisabled,
                    ]}
                  >
                    <ThemedText style={[styles.addButtonText, { color: borderColor }]}>
                      Following
                    </ThemedText>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole='button'
                    onPress={() => handleAddFriendFromSearch(result)}
                    disabled={addingFriendId === result.id}
                    style={[
                      styles.addButton,
                      { borderColor: tintColor },
                      addingFriendId === result.id && styles.buttonDisabled,
                    ]}
                  >
                    <ThemedText style={[styles.addButtonText, { color: tintColor }]}>
                      {addingFriendId === result.id ? 'Following...' : 'Follow'}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            );
          })}
        </>
      )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <ThemedText type='subtitle'>You're following</ThemedText>
          <ThemedText style={styles.sectionHint} lightColor='#6f7276' darkColor='#9da3aa'>
            {following.length} {following.length === 1 ? 'person' : 'people'}
          </ThemedText>

          {networkError && (
            <View style={styles.networkErrorRow}>
              <ThemedText
                style={[styles.placeholderText, styles.errorText]}
                lightColor='#c53030'
                darkColor='#f06272'
              >
                {networkError}
              </ThemedText>
              <Pressable onPress={() => fetchNetwork()}>
                <ThemedText style={[styles.retryLink, { color: tintColor }]}>Try again</ThemedText>
              </Pressable>
            </View>
          )}

          {networkLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size='small' color={tintColor} />
              <ThemedText style={styles.loadingText}>Refreshing network...</ThemedText>
            </View>
          )}

          {following.length === 0 ? (
            <ThemedText style={styles.placeholderText} lightColor='#6f7276' darkColor='#9da3aa'>
              You are not following anyone yet. Use the search above to get started.
            </ThemedText>
          ) : (
            following.map((friend) => {
              const removing = removingFriendId === friend.id;
              return (
                <View
                  key={friend.id}
                  style={[
                    styles.friendCard,
                    { backgroundColor: cardColor, borderColor },
                  ]}
                >
                  <View style={[styles.avatar, { backgroundColor: friend.accent }]}>
                    <ThemedText style={styles.avatarInitials} lightColor='#ffffff' darkColor='#ffffff'>
                      {initialsFromText(friend.name || friend.username)}
                    </ThemedText>
                  </View>
                  <View style={styles.friendMeta}>
                    <ThemedText style={styles.friendName}>
                      {friend.name || displayNameFromHandle(friend.username)}
                    </ThemedText>
                    <ThemedText style={styles.friendUsername} lightColor='#6f7276' darkColor='#b0b6bb'>
                      {ensureHandle(friend.username)}
                    </ThemedText>
                    <ThemedText style={styles.friendActivity} lightColor='#3d3f42' darkColor='#d4d7db'>
                      {friend.lastShared || 'Active on Movi'}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => handleUnfollow(friend)}
                    disabled={removing}
                    style={[
                      styles.actionButton,
                      { borderColor: tintColor },
                      removing && styles.buttonDisabled,
                    ]}
                  >
                    <ThemedText style={[styles.actionButtonText, { color: tintColor }]}>
                      {removing ? 'Removing...' : 'Unfollow'}
                    </ThemedText>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <ThemedText type='subtitle'>Followers</ThemedText>
          <ThemedText style={styles.sectionHint} lightColor='#6f7276' darkColor='#9da3aa'>
            {followers.length}{' '}
            {followers.length === 1 ? 'person follows you' : 'people follow you'}
          </ThemedText>

          {followers.length === 0 ? (
            <ThemedText style={styles.placeholderText} lightColor='#6f7276' darkColor='#9da3aa'>
              No one is following you yet. Keep sharing to grow your audience.
            </ThemedText>
          ) : (
            followers.map((follower) => {
              const isFollowingBack = friendIds.has(follower.id);
              const isMutating = addingFriendId === follower.id;
              return (
                <View
                  key={`follower-${follower.id}`}
                  style={[
                    styles.friendCard,
                    { backgroundColor: cardColor, borderColor },
                  ]}
                >
                  <View style={[styles.avatar, { backgroundColor: follower.accent }]}>
                    <ThemedText style={styles.avatarInitials} lightColor='#ffffff' darkColor='#ffffff'>
                      {initialsFromText(follower.name || follower.username)}
                    </ThemedText>
                  </View>
                  <View style={styles.friendMeta}>
                    <ThemedText style={styles.friendName}>
                      {follower.name || displayNameFromHandle(follower.username)}
                    </ThemedText>
                    <ThemedText style={styles.friendUsername} lightColor='#6f7276' darkColor='#b0b6bb'>
                      {ensureHandle(follower.username)}
                    </ThemedText>
                    <ThemedText style={styles.friendActivity} lightColor='#3d3f42' darkColor='#d4d7db'>
                      {follower.lastShared || 'Follows you on Movi'}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => followUser(follower.id, follower.username)}
                    disabled={isFollowingBack || isMutating}
                    style={[
                      styles.actionButton,
                      { borderColor: isFollowingBack ? borderColor : tintColor },
                      (isFollowingBack || isMutating) && styles.buttonDisabled,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.actionButtonText,
                        { color: isFollowingBack ? iconColor : tintColor },
                      ]}
                    >
                      {isFollowingBack ? 'Following' : isMutating ? 'Following...' : 'Follow back'}
                    </ThemedText>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 32,
  },
  header: {
    gap: 10,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    opacity: 0.75,
  },
  section: {
    gap: 14,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  resultsContainer: {
    gap: 12,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontWeight: '700',
    fontSize: 16,
  },
  userMeta: {
    flex: 1,
    gap: 2,
    marginLeft: 12,
  },
  resultName: {
    fontSize: 17,
    fontWeight: '600',
  },
  username: {
    fontSize: 14,
  },
  resultDescription: {
    fontSize: 13,
    marginTop: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  errorText: {
    fontWeight: '600',
  },
  addButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHint: {
    fontSize: 14,
    marginTop: -8,
  },
  networkErrorRow: {
    gap: 4,
  },
  retryLink: {
    fontSize: 14,
    fontWeight: '700',
  },
  placeholderText: {
    fontSize: 15,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginTop: 8,
  },
  friendMeta: {
    flex: 1,
    marginLeft: 12,
    gap: 2,
  },
  friendName: {
    fontSize: 17,
    fontWeight: '600',
  },
  friendUsername: {
    fontSize: 14,
  },
  friendActivity: {
    fontSize: 13,
    marginTop: 4,
  },
  actionButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
