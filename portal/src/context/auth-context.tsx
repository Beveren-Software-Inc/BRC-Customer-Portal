"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { erpnextApi, getCurrentUser, logoutUser } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  company?: string;
  initials: string;
  isLoggedIn: boolean;
}

interface AuthContextType {
  user: User;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isInitialized: boolean;
}

const defaultUser: User = {
  id: "",
  fullName: "User",
  email: "",
  phone: "",
  company: "",
  initials: "U",
  isLoggedIn: false,
};

const AuthContext = createContext<AuthContextType>({
  user: defaultUser,
  logout: async () => {},
  refreshUser: async () => {},
  isInitialized: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(defaultUser);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();

  const generateInitials = (fullName: string): string => {
    if (!fullName) return "U";
    return fullName
      .split(' ')
      .filter(part => part.length > 0) // Skip empty parts
      .map(name => name[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const refreshUser = async () => {
    try {
      
      // Get current user from the API
      const userId = await getCurrentUser();
      
      if (userId && userId !== 'Guest') {
        
        // Get user's basic profile information 
        try {
          const userResponse = await erpnextApi.get(`/resource/User/${userId}`);
          
          let userData, fullName;
          
          if (userResponse.data && userResponse.data.data) {
            userData = userResponse.data.data;
            fullName = userData.full_name || userId;
            
            const userInfo = {
              id: userId,
              fullName: fullName,
              email: userId,
              phone: userData?.phone || "",
              company: userData?.company || "",
              initials: generateInitials(fullName),
              isLoggedIn: true,
            };
            setUser(userInfo);
          } else {
            // Basic user info if full profile can't be retrieved
            const userInfo = {
              id: userId,
              fullName: userId,
              email: userId,
              initials: generateInitials(userId),
              isLoggedIn: true,
            };
            setUser(userInfo);
          }
        } catch (error) {
          const userInfo = {
            id: userId,
            fullName: userId,
            email: userId,
            initials: generateInitials(userId),
            isLoggedIn: true,
          };
          setUser(userInfo);
        }
      } else {
        // No user found or Guest user - set as not logged in
        setUser({
          ...defaultUser,
          isLoggedIn: false,
        });
      }
    } catch (error) {
      console.error("Failed to fetch user data:", error);
      // API error - assume not logged in
      setUser({
        ...defaultUser,
        isLoggedIn: false,
      });
    } finally {
      setIsInitialized(true);
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
      setUser({
        ...defaultUser,
        isLoggedIn: false,
      });
      
      // Show success toast
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of your account.",
        duration: 3000,
      });
      
      // Redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error("Logout failed:", error);
      toast({
        title: "Logout failed",
        description: "There was an error logging out. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  // Don't render children until authentication check is complete
  if (!isInitialized) {
    return <div className="flex items-center justify-center min-h-screen">
      <p>Loading...</p>
    </div>;
  }

  return (
    <AuthContext.Provider value={{ user, logout, refreshUser, isInitialized }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);