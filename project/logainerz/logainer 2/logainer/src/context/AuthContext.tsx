import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { api } from '../services/api';
import { offlineDB } from '../services/db';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: Role) => void;
  isAuthenticated: boolean;
}

const DEFAULT_USER: User = {
  username: 'officer@logainer.gov.in',
  full_name: 'Dr. Anupam Sarma, IAS',
  role: 'State Logistics Director',
  department: 'Ministry of Development of North Eastern Region (MDoNER)',
  state: 'Assam',
  access_token: 'demo-bearer-token'
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('logainer_user');
      return saved ? JSON.parse(saved) : DEFAULT_USER;
    } catch {
      return DEFAULT_USER;
    }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('logainer_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('logainer_user');
    }
  }, [user]);

  const login = async (username: string, password: string) => {
    try {
      const data = await api.login(username, password);
      setUser(data);
    } catch (e) {
      // Fallback local login for smooth demonstration
      const fallbackUser: User = {
        username,
        full_name: username.includes('bro') ? 'Col. R. K. Thapa' : (username.includes('ndrf') ? 'Commander J. Sangma' : 'Logistics Officer'),
        role: username.includes('bro') ? 'Chief Engineer' : (username.includes('ndrf') ? 'Emergency Response Officer' : 'State Logistics Director'),
        department: 'North Eastern Council (NEC)',
        state: 'Assam'
      };
      setUser(fallbackUser);
    }
  };

  const logout = async () => {
    if (user?.username) {
      try {
        await offlineDB.clearUserSessionData(user.username);
      } catch (e) {
        console.warn('[AuthContext] Error purging user cache on logout:', e);
      }
    }
    setUser(null);
  };

  const switchRole = (role: Role) => {
    if (!user) return;
    let dept = 'Regional Transport Cell';
    let name = user.full_name;
    let state = user.state;

    if (role === 'Admin / Central Command') {
      name = 'Dr. Himanta K. Das';
      dept = 'Logistics Operations Command Center (NER-HQ)';
      state = 'Assam (Regional Command)';
    } else if (role === 'State Logistics Director') {
      name = 'Dr. Anupam Sarma, IAS';
      dept = 'Ministry of Development of North Eastern Region (MDoNER)';
      state = 'Assam';
    } else if (role === 'Chief Engineer (BRO)') {
      name = 'Col. R. K. Thapa';
      dept = 'Border Roads Organisation (Project Vartak / Pushpak)';
      state = 'Arunachal Pradesh';
    } else if (role === 'Emergency Response Officer (NDRF)') {
      name = 'Commander J. Sangma';
      dept = 'National Disaster Response Force (1st Bn NDRF)';
      state = 'Meghalaya';
    } else if (role === 'District Authority / DLO') {
      name = 'EAC P. Jamir, ACS';
      dept = 'District Administration & Logistics Cell';
      state = 'Nagaland (Kohima)';
    }

    setUser({
      ...user,
      role,
      full_name: name,
      department: dept,
      state
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, switchRole, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
