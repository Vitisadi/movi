import React, { useEffect, useState } from 'react';
import {
   StyleSheet,
   View,
   TextInput,
   TouchableOpacity,
   KeyboardAvoidingView,
   Platform,
   ScrollView,
   Text,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [showPassword, setShowPassword] = useState(false);
   const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
   const router = useRouter();
   const params = useLocalSearchParams();
   const { login, isLoading } = useAuth();

   const backgroundColor = useThemeColor({}, 'background');
   const textColor = useThemeColor({}, 'text');
   const tintColor = useThemeColor({}, 'tint');
   const placeholderColor = useThemeColor(
      { light: '#999', dark: '#666' },
      'text'
   );

   useEffect(() => {
      if (params?.created === '1') {
         setToast({ type: 'success', message: 'Account created! Please sign in.' });
      }
   }, [params?.created]);

   useEffect(() => {
      if (!toast) return;
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
   }, [toast]);

   const handleLogin = async () => {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();
      if (!cleanEmail || !cleanPassword) {
         setToast({ type: 'error', message: 'Please fill in all fields.' });
         return;
      }

      if (cleanPassword.length < 6) {
         setToast({ type: 'error', message: 'Password must be at least 6 characters long.' });
         return;
      }

      try {
         await login(cleanEmail, cleanPassword);
         router.replace('/(tabs)/home');
      } catch (error) {
         setToast({
            type: 'error',
            message:
               error instanceof Error
                  ? error.message
                  : 'Login failed. Please check your credentials and try again.',
         });
      }
   };

   const navigateToRegister = () => {
      router.push('/(auth)/register');
   };
   return (
      <KeyboardAvoidingView
         style={[styles.container, { backgroundColor }]}
         behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
         <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps='handled'
         >
            <ThemedView style={styles.content}>
               <View style={styles.header}>
                  <ThemedText type='title' style={styles.title}>
                     Welcome Back
                  </ThemedText>
                  <ThemedText
                     style={[styles.subtitle, { color: placeholderColor }]}
                  >
                     Sign in to your account
                  </ThemedText>
               </View>

               <View style={styles.form}>
                  <View style={styles.inputContainer}>
                     <ThemedText style={styles.label}>Email</ThemedText>
                     <TextInput
                        style={[
                           styles.input,
                           {
                              borderColor: tintColor,
                              color: textColor,
                           },
                        ]}
                    placeholder='Enter your email'
                    placeholderTextColor={placeholderColor}
                    value={email}
                    onChangeText={(v) => setEmail(v.trimStart())}
                    autoCapitalize='none'
                    keyboardType='email-address'
                    autoComplete='email'
                    editable={!isLoading}
                    returnKeyType='next'
                 />
               </View>

               <View style={styles.inputContainer}>
                  <ThemedText style={styles.label}>Password</ThemedText>
                  <View style={styles.inputWrapper}>
                     <TextInput
                        style={[
                           styles.input,
                           {
                              borderColor: tintColor,
                              color: textColor,
                              paddingRight: 80,
                           },
                        ]}
                        placeholder='Enter your password'
                        placeholderTextColor={placeholderColor}
                        value={password}
                        onChangeText={(v) => setPassword(v)}
                        secureTextEntry={!showPassword}
                        autoComplete='password'
                        editable={!isLoading}
                        returnKeyType='done'
                        onSubmitEditing={handleLogin}
                     />
                     <TouchableOpacity
                        onPress={() => setShowPassword((prev) => !prev)}
                        style={styles.toggleInside}
                     >
                        <ThemedText style={{ color: tintColor }}>
                           {showPassword ? 'Hide' : 'Show'}
                        </ThemedText>
                     </TouchableOpacity>
                  </View>
               </View>

                  <TouchableOpacity
                     style={[
                        styles.loginButton,
                        { backgroundColor: tintColor },
                        isLoading && styles.disabledButton,
                     ]}
                     onPress={handleLogin}
                     disabled={isLoading}
                  >
                     <ThemedText
                        style={styles.loginButtonText}
                        lightColor='#ffffff'
                        darkColor='#000000'
                     >
                        {isLoading ? 'Signing In...' : 'Sign In'}
                     </ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.forgotPassword}>
                     <ThemedText
                        style={[
                           styles.forgotPasswordText,
                           { color: tintColor },
                        ]}
                     >
                        Forgot Password?
                     </ThemedText>
                  </TouchableOpacity>
               </View>

               <View style={styles.footer}>
                  <ThemedText
                     style={[styles.footerText, { color: placeholderColor }]}
                  >
                     Don't have an account?{' '}
                  </ThemedText>
                  <TouchableOpacity onPress={navigateToRegister}>
                     <ThemedText
                        style={[styles.registerLink, { color: tintColor }]}
                     >
                        Sign Up
                     </ThemedText>
                  </TouchableOpacity>
               </View>
            </ThemedView>
         </ScrollView>
         {toast ? (
            <View
               style={[
                  styles.toast,
                  toast.type === 'error' && { backgroundColor: '#ef4444' },
                  toast.type === 'success' && { backgroundColor: '#22c55e' },
               ]}
            >
               <Text style={styles.toastText}>{toast.message}</Text>
            </View>
         ) : null}
      </KeyboardAvoidingView>
   );
}

const styles = StyleSheet.create({
   container: {
      flex: 1,
   },
   scrollContainer: {
      flexGrow: 1,
      justifyContent: 'center',
   },
   content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingVertical: 32,
      maxWidth: 400,
      alignSelf: 'center',
      width: '100%',
   },
   header: {
      alignItems: 'center',
      marginBottom: 48,
   },
   title: {
      fontSize: 32,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 8,
   },
   subtitle: {
      fontSize: 16,
      textAlign: 'center',
   },
   form: {
      marginBottom: 32,
   },
   inputContainer: {
      marginBottom: 20,
   },
   label: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
   },
   input: {
      height: 48,
      borderWidth: 1.5,
      borderRadius: 8,
      paddingHorizontal: 16,
      fontSize: 16,
   },
   loginButton: {
      height: 48,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
   },
   disabledButton: {
      opacity: 0.6,
   },
   loginButtonText: {
      color: 'black',
      fontSize: 16,
      fontWeight: '600',
   },
   forgotPassword: {
      alignItems: 'center',
      marginTop: 16,
   },
   forgotPasswordText: {
      fontSize: 14,
      fontWeight: '500',
   },
   footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
   },
   footerText: {
      fontSize: 14,
   },
   registerLink: {
      fontSize: 14,
      fontWeight: '600',
   },
   inputWrapper: { position: 'relative' },
   toggleInside: {
      position: 'absolute',
      right: 12,
      top: 10,
      paddingHorizontal: 6,
      paddingVertical: 6,
      borderRadius: 8,
   },
   toast: {
      position: 'absolute',
      top: 20,
      left: 16,
      right: 16,
      padding: 12,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
      backgroundColor: '#0ea5e9',
   },
   toastText: { color: '#f8fafc', fontWeight: '700', textAlign: 'center' },
});
