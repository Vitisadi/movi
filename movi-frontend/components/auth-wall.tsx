import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';

import { useThemeColor } from '@/hooks/use-theme-color';

type Props = {
  title?: string;
  subtitle?: string;
};

export function AuthWall({
  title = 'Sign in to continue',
  subtitle = 'Log in or create an account to access this page.',
}: Props) {
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: textColor }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: iconColor }]}>{subtitle}</Text>
      <TouchableOpacity
        style={[styles.primaryButton, { backgroundColor: tintColor }]}
        onPress={() => router.push('/(auth)/login')}
      >
        <Text style={styles.primaryButtonText}>Log In</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.secondaryButton, { borderColor: tintColor }]}
        onPress={() => router.push('/(auth)/register')}
      >
        <Text style={[styles.secondaryButtonText, { color: tintColor }]}>
          Create account
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontWeight: '700',
    fontSize: 15,
  },
});
