import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    SafeAreaView,
    Modal,
    TextInput,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { ArrowLeft, UserPlus, Shield, Edit2, Trash2, Save, X, Check, Search, ChevronRight } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { SQLiteUserRepository, User, Permission, getUserRepository } from '../database/repositories/UserRepository';
import { useAuth } from '../context/AuthContext';
import { generateUUID } from '../lib/uuid';

interface UserManagementScreenProps {
    onBack: () => void;
}

const SCREENS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'inventory_list', label: 'Inventario (Lista)' },
    { id: 'inventory_entry', label: 'Ingresos (Entradas)' },
    { id: 'inventory_exit', label: 'Egresos (Salidas)' },
    { id: 'collaborators', label: 'Colaboradores' },
    { id: 'locations', label: 'Ubicaciones' },
    { id: 'movement_history', label: 'Historial Movimientos' },
    { id: 'user_management', label: 'Gestión Usuarios' },
];

const ROLES = [
    { id: 'admin', label: 'Administrador' },
    { id: 'revisor', label: 'Revisor' },
    { id: 'operario', label: 'Operario' },
];

const UserManagementScreen: React.FC<UserManagementScreenProps> = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState<'users' | 'permissions'>('users');
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<User[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const { isOnline } = useAuth();
    const [selectedRole, setSelectedRole] = useState<string>('admin');

    // User Modal State
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [userDocumento, setUserDocumento] = useState('');
    const [userPassword, setUserPassword] = useState('');
    const [userRole, setUserRole] = useState<'admin' | 'revisor' | 'operario'>('operario');

    useEffect(() => {
        loadData();
    }, [activeTab, selectedRole]);

    const loadData = async () => {
        setLoading(true);
        try {
            const repo = await getUserRepository(isOnline);
            console.log(`Loading users/permissions in ${isOnline ? 'ONLINE' : 'OFFLINE'} mode`);

            if (activeTab === 'users') {
                const u = await repo.getAllUsers();
                setUsers(u);
            } else {
                const p = await repo.getPermissionsByRole(selectedRole);
                setPermissions(p);
            }
        } catch (error) {
            console.error('Error loading user management data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveUser = async () => {
        if (!userName || !userEmail || !userDocumento || (!editingUser && !userPassword)) {
            Alert.alert('Error', 'Por favor complete todos los campos');
            return;
        }

        try {
            const repo = await getUserRepository(isOnline);

            if (editingUser) {
                await repo.updateUser({
                    id: editingUser.id,
                    nombre: userName,
                    email: userEmail,
                    documento: userDocumento,
                    rol: userRole,
                    password_hash: userPassword || undefined
                });
            } else {
                await repo.createUser({
                    id: generateUUID(),
                    nombre: userName,
                    email: userEmail,
                    documento: userDocumento,
                    rol: userRole,
                    password_hash: userPassword
                });
            }

            Alert.alert('Éxito', editingUser ? 'Usuario actualizado' : 'Usuario creado correctamente');
            setShowUserModal(false);
            loadData();
        } catch (error: any) {
            console.error('Error saving user FULL ERROR:', JSON.stringify(error, null, 2));
            Alert.alert('Error de Guardado', 'No se pudo guardar el usuario.\n\nDetalle: ' + (error.message || 'Error desconocido'));
        }
    };

    const handleDeleteUser = (user: User) => {
        if (user.rol === 'admin' && users.filter(u => u.rol === 'admin').length <= 1) {
            Alert.alert('Error', 'No se puede eliminar el último administrador');
            return;
        }

        Alert.alert(
            'Confirmar',
            `¿Está seguro de eliminar al usuario ${user.nombre}?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        const repo = await getUserRepository(isOnline);
                        await repo.deleteUser(user.id);
                        loadData();
                    }
                }
            ]
        );
    };

    const togglePermission = async (pantalla: string, type: 'view' | 'edit') => {
        const repo = await getUserRepository(isOnline);
        const p = permissions.find(x => x.pantalla === pantalla);
        if (!p) return;

        const newView = type === 'view' ? !p.puede_ver : p.puede_ver;
        const newEdit = type === 'edit' ? !p.puede_editar : p.puede_editar;

        await repo.updatePermissions(selectedRole, pantalla, newView, newEdit);
        loadData();
    };

    const renderUserItem = ({ item }: { item: User }) => (
        <View style={styles.userCard}>
            <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.nombre}</Text>
                <Text style={styles.userEmail}>{item.email} • {item.documento || 'Sin Documento'}</Text>
                <View style={[styles.roleBadge, { backgroundColor: item.rol === 'admin' ? Colors.error + '20' : Colors.primary + '20' }]}>
                    <Text style={[styles.roleText, { color: item.rol === 'admin' ? Colors.error : Colors.primary }]}>
                        {item.rol.toUpperCase()}
                    </Text>
                </View>
            </View>
            <View style={styles.userActions}>
                <TouchableOpacity onPress={() => {
                    setEditingUser(item);
                    setUserName(item.nombre);
                    setUserEmail(item.email);
                    setUserDocumento(item.documento || '');
                    setUserRole(item.rol);
                    setUserPassword('');
                    setShowUserModal(true);
                }} style={styles.actionButton}>
                    <Edit2 size={18} color={Colors.secondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteUser(item)} style={styles.actionButton}>
                    <Trash2 size={18} color={Colors.error} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.secondary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Gestión de Usuarios</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'users' && styles.activeTab]}
                    onPress={() => setActiveTab('users')}
                >
                    <UserPlus size={18} color={activeTab === 'users' ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>Usuarios</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'permissions' && styles.activeTab]}
                    onPress={() => setActiveTab('permissions')}
                >
                    <Shield size={18} color={activeTab === 'permissions' ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.tabText, activeTab === 'permissions' && styles.activeTabText]}>Permisos</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'users' ? (
                <View style={{ flex: 1 }}>
                    {loading ? (
                        <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
                    ) : (
                        <FlatList
                            data={users}
                            keyExtractor={(item) => item.id}
                            renderItem={renderUserItem}
                            contentContainerStyle={styles.listContainer}
                        />
                    )}
                    <TouchableOpacity
                        style={styles.fab}
                        onPress={() => {
                            setEditingUser(null);
                            setUserName('');
                            setUserEmail('');
                            setUserDocumento('');
                            setUserPassword('');
                            setUserRole('operario');
                            setShowUserModal(true);
                        }}
                    >
                        <UserPlus size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <View style={styles.roleSelector}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {ROLES.map((role) => (
                                <TouchableOpacity
                                    key={role.id}
                                    style={[styles.roleChip, selectedRole === role.id && styles.activeRoleChip]}
                                    onPress={() => setSelectedRole(role.id)}
                                >
                                    <Text style={[styles.roleChipText, selectedRole === role.id && styles.activeRoleChipText]}>
                                        {role.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                    <ScrollView contentContainerStyle={styles.matrixContainer}>
                        <View style={styles.matrixHeader}>
                            <Text style={[styles.matrixLabel, { flex: 2 }]}>Pantalla</Text>
                            <Text style={styles.matrixCenterLabel}>Ver</Text>
                            <Text style={styles.matrixCenterLabel}>Editar</Text>
                        </View>
                        {SCREENS.map((screen) => {
                            const p = permissions.find(x => x.pantalla === screen.id);
                            return (
                                <View key={screen.id} style={styles.matrixRow}>
                                    <Text style={[styles.screenName, { flex: 2 }]}>{screen.label}</Text>
                                    <TouchableOpacity
                                        style={styles.checkboxContainer}
                                        onPress={() => togglePermission(screen.id, 'view')}
                                    >
                                        <View style={[styles.checkbox, p?.puede_ver && styles.checkboxActive]}>
                                            {p?.puede_ver && <Check size={12} color="#FFF" />}
                                        </View>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.checkboxContainer}
                                        onPress={() => togglePermission(screen.id, 'edit')}
                                    >
                                        <View style={[styles.checkbox, p?.puede_editar && styles.checkboxActive]}>
                                            {p?.puede_editar && <Check size={12} color="#FFF" />}
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            {/* User Modal */}
            <Modal visible={showUserModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                            </Text>
                            <TouchableOpacity onPress={() => setShowUserModal(false)}>
                                <X size={24} color={Colors.secondary} />
                            </TouchableOpacity>
                        </View>

                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            enabled={Platform.OS !== 'web'}
                        >
                            <ScrollView>
                                <Text style={styles.inputLabel}>Nombre Completo</Text>
                            <TextInput
                                style={styles.input}
                                value={userName}
                                onChangeText={setUserName}
                                placeholder="Ej: Juan Pérez"
                            />

                            <Text style={styles.inputLabel}>Documento (ID)</Text>
                            <TextInput
                                style={styles.input}
                                value={userDocumento}
                                onChangeText={setUserDocumento}
                                placeholder="Número de cédula o DNI"
                                keyboardType="numeric"
                            />

                            <Text style={styles.inputLabel}>Correo Electrónico</Text>
                            <TextInput
                                style={styles.input}
                                value={userEmail}
                                onChangeText={setUserEmail}
                                placeholder="juan@kardex.com"
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />

                            <Text style={styles.inputLabel}>
                                {editingUser ? 'Cambiar Contraseña (opcional)' : 'Contraseña'}
                            </Text>
                            <TextInput
                                style={styles.input}
                                value={userPassword}
                                onChangeText={setUserPassword}
                                placeholder="******"
                                secureTextEntry
                            />

                            <Text style={styles.inputLabel}>Rol del Sistema</Text>
                            <View style={styles.rolePicker}>
                                {ROLES.map((role) => (
                                    <TouchableOpacity
                                        key={role.id}
                                        style={[styles.roleOption, userRole === role.id && styles.roleOptionActive]}
                                        onPress={() => setUserRole(role.id as any)}
                                    >
                                        <Text style={[styles.roleOptionText, userRole === role.id && styles.roleOptionTextActive]}>
                                            {role.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity style={styles.saveButton} onPress={handleSaveUser}>
                                <Save size={20} color="#FFF" style={{ marginRight: 8 }} />
                                <Text style={styles.saveButtonText}>Guardar Usuario</Text>
                            </TouchableOpacity>
                        </ScrollView>
                        </KeyboardAvoidingView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: '#FFF',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.secondary,
    },
    backButton: {
        padding: 8,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 8,
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: Colors.primary,
    },
    tabText: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    activeTabText: {
        color: Colors.primary,
    },
    listContainer: {
        padding: 16,
    },
    userCard: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.secondary,
    },
    userEmail: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    roleBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 6,
    },
    roleText: {
        fontSize: 10,
        fontWeight: '700',
    },
    userActions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        padding: 6,
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        backgroundColor: Colors.primary,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    roleSelector: {
        backgroundColor: '#FFF',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    roleChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: Colors.surface,
        marginHorizontal: 8,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    activeRoleChip: {
        backgroundColor: Colors.secondary,
        borderColor: Colors.secondary,
    },
    roleChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    activeRoleChipText: {
        color: '#FFF',
    },
    matrixContainer: {
        padding: 16,
    },
    matrixHeader: {
        flexDirection: 'row',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    matrixLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.secondary,
    },
    matrixCenterLabel: {
        flex: 1,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '700',
        color: Colors.secondary,
    },
    matrixRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: Colors.surface,
    },
    screenName: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.text,
    },
    checkboxContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxActive: {
        backgroundColor: Colors.success,
        borderColor: Colors.success,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        maxHeight: '85%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.secondary,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: 8,
        marginTop: 16,
    },
    input: {
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: Colors.text,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    rolePicker: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    roleOption: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.surface,
    },
    roleOptionActive: {
        backgroundColor: Colors.primary + '10',
        borderColor: Colors.primary,
    },
    roleOptionText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    roleOptionTextActive: {
        color: Colors.primary,
    },
    saveButton: {
        backgroundColor: Colors.secondary,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        marginTop: 32,
        marginBottom: 16,
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default UserManagementScreen;
