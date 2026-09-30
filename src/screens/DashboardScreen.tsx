import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import {
    LogOut,
    Package,
    ArrowDownLeft,
    ArrowUpRight,
    Users,
    MapPin,
    Settings,
    TrendingUp,
    Shield,
    RefreshCw,
    Wrench,
    FileText,
    Briefcase
} from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import { getMovementRepository } from '../database/repositories/MovementRepository';
import * as SQLite from 'expo-sqlite';

interface DashboardScreenProps {
    onNavigate: (screen: string) => void;
}

const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigate }) => {
    const { user, logout, can, isOnline } = useAuth();
    const [stats, setStats] = useState({ dailyMovements: 0, activeLoans: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const repo = await getMovementRepository(isOnline);
            const data = await repo.getDashboardStats();
            setStats(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            {/* Header / Profile */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <Logo size={240} style={styles.logo} />
                    <TouchableOpacity onPress={logout} style={styles.logoutButton}>
                        <LogOut size={20} color={Colors.error} />
                    </TouchableOpacity>
                </View>

                <View style={styles.profileSection}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{user?.nombre?.charAt(0) || 'A'}</Text>
                    </View>
                    <View>
                        <Text style={styles.welcomeText}>Panel de Control</Text>
                        <Text style={styles.userName}>{user?.nombre || 'Administrador'}</Text>
                    </View>
                    <TouchableOpacity onPress={fetchStats} style={styles.refreshBadge}>
                        <RefreshCw size={14} color={Colors.secondary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.statsCard}>
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Movimientos Hoy</Text>
                        {loading ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Text style={styles.statValue}>{stats.dailyMovements}</Text>
                        )}
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Salidas (Pendientes)</Text>
                        {loading ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                            <Text style={styles.statValue}>{stats.activeLoans}</Text>
                        )}
                    </View>
                </View>
            </View>

            {/* Main Menu */}
            <View style={styles.content}>
                <Text style={styles.sectionTitle}>Gestión de Almacén</Text>

                <View style={styles.grid}>
                    {can('movement_history', 'ver') && (
                        <MenuButton
                            title="Ver Movimientos"
                            icon={TrendingUp}
                            onPress={() => onNavigate('movement_history')}
                        />
                    )}
                    {can('inventory_entry', 'ver') && (
                        <MenuButton
                            title="Registrar Entrada"
                            icon={ArrowDownLeft}
                            onPress={() => onNavigate('inventory_entry')}
                        />
                    )}
                    {can('inventory_exit', 'ver') && (
                        <MenuButton
                            title="Registrar Salida"
                            icon={ArrowUpRight}
                            onPress={() => onNavigate('inventory_exit')}
                        />
                    )}
                    {(can('inventory_entry', 'editar') || user?.rol === 'admin') && (
                        <MenuButton
                            title="Devolver Herramienta"
                            icon={RefreshCw}
                            onPress={() => onNavigate('inventory_return')}
                        />
                    )}
                    {can('inventory_list', 'ver') && (
                        <MenuButton
                            title="Ver Inventario"
                            icon={Package}
                            onPress={() => onNavigate('inventory_list')}
                        />
                    )}
                    {(can('inventory_entry', 'editar') || user?.rol === 'admin') && (
                        <MenuButton
                            title="Mantenimiento"
                            icon={Wrench}
                            onPress={() => onNavigate('maintenance')}
                        />
                    )}
                    {can('inventory_list', 'ver') && (
                        <MenuButton
                            title="Hoja de Vida"
                            icon={FileText}
                            onPress={() => onNavigate('lifecycle')}
                        />
                    )}
                    {can('collaborators', 'ver') && (
                        <MenuButton
                            title="Colaboradores"
                            icon={Users}
                            onPress={() => onNavigate('collaborators')}
                        />
                    )}
                    {can('locations', 'ver') && (
                        <MenuButton
                            title="Ubicaciones"
                            icon={MapPin}
                            onPress={() => onNavigate('locations')}
                        />
                    )}
                    {can('business_lines', 'ver') && (
                        <MenuButton
                            title="Líneas de Negocio"
                            icon={Briefcase}
                            onPress={() => onNavigate('business_lines')}
                        />
                    )}
                    {user?.rol === 'admin' && (
                        <MenuButton
                            title="Gestión Usuarios"
                            icon={Shield}
                            onPress={() => onNavigate('user_management')}
                        />
                    )}
                    <MenuButton 
                        title="Configuración" 
                        icon={Settings} 
                        onPress={() => onNavigate('settings')}
                    />
                </View>

                {/* Quick Info */}
                <View style={[styles.infoCard, { marginTop: 20 }]}>
                    <Shield size={24} color={Colors.primary} />
                    <View style={styles.infoContent}>
                        <Text style={styles.infoTitle}>Seguridad del Sistema</Text>
                        <Text style={styles.infoDescription}>Toda la información se guarda localmente en SQLite para asegurar el trabajo offline.</Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
};

const MenuButton = ({ title, icon: Icon, onPress }: any) => (
    <TouchableOpacity style={styles.menuButton} onPress={onPress}>
        <View style={styles.iconContainer}>
            <Icon size={24} color={Colors.primary} />
        </View>
        <Text style={styles.menuText}>{title}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        backgroundColor: '#FFF',
        paddingTop: 50,
        paddingHorizontal: 24,
        paddingBottom: 60,
        borderBottomLeftRadius: 36,
        borderBottomRightRadius: 36,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    logo: {
        alignItems: 'flex-start',
        padding: 0,
    },
    logoutButton: {
        backgroundColor: Colors.surface,
        padding: 10,
        borderRadius: 12,
    },
    profileSection: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
        position: 'relative',
    },
    refreshBadge: {
        position: 'absolute',
        right: 0,
        backgroundColor: Colors.surface,
        padding: 8,
        borderRadius: 20,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: Colors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        borderWidth: 1,
        borderColor: Colors.primary + '30',
    },
    avatarText: {
        color: Colors.primary,
        fontSize: 22,
        fontWeight: '700',
    },
    welcomeText: {
        color: Colors.textSecondary,
        fontSize: 13,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    userName: {
        color: Colors.secondary,
        fontSize: 22,
        fontWeight: '700',
    },
    statsCard: {
        backgroundColor: Colors.secondary,
        borderRadius: 24,
        padding: 24,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        marginTop: -20,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 6,
        fontWeight: '600',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '800',
        color: '#FFF',
    },
    divider: {
        width: 1,
        height: 40,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginHorizontal: 10,
    },
    content: {
        padding: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.secondary,
        marginBottom: 20,
        marginLeft: 4,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    menuButton: {
        width: '48%',
        backgroundColor: '#FFF',
        borderRadius: 24,
        paddingVertical: 24,
        paddingHorizontal: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    menuText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.secondary,
        textAlign: 'center',
    },
    infoCard: {
        flexDirection: 'row',
        backgroundColor: Colors.primary + '10',
        padding: 20,
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.primary + '20',
    },
    infoContent: {
        marginLeft: 16,
        flex: 1,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.primary,
        marginBottom: 4,
    },
    infoDescription: {
        fontSize: 13,
        color: Colors.textSecondary,
        lineHeight: 18,
    },
});

export default DashboardScreen;
