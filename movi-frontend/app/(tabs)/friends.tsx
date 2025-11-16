import React, { useEffect, useMemo, useState } from 'react';
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

const PLACEHOLDER_FRIENDS: FriendProfile[] = [
  {
    id: 'f-alex',
    name: 'Alex Rios',
    username: '@alexrios',
    accent: '#FF9F68',
    lastShared: 'Reviewed Interstellar',
  },
  {
    id: 'f-diego',
    name: 'Diego Chu',
    username: '@diegoreads',
    accent: '#32C6A6',
    lastShared: 'Watching Air: Courting a Legend',
  },
  {
    id: 'f-sasha',
    name: 'Sasha Odun',
    username: '@sashaodun',
    accent: '#FFB347',
    lastShared: 'Finished Nimona',
  },
];

function ensureHandle(username: string) {
  const clean = (username || '').trim();
  if (!clean) return '@moviewatcher';
  return clean.startsWith('@') ? clean : `@${clean}`;
}

function displayNameFromHandle(username: string) {
  const clean = username.replace(/^@/, '').trim();
  if (!clean) return 'Movi Friend';
  if (clean.includes(' ')) return clean;
  return clean
    .split(/[\._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function initialsFromText(text: string) {
  const clean = text.replace('@', '').trim();
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

export default function FriendsScreen() {
  const { user } = useAuth();

  const activeUserId = user?.id ?? '68c9b2d573fbd318f36537ce';
  const [query, setQuery] = useState('');
  const [friends, setFriends] = useState<FriendProfile[]>(PLACEHOLDER_FRIENDS);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState('');

  const tintColor = useThemeColor({}, 'tint');
  const iconColor = useThemeColor({}, 'icon');
  const cardColor = useThemeColor({ light: '#fff', dark: '#1c1c1e' }, 'background');
  const borderColor = useThemeColor({ light: '#ececec', dark: '#2c2c2c' }, 'background');
  const inputColor = useThemeColor({ light: '#f7f7f7', dark: '#1f1f1f' }, 'background');

  const trimmedQuery = query.trim();
  const meetsMinChars = trimmedQuery.length >= 2;
  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.id)), [friends]);

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

  const handleAddFriendFromSearch = (result: SearchResult) => {
    if (friendIds.has(result.id)) return;

    const formattedUsername = ensureHandle(result.username);
    const newFriend: FriendProfile = {
      id: result.id,
      name: displayNameFromHandle(formattedUsername),
      username: formattedUsername,
      accent: pickAccent(formattedUsername),
      lastShared: 'Just joined your friends list',
    };

    setFriends((prev) => [...prev, newFriend]);
    setQuery('');
    setSearchResults([]);
    notify('Friend added', `${newFriend.name} has been added to your list.`);
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
                        <Pressable
                          accessibilityRole='button'
                          onPress={() => handleAddFriendFromSearch(result)}
                          style={[styles.addButton, { borderColor: tintColor }]}
                        >
                          <ThemedText style={[styles.addButtonText, { color: tintColor }]}>
                            Add Friend
                          </ThemedText>
                        </Pressable>
                      </View>
                    );
                  })}
                </>
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <ThemedText type='subtitle'>Your friends</ThemedText>
          <ThemedText style={styles.sectionHint} lightColor='#6f7276' darkColor='#9da3aa'>
            {friends.length} {friends.length === 1 ? 'connection' : 'connections'}
          </ThemedText>

          {friends.length === 0 ? (
            <ThemedText style={styles.placeholderText} lightColor='#6f7276' darkColor='#9da3aa'>
              You have not added any friends yet. Use the search above to get started.
            </ThemedText>
          ) : (
            friends.map((friend) => (
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
                    {friend.lastShared}
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.messageButton, { borderColor: tintColor }]}
                >
                  <ThemedText style={[styles.messageButtonText, { color: tintColor }]}>
                    Message
                  </ThemedText>
                </Pressable>
              </View>
            ))
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
  messageButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
