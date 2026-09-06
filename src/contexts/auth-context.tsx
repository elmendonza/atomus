import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/src/lib/supabase';

type AuthContextValor = {
  session: Session | null;
  user: User | null;
  carregando: boolean;
  modoRecuperacaoSenha: boolean;
  signIn: (email: string, senha: string) => Promise<{ error: string | null }>;
  signUp: (email: string, senha: string, nome: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  enviarRecuperacaoSenha: (email: string) => Promise<{ error: string | null }>;
  redefinirSenha: (novaSenha: string) => Promise<{ error: string | null }>;
  cancelarRecuperacaoSenha: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValor | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [modoRecuperacaoSenha, setModoRecuperacaoSenha] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregando(false);
    });

    const { data: assinatura } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      setSession(novaSessao);
      if (evento === 'PASSWORD_RECOVERY') {
        setModoRecuperacaoSenha(true);
      }
    });

    return () => assinatura.subscription.unsubscribe();
  }, []);

  const valor = useMemo<AuthContextValor>(
    () => ({
      session,
      user: session?.user ?? null,
      carregando,
      modoRecuperacaoSenha,
      async signIn(email, senha) {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        return { error: error?.message ?? null };
      },
      async signUp(email, senha, nome) {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { data: { nome: nome.trim() } },
        });
        return { error: error?.message ?? null };
      },
      async signOut() {
        setModoRecuperacaoSenha(false);
        await supabase.auth.signOut();
      },
      async enviarRecuperacaoSenha(email) {
        const redirectTo =
          Platform.OS === 'web' && typeof window !== 'undefined'
            ? `${window.location.origin}/redefinir-senha`
            : undefined;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        return { error: error?.message ?? null };
      },
      async redefinirSenha(novaSenha) {
        const { error } = await supabase.auth.updateUser({ password: novaSenha });
        if (!error) setModoRecuperacaoSenha(false);
        return { error: error?.message ?? null };
      },
      async cancelarRecuperacaoSenha() {
        setModoRecuperacaoSenha(false);
        await supabase.auth.signOut();
      },
    }),
    [session, carregando, modoRecuperacaoSenha]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth precisa ser usado dentro de um AuthProvider');
  }
  return contexto;
}
