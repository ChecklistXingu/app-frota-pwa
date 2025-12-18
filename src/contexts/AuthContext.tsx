import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../services/firebase";

export type AppUserRole = "driver" | "admin";

export type AppUserProfile = {
  id: string;
  name: string;
  phone: string;
  filial: string;
  role: AppUserRole;
};

interface RegisterData {
  name: string;
  phone: string;
  filial: string;
  role?: AppUserRole;
  email: string;
  password: string;
}

interface AuthContextValue {
  user: User | null;
  profile: AppUserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          // Timeout de 5 segundos para não travar offline
          const timeoutPromise = new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('timeout')), 5000)
          );
          
          const ref = doc(db, "users", firebaseUser.uid);
          const snap = await Promise.race([
            getDoc(ref),
            timeoutPromise
          ]);

          if (snap && snap.exists()) {
            const data = snap.data() as any;
            setProfile({
              id: snap.id,
              name: data.name ?? "",
              phone: data.phone ?? "",
              filial: data.filial ?? "",
              role: (data.role as AppUserRole) ?? "driver",
            });
          } else {
            // Se timeout ou não existe, tenta carregar do cache local
            const cachedProfile = localStorage.getItem('cached_user_profile');
            if (cachedProfile) {
              console.log('[AUTH] Usando perfil do cache local (offline)');
              setProfile(JSON.parse(cachedProfile));
            } else {
              setProfile(null);
            }
          }
          
          // Salva no cache para uso offline
          if (snap && snap.exists()) {
            const data = snap.data() as any;
            const profileData = {
              id: snap.id,
              name: data.name ?? "",
              phone: data.phone ?? "",
              filial: data.filial ?? "",
              role: (data.role as AppUserRole) ?? "driver",
            };
            localStorage.setItem('cached_user_profile', JSON.stringify(profileData));
          }
        } catch (error) {
          console.warn('[AUTH] Erro ao buscar perfil (provavelmente offline):', error);
          // Tenta carregar do cache local
          const cachedProfile = localStorage.getItem('cached_user_profile');
          if (cachedProfile) {
            console.log('[AUTH] Usando perfil do cache local (offline)');
            setProfile(JSON.parse(cachedProfile));
          } else {
            setProfile(null);
          }
        }
      } else {
        setProfile(null);
        localStorage.removeItem('cached_user_profile');
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async ({
    name,
    phone,
    filial,
    role = "driver",
    email,
    password,
  }: RegisterData) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    await setDoc(doc(db, "users", uid), {
      name,
      phone,
      filial,
      role,
      createdAt: serverTimestamp(),
    });
  };

  const logout = async () => {
    await signOut(auth);
  };

  const value: AuthContextValue = {
    user,
    profile,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
