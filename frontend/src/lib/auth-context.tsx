"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, getStoredToken, setStoredToken, User } from "./api";

interface AuthContextType {
  user: User | null;
  role: "ADMIN" | "STAFF" | "CUSTOMER" | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  token: null,
  isLoading: true,
  login: async () => {
    throw new Error("AuthContext not initialized");
  },
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = getStoredToken();
    if (stored) {
      setTokenState(stored);
      authApi
        .getCurrentUser()
        .then((u) => setUser(u))
        .catch(() => {
          setStoredToken("");
          setTokenState(null);
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const resp = await authApi.login(email, password);
      setStoredToken(resp.access_token);
      setTokenState(resp.access_token);
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setStoredToken("");
    setTokenState(null);
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: (user?.role as any) || null,
        token,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
