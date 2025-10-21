import { StyleSheet, Text, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileScreen() {
   const { user } = useAuth();
   return (
      <ThemedView style={styles.container}>
         <ThemedView style={styles.titleContainer}>
            <ThemedText type='title'>Profile</ThemedText>
         </ThemedView>
         <ThemedView style={styles.content}>
            <ThemedText>profile</ThemedText>
         </ThemedView>
      </ThemedView>
   );
}

const styles = StyleSheet.create({
   container: {
      flex: 1,
      padding: 16,
   },
   titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 20,
   },
   content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
   },
});
