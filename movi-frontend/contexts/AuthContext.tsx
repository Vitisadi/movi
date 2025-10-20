import React, {
   createContext,
   useContext,
   useState,
   useEffect,
   ReactNode,
} from 'react';

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

   const isAuthenticated = !!user;

   // Check for existing session on app start
   useEffect(() => {
      checkAuthStatus();
   }, []);

   const checkAuthStatus = async () => {
      try {
         // TODO: Check for stored auth token and validate with API
         // For now, just simulate checking stored credentials
         const storedUser = null; // await getStoredUser();
         if (storedUser) {
            setUser(storedUser);
         }
      } catch (error) {
         console.error('Error checking auth status:', error);
      } finally {
         setIsLoading(false);
      }
   };

   const login = async (email: string, password: string): Promise<void> => {
      try {
         setIsLoading(true);

         // TODO: Add Login API call when done
         // TODO: Store auth token in cookies
      } catch (error) {
         throw new Error('Invalid email or password');
      } finally {
         setIsLoading(false);
      }
   };

   const register = async (
      name: string,
      email: string,
      password: string
   ): Promise<void> => {
      try {
         setIsLoading(true);

         // TODO: Add Register API call when done
      } catch (error) {
         throw new Error('Registration failed. Please try again.');
      } finally {
         setIsLoading(false);
      }
   };

   const logout = async (): Promise<void> => {
      try {
         setIsLoading(true);

         // TODO: Call logout API endpoint

         setUser(null);
      } catch (error) {
         console.error('Error during logout:', error);
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
