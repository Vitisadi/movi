import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ScrollView,
  Image,
  Pressable,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { emitLibraryChanged, onLibraryChanged } from '@/lib/library-events';

/* ---------- Types ---------- */
type Movie = {
  id: string;
  title: string;
  year?: number;
  director?: string;
  runtimeMin?: number;
  posterUrl?: string;
  rating?: number; // 0-10
};

type Book = {
  id: string;
  title: string;
  author?: string;
  year?: number;
  pages?: number;
  coverUrl?: string;
  rating?: number; // 0-10
};

type Review = {
  id: string;
  kind: 'movie' | 'book';
  itemId?: string | number;
  itemTitle?: string;
  itemAuthor?: string;
  itemYear?: number;
  itemPoster?: string;
  itemCover?: string;
  rating?: number;
  title?: string;
  body?: string;
  createdAt?: string;
};

const TABS = ['Completed', 'Saved', 'Reviews'] as const;
type TabKey = (typeof TABS)[number];

// Frontend API base URL from env
const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ||
  'http://127.0.0.1:3000';

export default function LibraryScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('Completed');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [watchedMovies, setWatchedMovies] = useState<Movie[]>([]);
  const [laterMovies, setLaterMovies] = useState<Movie[]>([]);
  const [watchedBooks, setWatchedBooks] = useState<Book[]>([]);
  const [laterBooks, setLaterBooks] = useState<Book[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [promotingItemId, setPromotingItemId] = useState<string | null>(null);
  const [removingReviewId, setRemovingReviewId] = useState<string | null>(null);

  const isReviewTab = activeTab === 'Reviews';
  const picked =
    activeTab === 'Completed'
      ? { movies: watchedMovies, books: watchedBooks }
      : activeTab === 'Saved'
        ? { movies: laterMovies, books: laterBooks }
        : { movies: [], books: [] };

  const { user, isLoading } = useAuth();
  const USER_ID = user?.id;
  const totalCount = isReviewTab
    ? reviews.length
    : (picked.movies?.length || 0) + (picked.books?.length || 0);
  const isEmpty = totalCount === 0;

  const sections = useMemo(
    () => [
      {
        title: `Movies (${picked.movies.length})`,
        data: picked.movies,
        kind: 'movie' as const,
      },
      {
        title: `Books (${picked.books.length})`,
        data: picked.books,
        kind: 'book' as const,
      },
    ],
    [activeTab, watchedMovies, laterMovies, watchedBooks, laterBooks]
  );

  function mapApiMovie(it: any): Movie {
    const idStr = String(it?.id ?? '');
    const yearNum = it?.year ? Number(it.year) : undefined;
    return {
      id: idStr,
      title: String(it?.title ?? ''),
      year: Number.isFinite(yearNum) ? yearNum : undefined,
      posterUrl: it?.posterUrl ?? undefined,
    };
  }

  function mapApiBook(work: any): Book {
    const key = String(work?.key ?? ''); // e.g. '/works/OL2665176W'
    const id = key ? (key.split('/').pop() || key) : String(work?.id ?? '');
    const title = String(work?.title ?? '');

    let coverUrl: string | undefined;
    if (Array.isArray(work?.covers) && work.covers.length > 0 && work.covers[0]) {
      coverUrl = `https://covers.openlibrary.org/b/id/${work.covers[0]}-M.jpg`;
    } else if (typeof work?.coverUrl === 'string') {
      coverUrl = work.coverUrl;
    }

    let author: string | undefined;
    if (Array.isArray(work?.authors) && work.authors.length > 0) {
      if (typeof work.authors[0] === 'string') {
        author = (work.authors as string[]).join(', ');
      } else if (work.authors[0]?.name) {
        author = work.authors.map((a: any) => a?.name).filter(Boolean).join(', ');
      }
    } else if (Array.isArray(work?.author_name)) {
      author = work.author_name.filter(Boolean).join(', ');
    }

    let year: number | undefined;
    const candidate = work?.first_publish_year ?? work?.first_publish_date ?? work?.created;
    if (typeof candidate === 'number') {
      year = candidate;
    } else if (typeof candidate === 'string') {
      const m = candidate.match(/\d{4}/);
      if (m) year = Number(m[0]);
    } else if (candidate && typeof candidate === 'object' && typeof candidate?.value === 'string') {
      const m = String(candidate.value).match(/\d{4}/);
      if (m) year = Number(m[0]);
    }

    return { id, title, author, year, coverUrl };
  }

  function mapApiReview(entry: any): Review | null {
    if (!entry) return null;
    const id = String(entry?.id ?? entry?._id ?? '').trim();
    if (!id) return null;
    const kind: 'movie' | 'book' = entry?.kind === 'book' ? 'book' : 'movie';
    const ratingNum = Number(entry?.rating);
    const yearNum = Number(entry?.itemYear);
    const createdAt =
      typeof entry?.createdAt === 'string'
        ? entry.createdAt
        : typeof entry?.createdAt?.value === 'string'
          ? entry.createdAt.value
          : undefined;
    return {
      id,
      kind,
      itemId: entry?.itemId ?? entry?.movieId ?? entry?.bookId,
      itemTitle: entry?.itemTitle || entry?.title || '',
      itemAuthor: entry?.itemAuthor,
      itemYear: Number.isFinite(yearNum) ? yearNum : undefined,
      itemPoster: entry?.itemPoster,
      itemCover: entry?.itemCover,
      rating: Number.isFinite(ratingNum) ? ratingNum : undefined,
      title: typeof entry?.title === 'string' ? entry.title : undefined,
      body: typeof entry?.body === 'string' ? entry.body : undefined,
      createdAt,
    };
  }

  const loadWatched = async () => {
    const url = `${API_BASE_URL}/movies/user/${USER_ID}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Watched HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    setWatchedMovies(items.map(mapApiMovie));
  };

  const loadLater = async () => {
    const url = `${API_BASE_URL}/watchlatermovies/user/${USER_ID}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`WatchLater HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    setLaterMovies(items.map(mapApiMovie));
  };

  const loadReadBooks = async () => {
    const url = `${API_BASE_URL}/read/user/${USER_ID}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ReadBooks HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data?.readBooks) ? data.readBooks : [];
    setWatchedBooks(items.map(mapApiBook));
  };

  const loadTbrBooks = async () => {
    const url = `${API_BASE_URL}/toberead/user/${USER_ID}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ToBeRead HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data?.toBeReadBooks) ? data.toBeReadBooks : [];
    setLaterBooks(items.map(mapApiBook));
  };

  const loadReviews = async () => {
    const url = `${API_BASE_URL}/reviews/user/${USER_ID}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Reviews HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    setReviews(items.map(mapApiReview).filter(Boolean) as Review[]);
  };

  const onRefresh = async (initial = false) => {
    try {
      if (initial) setLoading(true);
      setRefreshing(true);
      if (!USER_ID) {
        setWatchedMovies([]);
        setLaterMovies([]);
        setWatchedBooks([]);
        setLaterBooks([]);
        setReviews([]);
        return;
      }
      await Promise.all([loadWatched(), loadLater(), loadReadBooks(), loadTbrBooks(), loadReviews()]);
    } catch (err: any) {
      Alert.alert('Load failed', String(err?.message || err));
    } finally {
      setRefreshing(false);
      if (initial) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && USER_ID) {
      onRefresh(true);
    }
  }, [isLoading, USER_ID]);

  useEffect(() => {
    if (!isLoading && !USER_ID) {
      setLoading(false);
    }
  }, [USER_ID, isLoading]);

  useEffect(() => {
    const off = onLibraryChanged(() => {
      if (!isLoading && USER_ID) {
        onRefresh();
      }
    });
    return off;
  }, [isLoading, USER_ID]);

  const removeLibraryItem = async (item: Movie | Book, kind: 'movie' | 'book') => {
    if (!USER_ID) {
      Alert.alert('Login required', 'Please sign in to manage your library.');
      return;
    }
    const targetId = String(item.id || '').trim();
    if (!targetId) {
      Alert.alert('Missing item', 'Could not determine which item to remove.');
      return;
    }
    const isWatchedTab = activeTab === 'Completed';

    let path = '';
    if (kind === 'movie') {
      const numId = Number(targetId);
      if (!Number.isFinite(numId)) {
        Alert.alert('Invalid movie', 'Movie id was not valid.');
        return;
      }
      path = isWatchedTab
        ? `/removewatchedmovie/user/${USER_ID}/movie/${numId}`
        : `/removewatchlatermovie/user/${USER_ID}/movie/${numId}`;
    } else {
      path = isWatchedTab
        ? `/read/user/${USER_ID}/book/${encodeURIComponent(targetId)}`
        : `/toberead/user/${USER_ID}/book/${encodeURIComponent(targetId)}`;
    }

    setRemovingItemId(targetId);
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, { method: 'DELETE' });
      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      const body = isJson ? await res.json() : undefined;
      if (!res.ok) {
        const msg = body?.detail || body?.error || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      if (kind === 'movie') {
        if (isWatchedTab) {
          setWatchedMovies((prev) => prev.filter((m) => String(m.id) !== targetId));
        } else {
          setLaterMovies((prev) => prev.filter((m) => String(m.id) !== targetId));
        }
      } else {
        if (isWatchedTab) {
          setWatchedBooks((prev) => prev.filter((b) => String(b.id) !== targetId));
        } else {
          setLaterBooks((prev) => prev.filter((b) => String(b.id) !== targetId));
        }
      }

      emitLibraryChanged();
    } catch (err: any) {
      Alert.alert('Remove failed', String(err?.message || err));
    } finally {
      setRemovingItemId(null);
    }
  };

  const markAsDone = async (item: Movie | Book, kind: 'movie' | 'book') => {
    if (activeTab !== 'Saved') {
      return;
    }
    if (!USER_ID) {
      Alert.alert('Login required', 'Please sign in to manage your library.');
      return;
    }
    const targetId = String(item.id || '').trim();
    if (!targetId) {
      Alert.alert('Missing item', 'Could not determine which item to move.');
      return;
    }

    let path = '';
    if (kind === 'movie') {
      const numId = Number(targetId);
      if (!Number.isFinite(numId)) {
        Alert.alert('Invalid movie', 'Movie id was not valid.');
        return;
      }
      path = `/addwatchedmovie/user/${USER_ID}/movie/${numId}`;
    } else {
      path = `/read/user/${USER_ID}/book/${encodeURIComponent(targetId)}`;
    }

    setPromotingItemId(targetId);
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST' });
      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      const body = isJson ? await res.json() : undefined;
      if (!res.ok) {
        const msg = body?.detail || body?.error || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      if (kind === 'movie') {
        setLaterMovies((prev) => prev.filter((m) => String(m.id) !== targetId));
        setWatchedMovies((prev) => {
          const exists = prev.some((m) => String(m.id) === targetId);
          return exists ? prev : [{ ...(item as Movie) }, ...prev];
        });
      } else {
        setLaterBooks((prev) => prev.filter((b) => String(b.id) !== targetId));
        setWatchedBooks((prev) => {
          const exists = prev.some((b) => String(b.id) === targetId);
          return exists ? prev : [{ ...(item as Book) }, ...prev];
        });
      }

      emitLibraryChanged();
      onRefresh();
    } catch (err: any) {
      Alert.alert('Move failed', String(err?.message || err));
    } finally {
      setPromotingItemId(null);
    }
  };

  const removeReview = async (review: Review) => {
    if (!review?.id) return;
    setRemovingReviewId(review.id);
    try {
      const url = `${API_BASE_URL}/reviews/${review.kind}/${encodeURIComponent(review.id)}`;
      const res = await fetch(url, { method: 'DELETE' });
      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      const body = isJson ? await res.json() : undefined;
      if (!res.ok) {
        const msg = body?.detail || body?.error || `HTTP ${res.status}`;
        throw new Error(msg);
      }
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      emitLibraryChanged();
    } catch (err: any) {
      Alert.alert('Remove failed', String(err?.message || err));
    } finally {
      setRemovingReviewId(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Library</Text>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setActiveTab(t)}
            style={[styles.tab, activeTab === t && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === t && styles.tabTextActive,
              ]}
            >
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#0ea5e9" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : !USER_ID ? (
        <EmptyState activeTab={activeTab} />
      ) : isEmpty ? (
        <EmptyState activeTab={activeTab} />
      ) : activeTab === 'Reviews' ? (
        <ScrollView
          contentContainerStyle={[styles.listContent, styles.reviewList]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onRemove={removeReview}
              removing={removingReviewId === review.id}
            />
          ))}
        </ScrollView>
      ) : (
        <SectionList
          sections={sections as any}
          keyExtractor={(item: Movie | Book) => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item, section }) => (
            <ItemCard
              item={item}
              kind={section.kind}
              onRemove={removeLibraryItem}
              onMarkDone={markAsDone}
              showMarkDone={activeTab === 'Saved'}
              removing={removingItemId === String(item.id)}
              promoting={promotingItemId === String(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}

/* ---------- Item Card ---------- */
function ItemCard({
  item,
  kind,
  onRemove,
  onMarkDone,
  showMarkDone,
  removing,
  promoting,
}: {
  item: Movie | Book;
  kind: 'movie' | 'book';
  onRemove: (item: Movie | Book, kind: 'movie' | 'book') => void;
  onMarkDone: (item: Movie | Book, kind: 'movie' | 'book') => void;
  showMarkDone?: boolean;
  removing?: boolean;
  promoting?: boolean;
}) {
  const isMovie = kind === 'movie';
  const cover = isMovie ? (item as Movie).posterUrl : (item as Book).coverUrl;
  const title = item.title;
  const subtitle = isMovie
    ? buildSubtitleMovie(item as Movie)
    : buildSubtitleBook(item as Book);
  const rating = (item as any).rating;

  return (
    <View style={styles.card}>
      <Image
        source={{ uri: cover || PLACEHOLDER_IMG }}
        style={styles.cover}
        resizeMode='cover'
      />
      <View style={styles.cardRight}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {title}
          </Text>
          <Pressable
            onPress={() => onRemove(item, kind)}
            disabled={removing}
            style={[styles.removeButton, removing && styles.buttonDisabled]}
          >
            <Text style={styles.removeText}>{removing ? '...' : 'X'}</Text>
          </Pressable>
        </View>

        <Text style={styles.cardSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>

        {typeof rating === 'number' && (
          <Text style={styles.cardMeta}>Rating: {rating}/10</Text>
        )}

        <View style={styles.pillsRow}>
          <Pill label={isMovie ? 'Movie' : 'Book'} />
          {showMarkDone && (
            <Pressable
              onPress={() => onMarkDone(item, kind)}
              disabled={promoting}
              style={[
                styles.markDoneButton,
                promoting && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.markDoneText}>
                {promoting ? '...' : isMovie ? 'Mark watched' : 'Mark read'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function ReviewCard({
  review,
  onRemove,
  removing,
}: {
  review: Review;
  onRemove: (review: Review) => void;
  removing?: boolean;
}) {
  const isMovie = review.kind === 'movie';
  const image = isMovie ? review.itemPoster : review.itemCover;
  const subtitleBits = [
    review.itemYear && `${review.itemYear}`,
    !isMovie && review.itemAuthor,
  ].filter(Boolean);
  const subtitle = subtitleBits.join(' | ');
  const created =
    review.createdAt && !Number.isNaN(Date.parse(review.createdAt))
      ? new Date(review.createdAt).toLocaleDateString()
      : null;

  return (
    <View style={styles.reviewCard}>
      <Image
        source={{ uri: image || PLACEHOLDER_IMG }}
        style={styles.reviewCover}
        resizeMode='cover'
      />
      <View style={styles.reviewBody}>
        <View style={styles.reviewHeader}>
          <Text style={styles.reviewTitle} numberOfLines={1}>
            {review.itemTitle || 'Untitled'}
          </Text>
          <Pressable
            onPress={() => onRemove(review)}
            disabled={removing}
            style={[styles.reviewRemoveButton, removing && styles.buttonDisabled]}
          >
            <Text style={styles.reviewRemoveText}>
              {removing ? '...' : 'X'}
            </Text>
          </Pressable>
        </View>
        {subtitle ? <Text style={styles.reviewSubtitle}>{subtitle}</Text> : null}
        {typeof review.rating === 'number' && (
          <Text style={styles.reviewRating}>Rating: {review.rating}/10</Text>
        )}
        {!!review.body && (
          <Text style={styles.reviewText} numberOfLines={4}>
            {review.body}
          </Text>
        )}
        <View style={styles.reviewFooter}>
          <View style={styles.reviewFooterLeft}>
            <Pill label={isMovie ? 'Movie' : 'Book'} />
            {created && <Text style={styles.reviewDate}>{created}</Text>}
          </View>
        </View>
      </View>
    </View>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

/* ---------- Helpers ---------- */
function buildSubtitleMovie(m: Movie) {
  const bits = [
    m.year && `${m.year}`,
    m.director && `Dir. ${m.director}`,
    m.runtimeMin && `${m.runtimeMin} min`,
  ].filter(Boolean);
  return bits.join(' | ');
}

function buildSubtitleBook(b: Book) {
  const bits = [
    b.author,
    b.year && `${b.year}`,
    b.pages && `${b.pages} pages`,
  ].filter(Boolean);
  return bits.join(' | ');
}

function EmptyState({ activeTab }: { activeTab: TabKey }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Nothing here yet</Text>
      {activeTab === 'Reviews' ? (
        <Text style={styles.emptySubtitle}>
          You haven't left any reviews yet. Add one from Search to see it here.
        </Text>
      ) : (
        <Text style={styles.emptySubtitle}>
          Add some {activeTab === 'Completed' ? 'finished' : 'saved for later'} items
          to your library.
        </Text>
      )}
    </View>
  );
}

/* ---------- Constants & Styles ---------- */
const PLACEHOLDER_IMG =
  'https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?w=400&auto=format&fit=crop&q=60';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f1f1f3',
  },
  tabActive: { backgroundColor: '#0ea5e9' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#111' },
  tabTextActive: { color: '#fff' },

  sectionHeader: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '800',
    color: '#374151',
  },
  listContent: { paddingBottom: 24 },
  reviewList: { paddingBottom: 24 },
  reviewCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  reviewCover: {
    width: 64,
    height: 96,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  reviewBody: { flex: 1, gap: 6 },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  reviewTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  reviewSubtitle: { fontSize: 13, color: '#6b7280' },
  reviewRating: { fontSize: 12, color: '#0ea5e9', fontWeight: '700' },
  reviewText: { fontSize: 13, color: '#111827' },
  reviewFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  reviewDate: { fontSize: 12, color: '#6b7280' },
  reviewRemoveButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#fee2e2',
    alignSelf: 'flex-start',
  },
  reviewRemoveText: { color: '#b91c1c', fontWeight: '700' },
  reviewFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 10,
    backgroundColor: '#fafafa',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  cover: {
    width: 64,
    height: 96,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
  },
  cardRight: { flex: 1 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2, flex: 1 },
  cardSubtitle: { fontSize: 13, color: '#6b7280' },
  cardMeta: { fontSize: 12, color: '#6b7280', marginTop: 4 },

  pillsRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  pill: {
    backgroundColor: '#e5f3ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: { fontSize: 12, color: '#0369a1', fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptySubtitle: { color: '#6b7280' },

  loadingWrap: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  loadingText: { marginTop: 8, color: '#6b7280' },

  removeButton: { paddingHorizontal: 6, paddingVertical: 2 },
  removeText: { fontSize: 16, color: '#ef4444', fontWeight: '800' },
  buttonDisabled: { opacity: 0.5 },
  markDoneButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#0ea5e9',
  },
  markDoneText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
});
