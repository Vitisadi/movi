import React, {
   createContext,
   useContext,
   useState,
   useEffect,
   ReactNode,
} from 'react';
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = "http://localhost:5000";

// Types
export interface User {
    id: string;
    name: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (name: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
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
            if (t) {
                setToken(t);
                // Optionally fetch user info from API using the token
                // Example: await fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${t}` } })
                // If your API has /me endpoint use that instead. Here we skip fetching user to keep it simple.
            }
        } catch (error) {
            console.error("Error checking auth status:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (email: string, password: string): Promise<void> => {
        try {
            setIsLoading(true);
            const resp = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            if (!resp.ok) {
                const j = await resp.json().catch(() => ({}));
                throw new Error(j.error || "Login failed");
            }
            const data = await resp.json();
            const t = data.token;
            const u = data.user;
            if (t) {
                await AsyncStorage.setItem("authToken", t);
                setToken(t);
            }
            if (u) setUser(u);
        } catch (error) {
            throw new Error("Invalid email or password");
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (name: string, email: string, password: string): Promise<void> => {
        try {
            setIsLoading(true);

            const resp = await fetch(`${API_BASE}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, username: name }),
            });
            if (!resp.ok) {
                const j = await resp.json().catch(() => ({}));
                throw new Error(j.error || "Registration failed");
            }
            // After register you might auto-login or require manual login. We'll auto-login if token returned.
            const data = await resp.json().catch(() => ({}));
            if (data.token) {
                await AsyncStorage.setItem("authToken", data.token);
                setToken(data.token);
            }
            if (data.user) setUser(data.user);
        } catch (error) {
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
            setToken(null);
            setUser(null);
        } catch (error) {
            console.error("Error during logout:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const value: AuthContextType = {
        user,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
   const context = useContext(AuthContext);
   if (context === undefined) {
      throw new Error('useAuth must be used within an AuthProvider');
   }
   return context;
}

export function useRequireAuth(): User {
   const { user, isAuthenticated } = useAuth();
   if (!isAuthenticated || !user) {
      throw new Error('Authentication required');
   }
   return user;
}
