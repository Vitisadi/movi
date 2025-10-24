import React, { useState } from 'react';
import {
   StyleSheet,
   View,
   Text,
   Image,
   Pressable,
   Alert,
   TouchableOpacity,
   ActivityIndicator,
} from 'react-native';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ProfileScreen() {
   const { user, logout } = useAuth();
   const [isLoggingOut, setIsLoggingOut] = useState(false);
   const [activeTab, setActiveTab] = useState<'Stats' | 'Collections'>('Stats');
   const colorScheme = useColorScheme();
   const tintColor = useThemeColor({}, 'tint');
   const backgroundColor = useThemeColor({}, 'background');
   const textColor = useThemeColor({}, 'text');
   const iconColor = useThemeColor({}, 'icon');

   // Stats placeholders - could be fetched from the backend
   const stats = {
      watched: 12,
      reading: 3,
      wishlist: 8,
      reviews: 5,
   };

   const handleLogout = async () => {
      try {
         setIsLoggingOut(true);
         await logout();
      } catch (e) {
         Alert.alert('Error', 'Failed to logout');
         setIsLoggingOut(false);
      }
   };

   const handleEditProfile = () => {
      Alert.alert('Coming Soon', 'Profile editing will be available soon!');
   };

   return (
      <ParallaxScrollView
         headerBackgroundColor={{ light: '#111', dark: '#000' }}
         headerImage={
            <View style={styles.headerImageContainer}>
               <Image
                  source={{ uri: user?.avatarUrl || COVER_IMG }}
                  style={styles.headerImage}
                  resizeMode='cover'
               />
               <View style={styles.headerOverlay} />
               <View style={styles.headerTopBar}>
                  <ThemedText type='title'>My Profile</ThemedText>
                  <TouchableOpacity
                     style={[
                        styles.editButton,
                        { backgroundColor: tintColor + '25' },
                     ]}
                     onPress={handleEditProfile}
                  >
                     <Text
                        style={[styles.editButtonText, { color: tintColor }]}
                     >
                        Edit Profile
                     </Text>
                  </TouchableOpacity>
               </View>
            </View>
         }
      >
         {/* Profile Card */}
         <ThemedView style={styles.profileCard}>
            <View style={styles.profileRow}>
               <View style={styles.avatarContainer}>
                  {user?.avatarUrl && (
                     <Image
                        source={{ uri: user?.avatarUrl }}
                        style={styles.avatar}
                     />
                  )}
                  <View
                     style={[styles.avatarRing, { borderColor: tintColor }]}
                  />
                  <View style={styles.badgeContainer}>
                     <View
                        style={[styles.badge, { backgroundColor: tintColor }]}
                     >
                        <Text style={styles.badgeText}>Pro</Text>
                     </View>
                  </View>
               </View>
               <View style={styles.nameBlock}>
                  <ThemedText style={styles.name}>
                     {user?.name || user?.username || 'User'}
                  </ThemedText>
                  {user?.username && (
                     <Text style={[styles.username, { color: tintColor }]}>
                        @{user.username}
                     </Text>
                  )}
                  {user?.email && (
                     <View style={styles.chipsRow}>
                        <View
                           style={[
                              styles.chip,
                              { backgroundColor: tintColor + '22' },
                           ]}
                        >
                           <Text
                              style={[styles.chipText, { color: tintColor }]}
                              numberOfLines={1}
                           >
                              {user.email}
                           </Text>
                        </View>
                     </View>
                  )}
               </View>
            </View>

            {user?.bio ? (
               <View style={styles.bioContainer}>
                  <ThemedText style={styles.bioLabel}>About</ThemedText>
                  <ThemedText style={styles.bio}>{user.bio}</ThemedText>
               </View>
            ) : (
               <View style={styles.bioContainer}>
                  <Text style={[styles.bioPlaceholder, { color: iconColor }]}>
                     No bio yet. Tap 'Edit Profile' to add one!
                  </Text>
               </View>
            )}
         </ThemedView>

         {/* Tabs */}
         <View style={styles.tabs}>
            {(['Stats', 'Collections'] as const).map((tab) => (
               <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[
                     styles.tab,
                     activeTab === tab && { backgroundColor: tintColor },
                  ]}
               >
                  <Text
                     style={[
                        styles.tabText,
                        { color: activeTab === tab ? '#fff' : textColor },
                     ]}
                  >
                     {tab}
                  </Text>
               </Pressable>
            ))}
         </View>

         {activeTab === 'Stats' ? (
            <ThemedView style={styles.statsContent}>
               {/* Stats Blocks */}
               <View style={styles.statsGrid}>
                  <ThemedView style={styles.statItem}>
                     <View
                        style={[
                           styles.statIcon,
                           { backgroundColor: tintColor + '22' },
                        ]}
                     >
                        <IconSymbol
                           name='book.fill'
                           color={tintColor}
                           size={20}
                        />
                     </View>
                     <Text style={[styles.statNumber, { color: tintColor }]}>
                        {stats.watched}
                     </Text>
                     <Text style={[styles.statLabel, { color: iconColor }]}>
                        Watched
                     </Text>
                  </ThemedView>
                  <ThemedView style={styles.statItem}>
                     <View
                        style={[
                           styles.statIcon,
                           { backgroundColor: tintColor + '22' },
                        ]}
                     >
                        <IconSymbol
                           name='books.vertical.fill'
                           color={tintColor}
                           size={20}
                        />
                     </View>
                     <Text style={[styles.statNumber, { color: tintColor }]}>
                        {stats.reading}
                     </Text>
                     <Text style={[styles.statLabel, { color: iconColor }]}>
                        Reading
                     </Text>
                  </ThemedView>
                  <ThemedView style={styles.statItem}>
                     <View
                        style={[
                           styles.statIcon,
                           { backgroundColor: tintColor + '22' },
                        ]}
                     >
                        <IconSymbol
                           name='bookmark.fill'
                           color={tintColor}
                           size={20}
                        />
                     </View>
                     <Text style={[styles.statNumber, { color: tintColor }]}>
                        {stats.wishlist}
                     </Text>
                     <Text style={[styles.statLabel, { color: iconColor }]}>
                        Wishlist
                     </Text>
                  </ThemedView>
                  <ThemedView style={styles.statItem}>
                     <View
                        style={[
                           styles.statIcon,
                           { backgroundColor: tintColor + '22' },
                        ]}
                     >
                        <IconSymbol
                           name='person.fill'
                           color={tintColor}
                           size={20}
                        />
                     </View>
                     <Text style={[styles.statNumber, { color: tintColor }]}>
                        {stats.reviews}
                     </Text>
                     <Text style={[styles.statLabel, { color: iconColor }]}>
                        Reviews
                     </Text>
                  </ThemedView>
               </View>

               <ThemedText style={styles.sectionTitle}>
                  Recent Activity
               </ThemedText>
               <ThemedView style={styles.emptyStateContainer}>
                  <Text style={[styles.emptyStateText, { color: iconColor }]}>
                     No recent activity to display
                  </Text>
               </ThemedView>
            </ThemedView>
         ) : (
            <ThemedView style={styles.collectionsContent}>
               <ThemedText style={styles.sectionTitle}>
                  My Collections
               </ThemedText>
               <ThemedView style={styles.collectionsList}>
                  <ThemedView style={styles.collectionCard}>
                     <ThemedText style={styles.collectionTitle}>
                        Favorites
                     </ThemedText>
                     <Text
                        style={[styles.collectionCount, { color: iconColor }]}
                     >
                        24 items
                     </Text>
                  </ThemedView>

                  <ThemedView style={styles.collectionCard}>
                     <ThemedText style={styles.collectionTitle}>
                        Want to Watch
                     </ThemedText>
                     <Text
                        style={[styles.collectionCount, { color: iconColor }]}
                     >
                        18 items
                     </Text>
                  </ThemedView>

                  <ThemedView style={styles.collectionCard}>
                     <ThemedText style={styles.collectionTitle}>
                        Science Fiction
                     </ThemedText>
                     <Text
                        style={[styles.collectionCount, { color: iconColor }]}
                     >
                        7 items
                     </Text>
                  </ThemedView>

                  <TouchableOpacity style={styles.createCollectionButton}>
                     <Text
                        style={[
                           styles.createCollectionText,
                           { color: tintColor },
                        ]}
                     >
                        + Create New Collection
                     </Text>
                  </TouchableOpacity>
               </ThemedView>
            </ThemedView>
         )}

         {/* Account Section */}
         <ThemedView style={styles.accountSection}>
            <ThemedText style={styles.sectionTitle}>Account</ThemedText>

            <ThemedView style={styles.accountActions}>
               <TouchableOpacity style={styles.actionButton}>
                  <ThemedText style={styles.actionButtonText}>
                     Privacy Settings
                  </ThemedText>
                  <Text style={[styles.actionButtonIcon, { color: iconColor }]}>
                     ›
                  </Text>
               </TouchableOpacity>

               <TouchableOpacity style={styles.actionButton}>
                  <ThemedText style={styles.actionButtonText}>
                     Notification Preferences
                  </ThemedText>
                  <Text style={[styles.actionButtonIcon, { color: iconColor }]}>
                     ›
                  </Text>
               </TouchableOpacity>

               <TouchableOpacity style={styles.actionButton}>
                  <ThemedText style={styles.actionButtonText}>
                     Help & Support
                  </ThemedText>
                  <Text style={[styles.actionButtonIcon, { color: iconColor }]}>
                     ›
                  </Text>
               </TouchableOpacity>
            </ThemedView>
         </ThemedView>

         {/* Logout */}
         <ThemedView style={styles.footer}>
            <Pressable
               style={[
                  styles.logoutButton,
                  isLoggingOut && styles.logoutButtonDisabled,
               ]}
               onPress={handleLogout}
               disabled={isLoggingOut}
            >
               {isLoggingOut ? (
                  <ActivityIndicator color='#fff' size='small' />
               ) : (
                  <Text style={styles.logoutText}>Logout</Text>
               )}
            </Pressable>
         </ThemedView>
      </ParallaxScrollView>
   );
}

