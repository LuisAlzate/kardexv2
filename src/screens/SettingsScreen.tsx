import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, ActivityIndicator } from 'react-native';
import { ArrowLeft, Download, Upload, Database, Users, MapPin, Briefcase, Shield, TrendingUp } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { getMovementRepository } from '../database/repositories/MovementRepository';
import { SQLiteUserRepository } from '../database/repositories/UserRepository';
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

interface SettingsScreenProps {
    onBack: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
    const { isOnline } = useAuth();
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

    const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    // ----- Export Logic -----
    const convertToCSV = (headers: string[], data: any[]) => {
        const csvRows = [];
        csvRows.push('\uFEFF' + headers.join(','));
        for (const row of data) {
            const values = headers.map(header => {
                const val = row[header];
                const escaped = ('' + (val ?? '')).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }
        return csvRows.join('\n');
    };

    const exportData = async (filename: string, headers: string[], data: any[]) => {
        try {
            if (data.length === 0) {
                Alert.alert('Aviso', 'No hay datos para exportar en esta tabla.');
                return;
            }
            const csvString = convertToCSV(headers, data);
            if (Platform.OS === 'web') {
                const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", filename);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                const fileUri = `${FileSystem.documentDirectory}${filename}`;
                await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });
                await Sharing.shareAsync(fileUri);
            }
        } catch (error) {
            console.error('Error exporting CSV:', error);
            Alert.alert('Error', 'Hubo un error al exportar el archivo.');
        }
    };

    const exportTools = async () => {
        setLoadingAction('tools');
        try {
            const repo = await getMovementRepository(isOnline);
            const data = await repo.getToolsWithStock();
            const cleanData = data.map(t => ({
                codigo_referencia: t.codigo_referencia,
                nombre: t.nombre,
                marca: t.marca,
                descripcion: t.descripcion,
                num_serial: t.num_serial,
                fecha_compra: t.fecha_compra,
                estanteria: t.estanteria,
                stock_bueno: t.stock_bueno,
                stock_malo: t.stock_malo,
                stock_total: t.stock_total
            }));
            const headers = ['codigo_referencia', 'nombre', 'marca', 'descripcion', 'num_serial', 'fecha_compra', 'estanteria', 'stock_bueno', 'stock_malo', 'stock_total'];
            await exportData('herramientas_respaldo.csv', headers, cleanData);
        } catch (e) {
            Alert.alert('Error', 'Fallo al exportar herramientas.');
        } finally {
            setLoadingAction(null);
        }
    };

    const exportCollaborators = async () => {
        setLoadingAction('collaborators');
        try {
            const repo = await getMovementRepository(isOnline);
            const data = await repo.getAllCollaborators();
            const cleanData = data.map(c => ({
                cedula: c.cedula,
                nombre: c.nombre,
                cargo: c.cargo
            }));
            const headers = ['cedula', 'nombre', 'cargo'];
            await exportData('colaboradores_respaldo.csv', headers, cleanData);
        } catch (e) { Alert.alert('Error', 'Fallo al exportar colaboradores.'); } finally { setLoadingAction(null); }
    };

    const exportLocations = async () => {
        setLoadingAction('locations');
        try {
            const repo = await getMovementRepository(isOnline);
            const data = await repo.getAllLocations();
            const cleanData = data.map(l => ({ nombre_obra: l.nombre_obra, estado: l.estado }));
            const headers = ['nombre_obra', 'estado'];
            await exportData('ubicaciones_respaldo.csv', headers, cleanData);
        } catch (e) { Alert.alert('Error', 'Fallo al exportar ubicaciones.'); } finally { setLoadingAction(null); }
    };

    const exportBusinessLines = async () => {
        setLoadingAction('business_lines');
        try {
            const repo = await getMovementRepository(isOnline);
            const data = await repo.getAllBusinessLines();
            const cleanData = data.map(b => ({ codigo: b.codigo, nombre: b.nombre }));
            const headers = ['codigo', 'nombre'];
            await exportData('lineas_negocio_respaldo.csv', headers, cleanData);
        } catch (e) { Alert.alert('Error', 'Fallo al exportar líneas de negocio.'); } finally { setLoadingAction(null); }
    };

