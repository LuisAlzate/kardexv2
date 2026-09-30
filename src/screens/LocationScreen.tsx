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
import { ArrowLeft, MapPin, Plus, Save, X } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { getMovementRepository, Location } from '../database/repositories/MovementRepository';
import * as SQLite from 'expo-sqlite';
import { useAuth } from '../context/AuthContext';
import { generateUUID } from '../lib/uuid';

interface LocationScreenProps {
    onBack: () => void;
}

const LocationScreen: React.FC<LocationScreenProps> = ({ onBack }) => {
    const [loading, setLoading] = useState(true);
    const [locations, setLocations] = useState<Location[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Form state
    const [nombreObra, setNombreObra] = useState('');
    const [estado, setEstado] = useState('Activo');
    const [saving, setSaving] = useState(false);
    const { isOnline } = useAuth();

    useEffect(() => {
        loadLocations();
    }, []);

    const loadLocations = async () => {
        setLoading(true);
        try {
            const repo = await getMovementRepository(isOnline);
            const data = await repo.getAllLocations();
            setLocations(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!nombreObra) {
            Alert.alert('Error', 'El nombre de la obra es obligatorio');
            return;
        }

        setSaving(true);
        try {
            const repo = await getMovementRepository(isOnline);

            await repo.createLocation({
                id: generateUUID(),
                nombre_obra: nombreObra,
                estado: estado,
            });

            Alert.alert('Éxito', 'Ubicación registrada correctamente');
            setIsModalVisible(false);
            setNombreObra('');
            setEstado('Activo');
            loadLocations();
        } catch (error: any) {
            Alert.alert('Error', 'No se pudo registrar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const renderItem = ({ item }: { item: Location }) => (
        <View style={styles.card}>
            <View style={styles.cardContent}>
                <View style={styles.iconContainer}>
                    <MapPin size={24} color={Colors.primary} />
                </View>
                <View style={styles.infoSection}>
                    <Text style={styles.name}>{item.nombre_obra}</Text>
                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: item.estado === 'Activo' ? Colors.success : Colors.error }]} />
                        <Text style={styles.statusText}>{item.estado}</Text>
                    </View>
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
                <Text style={styles.headerTitle}>Ubicaciones / Obras</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={locations}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MapPin size={64} color={Colors.border} />
                            <Text style={styles.emptyText}>No hay ubicaciones registradas</Text>
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
                            <Text style={styles.modalTitle}>Nueva Ubicación / Obra</Text>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                                <X size={24} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            enabled={Platform.OS !== 'web'}
                        >
                            <View style={styles.form}>
                                <Text style={styles.label}>Nombre de la Obra *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={nombreObra}
                                    onChangeText={setNombreObra}
                                    placeholder="Ej. Edificio Mirador"
                                />

                                <Text style={styles.label}>Estado</Text>
                                <View style={styles.statusPicker}>
                                    {['Activo', 'Cerrado'].map((s) => (
                                        <TouchableOpacity
                                            key={s}
                                            style={[styles.statusOption, estado === s && styles.statusOptionActive]}
                                            onPress={() => setEstado(s)}
                                        >
                                            <Text style={[styles.statusOptionText, estado === s && styles.statusOptionTextActive]}>
                                                {s}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

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
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusText: {
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
        minHeight: '50%',
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
    statusPicker: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    statusOption: {
        flex: 1,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    statusOptionActive: {
        backgroundColor: Colors.primary + '10',
        borderColor: Colors.primary,
    },
    statusOptionText: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    statusOptionTextActive: {
        color: Colors.primary,
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

export default LocationScreen;
