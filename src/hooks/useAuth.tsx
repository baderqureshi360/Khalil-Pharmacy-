import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Owner-only system - only one role exists
type AppRole = 'owner';

interface UserRole {
  role: AppRole;
  can_add_products: boolean; // Always true for owner
}

interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  id_card_number: string | null;
  address: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: UserRole | null;
  isOwner: boolean; // Owner-only system
  canAddProducts: boolean; // Always true for owner
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Safely fetches user profile and role data from Supabase.
   * Handles errors gracefully without crashing the UI.
   */
  const fetchUserData = async (userId: string) => {
    if (!userId || typeof userId !== 'string') {
      console.warn('Invalid userId provided to fetchUserData');
      return;
    }

    try {
      // Fetch profile with error handling
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileError) {
        // Log error but don't crash - profile might not exist yet
        console.warn('Error fetching user profile:', profileError);
      } else if (profileData) {
        setProfile(profileData);
      }

      // Fetch role with error handling - owner-only system
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role, can_add_products')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (roleError) {
        // If no role exists, create owner role for this user (first user becomes owner)
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: 'owner',
            can_add_products: true,
          });
        
        if (!insertError) {
          setUserRole({ role: 'owner', can_add_products: true });
        } else {
          console.warn('Error creating owner role:', insertError);
        }
      } else if (roleData) {
        // Ensure role is owner (security enforcement)
        if (roleData.role !== 'owner') {
          // Update to owner if somehow not owner
          await supabase
            .from('user_roles')
            .update({ role: 'owner', can_add_products: true })
            .eq('user_id', userId);
          setUserRole({ role: 'owner', can_add_products: true });
        } else {
          setUserRole({ role: 'owner', can_add_products: true });
        }
      } else {
        // No role found, create owner role
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: 'owner',
            can_add_products: true,
          });
        
        if (!insertError) {
          setUserRole({ role: 'owner', can_add_products: true });
        }
      }
    } catch (error) {
      // Catch any unexpected errors and log them
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Unexpected error fetching user data:', errorMessage);
      // Don't throw - allow app to continue with partial data
    }
  };

  const refreshUserData = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        try {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            // Defer Supabase calls with setTimeout to avoid race conditions
            setTimeout(() => {
              if (isMounted) {
                fetchUserData(session.user.id);
              }
            }, 0);
          } else {
            setProfile(null);
            setUserRole(null);
          }
          
          if (event === 'SIGNED_OUT') {
            setProfile(null);
            setUserRole(null);
          }
          
          setLoading(false);
        } catch (error) {
          // Handle any errors in auth state change handler
          console.error('Error in auth state change handler:', error);
          if (isMounted) {
            setLoading(false);
          }
        }
      }
    );

    // THEN check for existing session with error handling
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!isMounted) return;

        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          return;
        }

        try {
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            fetchUserData(session.user.id);
          }
          setLoading(false);
        } catch (error) {
          console.error('Error processing session:', error);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (isMounted) {
          console.error('Unexpected error getting session:', error);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Safely handles user sign up with comprehensive error handling.
   */
  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      if (!email || !password || !fullName) {
        return { 
          error: new Error('Email, password, and full name are required') 
        };
      }

      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName.trim(),
          },
        },
      });
      
      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Unexpected error during sign up:', err);
      return { error: err };
    }
  };

  /**
   * Safely handles user sign in with comprehensive error handling.
   */
  const signIn = async (email: string, password: string) => {
    try {
      if (!email || !password) {
        return { 
          error: new Error('Email and password are required') 
        };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      
      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Unexpected error during sign in:', err);
      return { error: err };
    }
  };

  /**
   * Safely handles user sign out with error handling.
   */
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        // Still clear local state even if sign out fails
      }
      // Clear local state regardless of error
      setUser(null);
      setSession(null);
      setProfile(null);
      setUserRole(null);
    } catch (error) {
      console.error('Unexpected error during sign out:', error);
      // Clear local state even on unexpected errors
      setUser(null);
      setSession(null);
      setProfile(null);
      setUserRole(null);
    }
  };

  // Owner-only system - user is owner if authenticated
  const isOwner = !!user && !!session;
  const canAddProducts = isOwner; // Owner always has full permissions

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        userRole,
        isOwner,
        canAddProducts,
        loading,
        signUp,
        signIn,
        signOut,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