    const exportUsers = async () => {
        setLoadingAction('users');
        try {
            const db = await SQLite.openDatabaseAsync('kardex.db');
            const repo = new SQLiteUserRepository(db);
            const data = await repo.getAllUsers();
            const cleanData = data.map(u => ({ documento: u.documento || '', nombre: u.nombre, email: u.email, rol: u.rol }));
            const headers = ['documento', 'nombre', 'email', 'rol'];
            await exportData('usuarios_sistema_respaldo.csv', headers, cleanData);
        } catch (e) { Alert.alert('Error', 'Fallo al exportar usuarios.'); } finally { setLoadingAction(null); }
    };

    const exportMovements = async () => {
        setLoadingAction('movements');
        try {
            const repo = await getMovementRepository(isOnline);
            const data = await repo.getMovements(999999, 0); 
            const cleanData = data.map(m => {
                const clearObs = m.observaciones?.replace(/Ref: EXP-\d+\.?\s?/, '').trim() || '';
                return {
                    fecha: m.fecha,
                    tipo_movimiento: m.tipo_movimiento,
                    cantidad: m.cantidad,
                    estado_insumo: m.estado_insumo,
                    tool_codigo: m.tool_codigo,
                    tool_nombre: m.tool_nombre,
                    tool_serial: m.tool_serial || '',
                    collaborator_nombre: m.collaborator_nombre || 'ALMACÉN PRINCIPAL',
                    location_nombre: m.location_nombre || '',
                    business_line_nombre: m.business_line_nombre || '',
                    observaciones: clearObs
                };
            });
            const headers = ['fecha', 'tipo_movimiento', 'cantidad', 'estado_insumo', 'tool_codigo', 'tool_nombre', 'tool_serial', 'collaborator_nombre', 'location_nombre', 'business_line_nombre', 'observaciones'];
            await exportData('historial_movimientos_respaldo.csv', headers, cleanData);
        } catch (e) { Alert.alert('Error', 'Fallo al exportar movimientos.'); } finally { setLoadingAction(null); }
    };

