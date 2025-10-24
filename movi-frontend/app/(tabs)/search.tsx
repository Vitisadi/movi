import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  SectionList,
  Image,
  Pressable,
  Alert,
  Keyboard,
  Modal,
  Platform,
} from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { emitLibraryChanged } from '@/lib/library-events';

type Kind = 'movie' | 'book';

type SearchItem = {
  id: string;
  kind: Kind;
  title: string;
  year?: number;
  director?: string; // if movie
  author?: string; // if book
  runtimeMin?: number; // if movie
  pages?: number; // if book
  coverUrl?: string; // for books
  posterUrl?: string; // for movies
  rating?: number; // 0-10
};

// Frontend API base URL from env 
const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ||
  'http://127.0.0.1:3000';

// TODO: Replace with authenticated user id from login/session
// Hard-coded for now per instructions
const HARDCODED_USER_ID = '68c9b2d573fbd318f36537ce';

// Cross-platform notification helper (web uses window.alert; native uses Alert)
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

const SAMPLE_ITEMS: SearchItem[] = [
  {
    id: 'm1',
    kind: 'movie',
    title: 'Inception',
    year: 2010,
    director: 'Christopher Nolan',
    runtimeMin: 148,
    posterUrl:
      'https://image.tmdb.org/t/p/w342/qmDpIHrmpJINaRKAfWQfftjCdyi.jpg',
    rating: 9,
  },
  {
    id: 'm2',
    kind: 'movie',
    title: 'The Matrix',
    year: 1999,
    director: 'Wachowski Sisters',
    runtimeMin: 136,
    posterUrl:
      'https://image.tmdb.org/t/p/w342/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
    rating: 9,
  },
  {
    id: 'b1',
    kind: 'book',
    title: 'The Pragmatic Programmer',
    author: 'Andrew Hunt, David Thomas',
    year: 1999,
    pages: 352,
    coverUrl:
      'https://images-na.ssl-images-amazon.com/images/I/41as+WafrFL._SX258_BO1,204,203,200_.jpg',
    rating: 8,
  },
  {
    id: 'b2',
    kind: 'book',
    title: 'Clean Code',
    author: 'Robert C. Martin',
    year: 2008,
    pages: 464,
    coverUrl:
      'https://images-na.ssl-images-amazon.com/images/I/41xShlnTZTL._SX374_BO1,204,203,200_.jpg',
    rating: 8,
  },
  {
    id: 'm3',
    kind: 'movie',
    title: 'Interstellar',
    year: 2014,
    director: 'Christopher Nolan',
    runtimeMin: 169,
    posterUrl:
      'https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    rating: 8,
  },
  {
    id: 'b3',
    kind: 'book',
    title: 'Atomic Habits',
    author: 'James Clear',
    year: 2018,
    pages: 320,
    coverUrl:
      'https://images-na.ssl-images-amazon.com/images/I/51-uspgqWIL._SX328_BO1,204,203,200_.jpg',
    rating: 8,
  },
];

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [reviewItem, setReviewItem] = useState<SearchItem | null>(null);
  const [reviewRating, setReviewRating] = useState('');
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [apiResults, setApiResults] = useState<SearchItem[]>([]);

  // Filter by activeQuery after the user presses Search
  const results = useMemo(() => {
    if (!hasSearched) return [] as SearchItem[];
    return apiResults;
  }, [apiResults, hasSearched]);

  const movies = useMemo(() => results.filter(r => r.kind === 'movie'), [results]);
  const books = useMemo(() => results.filter(r => r.kind === 'book'), [results]);
  const sections = useMemo(
    () => [
      { title: `Movies (${movies.length})`, data: movies, kind: 'movie' as const },
      { title: `Books (${books.length})`, data: books, kind: 'book' as const },
    ],
    [movies, books]
  );

  const sendToBackend = async (
    action: 'watched' | 'later',
    item: SearchItem
  ) => {
    try {
      if (item.kind !== 'movie') {
        notify('Not supported', 'Only movies can be added.');
        return;
      }
      const movieId = String(item.id || '').trim();
      if (!movieId) {
        notify('Missing movie', 'Could not determine movie id.');
        return;
      }

      const path =
        action === 'watched'
          ? `/addwatchedmovie/user/${HARDCODED_USER_ID}/movie/${encodeURIComponent(movieId)}`
          : `/addwatchlatermovie/user/${HARDCODED_USER_ID}/movie/${encodeURIComponent(movieId)}`;
      const res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST' });
      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      const body = isJson ? await res.json() : undefined;
      if (!res.ok) {
        const msg = body?.error || `HTTP ${res.status}`;
        notify('Action failed', String(msg));
        return;
      }
      notify(
        action === 'watched' ? 'Added to Watched' : 'Added to Watch Later',
        `${item.title} (${item.kind})`
      );
      // Notify library to refresh
      emitLibraryChanged();
    } catch (err: any) {
      notify('Network error', String(err?.message || err));
    }
  };

  const handleAddWatched = (item: SearchItem) => sendToBackend('watched', item);
  const handleAddLater = (item: SearchItem) => sendToBackend('later', item);

  const onSubmitSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSubmitting(true);
    Keyboard.dismiss();
    setActiveQuery(q);
    setHasSearched(true);
    try {
      const url = `${API_BASE_URL}/getmovies/${encodeURIComponent(q)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      const mapped: SearchItem[] = items.map((it: any) => ({
        id: String(it.id ?? ''),
        kind: 'movie',
        title: String(it.title ?? ''),
        year: it.year ? Number(it.year) : undefined,
        posterUrl: it.posterUrl ?? undefined,
      }));
      setApiResults(mapped);
    } catch (err: any) {
      notify('Search failed', String(err?.message || err));
      setApiResults([]);
    } finally {
      setSubmitting(false);
    }
  };

  const openReview = (item: SearchItem) => {
    setReviewItem(item);
    setReviewRating('');
    setReviewTitle('');
    setReviewText('');
    setReviewVisible(true);
  };

  const closeReview = () => setReviewVisible(false);

  const submitReview = async () => {
    const ratingNum = Number(reviewRating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 10) {
      notify('Invalid rating', 'Please enter a rating from 1 to 10.');
      return;
    }
    if (!reviewItem) return;
    if (reviewItem.kind !== 'movie') {
      notify('Not supported', 'Only movies can be reviewed.');
      return;
    }
    const movieIdNum = Number(reviewItem.id);
    if (!Number.isFinite(movieIdNum)) {
      notify('Missing movie', 'Could not determine movie id.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/createmoviereview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: HARDCODED_USER_ID, // TODO: replace with logged-in user id
          movieId: movieIdNum,
          rating: ratingNum,
          title: reviewTitle || undefined,
          body: reviewText || '',
        }),
      });
      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      const body = isJson ? await res.json() : undefined;
      if (!res.ok) {
        const detail = body?.detail || body?.error || `HTTP ${res.status}`;
        notify('Review failed', String(detail));
        return;
      }
      notify('Review submitted', `${reviewItem.title} (Rating: ${ratingNum})`);
      setReviewVisible(false);
    } catch (err: any) {
      notify('Network error', String(err?.message || err));
    }
  };

  return (
    <ThemedView style={styles.container}>
      {/* Page Title */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.pageTitle}>Search</ThemedText>
      </View>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search movies or books"
          placeholderTextColor="#9ca3af"
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={onSubmitSearch}
        />
        <Pressable
          onPress={onSubmitSearch}
          style={[styles.searchBtn, submitting && styles.searchBtnDisabled]}
          disabled={submitting}
        >
          <Text style={styles.searchBtnText}>{submitting ? '...' : 'Search'}</Text>
        </Pressable>
      </View>

      {/* Results */}
      {hasSearched ? (
        <SectionList
          sections={sections as any}
          keyExtractor={(item: SearchItem) => item.id}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item, section }) => (
            <SearchResultCard
              item={item}
              onAddWatched={handleAddWatched}
              onAddLater={handleAddLater}
              onLeaveReview={openReview}
            />
          )}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No results</Text>
              <Text style={styles.emptySubtitle}>Try a different search.</Text>
            </View>
          )}
        />
      ) : (
        <View style={styles.empty}> 
          <Text style={styles.emptyTitle}>Search the library</Text>
          <Text style={styles.emptySubtitle}>Enter a query and press Search.</Text>
        </View>
      )}

      {/* Review Modal */}
      <Modal visible={reviewVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Leave a Review</Text>
            {!!reviewItem && (
              <Text style={styles.modalSubtitle} numberOfLines={2}>
                For: {reviewItem.title} ({reviewItem.kind})
              </Text>
            )}
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Rating (1-10)</Text>
              <TextInput
                value={reviewRating}
                onChangeText={setReviewRating}
                keyboardType="number-pad"
                placeholder="e.g. 8"
                style={styles.input}
              />
            </View>
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Title</Text>
              <TextInput
                value={reviewTitle}
                onChangeText={setReviewTitle}
                placeholder="Short title (optional)"
                style={styles.input}
              />
            </View>
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Review</Text>
              <TextInput
                value={reviewText}
                onChangeText={setReviewText}
                placeholder="Write your thoughts..."
                style={[styles.input, styles.textarea]}
                multiline
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable onPress={closeReview} style={[styles.actionBtn, styles.cancelBtn]}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitReview} style={[styles.actionBtn, styles.actionPrimary]}>
                <Text style={styles.actionPrimaryText}>Submit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

function SearchResultCard({
  item,
  onAddWatched,
  onAddLater,
  onLeaveReview,
}: {
  item: SearchItem;
  onAddWatched: (item: SearchItem) => void;
  onAddLater: (item: SearchItem) => void;
  onLeaveReview: (item: SearchItem) => void;
}) {
  const isMovie = item.kind === 'movie';
  const image = isMovie ? item.posterUrl : item.coverUrl;
  const subtitle = isMovie
    ? buildSubtitleMovie(item)
    : buildSubtitleBook(item);

  return (
    <View style={styles.card}>
      <Image
        source={{ uri: image || PLACEHOLDER_IMG }}
        style={styles.cover}
        resizeMode="cover"
      />
      <View style={styles.cardRight}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.cardSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>

        {typeof item.rating === 'number' && (
          <Text style={styles.cardMeta}>Rating: {item.rating}/10</Text>
        )}

        <View style={styles.actionsRow}>
          <Pressable style={[styles.actionBtn, styles.actionPrimary]} onPress={() => onAddWatched(item)}>
            <Text style={styles.actionPrimaryText} numberOfLines={1}>Watched</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.actionSecondary, styles.actionBtnMultiline]} onPress={() => onAddLater(item)}>
            <Text style={[styles.actionSecondaryText, styles.actionTextMultiline]} numberOfLines={2}>{'Watch\nLater'}</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.actionTertiary, styles.actionBtnMultiline]} onPress={() => onLeaveReview(item)}>
            <Text style={[styles.actionTertiaryText, styles.actionTextMultiline]} numberOfLines={2}>{'Leave\nReview'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function buildSubtitleMovie(m: SearchItem) {
  const bits = [
    m.year && `${m.year}`,
    m.director && `Dir. ${m.director}`,
    m.runtimeMin && `${m.runtimeMin} min`,
  ].filter(Boolean) as string[];
  return bits.join(' • ');
}

function buildSubtitleBook(b: SearchItem) {
  const bits = [
    b.author,
    b.year && `${b.year}`,
    b.pages && `${b.pages} pages`,
  ].filter(Boolean) as string[];
  return bits.join(' • ');
}

const PLACEHOLDER_IMG =
  'https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?w=400&auto=format&fit=crop&q=60';

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16, paddingHorizontal: 16 },
  header: { marginBottom: 12, alignItems: 'center' },
  pageTitle: { textAlign: 'center' },

  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  searchInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    backgroundColor: '#fafafa',
    color: '#111827',
  },
  searchBtn: {
    height: 44,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#0ea5e9',
  },
  searchBtnDisabled: { opacity: 0.6 },
  searchBtnText: { color: '#fff', fontWeight: '800' },

  listContent: { paddingBottom: 24 },
  sectionHeader: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '800',
    color: '#374151',
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
  cover: { width: 64, height: 96, borderRadius: 8, backgroundColor: '#e5e7eb' },
  cardRight: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  cardSubtitle: { fontSize: 13, color: '#6b7280' },
  cardMeta: { fontSize: 12, color: '#6b7280', marginTop: 4 },

  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  actionBtn: { flex: 1, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', display: 'flex' },
  actionBtnMultiline: { height: 44, paddingVertical: 2 },
  actionPrimary: { backgroundColor: '#0ea5e9' },
  actionPrimaryText: { color: '#fff', fontWeight: '800', textAlign: 'center', textAlignVertical: 'center', fontSize: 14, lineHeight: 18, includeFontPadding: false },
  actionSecondary: { backgroundColor: '#e5f3ff' },
  actionSecondaryText: { color: '#0369a1', fontWeight: '800', textAlign: 'center', textAlignVertical: 'center', fontSize: 14, lineHeight: 18, includeFontPadding: false },
  actionTertiary: { backgroundColor: '#f1f5f9' },
  actionTertiaryText: { color: '#0f172a', fontWeight: '800', textAlign: 'center', textAlignVertical: 'center', fontSize: 14, lineHeight: 18, includeFontPadding: false },
  actionTextMultiline: { lineHeight: 16, textAlign: 'center', textAlignVertical: 'center' },

  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptySubtitle: { color: '#6b7280' },

  // Review modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 14,
    backgroundColor: '#fff',
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  modalSubtitle: { color: '#6b7280', marginBottom: 12 },
  modalField: { marginBottom: 10 },
  modalLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6, color: '#374151' },
  input: {
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    backgroundColor: '#fafafa',
    color: '#111827',
  },
  textarea: { height: 96, textAlignVertical: 'top', paddingTop: 10 },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  cancelBtn: { backgroundColor: '#f1f5f9' },
  cancelBtnText: { color: '#0f172a', fontWeight: '800' },
});
