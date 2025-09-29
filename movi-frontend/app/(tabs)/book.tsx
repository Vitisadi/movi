import { StyleSheet, Text, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useLocalSearchParams } from 'expo-router';

export default function BookScreen() {
   const { id } = useLocalSearchParams();

   return (
      <ThemedView style={styles.container}>
         <ThemedView style={styles.titleContainer}>
            <ThemedText type='title'>Book Details</ThemedText>
         </ThemedView>
         <ThemedView style={styles.content}>
            <ThemedText>Books</ThemedText>
            {id && <ThemedText>Book ID: {id}</ThemedText>}
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
      gap: 10,
   },
});
