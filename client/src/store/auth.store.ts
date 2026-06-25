import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, setAccessToken } from '@/lib/api';

export type Role = 'super_admin' | 'company_admin' | 'recruiter' | 'hr_manager' | 'candidate';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: Role;
  company?: string;
  avatar?: string;
  isEmailVerified: boolean;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  login: (email: string, password: string, otp?: string) => Promise<void>;
  googleLogin: (credential: string, role?: 'company_admin' | 'candidate') => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  setSession: (user: AuthUser, accessToken: string) => void;
}

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role?: 'company_admin' | 'candidate';
  companyName?: string;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      status: 'idle',

      setSession: (user, accessToken) => {
        setAccessToken(accessToken);
        set({ user, accessToken, status: 'authenticated' });
      },

      login: async (email, password, otp) => {
        set({ status: 'loading' });
        const { data } = await api.post('/auth/login', { email, password, otp });
        get().setSession(data.data.user, data.data.accessToken);
      },

      googleLogin: async (credential, role) => {
        set({ status: 'loading' });
        const { data } = await api.post('/auth/google', { credential, role });
        get().setSession(data.data.user, data.data.accessToken);
      },

      register: async (payload) => {
        set({ status: 'loading' });
        const { data } = await api.post('/auth/register', payload);
        get().setSession(data.data.user, data.data.accessToken);
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {
          /* ignore */
        }
        setAccessToken(null);
        set({ user: null, accessToken: null, status: 'unauthenticated' });
      },

      // Re-validate the persisted session against the API on app load.
      hydrate: async () => {
        const token = get().accessToken;
        if (token) setAccessToken(token);
        try {
          const { data } = await api.get('/auth/me');
          set({ user: data.data.user, status: 'authenticated' });
        } catch {
          set({ user: null, accessToken: null, status: 'unauthenticated' });
        }
      },
    }),
    {
      name: 'hiresense-auth',
      partialize: (s) => ({ accessToken: s.accessToken, user: s.user }),
    },
  ),
);
