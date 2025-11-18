import React, { useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator,
} from "react-native";
import { Stack, router } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";
import { useThemeColor } from "@/hooks/use-theme-color";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";

const API_BASE_URL =
    (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) || "http://localhost:3000";

export default function EditProfileScreen() {
    const { user, updateUser } = useAuth();
    const [bio, setBio] = useState(user?.bio ?? "");
    const [isSaving, setIsSaving] = useState(false);

    const backgroundColor = useThemeColor({}, "background");
    const tintColor = useThemeColor({}, "tint");
    const textColor = useThemeColor({}, "text");
    const iconColor = useThemeColor({}, "icon");

    const handleSave = async () => {
        if (!user) {
            router.replace("/(auth)/login");
            return;
        }
        setIsSaving(true);
        try {
            const resp = await fetch(`${API_BASE_URL}/users/${user.id}/bio`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bio }),
            });

            if (!resp.ok) {
                throw new Error("Failed to update profile");
            }

            await updateUser({ bio });
            router.back();
        } catch (error) {
            console.error("Failed to update profile", error);
            Alert.alert("Error", "Could not update your profile. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) {
        return (
            <ThemedView style={[styles.centered, { backgroundColor }]}>
                <Stack.Screen options={{ title: "Edit Profile" }} />
                <ThemedText>You need to be logged in to edit your profile.</ThemedText>
                <TouchableOpacity style={[styles.secondaryButton, { borderColor: tintColor }]} onPress={() => router.replace("/(auth)/login")}>
                    <Text style={[styles.secondaryButtonText, { color: tintColor }]}>Go to Login</Text>
                </TouchableOpacity>
            </ThemedView>
        );
    }

    const isSaveDisabled = isSaving || bio.trim() === (user.bio ?? "").trim();

    return (
        <ThemedView style={[styles.container, { backgroundColor }]}>
            <Stack.Screen options={{ title: "Edit Profile" }} />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
            >
                <View style={styles.content}>
                    <ThemedText style={styles.label}>Bio</ThemedText>
                    <TextInput
                        value={bio}
                        onChangeText={setBio}
                        style={[
                            styles.input,
                            { color: textColor, borderColor: iconColor + "55", backgroundColor: iconColor + "0D" },
                        ]}
                        multiline
                        numberOfLines={6}
                        placeholder="Tell others a bit about yourself..."
                        placeholderTextColor={iconColor}
                        textAlignVertical="top"
                    />

                    <Text style={[styles.helperText, { color: iconColor }]}>
                        This bio appears in your profile and collections.
                    </Text>
                </View>

                <View style={styles.buttons}>
                    <TouchableOpacity
                        style={[styles.secondaryButton, { borderColor: iconColor + "55" }]}
                        onPress={() => router.back()}
                        disabled={isSaving}
                    >
                        <Text style={[styles.secondaryButtonText, { color: textColor }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.primaryButton,
                            { backgroundColor: tintColor, opacity: isSaveDisabled ? 0.5 : 1 },
                        ]}
                        onPress={handleSave}
                        disabled={isSaveDisabled}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.primaryButtonText}>Save</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
    },
    centered: {
        flex: 1,
        padding: 24,
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
    },
    content: {
        flex: 1,
    },
    label: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 12,
    },
    input: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        minHeight: 140,
    },
    helperText: {
        marginTop: 12,
        fontSize: 14,
    },
    buttons: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
        paddingTop: 16,
    },
    secondaryButton: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: "center",
    },
    secondaryButtonText: {
        fontSize: 16,
        fontWeight: "600",
    },
    primaryButton: {
        flex: 1,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: "center",
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: "700",
        color: "#fff",
    },
});
