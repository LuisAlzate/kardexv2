import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    ActivityIndicator,
    FlatList,
    Modal,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import {
    ArrowLeft,
    RefreshCw,
    User,
    MapPin,
    Package,
    Info,
    CheckCircle2,
    X,
    ChevronDown,
    Calendar,
    AlertCircle,
    Search,
    Check
} from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { getMovementRepository, MovementListItem, Collaborator, Location } from '../database/repositories/MovementRepository';
import { useAuth } from '../context/AuthContext';
import * as SQLite from 'expo-sqlite';

interface InventoryReturnScreenProps {
    onBack: () => void;
}

type ToolCondition = 'BUENA' | 'MALA' | 'APORREADO';

const InventoryReturnScreen: React.FC<InventoryReturnScreenProps> = ({ onBack }) => {
    const { user, isOnline } = useAuth();
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);

    // Filters
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | undefined>(undefined);
    const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(undefined);

    // Results
    const [assignedTools, setAssignedTools] = useState<MovementListItem[]>([]);

    // Return Modal
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<MovementListItem | null>(null);
    const [returnQty, setReturnQty] = useState('1');
    const [condition, setCondition] = useState<ToolCondition>('BUENA');
    const [observations, setObservations] = useState('');
    const [modalType, setModalType] = useState<'collaborator' | 'location' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (selectedCollaboratorId || selectedLocationId) {
            handleSearch();
        } else {
            setAssignedTools([]);
        }
    }, [selectedCollaboratorId, selectedLocationId]);

    const loadInitialData = async () => {
        try {
            const repo = await getMovementRepository(isOnline);
            const [c, l] = await Promise.all([
                repo.getAllCollaborators(),
                repo.getAllLocations()
            ]);
            setCollaborators(c);
            setLocations(l);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSearch = async () => {
        setSearching(true);
        try {
            const repo = await getMovementRepository(isOnline);
            // Solo mostramos artículos de categoría HERRAMIENTAS en este módulo
            const results = await repo.getAssignedToolsByFilter(
                selectedCollaboratorId,
                selectedLocationId,
                'tools'
            );
            setAssignedTools(results);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Error al buscar herramientas asignadas');
        } finally {
            setSearching(false);
        }
    };

    const openReturnModal = (item: MovementListItem) => {
        if (Number(item.balance) <= 0) {
            Alert.alert('Información', 'Esta herramienta ya no tiene cantidades pendientes por devolver.');
            handleSearch(); // Auto-refresh to fix the list
            return;
        }
        setSelectedItem(item);
        setReturnQty('1');
        setCondition('BUENA');
        setObservations('');
        setShowReturnModal(true);
    };

    const handleProcessReturn = async () => {
        if (!selectedItem) return;

        const qty = parseInt(returnQty);
        const currentQty = Number(selectedItem.balance);

        if (isNaN(qty) || qty <= 0 || qty > currentQty) {
            Alert.alert('Error', `Cantidad inválida. Máximo disponible: ${currentQty}`);
            return;
        }

        setLoading(true);
        try {
            const repo = await getMovementRepository(isOnline);
            const bodegaId = await repo.getBodegaId();

            const movement = {
                id: generateUUID(),
                herramienta_id: selectedItem.herramienta_id,
                trabajador_id: selectedItem.trabajador_id, // Identify WHO is returning it to credit their balance
                ubicacion_id: selectedItem.ubicacion_id, // Identify WHERE it's coming from
                tipo_movimiento: 'DEVOLUCION' as const,
                cantidad: qty,
                estado_insumo: (condition === 'BUENA' ? 'BUENA' : 'MALA') as any, // Repository uses BUENA/MALA, we store details in obs
                observaciones: `Devolución de HERRAMIENTA a BODEGA. Estado: ${condition}. ${observations}. (Resp: ${selectedItem.collaborator_nombre || 'N/A'})`,
                usuario_sistema_id: user?.id || '00000000-0000-0000-0000-000000000001',
                fecha: new Date().toISOString()
            };

            await repo.registerMovement(movement);

            setShowReturnModal(false);
            setAssignedTools([]); // Clear stale data
            Alert.alert('Éxito', 'Devolución registrada correctamente');
            handleSearch(); // Fetch fresh balances
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo procesar la devolución');
        } finally {
            setLoading(false);
        }
    };

    const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    const getFilteredData = () => {
        const query = searchQuery.toLowerCase().trim();
        if (modalType === 'collaborator') {
            return collaborators.filter(c =>
                c.nombre.toLowerCase().includes(query) ||
                c.cedula.includes(query)
            );
        }
        if (modalType === 'location') {
            return locations.filter(l =>
                l.nombre_obra.toLowerCase().includes(query)
            );
        }
        return [];
    };

    const renderPickerItem = ({ item }: { item: any }) => {
        const isSelected = modalType === 'collaborator'
            ? selectedCollaboratorId === item.id
            : selectedLocationId === item.id;

        const title = modalType === 'collaborator' ? item.nombre : item.nombre_obra;
        const subtitle = modalType === 'collaborator' ? item.cargo : item.estado;

        return (
            <TouchableOpacity
                style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                onPress={() => {
                    if (modalType === 'collaborator') setSelectedCollaboratorId(item.id);
                    else setSelectedLocationId(item.id);
                    setModalType(null);
                    setSearchQuery('');
                }}
            >
                <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerItemTitle, isSelected && styles.pickerItemTextActive]}>{title}</Text>
                    <Text style={styles.pickerItemSubtitle}>{subtitle}</Text>
                </View>
                {isSelected && <Check size={20} color={Colors.primary} />}
            </TouchableOpacity>
        );
    };

    const renderItem = ({ item }: { item: MovementListItem }) => (
        <TouchableOpacity style={styles.toolCard} onPress={() => openReturnModal(item)}>
            <View style={styles.cardHeader}>
                <View style={styles.toolIcon}>
                    <Package size={20} color={Colors.primary} />
                </View>
                <View style={styles.toolInfo}>
                    <Text style={styles.toolName}>{item.tool_nombre}</Text>
                    <Text style={styles.toolCode}>{item.tool_codigo} {item.tool_serial ? `• SN: ${item.tool_serial}` : ''}</Text>
                    <Text style={styles.stockBadge}>Cant. Asignada: {item.balance}</Text>
                </View>
                <View style={[styles.typeBadge, { backgroundColor: Colors.success + '15' }]}>
                    <Text style={[styles.typeBadgeText, { color: Colors.success }]}>EN POSESIÓN</Text>
                </View>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.cardFooter}>
                <View style={styles.footerItem}>
                    <User size={12} color={Colors.textSecondary} />
                    <Text style={styles.footerText}>{item.collaborator_nombre || 'Sin Resp.'}</Text>
                </View>
                <View style={styles.footerItem}>
                    <MapPin size={12} color={Colors.textSecondary} />
                    <Text style={styles.footerText}>{item.location_nombre || 'Sin Ubic.'}</Text>
                </View>
                <View style={styles.footerItem}>
                    <Calendar size={12} color={Colors.textSecondary} />
                    <Text style={styles.footerText}>{new Date(item.fecha!).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.secondary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Devolución de Herramienta</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.filterSection}>
                <Text style={styles.filterTitle}>Filtrar por Responsable o Obra</Text>

                <View style={styles.pickerRow}>
                    <View style={styles.pickerContainer}>
                        <User size={16} color={Colors.primary} style={styles.pickerIcon} />
                        {Platform.OS === 'web' ? (
                            <select
                                style={styles.webSelect}
                                value={selectedCollaboratorId || ''}
                                onChange={(e) => setSelectedCollaboratorId(e.target.value || undefined)}
                            >
                                <option value="">Todos los Colaboradores</option>
                                {collaborators.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                ))}
                            </select>
                        ) : (
                            <TouchableOpacity
                                style={styles.nativePickerPlaceholder}
                                onPress={() => setModalType('collaborator')}
                            >
                                <Text style={styles.pickerText}>
                                    {selectedCollaboratorId ? collaborators.find(c => c.id === selectedCollaboratorId)?.nombre : 'Colaborador...'}
                                </Text>
                                <ChevronDown size={16} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.pickerContainer}>
                        <MapPin size={16} color={Colors.primary} style={styles.pickerIcon} />
                        {Platform.OS === 'web' ? (
                            <select
                                style={styles.webSelect}
                                value={selectedLocationId || ''}
                                onChange={(e) => setSelectedLocationId(e.target.value || undefined)}
                            >
                                <option value="">Todas las Ubicaciones</option>
                                {locations.map(l => (
                                    <option key={l.id} value={l.id}>{l.nombre_obra}</option>
                                ))}
                            </select>
                        ) : (
                            <TouchableOpacity
                                style={styles.nativePickerPlaceholder}
                                onPress={() => setModalType('location')}
                            >
                                <Text style={styles.pickerText}>
                                    {selectedLocationId ? locations.find(l => l.id === selectedLocationId)?.nombre_obra : 'Ubicación...'}
                                </Text>
                                <ChevronDown size={16} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {(selectedCollaboratorId || selectedLocationId) && (
                    <TouchableOpacity
                        style={styles.clearFilters}
                        onPress={() => {
                            setSelectedCollaboratorId(undefined);
                            setSelectedLocationId(undefined);
                        }}
                    >
                        <Text style={styles.clearFiltersText}>Limpiar Filtros</Text>
                    </TouchableOpacity>
                )}
            </View>

            {searching ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : assignedTools.length > 0 ? (
                <FlatList
                    data={assignedTools}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContainer}
                />
            ) : (
                <View style={styles.centerContainer}>
                    <RefreshCw size={48} color={Colors.border} style={{ marginBottom: 16 }} />
                    <Text style={styles.emptyText}>
                        {(!selectedCollaboratorId && !selectedLocationId)
                            ? "Selecciona un colaborador o ubicación para ver qué herramientas tienen asignadas."
                            : "No se encontraron herramientas asignadas para este filtro."}
                    </Text>
                </View>
            )}

            {/* Return Details Modal */}
            <Modal
                visible={showReturnModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowReturnModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Registrar Devolución</Text>
                                <Text style={styles.modalSubtitle}>{selectedItem?.tool_nombre}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowReturnModal(false)} style={styles.modalClose}>
                                <X size={24} color={Colors.secondary} />
                            </TouchableOpacity>
                        </View>

                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            enabled={Platform.OS !== 'web'}
                        >
                            <ScrollView style={styles.modalBody}>
                                <View style={styles.modalSection}>
                                <Text style={styles.modalLabel}>Cantidad a Devolver</Text>
                                <View style={[styles.modalInputBox, selectedItem?.tool_serial && styles.disabledInput]}>
                                    <TextInput
                                        style={styles.modalInput}
                                        value={returnQty}
                                        onChangeText={setReturnQty}
                                        keyboardType="numeric"
                                        editable={!selectedItem?.tool_serial}
                                    />
                                    {selectedItem?.tool_serial && <Info size={16} color={Colors.textSecondary} />}
                                </View>
                                {selectedItem?.tool_serial && (
                                    <Text style={styles.inputHint}>Herramienta seriada se devuelve por unidad.</Text>
                                )}
                            </View>

                            <View style={styles.modalSection}>
                                <Text style={styles.modalLabel}>Estado Físico</Text>
                                <View style={styles.conditionRow}>
                                    {(['BUENA', 'MALA', 'APORREADO'] as ToolCondition[]).map((c) => (
                                        <TouchableOpacity
                                            key={c}
                                            style={[
                                                styles.conditionBtn,
                                                condition === c && styles.conditionBtnActive,
                                                condition === c && { backgroundColor: c === 'MALA' ? Colors.error : c === 'APORREADO' ? '#F59E0B' : Colors.success }
                                            ]}
                                            onPress={() => setCondition(c)}
                                        >
                                            <Text style={[styles.conditionBtnText, condition === c && styles.conditionBtnTextActive]}>
                                                {c === 'BUENA' ? 'Excelente' : c === 'MALA' ? 'Dañada' : 'Aporreada'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.modalSection}>
                                <Text style={styles.modalLabel}>Observaciones</Text>
                                <TextInput
                                    style={[styles.modalInput, styles.modalTextArea]}
                                    value={observations}
                                    onChangeText={setObservations}
                                    placeholder="Nota sobre el estado de entrega..."
                                    multiline
                                    numberOfLines={4}
                                />
                            </View>
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.processBtn}
                            onPress={handleProcessReturn}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <>
                                    <CheckCircle2 size={20} color="#FFF" style={{ marginRight: 8 }} />
                                    <Text style={styles.processBtnText}>Confirmar Devolución</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        </KeyboardAvoidingView>
                    </View>
                </View>
            </Modal>

            {/* Selection Modal (Collaborator/Location) */}
            <Modal
                visible={!!modalType}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setModalType(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {modalType === 'collaborator' ? 'Seleccionar Colaborador' : 'Seleccionar Ubicación'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalType(null)} style={styles.modalClose}>
                                <X size={24} color={Colors.secondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchContainer}>
                            <Search size={20} color={Colors.textSecondary} style={{ marginRight: 10 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Buscar..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCorrect={false}
                            />
                        </View>

                        <FlatList
                            data={getFilteredData()}
                            keyExtractor={(item) => item.id}
                            renderItem={renderPickerItem}
                            contentContainerStyle={{ paddingBottom: 40 }}
                            ListEmptyComponent={
                                <View style={styles.centerContainer}>
                                    <Text style={styles.emptyText}>No se encontraron resultados</Text>
                                </View>
                            }
                        />
                    </View>
                </View>
            </Modal>
        </View>
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
    filterSection: {
        backgroundColor: '#FFF',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    filterTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        marginBottom: 12,
        letterSpacing: 0.5,
    },
    pickerRow: {
        flexDirection: 'row',
        gap: 10,
    },
    pickerContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: 10,
        height: 48,
    },
    pickerIcon: {
        marginRight: 8,
    },
    webSelect: {
        flex: 1,
        height: '100%',
        backgroundColor: 'transparent',
        borderWidth: 0,
        fontSize: 14,
        color: Colors.secondary,
    },
    nativePickerPlaceholder: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pickerText: {
        fontSize: 14,
        color: Colors.secondary,
    },
    clearFilters: {
        marginTop: 12,
        alignSelf: 'flex-start',
    },
    clearFiltersText: {
        color: Colors.primary,
        fontSize: 13,
        fontWeight: '600',
    },
    listContainer: {
        padding: 20,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 15,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    toolCard: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    toolIcon: {
        width: 42,
        height: 42,
        borderRadius: 14,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    toolInfo: {
        flex: 1,
    },
    toolName: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.secondary,
    },
    toolCode: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    stockBadge: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.primary,
        marginTop: 4,
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    typeBadgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    cardDivider: {
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: 12,
    },
    cardFooter: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 15,
    },
    footerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    footerText: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    // Modal Styles
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
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: Colors.secondary,
    },
    modalSubtitle: {
        fontSize: 14,
        color: Colors.primary,
        marginTop: 2,
        fontWeight: '600',
    },
    modalClose: {
        backgroundColor: Colors.surface,
        padding: 8,
        borderRadius: 12,
    },
    modalBody: {
        marginBottom: 24,
    },
    modalSection: {
        marginBottom: 20,
    },
    modalLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.secondary,
        marginBottom: 10,
    },
    modalInputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 48,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    disabledInput: {
        backgroundColor: '#F1F5F9',
        borderColor: '#E2E8F0',
    },
    modalInput: {
        flex: 1,
        fontSize: 16,
        color: Colors.text,
    },
    inputHint: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 6,
        fontStyle: 'italic',
    },
    conditionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    conditionBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        alignItems: 'center',
    },
    conditionBtnActive: {
        borderColor: 'transparent',
    },
    conditionBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.secondary,
    },
    conditionBtnTextActive: {
        color: '#FFF',
    },
    modalTextArea: {
        height: 100,
        textAlignVertical: 'top',
        paddingTop: 12,
    },
    processBtn: {
        backgroundColor: Colors.primary,
        borderRadius: 16,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
        marginBottom: Platform.OS === 'ios' ? 20 : 0,
    },
    processBtnText: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '700',
    },
    // Picker Modal Styles
    pickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    pickerItemActive: {
        backgroundColor: Colors.primary + '10',
        borderColor: Colors.primary,
    },
    pickerItemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.secondary,
    },
    pickerItemTextActive: {
        color: Colors.primary,
    },
    pickerItemSubtitle: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 48,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: Colors.text,
    },
});

export default InventoryReturnScreen;
