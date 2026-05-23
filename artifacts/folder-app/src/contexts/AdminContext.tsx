import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { setAdminKey } from "@workspace/api-client-react";

const ADMIN_KEY = "HTR-CHORCHA-ADMIN-2025";
const STORAGE_KEY = "chorcha_admin";
const ADMIN_USER = "Hosen Toufiq Riyad";
const ADMIN_PASS = "Hosen Toufiq Riyad";

interface AdminContextType {
  isAdmin: boolean;
  login: (user: string, pass: string) => boolean;
  logout: () => void;
}

const AdminContext = createContext<AdminContextType>({
  isAdmin: false,
  login: () => false,
  logout: () => {},
});

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY) === ADMIN_KEY
  );

  useEffect(() => {
    setAdminKey(isAdmin ? ADMIN_KEY : null);
  }, [isAdmin]);

  const login = (user: string, pass: string): boolean => {
    if (user.trim() === ADMIN_USER && pass === ADMIN_PASS) {
      localStorage.setItem(STORAGE_KEY, ADMIN_KEY);
      setAdminKey(ADMIN_KEY);
      setIsAdmin(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAdminKey(null);
    setIsAdmin(false);
  };

  return (
    <AdminContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
