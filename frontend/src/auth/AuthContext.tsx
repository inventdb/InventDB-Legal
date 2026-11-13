import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, errorMessage, getToken, setToken, setUnauthorizedHandler } from "../api/client";
import { resetAnalyzeState } from "../analyze/store";
import { setCurrentAccess, type AccessMap } from "../config/access";
import type { AuthUser, LoginResponse } from "../types";

const USER_KEY = "legal.user";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  /**
   * What this person may reach. Null while it is being worked out (right after
   * sign-in, or on a reload); the signed-in frame waits for it so nobody sees
   * the whole firm for a moment before their own part of it.
   */
  access: AccessMap | null;
  accessError: string | null;
  reloadAccess: () => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

async function fetchAccess(): Promise<AccessMap> {
  const { data } = await api.get<AccessMap>("/auth/access");
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => loadUser());
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [loading, setLoading] = useState(false);
  const [access, setAccessState] = useState<AccessMap | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessTick, setAccessTick] = useState(0);

  const setAccess = useCallback((next: AccessMap | null) => {
    // The module store first, so plain helpers agree with the context from the
    // very render that first shows the frame.
    setCurrentAccess(next);
    setAccessState(next);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setTokenState(null);
    setAccess(null);
    setAccessError(null);
    // Analyze holds its threads at module scope so a running analysis survives
    // navigation — which means signing out has to clear them explicitly, or the
    // next person to sign in on this tab would find the last one's questions
    // (and any stream still in flight) waiting for them.
    resetAnalyzeState();
  }, [setAccess]);

  // Any 401 from the API layer forces a logout.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Worked out again on every load, never trusted from storage: a role changed
  // in InventDB takes effect the next time the app opens.
  useEffect(() => {
    if (!token) return;
    let live = true;
    setAccessError(null);
    fetchAccess()
      .then((a) => live && setAccess(a))
      .catch((err) => live && setAccessError(errorMessage(err)));
    return () => {
      live = false;
    };
  }, [token, accessTick, setAccess]);

  const login = useCallback(
    async (username: string, password: string) => {
      setLoading(true);
      try {
        const { data } = await api.post<LoginResponse>("/auth/login", {
          username,
          password,
        });
        if (!data.token) {
          throw new Error(data.error || "Login failed");
        }
        setToken(data.token);
        // Access before the user, so the frame opens straight onto this
        // person's own dashboard rather than flashing anyone else's.
        setAccess(null);
        const next = await fetchAccess().catch(() => null);
        setAccess(next);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user ?? {}));
        setTokenState(data.token);
        setUser(data.user ?? {});
      } catch (err) {
        throw new Error(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [setAccess]
  );

  const reloadAccess = useCallback(() => setAccessTick((t) => t + 1), []);

  const value = useMemo<AuthState>(
    () => ({ user, token, loading, access, accessError, reloadAccess, login, logout }),
    [user, token, loading, access, accessError, reloadAccess, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
