import React, { useCallback, useEffect, useState } from 'react';
import type { ListRenderItem } from 'react-native';
import {
   ActivityIndicator,
   FlatList,
   Image,
   RefreshControl,
   StyleSheet,
   Text,
   TouchableOpacity,
   View,
} from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

const API_BASE_URL =
   (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ||
   'http://127.0.0.1:3000';

type RawActivity = {
   _id?: string;
   id?: string;
   activity?: unknown;
   createdAt?: unknown;
   meta?: Record<string, unknown> | null;
};

type ActivityFeedItem = {
   id: string;
   message: string;
   highlight?: string;
   chips: string[];
   timestamp: number | null;
   createdAtLabel: string;
   movieId?: string | null;
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const YEAR = 365 * DAY;
const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w185';

function toDate(value: unknown): Date | null {
   if (!value) {
      return null;
   }
   if (value instanceof Date) {
      return value;
   }
   if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
   }
   if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(obj, '$date')) {
         return toDate(obj.$date);
      }
      if (Object.prototype.hasOwnProperty.call(obj, '$numberLong')) {
         return toDate(obj.$numberLong);
      }
   }
   return null;
}

function formatRelativeTime(date: Date | null): string {
   if (!date) {
      return 'Unknown time';
   }
   const diff = Date.now() - date.getTime();
   if (!Number.isFinite(diff)) {
      return date.toLocaleString();
   }
   const abs = Math.abs(diff);
   if (abs < MINUTE) {
      return 'Just now';
   }
   if (abs < HOUR) {
      return `${Math.round(abs / MINUTE)}m ago`;
   }
   if (abs < DAY) {
      return `${Math.round(abs / HOUR)}h ago`;
   }
   if (abs < WEEK) {
      return `${Math.round(abs / DAY)}d ago`;
   }
   const options: Intl.DateTimeFormatOptions =
      abs >= YEAR
         ? { month: 'short', day: 'numeric', year: 'numeric' }
         : { month: 'short', day: 'numeric' };
   try {
      return date.toLocaleDateString(undefined, options);
   } catch {
      return date.toDateString();
   }
}

function readMeta(
   meta: Record<string, unknown> | null,
   key: string
): unknown {
   if (!meta) {
      return undefined;
   }
   return meta[key];
}

function getString(value: unknown): string | null {
   if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
   }
   return null;
}

function getNumber(value: unknown): number | null {
   if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
   }
   if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
         return null;
      }
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
   }
   return null;
}

function shapeActivity(raw: RawActivity): ActivityFeedItem {
   const meta = (raw.meta && typeof raw.meta === 'object'
      ? raw.meta
      : null) as Record<string, unknown> | null;

   const id =
      getString(raw._id) ||
      getString(raw.id) ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;

   const message =
      getString(raw.activity) || 'Activity recorded';

   let highlight =
      getString(readMeta(meta, 'title')) ||
      getString(readMeta(meta, 'name'));

   const chips: string[] = [];

   const rating = getNumber(readMeta(meta, 'rating'));
   if (rating !== null) {
      chips.push(`Rated ${rating}/10`);
   }

   const status = getString(readMeta(meta, 'status'));
   if (status) {
      chips.push(status);
   }

   const movieIdRaw =
      readMeta(meta, 'movieId') ?? readMeta(meta, 'id');
   const movieId =
      typeof movieIdRaw === 'number' || typeof movieIdRaw === 'string'
         ? String(movieIdRaw).trim()
         : '';
   if (movieId) {
      if (!highlight) {
         highlight = `Movie #${movieId}`;
      }
      chips.push(`TMDB #${movieId}`);
   }

   const bookIdRaw = readMeta(meta, 'bookId');
   const bookId =
      typeof bookIdRaw === 'number' || typeof bookIdRaw === 'string'
         ? String(bookIdRaw).trim()
         : '';
   if (bookId) {
      if (!highlight) {
         highlight = `Book #${bookId}`;
      }
      chips.push(`Book #${bookId}`);
   }

   const uniqueChips = chips.filter(
      (chip, index, arr) => arr.indexOf(chip) === index
   );

   const createdAt = toDate(raw.createdAt);
   const timestamp = createdAt ? createdAt.getTime() : null;

   return {
      id,
      message,
      highlight: highlight || undefined,
      chips: uniqueChips,
      timestamp,
      createdAtLabel: formatRelativeTime(createdAt),
      movieId: movieId || null,
   };
}

