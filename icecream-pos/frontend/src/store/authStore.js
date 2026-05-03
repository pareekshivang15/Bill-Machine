import { create } from "zustand";
import { supabase } from "../services/supabase";

const authListener = { subscription: null };

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      set({ initialized: true });
      return;
    }

    set({
      user: data.session?.user ?? null,
      session: data.session ?? null,
      initialized: true,
    });

    if (!authListener.subscription) {
      const { data: listenerData } = supabase.auth.onAuthStateChange((_event, session) => {
        set({
          user: session?.user ?? null,
          session: session ?? null,
          initialized: true,
        });
      });
      authListener.subscription = listenerData.subscription;
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    set({ loading: false });
    if (error) throw error;
    set({ user: data.user, session: data.session });
    return data;
  },

  logout: async () => {
    set({ loading: true });
    const { error } = await supabase.auth.signOut();
    set({ loading: false });
    if (error) throw error;
    set({ user: null, session: null });
  },
}));