const COVER_IMG =
   'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=2070&auto=format&fit=crop';

const styles = StyleSheet.create({
   // Header
   headerImageContainer: {
      flex: 1,
      position: 'relative',
      justifyContent: 'flex-end',
   },
   headerImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
   },
   headerOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.35)',
   },
   headerTopBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingBottom: 16,
   },
   editButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
   },
   editButtonText: {
      fontWeight: '600',
      fontSize: 14,
   },

   // Profile Card
   profileCard: {
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      alignItems: 'stretch',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
   },
   profileRow: {
      flexDirection: 'row',
      gap: 16,
      alignItems: 'center',
   },
   avatarContainer: {
      position: 'relative',
      marginBottom: 12,
   },
   avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: '#e5e7eb',
   },
   avatarRing: {
      position: 'absolute',
      top: -4,
      left: -4,
      right: -4,
      bottom: -4,
      borderRadius: 54,
      borderWidth: 2,
   },
   badgeContainer: {
      position: 'absolute',
      bottom: 0,
      right: 0,
   },
   badge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: '#fff',
   },
   badgeText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 12,
   },
   nameBlock: {
      flex: 1,
      alignItems: 'flex-start',
   },
   name: {
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 2,
   },
   username: {
      fontWeight: '600',
      fontSize: 14,
   },
   chipsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
   },
   chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
   },
   chipText: {
      fontSize: 12,
      fontWeight: '600',
      maxWidth: 220,
   },
   infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 4,
   },
   infoIcon: {
      fontSize: 16,
      marginRight: 8,
   },
   infoText: {
      fontSize: 14,
   },
   bioContainer: {
      marginTop: 12,
      width: '100%',
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: '#e5e7eb',
   },
   bioLabel: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 4,
   },
   bio: {
      fontSize: 14,
      lineHeight: 20,
   },
   bioPlaceholder: {
      fontSize: 14,
      fontStyle: 'italic',
      textAlign: 'left',
   },

   // Tabs
   tabs: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
   },
   tab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: '#f1f1f3',
   },
   tabText: {
      fontSize: 14,
      fontWeight: '600',
   },

   // Stats Section
   statsContent: {
      marginBottom: 24,
   },
   sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 12,
      marginTop: 8,
   },
   statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 24,
   },
   statItem: {
      width: '48%',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
   },
   statIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
   },
   statNumber: {
      fontSize: 22,
      fontWeight: '700',
      marginBottom: 4,
   },
   statLabel: {
      fontSize: 14,
   },

   // Empty State
   emptyStateContainer: {
      padding: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 120,
   },
   emptyStateText: {
      fontSize: 15,
      textAlign: 'center',
   },

   // Collections
   collectionsContent: {
      marginBottom: 24,
   },
   collectionsList: {
      gap: 12,
   },
   collectionCard: {
      padding: 16,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
   },
   collectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
   },
   collectionCount: {
      fontSize: 13,
   },
   createCollectionButton: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: '#d1d5db',
      alignItems: 'center',
      justifyContent: 'center',
   },
   createCollectionText: {
      fontSize: 15,
      fontWeight: '600',
   },

   // Account Section
   accountSection: {
      marginBottom: 24,
   },
   accountActions: {
      borderRadius: 12,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
   },
   actionButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: '#e5e7eb',
   },
   actionButtonText: {
      fontSize: 15,
   },
   actionButtonIcon: {
      fontSize: 18,
   },

   // Footer
   footer: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: '#e5e7eb',
   },
   logoutButton: {
      backgroundColor: '#ef4444',
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
   },
   logoutButtonDisabled: {
      opacity: 0.6,
   },
   logoutText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 16,
   },
});
