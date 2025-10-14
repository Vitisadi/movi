import React, { useState } from 'react';
import {
   StyleSheet,
   View,
   TextInput,
   TouchableOpacity,
   Alert,
   KeyboardAvoidingView,
   Platform,
   ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const router = useRouter();
   const { login, isLoading } = useAuth();

   const backgroundColor = useThemeColor({}, 'background');
   const textColor = useThemeColor({}, 'text');
   const tintColor = useThemeColor({}, 'tint');
   const placeholderColor = useThemeColor(
      { light: '#999', dark: '#666' },
      'text'
   );

   const handleLogin = async () => {
      if (!email.trim() || !password.trim()) {
         Alert.alert('Error', 'Please fill in all fields');
         return;
      }

      if (password.length < 6) {
         Alert.alert('Error', 'Password must be at least 6 characters long');
         return;
      }

      try {
         await login(email, password);

         Alert.alert('Success', 'Login successful!', [
            {
               text: 'OK',
               onPress: () => {
                  router.replace('/(tabs)/home');
               },
            },
         ]);
      } catch (error) {
         Alert.alert(
            'Error',
            error instanceof Error
               ? error.message
               : 'Login failed. Please check your credentials and try again.'
         );
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
                        onChangeText={setEmail}
                        autoCapitalize='none'
                        keyboardType='email-address'
                        autoComplete='email'
                        editable={!isLoading}
                     />
                  </View>

                  <View style={styles.inputContainer}>
                     <ThemedText style={styles.label}>Password</ThemedText>
                     <TextInput
                        style={[
                           styles.input,
                           {
                              borderColor: tintColor,
                              color: textColor,
                           },
                        ]}
                        placeholder='Enter your password'
                        placeholderTextColor={placeholderColor}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoComplete='password'
                        editable={!isLoading}
                     />
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
});
