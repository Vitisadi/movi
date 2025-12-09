import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { getApiBaseUrl } from "@/lib/api";

const API_BASE = getApiBaseUrl();

// Types
export interface User {
    id: string;
    name: string | null;
    email: string;
    username?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    updateUser: (partial: Partial<User>) => Promise<void>;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [token, setToken] = useState<string | null>(null);

    const isAuthenticated = !!user;

    // Check for existing session on app start
    useEffect(() => {
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            const t = await AsyncStorage.getItem("authToken");
            const u = await AsyncStorage.getItem("user");
            console.log(t);
            if (t) {
                setToken(t);
                // Optionally fetch user info from API using the token
                // Example: await fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${t}` } })
                // If your API has /me endpoint use that instead. Here we skip fetching user to keep it simple.
            }

            if (u) {
                try {
                    const parsed = JSON.parse(u);
                    // map server user shape to frontend User
                    const mapped: User = {
                        id: parsed._id || parsed.id,
                        name: parsed.name ?? null,
                        email: parsed.email,
                        username: parsed.username ?? null,
                        avatarUrl: parsed.avatarUrl ?? null,
                        bio: parsed.bio ?? null,
                    };
                    setUser(mapped);
                } catch (e) {
                    console.error("Failed to parse stored user", e);
                }
            }
            console.log(u);
        } catch (error) {
            console.error("Error checking auth status:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, password: string): Promise<void> => {
        try {
            setIsLoading(true);
            const payload = {
                email: email.trim().toLowerCase(),
                password: password.trim(),
            };
            const resp = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                const j = await resp.json().catch(() => ({}));
                const detail = j?.error || j?.message || "";
                if (resp.status === 401) {
                    throw new Error("Incorrect email or password.");
                }
                throw new Error(detail || "Login failed. Please try again.");
            }
            const data = await resp.json();
            const t = data.token;
            const u = data.user;
            if (t) {
                await AsyncStorage.setItem("authToken", t);
                setToken(t);
            }
            if (u) {
                // map server user to frontend shape
                const mapped: User = {
                    id: u._id || u.id,
                    name: u.name ?? null,
                    email: u.email,
                    username: u.username ?? null,
                    avatarUrl: u.avatarUrl ?? null,
                    bio: u.bio ?? null,
                };
                await AsyncStorage.setItem("user", JSON.stringify(u));
                setUser(mapped);

                router.replace("/(tabs)/profile");
            }
        } catch (error) {
            if (error instanceof Error) throw error;
            throw new Error("Login failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (name: string, email: string, password: string): Promise<void> => {
        try {
            setIsLoading(true);
            const payload = {
                email: email.trim().toLowerCase(),
                password: password.trim(),
                username: name.trim(),
            };

            const resp = await fetch(`${API_BASE}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!resp.ok) {
                const j = await resp.json().catch(() => ({}));
                const errText = j?.error || j?.message || "";
                if (resp.status === 409) {
                    if (errText.toLowerCase().includes("email")) {
                        throw new Error("Email already exists.");
                    }
                    if (errText.toLowerCase().includes("username")) {
                        throw new Error("Username already taken.");
                    }
                    throw new Error("Account already exists.");
                }
                throw new Error(errText || "Registration failed. Please try again.");
            }
            // Success: no auto-login, let caller handle redirect
        } catch (error) {
            if (error instanceof Error) throw error;
            throw new Error("Registration failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async (): Promise<void> => {
        try {
            setIsLoading(true);

            // Remove stored token and user on logout
            await AsyncStorage.removeItem("authToken");
            await AsyncStorage.removeItem("user");
            setToken(null);
            setUser(null);
        } catch (error) {
            console.error("Error during logout:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateUser = useCallback(async (partial: Partial<User>): Promise<void> => {
        setUser((prev) => {
            if (!prev) return prev;
            return { ...prev, ...partial };
        });

        // persist updated user to storage
        const stored = await AsyncStorage.getItem("user");
        try {
            const old = stored ? JSON.parse(stored) : {};
            const updated = { ...old, ...partial };
            await AsyncStorage.setItem("user", JSON.stringify(updated));
        } catch (e) {
            console.error("Failed to persist updated user", e);
        }
    }, []);

    const value: AuthContextType = {
        user,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        updateUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

export function useRequireAuth(): User {
    const { user, isAuthenticated } = useAuth();
    if (!isAuthenticated || !user) {
        throw new Error("Authentication required");
    }
    return user;
}