export default function HomeScreen() {
   const { user, isLoading: authLoading } = useAuth();
   const [items, setItems] = useState<ActivityFeedItem[]>([]);
   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [moviePosters, setMoviePosters] = useState<
      Record<string, string | null>
   >({});

   const colorScheme = useColorScheme();
   const tintColor = useThemeColor({}, 'tint');
   const textColor = useThemeColor({}, 'text');
   const iconColor = useThemeColor({}, 'icon');

   const cardBackground = colorScheme === 'dark' ? '#1b1f24' : '#f6f8fb';
   const borderColor = colorScheme === 'dark' ? '#262b32' : '#e5e9ef';
   const posterPlaceholderBg =
      colorScheme === 'dark' ? '#272d37' : '#e6ebf3';
   const posterPlaceholderText =
      colorScheme === 'dark' ? '#a0aab8' : '#5b6c84';

   const fetchActivity = useCallback(
      async (initial = false) => {
         if (!user?.id) {
            setItems([]);
            setError(null);
            setLoading(false);
            return;
         }
         try {
            if (initial) {
               setLoading(true);
            }
            setError(null);

            const response = await fetch(
               `${API_BASE_URL}/users/${encodeURIComponent(user.id)}/activity`
            );
            if (response.status === 404) {
               setItems([]);
               setError(null);
               return;
            }
            if (!response.ok) {
               throw new Error(
                  `Request failed (${response.status})`
               );
            }
            const data = await response.json().catch(() => ({}));
            const rawItems = Array.isArray(data?.items) ? data.items : [];
            const shaped = rawItems
               .map((item) => shapeActivity(item as RawActivity))
               .sort(
                  (a, b) =>
                     (b.timestamp ?? 0) - (a.timestamp ?? 0)
               );
            setItems(shaped);
         } catch (err: unknown) {
            const message =
               err instanceof Error
                  ? err.message
                  : 'Something went wrong while loading activity.';
            setError(message);
         } finally {
            if (initial) {
               setLoading(false);
            }
         }
      },
      [user?.id]
   );

   useEffect(() => {
      if (!authLoading) {
         void fetchActivity(true);
      }
   }, [authLoading, fetchActivity]);

   const handleRefresh = useCallback(async () => {
      if (!user?.id) {
         return;
      }
      setRefreshing(true);
      try {
         await fetchActivity(false);
      } finally {
         setRefreshing(false);
      }
   }, [fetchActivity, user?.id]);

   const handleRetry = useCallback(() => {
      void fetchActivity(true);
   }, [fetchActivity]);

   useEffect(() => {
      const controller = new AbortController();
      const loadPosters = async () => {
         const missingIds = Array.from(
            new Set(
               items
                  .map((item) => item.movieId?.trim())
                  .filter(
                     (movieId): movieId is string =>
                        Boolean(movieId) && !(movieId in moviePosters)
                  )
            )
         );

         if (missingIds.length === 0) {
            return;
         }

         try {
            const results = await Promise.all(
               missingIds.map(async (movieId) => {
                  try {
                     const res = await fetch(
                        `${API_BASE_URL}/api/title/movie/${encodeURIComponent(
                           movieId
                        )}`,
                        { signal: controller.signal }
                     );

                     if (res.status === 404) {
                        return { movieId, poster: null };
                     }
                     if (!res.ok) {
                        throw new Error(`Movie ${movieId} HTTP ${res.status}`);
                     }

                     const data = await res.json().catch(() => null);
                     const posterPath =
                        data?.poster_path ??
                        data?.posterPath ??
                        data?.data?.poster_path ??
                        null;
                     const poster =
                        typeof posterPath === 'string' && posterPath
                           ? `${TMDB_POSTER_BASE}${posterPath}`
                           : null;
                     return { movieId, poster };
                  } catch (err) {
                     if (controller.signal.aborted) {
                        return null;
                     }
                     console.warn('Failed to fetch movie details', err);
                     return { movieId, poster: null };
                  }
               })
            );

            if (!controller.signal.aborted) {
               setMoviePosters((prev) => {
                  const next = { ...prev };
                  for (const entry of results) {
                     if (!entry) continue;
                     next[entry.movieId] = entry.poster;
                  }
                  return next;
               });
            }
         } catch (err) {
            if (!controller.signal.aborted) {
               console.warn('Movie detail batch failed', err);
            }
         }
      };

      void loadPosters();

      return () => {
        controller.abort();
      };
   }, [items, moviePosters]);

   const greetingName = user?.name?.split(' ')[0] || user?.username || 'there';

   const renderItem: ListRenderItem<ActivityFeedItem> = useCallback(
      ({ item }) => {
         const posterUri =
            item.movieId && moviePosters[item.movieId]
               ? moviePosters[item.movieId] || undefined
               : undefined;

         return (
            <View
               style={[
                  styles.card,
                  {
                     backgroundColor: cardBackground,
                     borderColor,
                  },
               ]}
            >
               <View style={styles.cardHeader}>
                  <Text
                     style={[
                        styles.activityText,
                        { color: textColor },
                     ]}
                  >
                     {item.message}
                  </Text>
                  <Text
                     style={[
                        styles.timestamp,
                        { color: iconColor },
                     ]}
                  >
                     {item.createdAtLabel}
                  </Text>
               </View>
               <View style={styles.cardContent}>
                  {posterUri ? (
                     <Image
                        source={{ uri: posterUri }}
                        style={styles.poster}
                        resizeMode='cover'
                     />
                  ) : (
                     <View
                        style={[
                           styles.posterPlaceholder,
                           { backgroundColor: posterPlaceholderBg },
                        ]}
                     >
                        <Text
                           style={[
                              styles.posterPlaceholderText,
                              { color: posterPlaceholderText },
                           ]}
                        >
                           🎬
                        </Text>
                     </View>
                  )}
                  <View style={styles.cardBody}>
                     {item.highlight ? (
                        <Text
                           style={[
                              styles.highlight,
                              { color: textColor },
                           ]}
                           numberOfLines={2}
                        >
                           {item.highlight}
                        </Text>
                     ) : null}
                     {item.chips.length > 0 ? (
                        <View style={styles.chipsRow}>
                           {item.chips.map((chip) => (
                              <View
                                 key={chip}
                                 style={[
                                    styles.chip,
                                    {
                                       borderColor: tintColor + '44',
                                       backgroundColor: tintColor + '22',
                                    },
                                 ]}
                              >
                                 <Text
                                    style={[
                                       styles.chipText,
                                       { color: tintColor },
                                    ]}
                                 >
                                    {chip}
                                 </Text>
                              </View>
                           ))}
                        </View>
                     ) : null}
                  </View>
               </View>
            </View>
         );
      },
      [
         borderColor,
         cardBackground,
         iconColor,
         moviePosters,
         posterPlaceholderBg,
         posterPlaceholderText,
         textColor,
         tintColor,
      ]
   );

   const keyExtractor = useCallback(
      (item: ActivityFeedItem) => item.id,
      []
   );

   const listEmptyComponent = (
      <View style={styles.emptyState}>
         <ThemedText style={styles.emptyTitle}>
            No activity yet
         </ThemedText>
         <Text
            style={[
               styles.emptySubtitle,
               { color: iconColor },
            ]}
         >
            Start adding movies to your library to see them appear
            here.
         </Text>
      </View>
   );

   const content = (() => {
      if (authLoading || loading) {
         return (
            <View style={styles.centerContent}>
               <ActivityIndicator size='small' color={tintColor} />
               <Text
                  style={[
                     styles.loadingText,
                     { color: iconColor },
                  ]}
               >
                  Loading your activity…
               </Text>
            </View>
         );
      }

      if (!user) {
         return (
            <View style={styles.loginState}>
               <Text
                  style={[
                     styles.loginTitle,
                     { color: textColor },
                  ]}
               >
                  Welcome to Movi
               </Text>
               <Text
                  style={[
                     styles.loginSubtitle,
                     { color: iconColor },
                  ]}
               >
                  Sign in to keep track of everything you have been
                  watching.
               </Text>
               <TouchableOpacity
                  style={[
                     styles.ctaButton,
                     { backgroundColor: tintColor },
                  ]}
                  onPress={() => router.push('/(auth)/login')}
               >
                  <Text
                     style={[
                        styles.ctaButtonText,
                        { color: '#fff' },
                     ]}
                  >
                     Log In
                  </Text>
               </TouchableOpacity>
               <TouchableOpacity
                  style={[
                     styles.ctaButtonOutline,
                     { borderColor: tintColor },
                  ]}
                  onPress={() => router.push('/(auth)/register')}
               >
                  <Text
                     style={[
                        styles.ctaButtonOutlineText,
                        { color: tintColor },
                     ]}
                  >
                     Create account
                  </Text>
               </TouchableOpacity>
            </View>
         );
      }

      if (error) {
         return (
            <View style={styles.centerContent}>
               <Text
                  style={[
                     styles.errorText,
                     { color: textColor },
                  ]}
               >
                  {error}
               </Text>
               <TouchableOpacity
                  style={[
                     styles.retryButton,
                     { backgroundColor: tintColor },
                  ]}
                  onPress={handleRetry}
               >
                  <Text
                     style={[
                        styles.retryButtonText,
                        { color: '#fff' },
                     ]}
                  >
                     Try again
                  </Text>
               </TouchableOpacity>
            </View>
         );
      }

      return (
         <FlatList
            data={items}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={[
               styles.listContent,
               items.length === 0 && styles.listEmptyContent,
            ]}
            refreshControl={
               <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  colors={[tintColor]}
                  tintColor={tintColor}
               />
            }
            ListEmptyComponent={listEmptyComponent}
            showsVerticalScrollIndicator={false}
         />
      );
   })();

   return (
      <ThemedView style={styles.container}>
         <View style={styles.header}>
            <ThemedText type='title'>Home</ThemedText>
            <Text
               style={[
                  styles.subtitle,
                  { color: iconColor },
               ]}
            >
               {user
                  ? `Welcome back, ${greetingName}. Here's what you have been up to.`
                  : 'Your personal activity feed lives here.'}
            </Text>
         </View>
         {content}
      </ThemedView>
   );
}

