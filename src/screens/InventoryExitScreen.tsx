import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
    ActivityIndicator,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    Modal,
    FlatList,
} from 'react-native';
import { ArrowLeft, Save, Package, Users, MapPin, ChevronDown, Check, Plus, Trash2, Edit2, Search } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { getMovementRepository, Tool, Collaborator, Location, BusinessLine, Movement, ToolWithStock } from '../database/repositories/MovementRepository';
import { useAuth } from '../context/AuthContext';
import * as SQLite from 'expo-sqlite';

interface InventoryExitScreenProps {
    onBack: () => void;
}

const InventoryExitScreen: React.FC<InventoryExitScreenProps> = ({ onBack }) => {
    const { user, isOnline } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data
    const [tools, setTools] = useState<ToolWithStock[]>([]);
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [businessLines, setBusinessLines] = useState<BusinessLine[]>([]);

    // Selection state
    const [selectedCollaborator, setSelectedCollaborator] = useState<Collaborator | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
    const [selectedBusinessLine, setSelectedBusinessLine] = useState<BusinessLine | null>(null);

    // Multi-item state
    const [cartItems, setCartItems] = useState<{ tool: ToolWithStock, cantidad: number }[]>([]);
    const [selectedToolItem, setSelectedToolItem] = useState<ToolWithStock | null>(null);
    const [cantidad, setCantidad] = useState('1');
    const [observaciones, setObservaciones] = useState('');

    // Modal visibility
    const [modalType, setModalType] = useState<'tool' | 'collaborator' | 'location' | 'business_line' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const repo = await getMovementRepository(isOnline);

            const [toolsData, collabsData, locsData, businessLinesData] = await Promise.all([
                repo.getToolsWithStock(),
                repo.getAllCollaborators(),
                repo.getAllLocations(),
                repo.getAllBusinessLines()
            ]);

            // Only show tools that have GOOD stock (available for assignment)
            setTools(toolsData.filter(t => t.stock_bueno > 0));
            setCollaborators(collabsData);
            setLocations(locsData);
            setBusinessLines(businessLinesData); // Note: I need to add this state variable
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo cargar la información');
        } finally {
            setLoading(false);
        }
    };

    const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    const addToCart = () => {
        if (!selectedToolItem || !cantidad) {
            Alert.alert('Error', 'Selecciona una herramienta y cantidad');
            return;
        }

        const qtyNum = parseInt(cantidad);
        if (isNaN(qtyNum) || qtyNum <= 0) {
            Alert.alert('Error', 'La cantidad debe ser un número positivo');
            return;
        }

        if (qtyNum > selectedToolItem.stock_bueno) {
            Alert.alert('Error', `Stock disponible insuficiente. Disponible: ${selectedToolItem.stock_bueno}`);
            return;
        }

        // Check if already in cart
        const existingIndex = cartItems.findIndex(item => item.tool.id === selectedToolItem.id);
        if (existingIndex !== -1) {
            const newQty = cartItems[existingIndex].cantidad + qtyNum;
            if (newQty > selectedToolItem.stock_bueno) {
                Alert.alert('Error', `Stock disponible insuficiente sumando el carrito. Disponible: ${selectedToolItem.stock_bueno}`);
                return;
            }
            const newCart = [...cartItems];
            newCart[existingIndex].cantidad = newQty;
            setCartItems(newCart);
        } else {
            setCartItems([...cartItems, { tool: selectedToolItem, cantidad: qtyNum }]);
        }

        // Reset item selection but keep collaborator/location
        setSelectedToolItem(null);
        setCantidad('1');
    };

    const removeFromCart = (index: number) => {
        const newCart = [...cartItems];
        newCart.splice(index, 1);
        setCartItems(newCart);
    };

    const getFilteredData = () => {
        const query = searchQuery.toLowerCase().trim();
        if (modalType === 'tool') {
            return tools.filter(t =>
                t.nombre.toLowerCase().includes(query) ||
                t.codigo_referencia.toLowerCase().includes(query) ||
                (t.num_serial && t.num_serial.toLowerCase().includes(query))
            );
        }
        if (modalType === 'collaborator') {
            return collaborators.filter(c =>
                c.nombre.toLowerCase().includes(query) ||
                c.cargo.toLowerCase().includes(query)
            );
        }
        if (modalType === 'location') {
            return locations.filter(l =>
                l.nombre_obra.toLowerCase().includes(query)
            );
        }
        if (modalType === 'business_line') {
            return businessLines.filter(bl =>
                bl.nombre.toLowerCase().includes(query) ||
                bl.codigo.toLowerCase().includes(query)
            );
        }
        return [];
    };

    const handleSave = async () => {
        if (cartItems.length === 0 || !selectedCollaborator || !selectedLocation || !selectedBusinessLine) {
            Alert.alert('Error', 'Por favor selecciona colaborador, ubicación, línea de negocio y al menos un insumo');
            return;
        }

        setSaving(true);
        try {
            const repo = await getMovementRepository(isOnline);

            const exitCode = `EXP-${new Date().getTime().toString().slice(-6)}`;

            const movements: Movement[] = cartItems.map(item => ({
                id: generateUUID(),
                herramienta_id: item.tool.id,
                trabajador_id: selectedCollaborator.id,
                ubicacion_id: selectedLocation.id,
                linea_negocio_id: selectedBusinessLine.id,
                tipo_movimiento: 'SALIDA',
                cantidad: item.cantidad,
                estado_insumo: 'BUENA',
                observaciones: `Ref: ${exitCode}. ${observaciones}`,
                usuario_sistema_id: user?.id || '00000000-0000-0000-0000-000000000001'
            }));

            await repo.registerMovements(movements);

            Alert.alert('Éxito', `Salida registrada correctamente. Código: ${exitCode}`);
            onBack();
        } catch (error: any) {
            console.error(error);
            Alert.alert('Error', 'No se pudo registrar la salida: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const renderPickerItem = ({ item, type }: { item: any; type: string }) => {
        let title = '';
        let subtitle = '';
        let isSelected = false;

        if (type === 'tool') {
            title = (item as ToolWithStock).nombre;
            const serialInfo = (item as ToolWithStock).num_serial ? ` | S/N: ${(item as ToolWithStock).num_serial}` : '';
            subtitle = `Disponible: ${(item as ToolWithStock).stock_bueno} | Ref: ${(item as ToolWithStock).codigo_referencia}${serialInfo}`;
            isSelected = selectedToolItem?.id === item.id;
        } else if (type === 'collaborator') {
            title = (item as Collaborator).nombre;
            subtitle = (item as Collaborator).cargo;
            isSelected = selectedCollaborator?.id === item.id;
        } else if (type === 'location') {
            title = (item as Location).nombre_obra;
            subtitle = (item as Location).estado;
            isSelected = selectedLocation?.id === item.id;
        } else if (type === 'business_line') {
            title = (item as BusinessLine).nombre;
            subtitle = `Cód: ${(item as BusinessLine).codigo}`;
            isSelected = selectedBusinessLine?.id === item.id;
        }

        return (
            <TouchableOpacity
                style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                onPress={() => {
                    if (type === 'tool') setSelectedToolItem(item);
                    if (type === 'collaborator') setSelectedCollaborator(item);
                    if (type === 'location') setSelectedLocation(item);
                    if (type === 'business_line') setSelectedBusinessLine(item);
                    setModalType(null);
                    setSearchQuery('');
                }}
            >
                <View style={styles.pickerItemInfo}>
                    <Text style={[styles.pickerItemTitle, isSelected && styles.pickerItemTextActive]}>{title}</Text>
                    <Text style={styles.pickerItemSubtitle}>{subtitle}</Text>
                </View>
                {isSelected && <Check size={20} color={Colors.primary} />}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.secondary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Registrar Salida</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                enabled={Platform.OS !== 'web'}
            >
                {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>1. Datos del Responsable</Text>

                        <Text style={styles.label}>Colaborador *</Text>
                        <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setModalType('collaborator')}
                        >
                            <View style={styles.selectorContent}>
                                <Users size={20} color={Colors.primary} style={styles.icon} />
                                <Text style={[styles.selectorText, !selectedCollaborator && styles.placeholder]}>
                                    {selectedCollaborator ? selectedCollaborator.nombre : '¿A quién se le entrega?'}
                                </Text>
                            </View>
                            <ChevronDown size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>

                        <Text style={styles.label}>Ubicación / Obra *</Text>
                        <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setModalType('location')}
                        >
                            <View style={styles.selectorContent}>
                                <MapPin size={20} color={Colors.primary} style={styles.icon} />
                                <Text style={[styles.selectorText, !selectedLocation && styles.placeholder]}>
                                    {selectedLocation ? selectedLocation.nombre_obra : '¿Hacia qué obra va?'}
                                </Text>
                            </View>
                            <ChevronDown size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>

                        <Text style={styles.label}>Línea de Negocio *</Text>
                        <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setModalType('business_line')}
                        >
                            <View style={styles.selectorContent}>
                                <Plus size={20} color={Colors.primary} style={styles.icon} />
                                <Text style={[styles.selectorText, !selectedBusinessLine && styles.placeholder]}>
                                    {selectedBusinessLine ? selectedBusinessLine.nombre : '¿A qué línea pertenece?'}
                                </Text>
                            </View>
                            <ChevronDown size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>2. Selección de Insumos</Text>

                        <Text style={styles.label}>Herramienta / Insumo *</Text>
                        <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setModalType('tool')}
                        >
                            <View style={styles.selectorContent}>
                                <Package size={20} color={Colors.primary} style={styles.icon} />
                                <Text style={[styles.selectorText, !selectedToolItem && styles.placeholder]}>
                                    {selectedToolItem ? selectedToolItem.nombre : 'Seleccionar herramienta'}
                                </Text>
                            </View>
                            <ChevronDown size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>
                        {selectedToolItem && (
                            <Text style={styles.stockInfo}>Disponible para entrega: {selectedToolItem.stock_bueno} unidades</Text>
                        )}

                        <View style={styles.addItemRow}>
                            <View style={{ flex: 1, marginRight: 12 }}>
                                <Text style={styles.label}>Cantidad *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={cantidad}
                                    onChangeText={setCantidad}
                                    keyboardType="numeric"
                                    placeholder="1"
                                />
                            </View>
                            <TouchableOpacity
                                style={styles.addButton}
                                onPress={addToCart}
                            >
                                <Plus size={24} color="#FFF" />
                                <Text style={styles.addButtonText}>Añadir</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {cartItems.length > 0 && (
                        <View style={styles.cartSection}>
                            <Text style={styles.sectionTitle}>Cart Items ({cartItems.length})</Text>
                            {cartItems.map((item, index) => (
                                <View key={index} style={styles.cartItem}>
                                    <View style={styles.cartItemInfo}>
                                        <Text style={styles.cartItemName}>{item.tool.nombre}</Text>
                                        <Text style={styles.cartItemDetails}>
                                            Ref: {item.tool.codigo_referencia}
                                            {item.tool.num_serial ? ` | S/N: ${item.tool.num_serial}` : ''}
                                            | Cant: {item.cantidad}
                                        </Text>
                                    </View>
                                    <TouchableOpacity onPress={() => removeFromCart(index)}>
                                        <Trash2 size={20} color={Colors.error} />
                                    </TouchableOpacity>
                                </View>
                            ))}

                            <Text style={styles.label}>Observaciones Generales</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={observaciones}
                                onChangeText={setObservaciones}
                                placeholder="Notas adicionales para este grupo de egresos..."
                                multiline
                                numberOfLines={3}
                            />
                        </View>
                    )}

                    <TouchableOpacity
                        style={[styles.saveButton, (saving || cartItems.length === 0 || !selectedCollaborator || !selectedLocation || !selectedBusinessLine) && styles.disabledButton]}
                        onPress={handleSave}
                        disabled={saving || cartItems.length === 0 || !selectedCollaborator || !selectedLocation || !selectedBusinessLine}
                    >
                        {saving ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <>
                                <Save size={20} color="#FFF" style={{ marginRight: 8 }} />
                                <Text style={styles.saveButtonText}>Confirmar Egreso Total</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {tools.length === 0 && (
                        <Text style={styles.errorText}>No hay herramientas con stock disponible en bodega.</Text>
                    )}
                </ScrollView>
            )}
            </KeyboardAvoidingView>

            {/* Selector Modal */}
            <Modal
                visible={!!modalType}
                animationType="slide"
                transparent={true}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {modalType === 'tool' ? 'Seleccionar Herramienta' :
                                    modalType === 'collaborator' ? 'Seleccionar Colaborador' :
                                        modalType === 'location' ? 'Seleccionar Ubicación' :
                                            'Seleccionar Línea de Negocio'}
                            </Text>
                            <TouchableOpacity onPress={() => setModalType(null)}>
                                <Check size={24} color={Colors.primary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchContainer}>
                            <Search size={20} color={Colors.textSecondary} style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Buscar..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCorrect={false}
                            />
                        </View>

                        <FlatList
                            data={getFilteredData() as any[]}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => renderPickerItem({ item, type: modalType! })}
                            contentContainerStyle={styles.pickerList}
                            ListEmptyComponent={
                                <View style={styles.emptySearch}>
                                    <Text style={styles.emptySearchText}>No se encontraron resultados</Text>
                                </View>
                            }
                        />
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
    content: {
        padding: 20,
    },
    section: {
        marginBottom: 20,
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.secondary,
        marginBottom: 8,
    },
    label: {
        fontSize: 14,
        color: Colors.text,
        marginBottom: 8,
        fontWeight: '600',
        marginTop: 16,
    },
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 56,
    },
    selectorContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    icon: {
        marginRight: 12,
    },
    selectorText: {
        fontSize: 16,
        color: Colors.text,
    },
    placeholder: {
        color: Colors.textSecondary,
    },
    stockInfo: {
        fontSize: 12,
        color: Colors.primary,
        marginTop: 4,
        fontWeight: '600',
        marginLeft: 4,
    },
    input: {
        backgroundColor: '#FFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 56,
        borderWidth: 1,
        borderColor: Colors.border,
        fontSize: 16,
        color: Colors.text,
    },
    textArea: {
        height: 60,
        paddingTop: 12,
        textAlignVertical: 'top',
    },
    addItemRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginTop: 8,
    },
    addButton: {
        backgroundColor: Colors.secondary,
        borderRadius: 12,
        height: 56,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addButtonText: {
        color: '#FFF',
        fontWeight: '700',
        marginLeft: 8,
    },
    cartSection: {
        marginBottom: 20,
    },
    cartItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    cartItemInfo: {
        flex: 1,
    },
    cartItemName: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text,
    },
    cartItemDetails: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    saveButton: {
        backgroundColor: Colors.primary,
        borderRadius: 12,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        marginBottom: 40,
    },
    disabledButton: {
        backgroundColor: Colors.border,
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '600',
    },
    errorText: {
        color: Colors.error,
        textAlign: 'center',
        marginTop: -20,
        fontSize: 14,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Modal Picker styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.secondary,
    },
    pickerList: {
        padding: 16,
    },
    pickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    pickerItemActive: {
        backgroundColor: Colors.primary + '10',
        borderColor: Colors.primary,
    },
    pickerItemInfo: {
        flex: 1,
    },
    pickerItemTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    pickerItemTextActive: {
        color: Colors.primary,
    },
    pickerItemSubtitle: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    // Search styles
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        marginHorizontal: 20,
        marginBottom: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        height: 48,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: Colors.text,
        height: '100%',
    },
    emptySearch: {
        padding: 40,
        alignItems: 'center',
    },
    emptySearchText: {
        color: Colors.textSecondary,
        fontSize: 14,
    },
});

export default InventoryExitScreen;
