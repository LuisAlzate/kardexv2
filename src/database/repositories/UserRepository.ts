export interface User {
    id: string;
    nombre: string;
    email: string;
    documento?: string;
    rol: 'admin' | 'revisor' | 'operario';
    fecha_creacion?: string;
    password_hash?: string; // Optional when fetching for list
}

export interface Permission {
    rol: string;
    pantalla: string;
    puede_ver: boolean;
    puede_editar: boolean;
}

export interface IUserRepository {
    findByEmail(email: string): Promise<User | null>;
    validateCredentials(email: string, passwordHash: string): Promise<User | null>;

    // User Management
    getAllUsers(): Promise<User[]>;
    createUser(user: { id: string, nombre: string, email: string, documento?: string, rol: string, password_hash: string }): Promise<void>;
    updateUser(user: { id: string, nombre: string, email: string, documento?: string, rol: string, password_hash?: string }): Promise<void>;
    deleteUser(id: string): Promise<void>;

    // Permissions
    getPermissionsByRole(rol: string): Promise<Permission[]>;
    updatePermissions(rol: string, pantalla: string, canView: boolean, canEdit: boolean): Promise<void>;
}

import * as SQLite from 'expo-sqlite';
import { supabase } from '../../lib/supabase';

export class SQLiteUserRepository implements IUserRepository {
    constructor(private db: SQLite.SQLiteDatabase) { }

    private getErrorMsg(error: any): string {
        if (typeof error === 'string') return error.toLowerCase();
        return (error?.message || String(error) || '').toLowerCase();
    }

    async findByEmail(email: string): Promise<User | null> {
        try {
            const result = await this.db.getFirstAsync<User>(
                'SELECT id, nombre, email, documento, rol, fecha_creacion FROM usuarios_sistema WHERE email = ?',
                [email]
            );
            return result;
        } catch (error: any) {
            const msg = this.getErrorMsg(error);
            if (msg.includes('documento') || msg.includes('fecha_creacion')) {
                console.warn('Fallback triggered (findByEmail): migration likely failed.');
                return await this.db.getFirstAsync<User>(
                    'SELECT id, nombre, email, rol FROM usuarios_sistema WHERE email = ?',
                    [email]
                );
            }
            throw error;
        }
    }

    async validateCredentials(email: string, passwordHash: string): Promise<User | null> {
        try {
            const result = await this.db.getFirstAsync<User>(
                'SELECT id, nombre, email, documento, rol FROM usuarios_sistema WHERE email = ? AND password_hash = ?',
                [email, passwordHash]
            );
            return result;
        } catch (error: any) {
            const msg = this.getErrorMsg(error);
            if (msg.includes('documento')) {
                console.warn('Fallback triggered (validateCredentials)');
                return await this.db.getFirstAsync<User>(
                    'SELECT id, nombre, email, rol FROM usuarios_sistema WHERE email = ? AND password_hash = ?',
                    [email, passwordHash]
                );
            }
            throw error;
        }
    }

    async getAllUsers(): Promise<User[]> {
        try {
            return await this.db.getAllAsync<User>(
                'SELECT id, nombre, email, documento, rol, fecha_creacion FROM usuarios_sistema ORDER BY id DESC'
            );
        } catch (error: any) {
            const msg = this.getErrorMsg(error);
            if (msg.includes('documento') || msg.includes('fecha_creacion')) {
                console.warn('Fallback: columns missing in usuarios_sistema');
                return await this.db.getAllAsync<User>(
                    'SELECT id, nombre, email, rol FROM usuarios_sistema ORDER BY id DESC'
                );
            }
            throw error;
        }
    }

