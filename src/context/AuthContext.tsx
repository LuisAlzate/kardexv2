import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, SQLiteUserRepository, SupabaseUserRepository, Permission } from '../database/repositories/UserRepository';
import { initDatabase } from '../database/database';
import * as SQLite from 'expo-sqlite';
import { supabase } from '../lib/supabase';

interface AuthContextType {
    user: User | null;
    permissions: Permission[];
    loading: boolean;
    initError: string | null;
    isOnline: boolean;
    login: (email: string, pass: string) => Promise<boolean>;
    logout: () => void;
    can: (pantalla: string, accion: 'ver' | 'editar') => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);
    const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
    const [initError, setInitError] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState<boolean>(false);

    useEffect(() => {
        const initializeApp = async () => {
            // Ping Supabase
            try {
                const { data, error } = await supabase.from('usuarios_sistema').select('id').limit(1);
                setIsOnline(!error);
                console.log('Supabase Connection:', !error ? 'ONLINE' : 'OFFLINE');

                // Auto-seed default admin if database is entirely empty
                if (!error && data && data.length === 0) {
                    console.log('Ningún usuario encontrado en Supabase. Creando usuario por defecto...');
                    const repo = new SupabaseUserRepository();
                    await repo.createUser({
                        id: '00000000-0000-0000-0000-000000000001',
                        nombre: 'Administrador Default',
                        email: 'admin@kardex.com',
                        rol: 'admin',
                        password_hash: 'admin123'
                    });
                }
            } catch (e) {
                setIsOnline(false);
                console.log('Supabase Ping Failed, Mode: OFFLINE');
            }

            // Init local SQLite as fallback
            try {
                const database = await initDatabase();
                setDb(database);
                setInitError(null);
            } catch (err: any) {
                console.error('Database Init Failed:', err);
                setInitError(err.message || 'Error al conectar con la base de datos local');
            } finally {
                setLoading(false);
            }
        };

        initializeApp();
    }, []);

    const login = async (email: string, pass: string) => {
        if (!isOnline && initError) {
            throw new Error(`Error de base de datos local y sin conexión a internet: ${initError}`);
        }

        if (!isOnline && !db) {
            throw new Error('La base de datos local aún no está lista. Reintente en un momento.');
        }

        try {
            const repo = isOnline ? new SupabaseUserRepository() : new SQLiteUserRepository(db!);
            const validatedUser = await repo.validateCredentials(email, pass);

            if (validatedUser) {
                const perms = await repo.getPermissionsByRole(validatedUser.rol);
                setPermissions(perms);
                setUser(validatedUser);
                return true;
            }
            return false;
        } catch (error: any) {
            console.error('AuthContext Login Error:', error);
            throw new Error(error.message || 'Error al validar credenciales');
        }
    };

    const logout = () => {
        setUser(null);
        setPermissions([]);
    };

    const can = (pantalla: string, accion: 'ver' | 'editar'): boolean => {
        if (user?.rol === 'admin') return true;

        const p = permissions.find(x => x.pantalla === pantalla);
        if (!p) {
            if ((pantalla === 'business_lines' || pantalla === 'categories' || pantalla === 'reports') && accion === 'ver') return true;
            return false;
        }
        return accion === 'ver' ? p.puede_ver : p.puede_editar;
    };

    return (
        <AuthContext.Provider value={{ user, permissions, loading, initError, isOnline, login, logout, can }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
