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
  verifyRegistration: (email: string, code: string) => Promise<void>;
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
        try {
          const { data } = await api.post('/auth/login', { email, password, otp });
          get().setSession(data.data.user, data.data.accessToken);
        } catch (err) {
          // A failed attempt must not strand status on 'loading' — protected
          // layouts render an infinite spinner for that state.
          set({ status: get().user ? 'authenticated' : 'unauthenticated' });
          throw err;
        }
      },

      googleLogin: async (credential, role) => {
        set({ status: 'loading' });
        try {
          const { data } = await api.post('/auth/google', { credential, role });
          get().setSession(data.data.user, data.data.accessToken);
        } catch (err) {
          set({ status: get().user ? 'authenticated' : 'unauthenticated' });
          throw err;
        }
      },

      // Phase 1: stages the signup server-side and emails a 6-digit code.
      // No session yet — verifyRegistration is what creates the account.
      register: async (payload) => {
        await api.post('/auth/register', payload);
      },

      // Phase 2: the emailed code creates the account and signs the user in.
      verifyRegistration: async (email, code) => {
        set({ status: 'loading' });
        try {
          const { data } = await api.post('/auth/register/verify', { email, code });
          get().setSession(data.data.user, data.data.accessToken);
        } catch (err) {
          // Wrong codes are a routine path — recover the status every time.
          set({ status: get().user ? 'authenticated' : 'unauthenticated' });
          throw err;
        }
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