    async createUser(u: { id: string, nombre: string, email: string, documento?: string, rol: string, password_hash: string }): Promise<void> {
        const existing = await this.findByEmail(u.email);
        if (existing) {
            throw new Error(`El correo ${u.email} ya está registrado.`);
        }

        try {
            const sql = 'INSERT INTO usuarios_sistema (id, nombre, email, documento, rol, password_hash) VALUES (?, ?, ?, ?, ?, ?)';
            const params = [u.id, u.nombre, u.email, u.documento || null, u.rol, u.password_hash];
            await this.db.runAsync(sql, params);

            const screens = [
                'dashboard', 'inventory_list', 'inventory_entry', 'inventory_exit',
                'collaborators', 'locations', 'movement_history', 'user_management', 'business_lines', 'categories', 'reports'
            ];

            for (const screen of screens) {
                const canView = u.rol === 'admin' || u.rol === 'revisor' || (u.rol === 'operario' && screen !== 'user_management');
                const canEdit = u.rol === 'admin' || (u.rol === 'operario' && (screen === 'inventory_entry' || screen === 'inventory_exit'));
                await this.updatePermissions(u.rol, screen, !!canView, !!canEdit);
            }

            console.log('User created and permissions seeded successfully:', u.email);
        } catch (error: any) {
            const msg = this.getErrorMsg(error);
            if (msg.includes('documento')) {
                console.error('CRITICAL FALLBACK (createUser): DOCUMENTO WILL NOT BE PERSISTED.');
                const sql = 'INSERT INTO usuarios_sistema (id, nombre, email, rol, password_hash) VALUES (?, ?, ?, ?, ?)';
                const params = [u.id, u.nombre, u.email, u.rol, u.password_hash];
                await this.db.runAsync(sql, params);
                return;
            }
            console.error('SQL Error in createUser:', error);
            throw error;
        }
    }

    async updateUser(u: { id: string, nombre: string, email: string, documento?: string, rol: string, password_hash?: string }): Promise<void> {
        try {
            let query = 'UPDATE usuarios_sistema SET nombre = ?, email = ?, documento = ?, rol = ?';
            const params: any[] = [u.nombre, u.email, u.documento || null, u.rol];

            if (u.password_hash) {
                query += ', password_hash = ?';
                params.push(u.password_hash);
            }

            query += ' WHERE id = ?';
            params.push(u.id);

            await this.db.runAsync(query, params);
            console.log('User updated successfully:', u.id);
        } catch (error: any) {
            const msg = this.getErrorMsg(error);
            if (msg.includes('documento')) {
                console.error('CRITICAL FALLBACK (updateUser): DOCUMENTO UPDATES WILL FAIL.');
                let query = 'UPDATE usuarios_sistema SET nombre = ?, email = ?, rol = ?';
                const params: any[] = [u.nombre, u.email, u.rol];

                if (u.password_hash) {
                    query += ', password_hash = ?';
                    params.push(u.password_hash);
                }

                query += ' WHERE id = ?';
                params.push(u.id);
                await this.db.runAsync(query, params);
                return;
            }
            console.error('SQL Error in updateUser:', error);
            throw error;
        }
    }

    async deleteUser(id: string): Promise<void> {
        await this.db.runAsync('DELETE FROM usuarios_sistema WHERE id = ?', [id]);
    }

    async getPermissionsByRole(rol: string): Promise<Permission[]> {
        const results = await this.db.getAllAsync<any>(
            'SELECT rol, pantalla, puede_ver, puede_editar FROM rol_permisos WHERE rol = ?',
            [rol]
        );
        return results.map(r => ({
            rol: r.rol,
            pantalla: r.pantalla,
            puede_ver: r.puede_ver === 1,
            puede_editar: r.puede_editar === 1
        }));
    }

    async updatePermissions(rol: string, pantalla: string, canView: boolean, canEdit: boolean): Promise<void> {
        await this.db.runAsync(
            `INSERT OR REPLACE INTO rol_permisos (id, rol, pantalla, puede_ver, puede_editar) 
             VALUES (
                COALESCE((SELECT id FROM rol_permisos WHERE rol = ? AND pantalla = ?), ?),
                ?, ?, ?, ?
             )`,
            [
                rol, pantalla, Date.now().toString() + Math.random().toString(),
                rol, pantalla, canView ? 1 : 0, canEdit ? 1 : 0
            ]
        );
    }
}

