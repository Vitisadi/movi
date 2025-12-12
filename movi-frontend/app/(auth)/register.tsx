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
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/contexts/AuthContext';

export default function RegisterScreen() {
   const [name, setName] = useState('');
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');
   const [showPassword, setShowPassword] = useState(false);
   const [showConfirm, setShowConfirm] = useState(false);
   const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
   const router = useRouter();
   const { register: registerUser, isLoading } = useAuth();

   const backgroundColor = useThemeColor({}, 'background');
   const textColor = useThemeColor({}, 'text');
   const tintColor = useThemeColor({}, 'tint');
   const placeholderColor = useThemeColor(
      { light: '#999', dark: '#666' },
      'text'
   );

   useEffect(() => {
      if (!toast) return;
      const t = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(t);
   }, [toast]);

   const validateEmail = (email: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
   };

   const validateForm = () => {
      const cleanName = name.trim();
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();
      const cleanConfirm = confirmPassword.trim();

      if (!cleanName) {
         setToast({ type: 'error', message: 'Please enter your full name.' });
         return false;
      }

      if (cleanName.length < 2) {
         setToast({ type: 'error', message: 'Name must be at least 2 characters long.' });
         return false;
      }

      if (!cleanEmail) {
         setToast({ type: 'error', message: 'Please enter your email address.' });
         return false;
      }

      if (!validateEmail(cleanEmail)) {
         setToast({ type: 'error', message: 'Please enter a valid email address.' });
         return false;
      }

      if (!cleanPassword) {
         setToast({ type: 'error', message: 'Please enter a password.' });
         return false;
      }

      if (cleanPassword.length < 6) {
         setToast({ type: 'error', message: 'Password must be at least 6 characters long.' });
         return false;
      }

      if (cleanPassword !== cleanConfirm) {
         setToast({ type: 'error', message: 'Passwords do not match.' });
         return false;
      }

      return true;
   };

   const handleRegister = async () => {
      if (!validateForm()) {
         return;
      }

      try {
         await registerUser(name.trim(), email.trim().toLowerCase(), password.trim());
         router.replace('/(auth)/login?created=1');
         setToast({ type: 'success', message: 'Account created. Sign in to continue.' });
      } catch (error) {
         setToast({
            type: 'error',
            message:
               error instanceof Error
                  ? error.message
                  : 'Registration failed. Please try again.',
         });
      }
   };

   const navigateToLogin = () => {
      router.push('/(auth)/login');
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
               {/* Header */}
               <View style={styles.header}>
                  <ThemedText type='title' style={styles.title}>
                     Create Account
                  </ThemedText>
                  <ThemedText
                     style={[styles.subtitle, { color: placeholderColor }]}
                  >
                     Sign up to get started
                  </ThemedText>
               </View>

               {/* Form */}
               <View style={styles.form}>
                  <View style={styles.inputContainer}>
                     <ThemedText style={styles.label}>Full Name</ThemedText>
                     <TextInput
                        style={[
                           styles.input,
                           {
                              borderColor: tintColor,
                              color: textColor,
                           },
                        ]}
                        placeholder='Enter your full name'
                        placeholderTextColor={placeholderColor}
                        value={name}
                        onChangeText={setName}
                        autoCapitalize='words'
                        autoComplete='name'
                        editable={!isLoading}
                     />
                  </View>

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
                  <View style={styles.passwordRow}>
                     <TextInput
                        style={[
                           styles.input,
                           {
                              borderColor: tintColor,
                              color: textColor,
                              flex: 1,
                           },
                        ]}
                        placeholder='Enter your password'
                        placeholderTextColor={placeholderColor}
                        value={password}
                        onChangeText={(v) => setPassword(v)}
                        secureTextEntry={!showPassword}
                        autoComplete='new-password'
                        editable={!isLoading}
                        returnKeyType='next'
                     />
                     <TouchableOpacity
                        onPress={() => setShowPassword((prev) => !prev)}
                        style={styles.toggle}
                     >
                        <ThemedText style={{ color: tintColor }}>
                           {showPassword ? 'Hide' : 'Show'}
                        </ThemedText>
                     </TouchableOpacity>
                  </View>
                  <ThemedText
                     style={[styles.helperText, { color: placeholderColor }]}
                  >
                     Password must be at least 6 characters
                     </ThemedText>
                  </View>

                  <View style={styles.inputContainer}>
                 <ThemedText style={styles.label}>
                    Confirm Password
                 </ThemedText>
                  <View style={styles.passwordRow}>
                     <TextInput
                        style={[
                           styles.input,
                           {
                              borderColor: tintColor,
                              color: textColor,
                              flex: 1,
                           },
                        ]}
                        placeholder='Confirm your password'
                        placeholderTextColor={placeholderColor}
                        value={confirmPassword}
                        onChangeText={(v) => setConfirmPassword(v)}
                        secureTextEntry={!showConfirm}
                        autoComplete='new-password'
                        editable={!isLoading}
                        returnKeyType='done'
                        onSubmitEditing={handleRegister}
                     />
                     <TouchableOpacity
                        onPress={() => setShowConfirm((prev) => !prev)}
                        style={styles.toggle}
                     >
                        <ThemedText style={{ color: tintColor }}>
                           {showConfirm ? 'Hide' : 'Show'}
                        </ThemedText>
                     </TouchableOpacity>
                  </View>
               </View>

                  {/* Register Button */}
                  <TouchableOpacity
                     style={[
                        styles.registerButton,
                        { backgroundColor: tintColor },
                        isLoading && styles.disabledButton,
                     ]}
                     onPress={handleRegister}
                     disabled={isLoading}
                  >
                     <ThemedText
                        style={styles.registerButtonText}
                        lightColor='#ffffff'
                        darkColor='#000000'
                     >
                        {isLoading ? 'Creating Account...' : 'Create Account'}
                     </ThemedText>
                  </TouchableOpacity>

                  {/* Terms */}
                  <ThemedText
                     style={[styles.termsText, { color: placeholderColor }]}
                  >
                     By creating an account, you agree to our Terms of Service
                     and Privacy Policy
                  </ThemedText>
               </View>

               {/* Login Link */}
               <View style={styles.footer}>
                  <ThemedText
                     style={[styles.footerText, { color: placeholderColor }]}
                  >
                     Already have an account?{' '}
                  </ThemedText>
                  <TouchableOpacity onPress={navigateToLogin}>
                     <ThemedText
                        style={[styles.loginLink, { color: tintColor }]}
                     >
                        Sign In
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
      marginBottom: 40,
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
   helperText: {
      fontSize: 12,
      marginTop: 4,
   },
   registerButton: {
      height: 48,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 16,
   },
   disabledButton: {
      opacity: 0.6,
   },
   registerButtonText: {
      color: 'black',
      fontSize: 16,
      fontWeight: '600',
   },
   termsText: {
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 16,
   },
   footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
   },
   footerText: {
      fontSize: 14,
   },
   loginLink: {
      fontSize: 14,
      fontWeight: '600',
   },
   passwordRow: { flexDirection: 'row', alignItems: 'center' },
   toggle: { paddingHorizontal: 8, paddingVertical: 8 },
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
