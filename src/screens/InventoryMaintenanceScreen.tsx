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
    Modal,
    FlatList,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { ArrowLeft, Save, Package, Wrench, ChevronDown, Check, Plus, Trash2, Search, RotateCcw, XCircle } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { getMovementRepository, Tool, Movement, ToolWithStock, MovementListItem } from '../database/repositories/MovementRepository';
import { useAuth } from '../context/AuthContext';
import * as SQLite from 'expo-sqlite';

interface InventoryMaintenanceScreenProps {
    onBack: () => void;
}

const InventoryMaintenanceScreen: React.FC<InventoryMaintenanceScreenProps> = ({ onBack }) => {
    const { user, isOnline } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'send' | 'receive'>('send');

    // Data lists
    const [availableTools, setAvailableTools] = useState<ToolWithStock[]>([]);
    const [toolsInMaintenance, setToolsInMaintenance] = useState<MovementListItem[]>([]);

    // Form states
    const [selectedTool, setSelectedTool] = useState<ToolWithStock | MovementListItem | null>(null);
    const [taller, setTaller] = useState('');
    const [cantidad, setCantidad] = useState('1');
    const [observaciones, setObservaciones] = useState('');
    const [showToolPicker, setShowToolPicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Reintegration states
    const [reintegrateStatus, setReintegrateStatus] = useState<'BUENA' | 'MALA' | 'BAJA'>('BUENA');

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setLoading(true);
        try {
            const repo = await getMovementRepository(isOnline);

            if (activeTab === 'send') {
                const data = await repo.getToolsWithStock();
                // Mantenimiento aplica solo a HERRAMIENTAS con stock disponible
                setAvailableTools(
                    data.filter(t => t.stock_total > 0 && (t.categoria_codigo === 'HERRAMIENTAS' || !t.categoria_codigo))
                );
            } else {
                const data = await repo.getToolsInMaintenance();
                // Solo herramientas en mantenimiento
                setToolsInMaintenance(
                    data.filter(t => t.tool_categoria_codigo === 'HERRAMIENTAS' || !t.tool_categoria_codigo)
                );
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudieron cargar los datos.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendToWorkshop = async () => {
        if (!selectedTool || !taller || !cantidad) {
            Alert.alert('Error', 'Complete todos los campos obligatorios.');
            return;
        }

        const qty = parseInt(cantidad);
        const tool = selectedTool as ToolWithStock;

        if (qty <= 0 || qty > tool.stock_total) {
            Alert.alert('Error', 'Cantidad inválida.');
            return;
        }

        setSaving(true);
        try {
            const repo = await getMovementRepository(isOnline);
            const bodegaId = await repo.getBodegaId();

            const movement: Movement = {
                id: generateUUID(),
                herramienta_id: tool.id,
                ubicacion_id: bodegaId,
                tipo_movimiento: 'MANTENIMIENTO',
                cantidad: qty,
                estado_insumo: tool.stock_bueno >= qty ? 'BUENA' : 'MALA', // Prefer good if available
                observaciones: `TALLER: ${taller.toUpperCase()} | ${observaciones}`,
                fecha: new Date().toISOString(),
                usuario_sistema_id: user?.id || 'unknown'
            };

            await repo.registerMovement(movement);
            Alert.alert('Éxito', 'Herramienta enviada al taller.');
            resetForm();
            loadData();
        } catch (error: any) {
            Alert.alert('Error', 'No se pudo registrar el envío: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleReceiveFromWorkshop = async () => {
        if (!selectedTool || !cantidad) {
            Alert.alert('Error', 'Complete todos los campos obligatorios.');
            return;
        }

        const qty = parseInt(cantidad);
        const item = selectedTool as MovementListItem;

        if (qty <= 0 || qty > item.balance) {
            Alert.alert('Error', 'Cantidad inválida.');
            return;
        }

        setSaving(true);
        try {
            const repo = await getMovementRepository(isOnline);
            const bodegaId = await repo.getBodegaId();

            // Reintegration is a negative MANTENIMIENTO movement (restores stock)
            const movement: Movement = {
                id: generateUUID(),
                herramienta_id: item.herramienta_id,
                ubicacion_id: bodegaId,
                tipo_movimiento: 'MANTENIMIENTO',
                cantidad: -qty,
                estado_insumo: reintegrateStatus === 'BAJA' ? 'MALA' : reintegrateStatus as any,
                observaciones: `REINGRESO TALLER: ${observaciones}${reintegrateStatus === 'BAJA' ? ' (DADA DE BAJA)' : ''}`,
                fecha: new Date().toISOString(),
                usuario_sistema_id: user?.id || 'unknown'
            };

            await repo.registerMovement(movement);
            Alert.alert('Éxito', 'Herramienta reintegrada.');
            resetForm();
            loadData();
        } catch (error: any) {
            Alert.alert('Error', 'No se pudo registrar el reingreso: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setSelectedTool(null);
        setTaller('');
        setCantidad('1');
        setObservaciones('');
        setReintegrateStatus('BUENA');
    };

    const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    const filteredTools = availableTools.filter(t =>
        t.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.codigo_referencia.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.num_serial && t.num_serial.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const renderToolPickerItem = ({ item }: { item: ToolWithStock }) => (
        <TouchableOpacity
            style={styles.pickerItem}
            onPress={() => {
                setSelectedTool(item);
                setShowToolPicker(false);
            }}
        >
            <View>
                <Text style={styles.pickerItemTitle}>{item.nombre}</Text>
                <Text style={styles.pickerItemSubtitle}>
                    Ref: {item.codigo_referencia} | Stock: {item.stock_total} ({item.stock_bueno}B / {item.stock_malo}M)
                </Text>
            </View>
            <Plus size={20} color={Colors.primary} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.secondary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Gestión de Mantenimiento</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.tabBar}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'send' && styles.activeTab]}
                    onPress={() => { setActiveTab('send'); resetForm(); }}
                >
                    <Wrench size={20} color={activeTab === 'send' ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.tabText, activeTab === 'send' && styles.activeTabText]}>Enviar a Taller</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'receive' && styles.activeTab]}
                    onPress={() => { setActiveTab('receive'); resetForm(); }}
                >
                    <RotateCcw size={20} color={activeTab === 'receive' ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.tabText, activeTab === 'receive' && styles.activeTabText]}>Recibir de Taller</Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                enabled={Platform.OS !== 'web'}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                {loading ? (
                    <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
                ) : (
                    <>
                        {activeTab === 'send' ? (
                            <View style={styles.formCard}>
                                <Text style={styles.label}>Herramienta a Reparar</Text>
                                <TouchableOpacity
                                    style={styles.toolSelector}
                                    onPress={() => setShowToolPicker(true)}
                                >
                                    <View style={styles.row}>
                                        <Package size={20} color={Colors.textSecondary} />
                                        <Text style={[styles.toolSelectorText, !selectedTool && { color: Colors.border }]}>
                                            {selectedTool ? (selectedTool as ToolWithStock).nombre : 'Seleccione herramienta...'}
                                        </Text>
                                    </View>
                                    <ChevronDown size={20} color={Colors.textSecondary} />
                                </TouchableOpacity>

                                {selectedTool && (
                                    <View style={styles.miniStats}>
                                        <Text style={styles.miniStatsText}>
                                            Referencia: {(selectedTool as ToolWithStock).codigo_referencia}
                                        </Text>
                                        <Text style={styles.miniStatsText}>
                                            Stock en Bodega: {(selectedTool as ToolWithStock).stock_total} unidades
                                        </Text>
                                    </View>
                                )}

                                <Text style={styles.label}>Nombre del Taller / Técnico</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ej: Taller Central, Sr. Moreno..."
                                    value={taller}
                                    onChangeText={setTaller}
                                />

                                <Text style={styles.label}>Cantidad</Text>
                                <TextInput
                                    style={styles.input}
                                    keyboardType="numeric"
                                    value={cantidad}
                                    onChangeText={setCantidad}
                                />

                                <Text style={styles.label}>Observaciones del Daño</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    multiline
                                    numberOfLines={4}
                                    placeholder="Describa el fallo o mantenimiento requerido..."
                                    value={observaciones}
                                    onChangeText={setObservaciones}
                                />

                                <TouchableOpacity
                                    style={[styles.submitButton, saving && { opacity: 0.7 }]}
                                    onPress={handleSendToWorkshop}
                                    disabled={saving}
                                >
                                    {saving ? <ActivityIndicator color="#FFF" /> : (
                                        <>
                                            <Wrench size={20} color="#FFF" style={{ marginRight: 8 }} />
                                            <Text style={styles.submitButtonText}>Registrar Salida a Taller</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.formCard}>
                                <Text style={styles.label}>Herramienta en Mantenimiento</Text>
                                <View style={styles.listContainer}>
                                    {toolsInMaintenance.length === 0 ? (
                                        <Text style={styles.emptyText}>No hay herramientas en taller actualmente.</Text>
                                    ) : (
                                        toolsInMaintenance.map(item => (
                                            <TouchableOpacity
                                                key={item.herramienta_id}
                                                style={[styles.listCard, selectedTool && ('herramienta_id' in selectedTool ? selectedTool.herramienta_id : selectedTool.id) === item.herramienta_id && styles.selectedListCard]}

                                                onPress={() => {
                                                    setSelectedTool(item);
                                                    setCantidad(item.balance.toString());
                                                }}
                                            >
                                                <View style={styles.listCardMain}>
                                                    <View>
                                                        <Text style={styles.listCardTitle}>{item.tool_nombre}</Text>
                                                        <Text style={styles.listCardSubtitle}>Ref: {item.tool_codigo} | Taller: {item.observaciones?.split('|')[0] || 'N/A'}</Text>
                                                    </View>
                                                    <View style={styles.countBadge}>
                                                        <Text style={styles.countBadgeText}>{item.balance}</Text>
                                                    </View>
                                                </View>
                                            </TouchableOpacity>
                                        ))
                                    )}
                                </View>

                                {selectedTool && (
                                    <View style={styles.reintegrateSection}>
                                        <Text style={styles.label}>Estado del Reingreso</Text>
                                        <View style={styles.statusGrid}>
                                            <TouchableOpacity
                                                style={[styles.statusOption, reintegrateStatus === 'BUENA' && styles.statusOptionActive]}
                                                onPress={() => setReintegrateStatus('BUENA')}
                                            >
                                                <Check size={20} color={reintegrateStatus === 'BUENA' ? '#FFF' : Colors.success} />
                                                <Text style={[styles.statusOptionText, reintegrateStatus === 'BUENA' && { color: '#FFF' }]}>Arreglada</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.statusOption, reintegrateStatus === 'MALA' && styles.statusOptionActive, { borderColor: Colors.error }]}
                                                onPress={() => setReintegrateStatus('MALA')}
                                            >
                                                <XCircle size={20} color={reintegrateStatus === 'MALA' ? '#FFF' : Colors.error} />
                                                <Text style={[styles.statusOptionText, reintegrateStatus === 'MALA' && { color: '#FFF' }]}>Sin Arreglo</Text>
                                            </TouchableOpacity>
                                        </View>

                                        <Text style={styles.label}>Cantidad a Reingresar</Text>
                                        <TextInput
                                            style={styles.input}
                                            keyboardType="numeric"
                                            value={cantidad}
                                            onChangeText={setCantidad}
                                        />

                                        <Text style={styles.label}>Notas de Reparación</Text>
                                        <TextInput
                                            style={[styles.input, styles.textArea]}
                                            multiline
                                            numberOfLines={3}
                                            placeholder="Detalles sobre lo realizado en el taller..."
                                            value={observaciones}
                                            onChangeText={setObservaciones}
                                        />

                                        <TouchableOpacity
                                            style={[styles.submitButton, { backgroundColor: Colors.secondary }, saving && { opacity: 0.7 }]}
                                            onPress={handleReceiveFromWorkshop}
                                            disabled={saving}
                                        >
                                            {saving ? <ActivityIndicator color="#FFF" /> : (
                                                <>
                                                    <RotateCcw size={20} color="#FFF" style={{ marginRight: 8 }} />
                                                    <Text style={styles.submitButtonText}>Confirmar Reingreso</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
            </KeyboardAvoidingView>

            <Modal visible={showToolPicker} animationType="slide">
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowToolPicker(false)}>
                            <XCircle size={24} color={Colors.textSecondary} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Seleccionar Herramienta</Text>
                        <View style={{ width: 24 }} />
                    </View>
                    <View style={styles.searchBar}>
                        <Search size={20} color={Colors.textSecondary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar herramienta..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                    <FlatList
                        data={filteredTools}
                        renderItem={renderToolPickerItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ padding: 20 }}
                    />
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.secondary, flex: 1, textAlign: 'center' },
    backButton: { padding: 8 },
    tabBar: { flexDirection: 'row', backgroundColor: '#FFF' },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    activeTab: { borderBottomColor: Colors.primary },
    tabText: { marginLeft: 8, fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
    activeTabText: { color: Colors.primary },
    scrollContent: { padding: 20 },
    formCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 20, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    label: { fontSize: 14, fontWeight: '600', color: Colors.secondary, marginBottom: 8, marginTop: 12 },
    input: { backgroundColor: Colors.surface, borderRadius: 12, padding: 15, borderWidth: 1, borderColor: Colors.border, fontSize: 16, color: Colors.secondary },
    textArea: { height: 100, textAlignVertical: 'top' },
    toolSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 12, padding: 15, borderWidth: 1, borderColor: Colors.border },
    row: { flexDirection: 'row', alignItems: 'center' },
    toolSelectorText: { marginLeft: 12, fontSize: 16, color: Colors.secondary },
    miniStats: { padding: 10, backgroundColor: Colors.primary + '10', borderRadius: 8, marginTop: 8 },
    miniStatsText: { fontSize: 12, color: Colors.primary, fontWeight: '500' },
    submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, padding: 18, borderRadius: 16, marginTop: 30 },
    submitButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
    listContainer: { marginTop: 10 },
    listCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 15, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: Colors.primary },
    selectedListCard: { borderColor: Colors.primary, borderWidth: 1 },
    listCardTitle: { fontSize: 16, fontWeight: '700', color: Colors.secondary },
    listCardSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
    listCardMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    countBadge: { backgroundColor: Colors.primary + '20', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
    countBadgeText: { color: Colors.primary, fontWeight: '700' },
    reintegrateSection: { marginTop: 20, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10 },
    statusGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    statusOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.success, marginHorizontal: 5 },
    statusOptionActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    statusOptionText: { marginLeft: 6, fontSize: 14, fontWeight: '600' },
    emptyText: { textAlign: 'center', color: Colors.textSecondary, marginTop: 20 },
    modalContainer: { flex: 1, backgroundColor: '#FFF' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
    modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.secondary },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, margin: 20, borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: Colors.border },
    searchInput: { flex: 1, paddingVertical: 12, marginLeft: 10, fontSize: 16 },
    pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: Colors.border },
    pickerItemTitle: { fontSize: 16, fontWeight: '600', color: Colors.secondary },
    pickerItemSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 }
});

export default InventoryMaintenanceScreen;