export class SupabaseUserRepository implements IUserRepository {
    async findByEmail(email: string): Promise<User | null> {
        const { data, error } = await supabase.from('usuarios_sistema').select('*').eq('email', email).single();
        if (error) {
            if (error.code === 'PGRST116') return null; // No rows found
            throw error;
        }
        return data as User;
    }

    async validateCredentials(email: string, passwordHash: string): Promise<User | null> {
        const { data, error } = await supabase.from('usuarios_sistema')
            .select('*')
            .eq('email', email)
            .eq('password_hash', passwordHash)
            .single();
            
        if (error) {
            if (error.code === 'PGRST116') return null; // Invalid credentials
            throw error;
        }
        return data as User;
    }

    async getAllUsers(): Promise<User[]> {
        const { data, error } = await supabase.from('usuarios_sistema').select('*').order('id', { ascending: false });
        if (error) throw error;
        return data as User[];
    }

    async createUser(u: { id: string, nombre: string, email: string, documento?: string, rol: string, password_hash: string }): Promise<void> {
        const existing = await this.findByEmail(u.email);
        if (existing) {
            throw new Error(`El correo ${u.email} ya está registrado.`);
        }

        const { error } = await supabase.from('usuarios_sistema').insert([{
            id: u.id,
            nombre: u.nombre,
            email: u.email,
            documento: u.documento || null,
            rol: u.rol,
            password_hash: u.password_hash
        }]);
        if (error) throw error;

        const screens = [
            'dashboard', 'inventory_list', 'inventory_entry', 'inventory_exit',
            'collaborators', 'locations', 'movement_history', 'user_management', 'business_lines', 'categories', 'reports'
        ];
        
        for (const screen of screens) {
            const canView = u.rol === 'admin' || u.rol === 'revisor' || (u.rol === 'operario' && screen !== 'user_management');
            const canEdit = u.rol === 'admin' || (u.rol === 'operario' && (screen === 'inventory_entry' || screen === 'inventory_exit'));
            await this.updatePermissions(u.rol, screen, canView, canEdit);
        }
    }

    async updateUser(u: { id: string, nombre: string, email: string, documento?: string, rol: string, password_hash?: string }): Promise<void> {
        const payload: any = {
            nombre: u.nombre,
            email: u.email,
            documento: u.documento || null,
            rol: u.rol
        };
        if (u.password_hash) payload.password_hash = u.password_hash;

        const { error } = await supabase.from('usuarios_sistema').update(payload).eq('id', u.id);
        if (error) throw error;
    }

    async deleteUser(id: string): Promise<void> {
        const { error } = await supabase.from('usuarios_sistema').delete().eq('id', id);
        if (error) throw error;
    }

    async getPermissionsByRole(rol: string): Promise<Permission[]> {
        const { data, error } = await supabase.from('rol_permisos').select('*').eq('rol', rol);
        if (error) throw error;
        return data.map((r: any) => ({
            rol: r.rol,
            pantalla: r.pantalla,
            puede_ver: Boolean(r.puede_ver),
            puede_editar: Boolean(r.puede_editar)
        }));
    }

    async updatePermissions(rol: string, pantalla: string, canView: boolean, canEdit: boolean): Promise<void> {
        // Use UPSERT for Supabase to handle both create and update in one call
        // The table must have a unique constraint on (rol, pantalla) for this to work
        const { error } = await supabase.from('rol_permisos').upsert({
            rol,
            pantalla,
            puede_ver: canView,
            puede_editar: canEdit
        }, { onConflict: 'rol,pantalla' });
        
        if (error) throw error;
    }
}

export const getUserRepository = async (isOnline: boolean, db?: SQLite.SQLiteDatabase): Promise<IUserRepository> => {
    if (isOnline) {
        return new SupabaseUserRepository();
    } else {
        const database = db || await SQLite.openDatabaseAsync('kardex.db');
        return new SQLiteUserRepository(database);
    }
};