    // ----- Import Logic -----
    const parseCSV = (csvText: string) => {
        const lines = csvText.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) return [];
        let headerLine = lines[0];
        if (headerLine.charCodeAt(0) === 0xFEFF) headerLine = headerLine.substring(1);
        const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const result = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const values = [];
            let curVal = '';
            let inQuotes = false;
            for (let char of line) {
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) { values.push(curVal); curVal = ''; }
                else curVal += char;
            }
            values.push(curVal);
            const obj: any = {};
            for(let j=0; j<headers.length; j++) {
                obj[headers[j]] = values[j] ? values[j].replace(/^"|"$/g, '').trim() : '';
            }
            result.push(obj);
        }
        return result;
    };

    const handleImport = async (type: 'tools' | 'collaborators' | 'locations' | 'business_lines' | 'users' | 'movements') => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
            if (result.canceled) return;

            setLoadingAction(`import_${type}`);
            const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
            const records = parseCSV(fileContent);

            if (!records || records.length === 0) {
                Alert.alert('Error', 'El archivo CSV está vacío o no es válido.');
                return;
            }

            const repo = await getMovementRepository(isOnline);
            const dbRef = await SQLite.openDatabaseAsync('kardex.db');
            const userRepo = new SQLiteUserRepository(dbRef);
            let importedCount = 0;

            for (const row of records) {
                if (type === 'tools') {
                    if (!row.codigo_referencia || !row.nombre) continue;
                    const existing = await repo.getToolByCodeAndSerial(row.codigo_referencia, row.num_serial || null);
                    if (!existing) {
                        // Ignores stock_bueno, stock_malo, stock_total when importing
                        await repo.createTool({
                            id: generateUUID(),
                            codigo_referencia: row.codigo_referencia,
                            nombre: row.nombre,
                            marca: row.marca || undefined,
                            descripcion: row.descripcion || undefined,
                            num_serial: row.num_serial || undefined,
                            fecha_compra: row.fecha_compra || undefined,
                            estanteria: row.estanteria || undefined
                        });
                        importedCount++;
                    }
                } else if (type === 'collaborators') {
                    if (!row.cedula || !row.nombre) continue;
                    try {
                        await repo.createCollaborator({ id: generateUUID(), cedula: String(row.cedula), nombre: row.nombre, cargo: row.cargo || 'OPERARIO' });
                        importedCount++;
                    } catch (e) { /* Ignore duplicados de cédula */ }
                } else if (type === 'locations') {
                    if (!row.nombre_obra) continue;
                    try {
                        await repo.createLocation({ id: generateUUID(), nombre_obra: row.nombre_obra, estado: row.estado || 'Activo' });
                        importedCount++;
                    } catch (e) {}
                } else if (type === 'business_lines') {
                    if (!row.codigo || !row.nombre) continue;
                    try {
                        await repo.createBusinessLine({ id: generateUUID(), codigo: String(row.codigo), nombre: row.nombre });
                        importedCount++;
                    } catch (e) {}
                } else if (type === 'users') {
                    if (!row.email || !row.nombre) continue;
                    try {
                        await userRepo.createUser({
                            id: generateUUID(),
                            nombre: row.nombre,
                            email: String(row.email),
                            documento: row.documento || undefined,
                            rol: row.rol || 'operario',
                            password_hash: row.password_hash || 'import_temp'
                        });
                        importedCount++;
                    } catch(e) {}
                } else if (type === 'movements') {
                    if (!row.tool_codigo || !row.tipo_movimiento) continue;
                    const tool = await repo.getToolByCodeAndSerial(row.tool_codigo, row.tool_serial || null);
                    if (!tool) continue; 
                    
                    let collabId: string | undefined = undefined;
                    let locId: string | undefined = undefined;
                    let blId: string | undefined = undefined;
                    
                    if (row.collaborator_nombre && row.collaborator_nombre !== 'ALMACÉN PRINCIPAL') {
                        const collabs = await repo.getAllCollaborators();
                        const matching = collabs.find(c => c.nombre === row.collaborator_nombre);
                        if (matching) collabId = matching.id;
                    }

                    try {
                        await repo.registerMovement({
                            id: generateUUID(),
                            herramienta_id: tool.id,
                            trabajador_id: collabId,
                            ubicacion_id: locId, 
                            linea_negocio_id: blId,
                            tipo_movimiento: row.tipo_movimiento as any,
                            cantidad: parseInt(row.cantidad) || 1,
                            estado_insumo: row.estado_insumo as any || 'BUENA',
                            observaciones: row.observaciones,
                            usuario_sistema_id: 'd9b23-1d02-4ec2-9e32-system-import',
                            fecha: row.fecha || new Date().toISOString()
                        });
                        importedCount++;
                    } catch(e) {}
                }
            }

            Alert.alert('Éxito', `Has restaurado ${importedCount} registros exitosamente.`);
        } catch (error: any) {
            console.error('Import Error:', error);
            Alert.alert('Error', 'No se pudo leer el archivo CSV. Comprueba el formato.');
        } finally {
            setLoadingAction(null);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.secondary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Configuración de Datos</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tab, activeTab === 'export' && styles.activeTab]} onPress={() => setActiveTab('export')}>
                    <Download size={18} color={activeTab === 'export' ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.tabText, activeTab === 'export' && styles.activeTabText]}>Exportar CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'import' && styles.activeTab]} onPress={() => setActiveTab('import')}>
                    <Upload size={18} color={activeTab === 'import' ? Colors.primary : Colors.textSecondary} />
                    <Text style={[styles.tabText, activeTab === 'import' && styles.activeTabText]}>Importar CSV</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {activeTab === 'export' ? (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Database size={20} color={Colors.primary} />
                            <Text style={styles.sectionTitle}>Copias de Seguridad Libres (CSV)</Text>
                        </View>
                        <Text style={styles.sectionDescription}>
                            Exporta la información limpiando los IDs técnicos (UUID). Extrae las columnas legibles al usuario para manipularlas en Excel o resguardarlas de manera offline.
                        </Text>
                        <BackupCard title="Inventario, Herramientas y Stock" description="Exporta descripción, códigos, ubicación física y recuentos de insumos totales calculados." icon={<Database size={24} color={Colors.secondary} />} onPress={exportTools} loading={loadingAction === 'tools'} />
                        <BackupCard title="Plantilla de Colaboradores" description="Exporta nombres, cédulas y cargos actuales." icon={<Users size={24} color={Colors.secondary} />} onPress={exportCollaborators} loading={loadingAction === 'collaborators'} />
                        <BackupCard title="Puntos / Ubicaciones" description="Exporta la lista de bodegas y frentes de trabajo." icon={<MapPin size={24} color={Colors.secondary} />} onPress={exportLocations} loading={loadingAction === 'locations'} />
                        <BackupCard title="Líneas de Negocio" description="Exporta centros de costos y líneas vigentes vinculadas." icon={<Briefcase size={24} color={Colors.secondary} />} onPress={exportBusinessLines} loading={loadingAction === 'business_lines'} />
                        <BackupCard title="Historial de Movimientos" description="Exporta el kárdex completo con movimientos, devoluciones, traslados e historiales técnicos." icon={<TrendingUp size={24} color={Colors.secondary} />} onPress={exportMovements} loading={loadingAction === 'movements'} />
                        <BackupCard title="Usuarios del Sistema" description="Exporta nombres y perfiles asignados." icon={<Shield size={24} color={Colors.secondary} />} onPress={exportUsers} loading={loadingAction === 'users'} />
                    </View>
                ) : (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Upload size={20} color={Colors.error} />
                            <Text style={styles.sectionTitle}>Restauración desde CSV (¡Cuidado!)</Text>
                        </View>
                        <Text style={styles.sectionDescription}>
                            Selecciona un archivo CSV para la importación en lote. Los registros idénticos que ya existan en la tabla matriz en este dispositivo serán ignorados.
                        </Text>
                        <BackupCard isImport title="Subir Inventario Master" description="Sube herramientas y códigos. Los totales se ignorarán (la base lo auto-calcula)." icon={<Database size={24} color={Colors.secondary} />} onPress={() => handleImport('tools')} loading={loadingAction === 'import_tools'} />
                        <BackupCard isImport title="Subir Lote de Colaboradores" description="Sube nuevos colaboradores mediante un CSV tabulado." icon={<Users size={24} color={Colors.secondary} />} onPress={() => handleImport('collaborators')} loading={loadingAction === 'import_collaborators'} />
                        <BackupCard isImport title="Restaurar Ubicaciones" description="Carga sedes, bodegas y proyectos masivamente." icon={<MapPin size={24} color={Colors.secondary} />} onPress={() => handleImport('locations')} loading={loadingAction === 'import_locations'} />
                        <BackupCard isImport title="Restaurar Líneas de Negocio" description="Carga centros de costos y categorías." icon={<Briefcase size={24} color={Colors.secondary} />} onPress={() => handleImport('business_lines')} loading={loadingAction === 'import_business_lines'} />
                        <BackupCard isImport title="Restaurar Usuarios" description="Inserta cuentas de sistema de forma automatizada." icon={<Shield size={24} color={Colors.secondary} />} onPress={() => handleImport('users')} loading={loadingAction === 'import_users'} />
                        <BackupCard isImport title="Restaurar Historial de Kárdex" description="Regresa registros puros de Entrada y Salida (Requiere inyectar Primero Inventario)." icon={<TrendingUp size={24} color={Colors.secondary} />} onPress={() => handleImport('movements')} loading={loadingAction === 'import_movements'} />
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const BackupCard = ({ title, description, icon, onPress, loading, isImport = false }: any) => {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} disabled={loading}>
            <View style={styles.cardIconBox}>
                {icon}
            </View>
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardDesc}>{description}</Text>
            </View>
            <View style={styles.cardAction}>
                {loading ? <ActivityIndicator size="small" color={Colors.primary} /> : 
                 isImport ? <Upload size={20} color={Colors.primary} /> :
                 <Download size={20} color={Colors.primary} />}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: Colors.border, elevation: 2 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.secondary, flex: 1, textAlign: 'center', marginLeft: -10 },
    backButton: { padding: 8 },
    tabContainer: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: Colors.border },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
    activeTab: { borderBottomWidth: 2, borderBottomColor: Colors.primary },
    tabText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    activeTabText: { color: Colors.primary },
    content: { padding: 24 },
    section: { marginBottom: 30 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.secondary, marginLeft: 8 },
    sectionDescription: { fontSize: 13, color: Colors.textSecondary, marginBottom: 20, lineHeight: 18 },
    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, elevation: 1 },
    cardIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    cardContent: { flex: 1 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: Colors.secondary, marginBottom: 4 },
    cardDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
    cardAction: { padding: 10 }
});

export default SettingsScreen;
