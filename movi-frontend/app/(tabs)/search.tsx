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
import { useAuth } from '@/contexts/AuthContext';

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

  const { user, isAuthenticated } = useAuth();
  const USER_ID = user?.id;

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

  const sendMovieToBackend = async (
    action: 'watched' | 'later',
    item: SearchItem
  ) => {
    try {
      if (!USER_ID) {
        notify('Login required', 'Please sign in to manage your library.');
        return;
      }
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
          ? `/addwatchedmovie/user/${USER_ID}/movie/${encodeURIComponent(movieId)}`
          : `/addwatchlatermovie/user/${USER_ID}/movie/${encodeURIComponent(movieId)}`;
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

  const sendBookToBackend = async (
    action: 'watched' | 'later',
    item: SearchItem
  ) => {
    try {
      if (!USER_ID) {
        notify('Login required', 'Please sign in to manage your library.');
        return;
      }
      if (item.kind !== 'book') {
        notify('Not supported', 'Only books can be added.');
        return;
      }
      const bookId = String(item.id || '').trim();
      if (!bookId) {
        notify('Missing book', 'Could not determine book id.');
        return;
      }

      const path =
        action === 'watched'
          ? `/read/user/${USER_ID}/book/${encodeURIComponent(bookId)}`
          : `/toberead/user/${USER_ID}/book/${encodeURIComponent(bookId)}`;
      const res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST' });
      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      const body = isJson ? await res.json() : undefined;
      if (!res.ok) {
        const msg = body?.error || `HTTP ${res.status}`;
        notify('Action failed', String(msg));
        return;
      }
      notify(
        action === 'watched' ? 'Added to Read' : 'Added to To Read',
        `${item.title} (${item.kind})`
      );
      emitLibraryChanged();
    } catch (err: any) {
      notify('Network error', String(err?.message || err));
    }
  };

  const handleAddWatched = (item: SearchItem) =>
    item.kind === 'movie' ? sendMovieToBackend('watched', item) : sendBookToBackend('watched', item);
  const handleAddLater = (item: SearchItem) =>
    item.kind === 'movie' ? sendMovieToBackend('later', item) : sendBookToBackend('later', item);

  const onSubmitSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSubmitting(true);
    Keyboard.dismiss();
    setActiveQuery(q);
    setHasSearched(true);
    try {
      const movieUrl = `${API_BASE_URL}/getmovies/${encodeURIComponent(q)}`;
      const bookUrl = `${API_BASE_URL}/book/${encodeURIComponent(q)}`;

      const [movieRes, bookRes] = await Promise.allSettled([
        fetch(movieUrl),
        fetch(bookUrl),
      ]);

      let mappedMovies: SearchItem[] = [];
      if (movieRes.status === 'fulfilled') {
        const res = movieRes.value;
        if (!res.ok) throw new Error(`Movies HTTP ${res.status}`);
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        mappedMovies = items.map((it: any) => ({
          id: String(it.id ?? ''),
          kind: 'movie',
          title: String(it.title ?? ''),
          year: it.year ? Number(it.year) : undefined,
          posterUrl: it.posterUrl ?? undefined,
        }));
      }

      let mappedBooks: SearchItem[] = [];
      if (bookRes.status === 'fulfilled') {
        const res = bookRes.value;
        if (!res.ok) throw new Error(`Books HTTP ${res.status}`);
        const data = await res.json();
        const arr = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
            ? data
            : [];
        mappedBooks = arr
          .map((entry: any) => {
            const raw =
              Array.isArray(entry) ? entry[0] : typeof entry === 'object' ? entry : null;
            if (!raw) return null;
            const worksKey = String(raw.id || raw.key || '').trim(); // e.g. '/works/OL2665176W'
            if (!worksKey) return null;
            const id = worksKey.split('/').pop() || worksKey;
            const authorArr = Array.isArray(raw.authors)
              ? raw.authors
              : Array.isArray(raw.author_name)
                ? raw.author_name
                : [];
            const author = authorArr
              .map((a: any) =>
                typeof a === 'string' ? a : String(a?.name || '').trim()
              )
              .filter(Boolean)
              .join(', ');
            const year = raw.first_publish_year ?? raw.year;
            const cover =
              raw.coverUrl ??
              raw.cover_url ??
              (Array.isArray(entry) ? entry[1] : undefined);
            return {
              id,
              kind: 'book' as const,
              title: String(raw.title || ''),
              author: author || undefined,
              year: Number.isFinite(Number(year)) ? Number(year) : undefined,
              coverUrl: cover || undefined,
            } as SearchItem;
          })
          .filter(Boolean) as SearchItem[];
      }

      setApiResults([...mappedMovies, ...mappedBooks]);
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
    const rawRating = (reviewRating || '').trim();
    const [intPart, decPart = ''] = rawRating.split('.');
    if (!intPart || decPart.length > 1) {
      notify('Invalid rating', 'Please enter a rating from 1 to 10 (one decimal max).');
      return;
    }
    const ratingNum = Number(rawRating);
    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 10) {
      notify('Invalid rating', 'Please enter a rating from 1 to 10.');
      return;
    }
    if (!reviewItem) return;
    if (!USER_ID) {
      notify('Login required', 'Please sign in to leave a review.');
      return;
    }
    try {
      const isMovie = reviewItem.kind === 'movie';
      const url = isMovie
        ? `${API_BASE_URL}/createmoviereview`
        : `${API_BASE_URL}/createbookreview`;

      // Prepare payload based on kind
      const payload = isMovie
        ? {
            userId: USER_ID,
            movieId: Number(reviewItem.id),
            rating: ratingNum,
            title: reviewTitle || undefined,
            body: reviewText || '',
          }
        : {
            userId: USER_ID,
            bookId: String(reviewItem.id),
            rating: ratingNum,
            title: reviewTitle || undefined,
            body: reviewText || '',
          };

      // Validate id per kind before sending
      if (isMovie) {
        if (!Number.isFinite((payload as any).movieId)) {
          notify('Missing movie', 'Could not determine movie id.');
          return;
        }
      } else {
        if (!String((payload as any).bookId || '').trim()) {
          notify('Missing book', 'Could not determine book id.');
          return;
        }
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      const body = isJson ? await res.json() : undefined;
      if (!res.ok) {
        const detail = body?.detail || body?.error || `HTTP ${res.status}`;
        notify('Review failed', String(detail));
        return;
      }
      notify('Review submitted', `${reviewItem.title} (Rating: ${ratingNum})`);
      emitLibraryChanged();
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
              <Text style={styles.modalLabel}>Rating (1-10, max 1 decimal)</Text>
              <TextInput
                value={reviewRating}
                onChangeText={(text) => {
                  const cleaned = text
                    .replace(/[^\d.]/g, '')
                    .replace(/(\..*)\./g, '$1');
                  setReviewRating(cleaned);
                }}
                keyboardType="decimal-pad"
                placeholder="e.g. 8"
                placeholderTextColor="#cbd5e1"
                style={styles.input}
              />
            </View>
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Review Title</Text>
              <TextInput
                value={reviewTitle}
                onChangeText={(text) => setReviewTitle(text.slice(0, 80))}
                placeholder="Short title (optional)"
                placeholderTextColor="#cbd5e1"
                style={styles.input}
              />
            </View>
            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Review</Text>
              <TextInput
                value={reviewText}
                onChangeText={(text) => setReviewText(text.slice(0, 800))}
                placeholder="Write your thoughts..."
                placeholderTextColor="#cbd5e1"
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
          {isMovie ? (
            <>
              <Pressable style={[styles.actionBtn, styles.actionPrimary]} onPress={() => onAddWatched(item)}>
                <Text style={styles.actionPrimaryText} numberOfLines={1}>Watched</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.actionSecondary, styles.actionBtnMultiline]} onPress={() => onAddLater(item)}>
                <Text style={[styles.actionSecondaryText, styles.actionTextMultiline]} numberOfLines={2}>{'Watch\nLater'}</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.actionTertiary, styles.actionBtnMultiline]} onPress={() => onLeaveReview(item)}>
                <Text style={[styles.actionTertiaryText, styles.actionTextMultiline]} numberOfLines={2}>{'Leave\nReview'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable style={[styles.actionBtn, styles.actionPrimary]} onPress={() => onAddWatched(item)}>
                <Text style={styles.actionPrimaryText} numberOfLines={1}>Read</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.actionSecondary, styles.actionBtnMultiline]} onPress={() => onAddLater(item)}>
                <Text style={[styles.actionSecondaryText, styles.actionTextMultiline]} numberOfLines={2}>{'To\nRead'}</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.actionTertiary, styles.actionBtnMultiline]} onPress={() => onLeaveReview(item)}>
                <Text style={[styles.actionTertiaryText, styles.actionTextMultiline]} numberOfLines={2}>{'Leave\nReview'}</Text>
              </Pressable>
            </>
          )}
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
