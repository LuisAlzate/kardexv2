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
    RotateCcw,
    User,
    MapPin,
    Package,
    Info,
    CheckCircle2,
    X,
    ChevronDown,
    Calendar,
    Search,
    Check,
    Tag,
} from 'lucide-react-native';
import { Colors } from '../theme/colors';
import {
    getMovementRepository,
    MovementListItem,
    Collaborator,
    Location,
} from '../database/repositories/MovementRepository';
import { useAuth } from '../context/AuthContext';

/**
 * Propiedades del componente SupplyReturnScreen
 */
interface SupplyReturnScreenProps {
    onBack: () => void;
}

/**
 * Condición del insumo al devolver
 */
type ItemCondition = 'BUENA' | 'MALA';

/**
 * Pantalla de Devolución de Insumos
 *
 * Permite registrar la devolución de cualquier artículo que NO sea
 * categoría HERRAMIENTAS (insumos, equipos, consumibles, etc.).
 *
 * Principios aplicados:
 * - SRP: Se encarga exclusivamente de devoluciones de insumos/equipos.
 * - DRY: Reutiliza el patrón de búsqueda y modal de InventoryReturnScreen.
 * - Documentación para desarrolladores Junior.
 */
const SupplyReturnScreen: React.FC<SupplyReturnScreenProps> = ({ onBack }) => {
    const { user, isOnline } = useAuth();
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);

    // Listas maestras para los filtros
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | undefined>(undefined);
    const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(undefined);

    // Resultados de la búsqueda
    const [assignedItems, setAssignedItems] = useState<MovementListItem[]>([]);

    // Control del modal de devolución
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<MovementListItem | null>(null);
    const [returnQty, setReturnQty] = useState('1');
    const [condition, setCondition] = useState<ItemCondition>('BUENA');
    const [observations, setObservations] = useState('');

    // Control del modal picker (colaborador / ubicación)
    const [modalType, setModalType] = useState<'collaborator' | 'location' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // -------------------------------------------------------------------------
    // CICLO DE VIDA
    // -------------------------------------------------------------------------
    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (selectedCollaboratorId || selectedLocationId) {
            handleSearch();
        } else {
            setAssignedItems([]);
        }
    }, [selectedCollaboratorId, selectedLocationId]);

    // -------------------------------------------------------------------------
    // CARGA DE DATOS
    // -------------------------------------------------------------------------
    /**
     * Carga colaboradores y ubicaciones para los filtros
     */
    const loadInitialData = async () => {
        try {
            const repo = await getMovementRepository(isOnline);
            const [c, l] = await Promise.all([
                repo.getAllCollaborators(),
                repo.getAllLocations(),
            ]);
            setCollaborators(c);
            setLocations(l);
        } catch (error) {
            console.error('Error al cargar datos iniciales:', error);
        }
    };

    /**
     * Busca insumos asignados al colaborador o ubicación seleccionados.
     * Usa categoryType='supplies' para excluir HERRAMIENTAS.
     */
    const handleSearch = async () => {
        setSearching(true);
        try {
            const repo = await getMovementRepository(isOnline);
            const results = await repo.getAssignedToolsByFilter(
                selectedCollaboratorId,
                selectedLocationId,
                'supplies' // Solo insumos/equipos (todo excepto HERRAMIENTAS)
            );
            setAssignedItems(results);
        } catch (error) {
            console.error('Error al buscar insumos asignados:', error);
            Alert.alert('Error', 'No se pudieron cargar los insumos asignados.');
        } finally {
            setSearching(false);
        }
    };

    // -------------------------------------------------------------------------
    // ACCIONES
    // -------------------------------------------------------------------------
    /**
     * Abre el modal de devolución para un insumo específico
     */
    const openReturnModal = (item: MovementListItem) => {
        if (Number(item.balance) <= 0) {
            Alert.alert('Información', 'Este insumo ya no tiene cantidades pendientes por devolver.');
            handleSearch();
            return;
        }
        setSelectedItem(item);
        setReturnQty('1');
        setCondition('BUENA');
        setObservations('');
        setShowReturnModal(true);
    };

    /**
     * Procesa la devolución del insumo registrando un movimiento DEVOLUCION
     */
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
                trabajador_id: selectedItem.trabajador_id,
                ubicacion_id: selectedItem.ubicacion_id,
                tipo_movimiento: 'DEVOLUCION' as const,
                cantidad: qty,
                estado_insumo: condition,
                observaciones: `Devolución de INSUMO a BODEGA. Estado: ${condition}. ${observations}. (Resp: ${selectedItem.collaborator_nombre || 'N/A'})`,
                usuario_sistema_id: user?.id || '00000000-0000-0000-0000-000000000001',
                fecha: new Date().toISOString(),
            };

            await repo.registerMovement(movement);

            setShowReturnModal(false);
            setAssignedItems([]);
            Alert.alert('Éxito', 'Devolución de insumo registrada correctamente.');
            handleSearch();
        } catch (error) {
            console.error('Error al procesar devolución de insumo:', error);
            Alert.alert('Error', 'No se pudo procesar la devolución.');
        } finally {
            setLoading(false);
        }
    };

    // -------------------------------------------------------------------------
    // UTILIDADES
    // -------------------------------------------------------------------------
    const generateUUID = () =>
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });

    /**
     * Filtra colaboradores o ubicaciones según el texto de búsqueda del picker
     */
    const getFilteredPickerData = () => {
        const query = searchQuery.toLowerCase().trim();
        if (modalType === 'collaborator') {
            return collaborators.filter(
                c => c.nombre.toLowerCase().includes(query) || c.cedula.includes(query)
            );
        }
        if (modalType === 'location') {
            return locations.filter(l => l.nombre_obra.toLowerCase().includes(query));
        }
        return [];
    };

    // -------------------------------------------------------------------------
    // RENDERIZADO DE COMPONENTES
    // -------------------------------------------------------------------------
    /**
     * Ítem del picker de colaborador/ubicación
     */
    const renderPickerItem = ({ item }: { item: any }) => {
        const isSelected =
            modalType === 'collaborator'
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
                    <Text style={[styles.pickerItemTitle, isSelected && styles.pickerItemTextActive]}>
                        {title}
                    </Text>
                    <Text style={styles.pickerItemSubtitle}>{subtitle}</Text>
                </View>
                {isSelected && <Check size={20} color={Colors.primary} />}
            </TouchableOpacity>
        );
    };

    /**
     * Tarjeta de insumo asignado
     */
    const renderItem = ({ item }: { item: MovementListItem }) => (
        <TouchableOpacity style={styles.itemCard} onPress={() => openReturnModal(item)}>
            <View style={styles.cardHeader}>
                <View style={styles.itemIcon}>
                    <Package size={20} color="#8b5cf6" />
                </View>
                <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.tool_nombre}</Text>
                    <Text style={styles.itemCode}>
                        {item.tool_codigo}
                        {item.tool_serial ? ` • SN: ${item.tool_serial}` : ''}
                    </Text>
                    {item.tool_categoria_codigo && (
                        <View style={styles.categoryBadge}>
                            <Tag size={10} color="#8b5cf6" />
                            <Text style={styles.categoryBadgeText}>{item.tool_categoria_codigo}</Text>
                        </View>
                    )}
                    <Text style={styles.stockBadge}>Cant. Asignada: {item.balance}</Text>
                </View>
                <View style={[styles.typeBadge, { backgroundColor: '#8b5cf615' }]}>
                    <Text style={[styles.typeBadgeText, { color: '#8b5cf6' }]}>EN USO</Text>
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
                    <Text style={styles.footerText}>
                        {item.fecha
                            ? new Date(item.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
                            : '-'}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    // -------------------------------------------------------------------------
    // JSX PRINCIPAL
    // -------------------------------------------------------------------------
    return (
        <View style={styles.container}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.secondary} />
                </TouchableOpacity>
                <View style={styles.headerTitles}>
                    <Text style={styles.headerTitle}>Devolución de Insumos</Text>
                    <Text style={styles.headerSubtitle}>Insumos, Equipos y Consumibles</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            {/* ── Filtros ── */}
            <View style={styles.filterSection}>
                <Text style={styles.filterTitle}>Filtrar por Responsable o Ubicación</Text>

                <View style={styles.pickerRow}>
                    {/* Selector de Colaborador */}
                    <View style={styles.pickerContainer}>
                        <User size={16} color="#8b5cf6" style={styles.pickerIcon} />
                        {Platform.OS === 'web' ? (
                            <select
                                style={styles.webSelect as any}
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
                                    {selectedCollaboratorId
                                        ? collaborators.find(c => c.id === selectedCollaboratorId)?.nombre
                                        : 'Colaborador...'}
                                </Text>
                                <ChevronDown size={16} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Selector de Ubicación */}
                    <View style={styles.pickerContainer}>
                        <MapPin size={16} color="#8b5cf6" style={styles.pickerIcon} />
                        {Platform.OS === 'web' ? (
                            <select
                                style={styles.webSelect as any}
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
                                    {selectedLocationId
                                        ? locations.find(l => l.id === selectedLocationId)?.nombre_obra
                                        : 'Ubicación...'}
                                </Text>
                                <ChevronDown size={16} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Botón limpiar filtros */}
                {(selectedCollaboratorId || selectedLocationId) && (
                    <TouchableOpacity
                        style={styles.clearButton}
                        onPress={() => {
                            setSelectedCollaboratorId(undefined);
                            setSelectedLocationId(undefined);
                            setAssignedItems([]);
                        }}
                    >
                        <X size={14} color={Colors.error} />
                        <Text style={styles.clearButtonText}>Limpiar filtros</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Contenido principal ── */}
            {searching ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#8b5cf6" />
                    <Text style={styles.loadingText}>Buscando insumos asignados...</Text>
                </View>
            ) : !selectedCollaboratorId && !selectedLocationId ? (
                <View style={styles.emptyContainer}>
                    <Info size={52} color="#8b5cf6" style={{ opacity: 0.4 }} />
                    <Text style={styles.emptyTitle}>Selecciona un filtro</Text>
                    <Text style={styles.emptySubtitle}>
                        Elige un colaborador o una ubicación para ver los insumos asignados pendientes de devolución.
                    </Text>
                </View>
            ) : assignedItems.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <CheckCircle2 size={52} color={Colors.success} style={{ opacity: 0.6 }} />
                    <Text style={styles.emptyTitle}>Sin insumos pendientes</Text>
                    <Text style={styles.emptySubtitle}>
                        No hay insumos ni equipos asignados con balance pendiente para este filtro.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={assignedItems}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                />
            )}

            {/* ── Modal Picker (Colaborador / Ubicación) ── */}
            <Modal visible={modalType !== null} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.pickerModal}>
                        <View style={styles.pickerModalHeader}>
                            <Text style={styles.pickerModalTitle}>
                                {modalType === 'collaborator' ? 'Seleccionar Colaborador' : 'Seleccionar Ubicación'}
                            </Text>
                            <TouchableOpacity onPress={() => { setModalType(null); setSearchQuery(''); }}>
                                <X size={22} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.searchBar}>
                            <Search size={16} color={Colors.textSecondary} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Buscar..."
                                placeholderTextColor={Colors.textSecondary}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoFocus
                            />
                        </View>
                        <FlatList
                            data={getFilteredPickerData()}
                            keyExtractor={item => item.id}
                            renderItem={renderPickerItem}
                            style={{ maxHeight: 300 }}
                        />
                    </View>
                </View>
            </Modal>

            {/* ── Modal Devolución de Insumo ── */}
            <Modal visible={showReturnModal} transparent animationType="slide">
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={styles.returnModal}>
                        {/* Header del modal */}
                        <View style={styles.returnModalHeader}>
                            <View style={styles.returnModalTitleRow}>
                                <RotateCcw size={20} color="#8b5cf6" />
                                <Text style={styles.returnModalTitle}>Devolver Insumo</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowReturnModal(false)}>
                                <X size={22} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Detalle del artículo */}
                            {selectedItem && (
                                <View style={styles.selectedItemInfo}>
                                    <Text style={styles.selectedItemName}>{selectedItem.tool_nombre}</Text>
                                    <Text style={styles.selectedItemCode}>
                                        Ref: {selectedItem.tool_codigo}
                                        {selectedItem.tool_serial ? ` | SN: ${selectedItem.tool_serial}` : ''}
                                    </Text>
                                    <Text style={styles.selectedItemBalance}>
                                        Cantidad máxima a devolver: <Text style={{ fontWeight: 'bold', color: '#8b5cf6' }}>{selectedItem.balance}</Text>
                                    </Text>
                                </View>
                            )}

                            {/* Cantidad */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Cantidad a Devolver *</Text>
                                <TextInput
                                    style={styles.input}
                                    keyboardType="numeric"
                                    value={returnQty}
                                    onChangeText={setReturnQty}
                                    placeholder="1"
                                    placeholderTextColor={Colors.textSecondary}
                                />
                            </View>

                            {/* Estado del insumo */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Estado al Devolver</Text>
                                <View style={styles.conditionRow}>
                                    {(['BUENA', 'MALA'] as ItemCondition[]).map(c => (
                                        <TouchableOpacity
                                            key={c}
                                            style={[
                                                styles.conditionButton,
                                                condition === c && styles.conditionButtonActive,
                                                c === 'MALA' && condition === c && styles.conditionButtonMala,
                                            ]}
                                            onPress={() => setCondition(c)}
                                        >
                                            <Text style={[
                                                styles.conditionButtonText,
                                                condition === c && styles.conditionButtonTextActive,
                                            ]}>
                                                {c === 'BUENA' ? '✓ Buena Condición' : '⚠ Mal Estado'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Observaciones */}
                            <View style={styles.formGroup}>
                                <Text style={styles.formLabel}>Observaciones (Opcional)</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    multiline
                                    numberOfLines={3}
                                    value={observations}
                                    onChangeText={setObservations}
                                    placeholder="Ej: Insumo utilizado parcialmente, requiere revisión..."
                                    placeholderTextColor={Colors.textSecondary}
                                />
                            </View>
                        </ScrollView>

                        {/* Acciones del modal */}
                        <View style={styles.returnModalActions}>
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => setShowReturnModal(false)}
                                disabled={loading}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.confirmButton}
                                onPress={handleProcessReturn}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <RotateCcw size={16} color="#fff" />
                                        <Text style={styles.confirmButtonText}>Confirmar Devolución</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

export default SupplyReturnScreen;

// =============================================================================
// ESTILOS
// =============================================================================
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 45 : 20,
        paddingBottom: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
    },
    backButton: {
        padding: 8,
        borderRadius: 10,
        backgroundColor: '#f5f5f5',
        marginRight: 10,
    },
    headerTitles: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.secondary,
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#8b5cf6',
        marginTop: 2,
        fontWeight: '500',
    },
    filterSection: {
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    filterTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: 12,
        textTransform: 'uppercase',
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
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#f8f9fa',
        gap: 8,
    },
    pickerIcon: {},
    nativePickerPlaceholder: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    pickerText: {
        flex: 1,
        fontSize: 13,
        color: Colors.text,
    },
    webSelect: {
        flex: 1,
        borderWidth: 0,
        backgroundColor: 'transparent',
        fontSize: 13,
        color: '#1e293b',
    } as any,
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
        alignSelf: 'flex-start',
    },
    clearButtonText: {
        fontSize: 12,
        color: Colors.error,
        fontWeight: '600',
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 12,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.secondary,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    listContent: {
        padding: 16,
        gap: 12,
    },
    itemCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#ede9fe',
        elevation: 2,
        shadowColor: '#8b5cf6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    itemIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#f5f3ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemInfo: {
        flex: 1,
        gap: 3,
    },
    itemName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: Colors.secondary,
    },
    itemCode: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#f5f3ff',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginTop: 2,
    },
    categoryBadgeText: {
        fontSize: 10,
        color: '#8b5cf6',
        fontWeight: '700',
    },
    stockBadge: {
        fontSize: 12,
        color: '#8b5cf6',
        fontWeight: '600',
        marginTop: 2,
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    typeBadgeText: {
        fontSize: 10,
        fontWeight: '700',
    },
    cardDivider: {
        height: 1,
        backgroundColor: '#f1f5f9',
        marginVertical: 10,
    },
    cardFooter: {
        flexDirection: 'row',
        gap: 16,
        flexWrap: 'wrap',
    },
    footerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    footerText: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    // ── Modales ──
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    pickerModal: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 20,
        width: '100%',
        maxWidth: 480,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
    },
    pickerModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    pickerModalTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.secondary,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 10,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: Colors.text,
        padding: 0,
    },
    pickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 10,
        marginBottom: 4,
    },
    pickerItemActive: {
        backgroundColor: '#f5f3ff',
    },
    pickerItemTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.secondary,
    },
    pickerItemTextActive: {
        color: '#8b5cf6',
    },
    pickerItemSubtitle: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    // ── Modal Devolución ──
    returnModal: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 22,
        width: '100%',
        maxWidth: 500,
        maxHeight: '90%',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
    },
    returnModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    returnModalTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    returnModalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.secondary,
    },
    selectedItemInfo: {
        backgroundColor: '#f5f3ff',
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#ede9fe',
    },
    selectedItemName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: Colors.secondary,
        marginBottom: 4,
    },
    selectedItemCode: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginBottom: 6,
    },
    selectedItemBalance: {
        fontSize: 13,
        color: Colors.secondary,
    },
    formGroup: {
        marginBottom: 16,
    },
    formLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.secondary,
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        color: Colors.text,
    },
    textArea: {
        minHeight: 70,
        textAlignVertical: 'top',
    },
    conditionRow: {
        flexDirection: 'row',
        gap: 10,
    },
    conditionButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8f9fa',
        alignItems: 'center',
    },
    conditionButtonActive: {
        borderColor: '#8b5cf6',
        backgroundColor: '#f5f3ff',
    },
    conditionButtonMala: {
        borderColor: Colors.error,
        backgroundColor: '#fff1f2',
    },
    conditionButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    conditionButtonTextActive: {
        color: '#8b5cf6',
    },
    returnModalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    confirmButton: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#8b5cf6',
        gap: 8,
    },
    confirmButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
    },
});
