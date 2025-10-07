import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Image,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";

// @ts-ignore
import libraryData from "../../assets/json/library.json";

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

type LibraryData = {
  watched: { movies: Movie[]; books: Book[] };
  later: { movies: Movie[]; books: Book[] };
};

const TABS = ["Watched", "Watch Later"] as const;
type TabKey = typeof TABS[number];

export default function LibraryScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>("Watched");
  const [refreshing, setRefreshing] = useState(false);

  const data: LibraryData = libraryData as LibraryData;
  const picked = activeTab === "Watched" ? data.watched : data.later;

  const totalCount =
    (picked.movies?.length || 0) + (picked.books?.length || 0);
  const isEmpty = totalCount === 0;

  const sections = useMemo(
    () => [
      {
        title: `Movies (${picked.movies.length})`,
        data: picked.movies,
        kind: "movie" as const,
      },
      {
        title: `Books (${picked.books.length})`,
        data: picked.books,
        kind: "book" as const,
      },
    ],
    //only needs to recompute when the tab changes (picked changes)
    [activeTab]
  );

  const onRefresh = () => {
    setRefreshing(true);
    //MAKE BACKEND API CALL HERE TO LOAD IN DATA
    setTimeout(() => setRefreshing(false), 400);
  };

  return (
    <View style={styles.container}>
      {/* Title */}
      <Text style={styles.title}>Library</Text>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setActiveTab(t)}
            style={[styles.tab, activeTab === t && styles.tabActive]}
          >
            <Text
              style={[styles.tabText, activeTab === t && styles.tabTextActive]}
            >
              {t}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List or Empty State */}
      {isEmpty ? (
        <EmptyState activeTab={activeTab} />
      ) : (
        <SectionList
          sections={sections as any}
          keyExtractor={(item: Movie | Book) => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item, section }) => (
            <ItemCard item={item} kind={section.kind} />
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
}: {
  item: Movie | Book;
  kind: "movie" | "book";
}) {
  const isMovie = kind === "movie";
  const cover = isMovie ? (item as Movie).posterUrl : (item as Book).coverUrl;
  const title = item.title;
  const subtitle = isMovie
    ? buildSubtitleMovie(item as Movie)
    : buildSubtitleBook(item as Book);
  const rating = (item as any).rating;

  const handleRemove = () => {
    console.log("Remove pressed for:", title);
    Alert.alert("Remove", `Pretend removing: ${title}`);
  };

  return (
    <View style={styles.card}>
      <Image
        source={{ uri: cover || PLACEHOLDER_IMG }}
        style={styles.cover}
        resizeMode="cover"
      />
      <View style={styles.cardRight}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {title}
          </Text>
          <Pressable onPress={handleRemove} style={styles.removeButton}>
            <Text style={styles.removeText}>✕</Text>
          </Pressable>
        </View>

        <Text style={styles.cardSubtitle} numberOfLines={2}>
          {subtitle}
        </Text>

        {typeof rating === "number" && (
          <Text style={styles.cardMeta}>Rating: {rating}/10</Text>
        )}

        <View style={styles.pillsRow}>
          <Pill label={isMovie ? "Movie" : "Book"} />
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
  return bits.join(" • ");
}

function buildSubtitleBook(b: Book) {
  const bits = [
    b.author,
    b.year && `${b.year}`,
    b.pages && `${b.pages} pages`,
  ].filter(Boolean);
  return bits.join(" • ");
}

function EmptyState({ activeTab }: { activeTab: TabKey }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Nothing here yet</Text>
      <Text style={styles.emptySubtitle}>
        Add some {activeTab === "Watched" ? "finished" : "to-watch"} items to
        your library.
      </Text>
    </View>
  );
}

/* ---------- Constants & Styles ---------- */
const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?w=400&auto=format&fit=crop&q=60";

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16, paddingHorizontal: 16, backgroundColor: "#fff" },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 16 },
  tabs: { flexDirection: "row", gap: 10, marginBottom: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f1f1f3",
  },
  tabActive: { backgroundColor: "#0ea5e9" },
  tabText: { fontSize: 14, fontWeight: "700", color: "#111" },
  tabTextActive: { color: "#fff" },

  sectionHeader: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 16,
    fontWeight: "800",
    color: "#374151",
  },
  listContent: { paddingBottom: 24 },

  card: {
    flexDirection: "row",
    gap: 12,
    padding: 10,
    backgroundColor: "#fafafa",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    marginBottom: 10,
  },
  cover: { width: 64, height: 96, borderRadius: 8, backgroundColor: "#e5e7eb" },
  cardRight: { flex: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 2, flex: 1 },
  cardSubtitle: { fontSize: 13, color: "#6b7280" },
  cardMeta: { fontSize: 12, color: "#6b7280", marginTop: 4 },

  pillsRow: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  pill: { backgroundColor: "#e5f3ff", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  pillText: { fontSize: 12, color: "#0369a1", fontWeight: "700" },

  empty: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  emptySubtitle: { color: "#6b7280" },

  removeButton: { paddingHorizontal: 6, paddingVertical: 2 },
  removeText: { fontSize: 16, color: "#ef4444", fontWeight: "800" },
});
