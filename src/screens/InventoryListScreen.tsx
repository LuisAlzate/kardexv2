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
    Modal,
    ScrollView,
    Alert,
} from 'react-native';
import { ArrowLeft, Package, Search, X, Edit2, Save } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { getMovementRepository, ToolWithStock } from '../database/repositories/MovementRepository';
import { useAuth } from '../context/AuthContext';

interface InventoryListScreenProps {
    onBack: () => void;
}

const InventoryListScreen: React.FC<InventoryListScreenProps> = ({ onBack }) => {
    const { isOnline, user } = useAuth();

    const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    const [loading, setLoading] = useState(true);
    const [tools, setTools] = useState<ToolWithStock[]>([]);
    const [filteredTools, setFilteredTools] = useState<ToolWithStock[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    // Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingTool, setEditingTool] = useState<ToolWithStock | null>(null);
    const [toolName, setToolName] = useState('');
    const [toolBrand, setToolBrand] = useState('');
    const [toolDescription, setToolDescription] = useState('');
    const [toolReference, setToolReference] = useState('');
    const [toolSerial, setToolSerial] = useState('');
    const [toolEstanteria, setToolEstanteria] = useState('');
    const [toolStockBueno, setToolStockBueno] = useState('');
    const [toolStockMalo, setToolStockMalo] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadInventory();
    }, []);

    useEffect(() => {
        if (!searchQuery) {
            setFilteredTools(tools);
        } else {
            const lowerQuery = searchQuery.toLowerCase();
            const filtered = tools.filter(
                t => t.nombre.toLowerCase().includes(lowerQuery) ||
                    t.codigo_referencia.toLowerCase().includes(lowerQuery) ||
                    (t.num_serial && t.num_serial.toLowerCase().includes(lowerQuery)) ||
                    (t.marca && t.marca.toLowerCase().includes(lowerQuery))
            );
            setFilteredTools(filtered);
        }
    }, [searchQuery, tools]);

    const loadInventory = async () => {
        setLoading(true);
        try {
            const repo = await getMovementRepository(isOnline);
            const data = await repo.getToolsWithStock();
            setTools(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditPress = (tool: ToolWithStock) => {
        setEditingTool(tool);
        setToolName(tool.nombre);
        setToolBrand(tool.marca || '');
        setToolDescription(tool.descripcion || '');
        setToolReference(tool.codigo_referencia);
        setToolSerial(tool.num_serial || '');
        setToolEstanteria(tool.estanteria || '');
        setToolStockBueno(String(tool.stock_bueno));
        setToolStockMalo(String(tool.stock_malo));
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!toolName || !toolReference) {
            Alert.alert('Error', 'El nombre y la referencia son obligatorios');
            return;
        }

        setIsSaving(true);
        try {
            const repo = await getMovementRepository(isOnline);
            if (editingTool) {
                await repo.updateTool({
                    id: editingTool.id,
                    nombre: toolName,
                    marca: toolBrand,
                    descripcion: toolDescription,
                    codigo_referencia: toolReference,
                    num_serial: toolSerial,
                    estanteria: toolEstanteria,
                });

                // Handle Stock Adjustments
                const newStockBueno = parseInt(toolStockBueno) || 0;
                const newStockMalo = parseInt(toolStockMalo) || 0;

                const adjustments: any[] = [];

                if (newStockBueno !== editingTool.stock_bueno) {
                    adjustments.push({
                        id: generateUUID(),
                        herramienta_id: editingTool.id,
                        tipo_movimiento: 'AJUSTE',
                        cantidad: newStockBueno - editingTool.stock_bueno,
                        estado_insumo: 'BUENA',
                        observaciones: 'Ajuste manual de inventario',
                        usuario_sistema_id: user?.id || '00000000-0000-0000-0000-000000000001',
                        fecha: new Date().toISOString()
                    });
                }

                if (newStockMalo !== editingTool.stock_malo) {
                    adjustments.push({
                        id: generateUUID(),
                        herramienta_id: editingTool.id,
                        tipo_movimiento: 'AJUSTE',
                        cantidad: newStockMalo - editingTool.stock_malo,
                        estado_insumo: 'MALA',
                        observaciones: 'Ajuste manual de inventario',
                        usuario_sistema_id: user?.id || '00000000-0000-0000-0000-000000000001',
                        fecha: new Date().toISOString()
                    });
                }

                if (adjustments.length > 0) {
                    await repo.registerMovements(adjustments);
                }

                Alert.alert('Éxito', 'Herramienta y stock actualizados correctamente');
                setShowEditModal(false);
                loadInventory();
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo actualizar la herramienta');
        } finally {
            setIsSaving(false);
        }
    };

    const renderItem = ({ item }: { item: ToolWithStock }) => (
        <View style={styles.card}>
            <View style={styles.cardContent}>
                <View style={styles.infoSection}>
                    <Text style={styles.toolName}>{item.nombre}</Text>
                    <Text style={styles.toolDetail}>Marca: {item.marca || 'N/A'}</Text>
                    {item.estanteria ? <Text style={styles.toolDetail}>Estante: {item.estanteria}</Text> : null}
                    <Text style={styles.toolDetail}>Ref: {item.codigo_referencia}</Text>
                    {item.num_serial ? <Text style={styles.toolDetail}>S/N: {item.num_serial}</Text> : null}
                    <Text style={[styles.stockLabel, { marginTop: 8 }]}>Stock Total: {item.stock_total}</Text>
                </View>
                <View style={styles.rightSection}>
                    <TouchableOpacity style={styles.editButton} onPress={() => handleEditPress(item)}>
                        <Edit2 size={20} color={Colors.primary} />
                    </TouchableOpacity>
                    <View style={styles.stockSection}>
                        <View style={[
                            styles.stockBadge,
                            { backgroundColor: item.stock_bueno > 0 ? Colors.success + '15' : Colors.error + '15' }
                        ]}>
                            <Text style={[
                                styles.stockValue,
                                { color: item.stock_bueno > 0 ? Colors.success : Colors.error }
                            ]}>
                                {item.stock_bueno}
                            </Text>
                        </View>
                        <Text style={styles.stockLabel}>Disponibles</Text>

                        {item.stock_malo > 0 && (
                            <View style={styles.damagedContainer}>
                                <Text style={styles.damagedText}>Dañadas: {item.stock_malo}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                {!isSearching ? (
                    <>
                        <TouchableOpacity onPress={onBack} style={styles.backButton}>
                            <ArrowLeft size={24} color={Colors.secondary} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Inventario Actual</Text>
                        <TouchableOpacity style={styles.backButton} onPress={() => setIsSearching(true)}>
                            <Search size={24} color={Colors.secondary} />
                        </TouchableOpacity>
                    </>
                ) : (
                    <View style={styles.searchContainer}>
                        <Search size={20} color={Colors.textSecondary} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar herramienta, ref, o serial..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus
                        />
                        <TouchableOpacity
                            onPress={() => {
                                setIsSearching(false);
                                setSearchQuery('');
                            }}
                            style={styles.closeSearchButton}
                        >
                            <X size={20} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={filteredTools}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Package size={64} color={Colors.border} />
                            <Text style={styles.emptyText}>No hay herramientas registradas</Text>
                        </View>
                    }
                />
            )}

            {/* Edit Modal */}
            <Modal visible={showEditModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Editar Herramienta</Text>
                            <TouchableOpacity onPress={() => setShowEditModal(false)}>
                                <X size={24} color={Colors.secondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            <Text style={styles.inputLabel}>Nombre de la Herramienta</Text>
                            <TextInput
                                style={styles.input}
                                value={toolName}
                                onChangeText={setToolName}
                                placeholder="Ej: Taladro Percutor"
                            />

                            <Text style={styles.inputLabel}>Marca</Text>
                            <TextInput
                                style={styles.input}
                                value={toolBrand}
                                onChangeText={setToolBrand}
                                placeholder="Ej: DeWalt"
                            />

                            <Text style={styles.inputLabel}>Referencia / Código</Text>
                            <TextInput
                                style={styles.input}
                                value={toolReference}
                                onChangeText={setToolReference}
                                placeholder="Ej: TL-001"
                            />

                            <Text style={styles.inputLabel}>Número de Serial</Text>
                            <TextInput
                                style={styles.input}
                                value={toolSerial}
                                onChangeText={setToolSerial}
                                placeholder="Ej: SN123456"
                            />

                            <Text style={styles.inputLabel}>Ubicación (Estante)</Text>
                            <TextInput
                                style={styles.input}
                                value={toolEstanteria}
                                onChangeText={setToolEstanteria}
                                placeholder="Ej: A-12"
                            />

                            <Text style={styles.inputLabel}>Descripción</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                value={toolDescription}
                                onChangeText={setToolDescription}
                                placeholder="Detalles adicionales..."
                                multiline
                            />

                            <View style={styles.stockAdjustmentContainer}>
                                <View style={styles.stockInputBox}>
                                    <Text style={styles.inputLabel}>Stock Existente (Bueno)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={toolStockBueno}
                                        onChangeText={setToolStockBueno}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={styles.stockInputBox}>
                                    <Text style={styles.inputLabel}>Stock Existente (Malo)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={toolStockMalo}
                                        onChangeText={setToolStockMalo}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            <TouchableOpacity 
                                style={[styles.saveButton, isSaving && { opacity: 0.7 }]} 
                                onPress={handleSaveEdit}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <>
                                        <Save size={20} color="#FFF" style={{ marginRight: 8 }} />
                                        <Text style={styles.saveButtonText}>Guardar Cambios</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
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
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 48,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: Colors.text,
    },
    closeSearchButton: {
        padding: 4,
    },
    listContent: {
        padding: 20,
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        marginBottom: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    cardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoSection: {
        flex: 1,
    },
    toolName: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.secondary,
        marginBottom: 4,
    },
    toolDetail: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginBottom: 2,
    },
    rightSection: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        height: '100%',
        minHeight: 100,
    },
    editButton: {
        padding: 8,
        backgroundColor: Colors.surface,
        borderRadius: 8,
    },
    stockSection: {
        alignItems: 'center',
    },
    stockBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 4,
    },
    stockValue: {
        fontSize: 20,
        fontWeight: '800',
    },
    stockLabel: {
        fontSize: 10,
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    damagedContainer: {
        marginTop: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: Colors.error + '10',
        borderRadius: 4,
    },
    damagedText: {
        fontSize: 10,
        color: Colors.error,
        fontWeight: '600',
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
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        maxHeight: '90%',
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
    saveButton: {
        backgroundColor: Colors.secondary,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        marginTop: 32,
        marginBottom: 24,
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    stockAdjustmentContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        gap: 16,
    },
    stockInputBox: {
        flex: 1,
    },
});

export default InventoryListScreen;
