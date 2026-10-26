import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    SafeAreaView,
    FlatList,
    Alert,
    Modal,
    Platform,
} from 'react-native';
import { ArrowLeft, Search, FileText, Calendar, User, MapPin, Package, Download, XCircle } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { getMovementRepository, Tool, MovementListItem, ToolWithStock } from '../database/repositories/MovementRepository';
import * as SQLite from 'expo-sqlite';
import * as Print from 'expo-print';
import { LOGO_BASE64 } from '../constants/LogoBase64';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../context/AuthContext';

interface ToolLifeCycleScreenProps {
    onBack: () => void;
}

const ToolLifeCycleScreen: React.FC<ToolLifeCycleScreenProps> = ({ onBack }) => {
    const { isOnline } = useAuth();
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [tools, setTools] = useState<ToolWithStock[]>([]);
    const [selectedTool, setSelectedTool] = useState<ToolWithStock | null>(null);
    const [history, setHistory] = useState<MovementListItem[]>([]);
    const [showToolPicker, setShowToolPicker] = useState(false);

    useEffect(() => {
        loadTools();
    }, []);

    const loadTools = async () => {
        try {
            const repo = await getMovementRepository(isOnline);
            const data = await repo.getToolsWithStock();
            // La hoja de vida aplica únicamente a HERRAMIENTAS (activos con serial/trazabilidad)
            setTools(data.filter(t => t.categoria_codigo === 'HERRAMIENTAS' || !t.categoria_codigo));
        } catch (error) {
            console.error(error);
        }
    };

    const loadHistory = async (tool: ToolWithStock) => {
        setLoading(true);
        setSelectedTool(tool);
        try {
            const repo = await getMovementRepository(isOnline);
            const data = await repo.getToolLifeCycle(tool.id);
            setHistory(data);
        } catch (error) {
            Alert.alert('Error', 'No se pudo cargar el historial.');
        } finally {
            setLoading(false);
        }
    };
    const generatePDF = async () => {
        console.log('--- GENERANDO REPORTE CON LOGO ---');
        if (!selectedTool || history.length === 0) return;

        // Limpieza de rastros anteriores
        if (Platform.OS === 'web') {
            ['print-style-v10', 'print-container-v10'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.remove();
            });
        }

        const htmlContent = `
            <div id="print-report-v10" style="font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; background: white; width: 100%; box-sizing: border-box;">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #F0A500; padding-bottom: 20px; margin-bottom: 30px;">
                    <div style="display: flex; align-items: center;">
                        <img src="${LOGO_BASE64}" style="height: 120px; max-width: 250px; margin-right: 20px; object-fit: contain;" />
                        <div>
                            <div style="font-weight: 900; font-size: 20px; color: #000; letter-spacing: -1px; line-height: 1;">KARDEX</div>
                            <div style="font-weight: 400; font-size: 11px; color: #F0A500; text-transform: uppercase; letter-spacing: 2px;">Sistema Gestión</div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <h1 style="margin: 0; font-size: 18px; color: #000; text-transform: uppercase;">Hoja de Vida</h1>
                        <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 11px; color: #666;">Reporte Oficial de Activo</p>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 14px;">
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 12px; width: 50%;">
                            <span style="color: #666; font-size: 10px; text-transform: uppercase;">Nombre del Activo</span><br/>
                            <strong style="font-size: 16px;">${selectedTool.nombre}</strong>
                        </td>
                        <td style="border: 1px solid #ddd; padding: 12px; width: 50%;">
                            <span style="color: #666; font-size: 10px; text-transform: uppercase;">Marca</span><br/>
                            <strong style="font-size: 16px;">${selectedTool.marca || 'NO REGISTRA'}</strong>
                        </td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 12px;">
                            <span style="color: #666; font-size: 10px; text-transform: uppercase;">ID / Referencia Interna</span><br/>
                            <strong style="font-size: 16px;">${selectedTool.codigo_referencia}</strong>
                        </td>
                        <td style="border: 1px solid #ddd; padding: 12px;">
                            <span style="color: #666; font-size: 10px; text-transform: uppercase;">Número de Serial</span><br/>
                            <strong>${selectedTool.num_serial || 'NO REGISTRA'}</strong>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="2" style="border: 1px solid #ddd; padding: 12px;">
                            <span style="color: #666; font-size: 10px; text-transform: uppercase;">Fecha de Emisión</span><br/>
                            <strong>${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })}</strong>
                        </td>
                    </tr>
                </table>

                <h2 style="font-size: 18px; border-left: 5px solid #F0A500; padding-left: 15px; margin-bottom: 20px; text-transform: uppercase; color: #333;">Movimientos y Trazabilidad</h2>
                
                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                        <tr style="background-color: #f4f4f4; border-bottom: 2px solid #000;">
                            <th style="padding: 12px; text-align: left; width: 18%;">FECHA / HORA</th>
                            <th style="padding: 12px; text-align: left; width: 12%;">ACCIÓN</th>
                            <th style="padding: 12px; text-align: left; width: 25%;">ORIGEN / DESTINO</th>
                            <th style="padding: 12px; text-align: center; width: 8%;">CANT.</th>
                            <th style="padding: 12px; text-align: left; width: 37%;">OBSERVACIONES Y ESTADO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${history.map(item => `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 10px; color: #555;">${new Date(item.fecha || new Date()).toLocaleString('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                                <td style="padding: 10px;"><strong>${item.tipo_movimiento}</strong></td>
                                <td style="padding: 10px;">${item.collaborator_nombre || item.location_nombre || 'ALMACÉN PRINCIPAL'}</td>
                                <td style="padding: 10px; text-align: center;"><strong>${item.cantidad}</strong></td>
                                <td style="padding: 10px;">
                                    <span style="display: inline-block; padding: 2px 6px; background: #eee; border-radius: 3px; font-weight: bold; margin-bottom: 3px;">
                                        ${item.estado_insumo || 'OPERATIVO'}
                                    </span><br/>
                                    ${item.observaciones || 'Sin registros adicionales.'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div style="margin-top: 100px; display: flex; width: 100%; justify-content: space-around;">
                    <div style="text-align: center; width: 250px;">
                        <div style="border-top: 1px solid #000; padding-top: 10px; font-weight: bold;">Firma Responsable Almacén</div>
                    </div>
                    <div style="text-align: center; width: 250px;">
                        <div style="border-top: 1px solid #000; padding-top: 10px; font-weight: bold;">Firma Recibido (Trabajador)</div>
                    </div>
                </div>

                <div style="margin-top: 60px; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
                    <p style="font-size: 9px; color: #999; margin: 0;">
                        Documento oficial de control de inventarios Kardex V2.0 PRO.
                    </p>
                    <p style="font-size: 9px; color: #999; margin: 5px 0 0 0;">
                        ID único de seguimiento: ${selectedTool.id}
                    </p>
                </div>
            </div>
        `;

        try {
            if (Platform.OS === 'web') {
                console.log('Web: Generando impresión final...');

                const style = document.createElement('style');
                style.id = 'print-style-v10';
                style.innerHTML = `
                    @media print {
                        body > :not(#print-container-v10) { display: none !important; }
                        #print-container-v10 { display: block !important; position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
                    }
                `;
                document.head.appendChild(style);

                const printDiv = document.createElement('div');
                printDiv.id = 'print-container-v10';
                printDiv.style.display = 'none';
                printDiv.innerHTML = htmlContent;
                document.body.appendChild(printDiv);

                setTimeout(() => {
                    window.print();
                    setTimeout(() => {
                        if (document.getElementById('print-style-v10')) document.head.removeChild(style);
                        if (document.getElementById('print-container-v10')) document.body.removeChild(printDiv);
                    }, 500);
                }, 500);
            } else {
                console.log('Nativo: Generando PDF...');
                const { uri } = await Print.printToFileAsync({ html: htmlContent });
                if (uri) await Sharing.shareAsync(uri);
            }
        } catch (error) {
            console.error('Error Reporte:', error);
            Alert.alert('Error', 'No se pudo generar el reporte.');
        }
    };

    const filteredTools = tools.filter(t =>
        t.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.codigo_referencia.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderMovement = ({ item }: { item: MovementListItem }) => (
        <View style={styles.timelineItem}>
            <View style={styles.timelineLine}>
                <View style={[styles.timelineDot, { backgroundColor: getMovementColor(item.tipo_movimiento || '') }]} />
            </View>
            <View style={styles.timelineContent}>
                <View style={styles.movementHeader}>
                    <Text style={[styles.movementType, { color: getMovementColor(item.tipo_movimiento || '') }]}>
                        {item.tipo_movimiento}
                    </Text>
                    <Text style={styles.movementDate}>{new Date(item.fecha || new Date()).toLocaleString('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })}</Text>
                </View>

                <View style={styles.movementDetail}>
                    {item.collaborator_nombre ? (
                        <View style={styles.detailRow}>
                            <User size={14} color={Colors.textSecondary} />
                            <Text style={styles.detailText}>{item.collaborator_nombre}</Text>
                        </View>
                    ) : null}

                    {item.location_nombre ? (
                        <View style={styles.detailRow}>
                            <MapPin size={14} color={Colors.textSecondary} />
                            <Text style={styles.detailText}>{item.location_nombre}</Text>
                        </View>
                    ) : null}

                    <View style={styles.detailRow}>
                        <Package size={14} color={Colors.textSecondary} />
                        <Text style={styles.detailText}>Cantidad: {item.cantidad}</Text>
                        {item.estado_insumo && (
                            <Text style={[styles.statusBadge, { color: item.estado_insumo === 'BUENA' ? Colors.success : Colors.error }]}>
                                • {item.estado_insumo}
                            </Text>
                        )}
                    </View>
                </View>

                {item.observaciones && (
                    <Text style={styles.observations}>{item.observaciones}</Text>
                )}
            </View>
        </View>
    );

    const getMovementColor = (type: string) => {
        switch (type) {
            case 'ENTRADA': return Colors.success;
            case 'SALIDA': return Colors.error;
            case 'DEVOLUCION': return Colors.primary;
            case 'MANTENIMIENTO': return '#f39c12';
            default: return Colors.textSecondary;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.secondary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>HOJA DE VIDA v10.0 FINAL</Text>
                {selectedTool ? (
                    <TouchableOpacity onPress={generatePDF} style={styles.pdfButton}>
                        <Download size={22} color={Colors.primary} />
                    </TouchableOpacity>
                ) : <View style={{ width: 40 }} />}
            </View>

            <View style={styles.searchSection}>
                <TouchableOpacity
                    style={styles.toolSelector}
                    onPress={() => setShowToolPicker(true)}
                >
                    <Package size={20} color={Colors.textSecondary} />
                    <Text style={[styles.selectorText, !selectedTool && { color: Colors.border }]}>
                        {selectedTool ? `${selectedTool.nombre} (${selectedTool.codigo_referencia})` : 'Seleccione una herramienta...'}
                    </Text>
                    <Search size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
            ) : selectedTool ? (
                <FlatList
                    data={history}
                    renderItem={renderMovement}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No hay movimientos registrados para esta herramienta.</Text>
                    }
                />
            ) : (
                <View style={styles.placeholderContainer}>
                    <FileText size={80} color={Colors.border} />
                    <Text style={styles.placeholderText}>Busca y selecciona una herramienta para ver su historial completo</Text>
                </View>
            )}

            <Modal visible={showToolPicker} animationType="slide">
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setShowToolPicker(false)}>
                            <XCircle size={24} color={Colors.textSecondary} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Buscar Herramienta</Text>
                        <View style={{ width: 24 }} />
                    </View>
                    <View style={styles.modalSearch}>
                        <Search size={20} color={Colors.textSecondary} />
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Nombre o Código..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                    <FlatList
                        data={filteredTools}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.pickerItem}
                                onPress={() => {
                                    loadHistory(item);
                                    setShowToolPicker(false);
                                }}
                            >
                                <Text style={styles.pickerItemTitle}>{item.nombre}</Text>
                                <Text style={styles.pickerItemSubtitle}>Ref: {item.codigo_referencia} | Serial: {item.num_serial || 'N/A'}</Text>
                            </TouchableOpacity>
                        )}
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
    pdfButton: { padding: 8 },
    searchSection: { padding: 20 },
    toolSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4
    },
    selectorText: { flex: 1, marginLeft: 12, fontSize: 16, color: Colors.secondary },
    listContent: { padding: 20, paddingBottom: 100 },
    timelineItem: { flexDirection: 'row', marginBottom: 20 },
    timelineLine: { width: 2, backgroundColor: Colors.border, alignItems: 'center', marginRight: 15, position: 'relative' },
    timelineDot: { width: 12, height: 12, borderRadius: 6, position: 'absolute', top: 5, left: -5 },
    timelineContent: { flex: 1, backgroundColor: '#FFF', padding: 15, borderRadius: 12, elevation: 1 },
    movementHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    movementType: { fontWeight: '800', fontSize: 12 },
    movementDate: { fontSize: 12, color: Colors.textSecondary },
    movementDetail: { marginTop: 5 },
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, marginRight: 15 },
    detailText: { marginLeft: 6, fontSize: 13, color: Colors.secondary },
    statusBadge: { fontSize: 11, fontWeight: '700', marginLeft: 8 },
    observations: { marginTop: 8, fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic', borderTopWidth: 1, borderTopColor: Colors.surface, paddingTop: 5 },
    placeholderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    placeholderText: { textAlign: 'center', color: Colors.textSecondary, marginTop: 20, fontSize: 16 },
    emptyText: { textAlign: 'center', color: Colors.textSecondary, marginTop: 40 },
    modalContainer: { flex: 1, backgroundColor: '#FFF' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
    modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.secondary },
    modalSearch: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, margin: 20, borderRadius: 12, paddingHorizontal: 15 },
    modalInput: { flex: 1, paddingVertical: 12, marginLeft: 10, fontSize: 16 },
    pickerItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: Colors.border },
    pickerItemTitle: { fontSize: 16, fontWeight: '600', color: Colors.secondary },
    pickerItemSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 }
});

export default ToolLifeCycleScreen;
