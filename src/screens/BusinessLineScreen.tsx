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
import { ArrowLeft, Briefcase, Plus, Save, X } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { getMovementRepository, BusinessLine } from '../database/repositories/MovementRepository';
import * as SQLite from 'expo-sqlite';
import { useAuth } from '../context/AuthContext';
import { generateUUID } from '../lib/uuid';

interface BusinessLineScreenProps {
    onBack: () => void;
}

const BusinessLineScreen: React.FC<BusinessLineScreenProps> = ({ onBack }) => {
    const [loading, setLoading] = useState(true);
    const [businessLines, setBusinessLines] = useState<BusinessLine[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Form state
    const [codigo, setCodigo] = useState('');
    const [nombre, setNombre] = useState('');
    const [saving, setSaving] = useState(false);
    const { isOnline } = useAuth();

    useEffect(() => {
        loadBusinessLines();
    }, []);

    const loadBusinessLines = async () => {
        setLoading(true);
        try {
            const repo = await getMovementRepository(isOnline);
            const data = await repo.getAllBusinessLines();
            setBusinessLines(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!codigo || !nombre) {
            Alert.alert('Error', 'Todos los campos son obligatorios');
            return;
        }

        setSaving(true);
        try {
            const repo = await getMovementRepository(isOnline);

            await repo.createBusinessLine({
                id: generateUUID(),
                codigo: codigo.toUpperCase(),
                nombre: nombre.toUpperCase(),
            });

            Alert.alert('Éxito', 'Línea de negocio registrada correctamente');
            setIsModalVisible(false);
            setCodigo('');
            setNombre('');
            loadBusinessLines();
        } catch (error: any) {
            Alert.alert('Error', 'No se pudo registrar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const renderItem = ({ item }: { item: BusinessLine }) => (
        <View style={styles.card}>
            <View style={styles.cardContent}>
                <View style={styles.iconContainer}>
                    <Briefcase size={24} color={Colors.primary} />
                </View>
                <View style={styles.infoSection}>
                    <Text style={styles.name}>{item.nombre}</Text>
                    <Text style={styles.code}>Cód: {item.codigo}</Text>
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
                <Text style={styles.headerTitle}>Líneas de Negocio</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={businessLines}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Briefcase size={64} color={Colors.border} />
                            <Text style={styles.emptyText}>No hay líneas de negocio registradas</Text>
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
                            <Text style={styles.modalTitle}>Nueva Línea de Negocio</Text>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                                <X size={24} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            enabled={Platform.OS !== 'web'}
                        >
                            <View style={styles.form}>
                                <Text style={styles.label}>Código *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={codigo}
                                    onChangeText={setCodigo}
                                    placeholder="Ej. LN001"
                                    autoCapitalize="characters"
                                />

                                <Text style={styles.label}>Nombre *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={nombre}
                                    onChangeText={setNombre}
                                    placeholder="Ej. Construcción Civil"
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
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    infoSection: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.secondary,
        marginBottom: 4,
    },
    code: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '500',
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
        minHeight: '40%',
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

export default BusinessLineScreen;