const styles = StyleSheet.create({
   container: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
   },
   header: {
      marginBottom: 16,
      gap: 6,
   },
   subtitle: {
      fontSize: 15,
      lineHeight: 20,
   },
   centerContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
   },
   loadingText: {
      fontSize: 14,
   },
   loginState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      gap: 12,
   },
   loginTitle: {
      fontSize: 22,
      fontWeight: '600',
   },
   loginSubtitle: {
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 20,
   },
   ctaButton: {
      marginTop: 8,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 999,
   },
   ctaButtonText: {
      fontSize: 15,
      fontWeight: '600',
   },
   ctaButtonOutline: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 999,
      borderWidth: 1,
   },
   ctaButtonOutlineText: {
      fontSize: 15,
      fontWeight: '600',
   },
   errorText: {
      fontSize: 15,
      textAlign: 'center',
   },
   retryButton: {
      paddingHorizontal: 24,
      paddingVertical: 10,
      borderRadius: 999,
   },
   retryButtonText: {
      fontSize: 15,
      fontWeight: '600',
   },
   listContent: {
      paddingBottom: 24,
      gap: 12,
   },
   listEmptyContent: {
      flexGrow: 1,
      justifyContent: 'center',
   },
   card: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      gap: 14,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
   },
   cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 8,
   },
   cardContent: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
   },
   poster: {
      width: 72,
      height: 108,
      borderRadius: 12,
      backgroundColor: '#00000012',
   },
   posterPlaceholder: {
      width: 72,
      height: 108,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
   },
   posterPlaceholderText: {
      fontSize: 22,
   },
   cardBody: {
      flex: 1,
      gap: 8,
   },
   activityText: {
      fontSize: 16,
      fontWeight: '600',
      flex: 1,
   },
   timestamp: {
      fontSize: 13,
   },
   highlight: {
      fontSize: 15,
      fontWeight: '500',
   },
   chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
   },
   chip: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderWidth: 1,
   },
   chipText: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.2,
   },
   emptyState: {
      alignItems: 'center',
      paddingVertical: 48,
      gap: 8,
   },
   emptyTitle: {
      fontSize: 17,
      fontWeight: '600',
   },
   emptySubtitle: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: 24,
   },
});
