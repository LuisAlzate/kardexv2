import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    SafeAreaView,
    TextInput,
    Alert,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { ArrowLeft, Users, Plus, Save, X, User } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { getMovementRepository, Collaborator } from '../database/repositories/MovementRepository';
import * as SQLite from 'expo-sqlite';
import { useAuth } from '../context/AuthContext';
import { generateUUID } from '../lib/uuid';

interface CollaboratorScreenProps {
    onBack: () => void;
}

const CollaboratorScreen: React.FC<CollaboratorScreenProps> = ({ onBack }) => {
    const [loading, setLoading] = useState(true);
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Form state
    const [cedula, setCedula] = useState('');
    const [nombre, setNombre] = useState('');
    const [cargo, setCargo] = useState('');
    const [saving, setSaving] = useState(false);
    const { isOnline } = useAuth();

    useEffect(() => {
        loadCollaborators();
    }, []);

    const loadCollaborators = async () => {
        setLoading(true);
        try {
            const repo = await getMovementRepository(isOnline);
            const data = await repo.getAllCollaborators();
            setCollaborators(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!cedula || !nombre || !cargo) {
            Alert.alert('Error', 'Todos los campos son obligatorios');
            return;
        }

        setSaving(true);
        try {
            const repo = await getMovementRepository(isOnline);

            await repo.createCollaborator({
                id: generateUUID(),
                cedula,
                nombre,
                cargo,
            });

            Alert.alert('Éxito', 'Colaborador registrado correctamente');
            setIsModalVisible(false);
            setCedula('');
            setNombre('');
            setCargo('');
            loadCollaborators();
        } catch (error: any) {
            Alert.alert('Error', 'No se pudo registrar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const renderItem = ({ item }: { item: Collaborator }) => (
        <View style={styles.card}>
            <View style={styles.cardContent}>
                <User size={32} color={Colors.primary} style={styles.avatar} />
                <View style={styles.infoSection}>
                    <Text style={styles.name}>{item.nombre}</Text>
                    <Text style={styles.detail}>C.C: {item.cedula}</Text>
                    <Text style={styles.detail}>Cargo: {item.cargo}</Text>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.secondary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Colaboradores</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={collaborators}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Users size={64} color={Colors.border} />
                            <Text style={styles.emptyText}>No hay colaboradores registrados</Text>
                        </View>
                    }
                />
            )}

            <TouchableOpacity
                style={styles.fab}
                onPress={() => setIsModalVisible(true)}
            >
                <Plus size={30} color="#FFF" />
            </TouchableOpacity>

            <Modal
                visible={isModalVisible}
                animationType="slide"
                transparent={true}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Nuevo Colaborador</Text>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                                <X size={24} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            enabled={Platform.OS !== 'web'}
                        >
                            <View style={styles.form}>
                                <Text style={styles.label}>Cédula / ID *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={cedula}
                                    onChangeText={setCedula}
                                    placeholder="Ej. 12345678"
                                    keyboardType="numeric"
                                />

                                <Text style={styles.label}>Nombre Completo *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={nombre}
                                    onChangeText={setNombre}
                                    placeholder="Ej. Juan Pérez"
                                />

                                <Text style={styles.label}>Cargo *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={cargo}
                                    onChangeText={setCargo}
                                    placeholder="Ej. Oficial de obra"
                                />

                                <TouchableOpacity
                                    style={styles.saveButton}
                                    onPress={handleSave}
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <>
                                            <Save size={20} color="#FFF" style={{ marginRight: 8 }} />
                                            <Text style={styles.saveButtonText}>Guardar</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
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
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.secondary,
    },
    backButton: {
        padding: 8,
    },
    listContent: {
        padding: 20,
        paddingBottom: 100,
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        marginBottom: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        marginRight: 16,
        opacity: 0.8,
    },
    infoSection: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.secondary,
        marginBottom: 2,
    },
    detail: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 100,
    },
    emptyText: {
        marginTop: 16,
        color: Colors.textSecondary,
        fontSize: 16,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        minHeight: '60%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.secondary,
    },
    form: {
        marginTop: 8,
    },
    label: {
        fontSize: 14,
        color: Colors.text,
        marginBottom: 8,
        fontWeight: '500',
    },
    input: {
        backgroundColor: Colors.surface,
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 50,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 20,
        fontSize: 16,
    },
    saveButton: {
        backgroundColor: Colors.primary,
        borderRadius: 12,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '600',
    },
});

export default CollaboratorScreen;
