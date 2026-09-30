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
    ScrollView,
} from 'react-native';
import { ArrowLeft, Filter, Calendar, ArrowDownLeft, ArrowUpRight, Search, Briefcase, Download } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';

import * as SQLite from 'expo-sqlite';
import { getMovementRepository, MovementListItem, Collaborator, Location, BusinessLine } from '../database/repositories/MovementRepository';
import { Users, MapPin, X } from 'lucide-react-native';
import { Modal, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { LOGO_BASE64 } from '../constants/LogoBase64';

interface MovementHistoryScreenProps {
    onBack: () => void;
}

const PAGE_SIZE = 20; // Increased to allow better grouping per page

interface GroupedMovement {
    id: string; // This will be the reference code or the first movement's ID
    tipo_movimiento: string;
    fecha: string;
    collaborator_nombre?: string;
    location_nombre?: string;
    trabajador_id?: string;
    ubicacion_id?: string;
    business_line_nombre?: string;
    items: {
        tool_nombre: string;
        tool_codigo: string;
        tool_serial?: string;
        cantidad: number;
        estado_insumo?: string;
    }[];
    observaciones?: string;
}

const MovementHistoryScreen: React.FC<MovementHistoryScreenProps> = ({ onBack }) => {
    const { isOnline } = useAuth();
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [movements, setMovements] = useState<GroupedMovement[]>([]);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    // Filters
    const [filterType, setFilterType] = useState<string | undefined>(undefined);
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [filterCollaboratorId, setFilterCollaboratorId] = useState<string | undefined>(undefined);
    const [filterLocationId, setFilterLocationId] = useState<string | undefined>(undefined);
    const [filterBusinessLineId, setFilterBusinessLineId] = useState<string | undefined>(undefined);
    const [filterCode, setFilterCode] = useState('');
    const [filterSerial, setFilterSerial] = useState('');

    // Detail Modal
    const [selectedMovement, setSelectedMovement] = useState<GroupedMovement | null>(null);

    // Data for pickers
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [businessLines, setBusinessLines] = useState<BusinessLine[]>([]);
    const [showCollaboratorPicker, setShowCollaboratorPicker] = useState(false);
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [showBusinessLinePicker, setShowBusinessLinePicker] = useState(false);

    // Picker state
    const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        loadMovements(true);
    }, [filterType, startDate, endDate, filterCollaboratorId, filterLocationId, filterCode, filterSerial]);

    const loadInitialData = async () => {
        try {
            const repo = await getMovementRepository(isOnline);
            const [c, l, bl] = await Promise.all([
                repo.getAllCollaborators(),
                repo.getAllLocations(),
                repo.getAllBusinessLines()
            ]);
            setCollaborators(c);
            setLocations(l);
            setBusinessLines(bl);
        } catch (error) {
            console.error(error);
        }
    };

    const groupMovements = (data: MovementListItem[]): GroupedMovement[] => {
        const groups: { [key: string]: GroupedMovement } = {};

        data.forEach(item => {
            // Try to extract EXP code from observations: "Ref: EXP-123456. ..."
            const match = item.observaciones?.match(/Ref: (EXP-\d+)/);
            const exitCode = match ? match[1] : null;

            // Grouping key: ExitCode OR (Date + Type + Collab + Location)
            const key = exitCode || `${item.fecha}_${item.tipo_movimiento}_${item.trabajador_id}_${item.ubicacion_id}_${item.linea_negocio_id}`;

            if (!groups[key]) {
                // Clean observations: remove the Ref code part
                const cleanObs = item.observaciones?.replace(/Ref: EXP-\d+\.?\s?/, '').trim();

                groups[key] = {
                    id: exitCode || item.id,
                    tipo_movimiento: item.tipo_movimiento,
                    fecha: item.fecha || '',
                    collaborator_nombre: item.collaborator_nombre,
                    location_nombre: item.location_nombre,
                    business_line_nombre: item.business_line_nombre,
                    trabajador_id: item.trabajador_id,
                    ubicacion_id: item.ubicacion_id,
                    items: [] as any,
                    observaciones: cleanObs
                };
            }

            groups[key].items.push({
                tool_nombre: item.tool_nombre,
                tool_codigo: item.tool_codigo,
                tool_serial: item.tool_serial,
                cantidad: item.cantidad,
                estado_insumo: item.estado_insumo
            });
        });

        return Object.values(groups);
    };

    const loadMovements = async (reset = false) => {
        if (reset) {
            setLoading(true);
            setOffset(0);
        } else {
            setLoadingMore(true);
        }

        try {
            const repo = await getMovementRepository(isOnline);

            const currentOffset = reset ? 0 : offset;
            const startStr = startDate ? startDate.toISOString().split('T')[0] : undefined;
            const endStr = endDate ? endDate.toISOString().split('T')[0] : undefined;

            const data = await repo.getMovements(
                PAGE_SIZE,
                currentOffset,
                filterType,
                startStr,
                endStr,
                filterCollaboratorId,
                filterLocationId,
                filterCode,
                filterSerial,
                filterBusinessLineId
            );

            const groupedData = groupMovements(data);

            if (reset) {
                setMovements(groupedData);
            } else {
                setMovements(prev => {
                    // Flatten prev back to raw items to regroup with new data
                    const prevRaw: MovementListItem[] = prev.flatMap(g =>
                        g.items.map(i => ({
                            ...g,
                            tool_nombre: i.tool_nombre,
                            tool_codigo: i.tool_codigo,
                            tool_serial: i.tool_serial,
                            cantidad: i.cantidad,
                            estado_insumo: i.estado_insumo,
                            // Re-construct observations with code if it was an exit code group
                            observaciones: (g.id && g.id.startsWith('EXP-')) ? `Ref: ${g.id}. ${g.observaciones}` : g.observaciones
                        } as any))
                    );
                    return groupMovements([...prevRaw, ...data]);
                });
            }

            setHasMore(data.length === PAGE_SIZE);
            setOffset(currentOffset + data.length);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        try {
            return date.toLocaleString('es-CO', {
                timeZone: 'America/Bogota',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: true
            });
        } catch (e) {
            return date.toLocaleString();
        }
    };

    const renderItem = ({ item }: { item: GroupedMovement }) => {
        const isEntry = item.tipo_movimiento === 'ENTRADA' || item.tipo_movimiento === 'DEVOLUCION';
        const isGrouped = item.items && item.items.length > 1;

        return (
            <TouchableOpacity style={styles.card} onPress={() => setSelectedMovement(item)}>
                <View style={styles.cardHeader}>
                    <View style={[styles.typeBadge, { backgroundColor: isEntry ? Colors.success + '20' : Colors.error + '20' }]}>
                        {isEntry ? (
                            <ArrowDownLeft size={16} color={Colors.success} />
                        ) : (
                            <ArrowUpRight size={16} color={Colors.error} />
                        )}
                        <Text style={[styles.typeText, { color: isEntry ? Colors.success : Colors.error }]}>
                            {item.tipo_movimiento}{isGrouped ? ' MÚLTIPLE' : ''}
                        </Text>
                    </View>
                    <View style={styles.headerRight}>
                        <Text style={styles.dateText}>{formatDate(item.fecha)}</Text>
                        {!!(item.id && item.id.startsWith('EXP-')) && (
                            <View style={styles.referenceBadge}>
                                <Text style={styles.referenceText}>{item.id}</Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={styles.cardBody}>
                    {item.items && item.items.map((tool, idx) => (
                        <View key={idx} style={styles.groupedToolRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.toolName}>{tool.tool_nombre}</Text>
                                <Text style={styles.toolDetail}>
                                    Ref: {tool.tool_codigo} {tool.tool_serial ? `| S/N: ${tool.tool_serial}` : ''}
                                </Text>
                            </View>
                            <Text style={styles.toolQty}>x{tool.cantidad}</Text>
                        </View>
                    ))}

                    {item.business_line_nombre ? (
                        <View style={styles.infoRow}>
                            <Briefcase size={12} color={Colors.textSecondary} style={{ marginRight: 4 }} />
                            <Text style={styles.infoValue}>{item.business_line_nombre}</Text>
                        </View>
                    ) : null}
                </View>

                {item.observaciones ? (
                    <Text style={styles.observations} numberOfLines={1}>"{item.observaciones}"</Text>
                ) : null}
            </TouchableOpacity>
        );
    };

    const generateMovementPDF = async () => {
        if (!selectedMovement) return;
        
        const collab = collaborators.find(c => c.id === selectedMovement.trabajador_id) || {
            nombre: selectedMovement.collaborator_nombre || 'ALMACÉN PRINCIPAL',
            cargo: 'ALMACÉN',
            cedula: 'N/A'
        };

        const isEntrada = selectedMovement.tipo_movimiento === 'ENTRADA' || selectedMovement.tipo_movimiento === 'DEVOLUCION';
        const isSalida = selectedMovement.tipo_movimiento === 'SALIDA';

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #000; background: white; width: 100%; box-sizing: border-box;">
                <table style="width: 100%; border-collapse: collapse; text-align: center; border: 2px solid #000; margin-bottom: 20px;">
                    <tr>
                        <td rowspan="3" style="width: 25%; border: 1px solid #000; padding: 10px; vertical-align: middle;">
                            <img src="${LOGO_BASE64}" style="width: 140px; height: 75px; object-fit: contain; display: block; margin: 0 auto;" />
                        </td>
                        <td rowspan="3" style="width: 45%; border: 1px solid #000; font-weight: bold; font-size: 16px; vertical-align: middle;">
                            FORMATO MOVIMIENTO DE HERRAMIENTAS
                        </td>
                        <td style="width: 30%; border: 1px solid #000; text-align: left; padding: 5px; font-size: 11px;">
                            <strong>Código:</strong> COM-F-04
                        </td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #000; text-align: left; padding: 5px; font-size: 11px;">
                            <strong>Versión:</strong> 01
                        </td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #000; text-align: left; padding: 5px; font-size: 11px;">
                            <strong>Vigencia:</strong> marzo 2026
                        </td>
                    </tr>
                </table>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; border: 1px solid #000;">
                    <tr>
                        <td style="padding: 8px; border: 1px solid #000; width: 15%;"><strong>Nombre:</strong></td>
                        <td style="padding: 8px; border: 1px solid #000; width: 35%;">${collab.nombre}</td>
                        <td style="padding: 8px; border: 1px solid #000; width: 15%;"><strong>Cargo:</strong></td>
                        <td style="padding: 8px; border: 1px solid #000; width: 35%;">${collab.cargo || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #000;"><strong>Cédula:</strong></td>
                        <td style="padding: 8px; border: 1px solid #000;">${collab.cedula || 'N/A'}</td>
                        <td style="padding: 8px; border: 1px solid #000;"><strong>Fecha Entrega:</strong></td>
                        <td style="padding: 8px; border: 1px solid #000;">${formatDate(selectedMovement.fecha)}</td>
                    </tr>
                </table>

                <div style="display: flex; justify-content: flex-start; align-items: center; margin-bottom: 20px; font-size: 14px;">
                    <div style="margin-right: 30px;">
                        <strong>Entrada:</strong> <span style="display: inline-block; width: 20px; height: 20px; border: 1px solid #000; text-align: center; line-height: 20px; margin-left: 5px;">${isEntrada ? 'X' : '&nbsp;'}</span>
                    </div>
                    <div>
                        <strong>Salida:</strong> <span style="display: inline-block; width: 20px; height: 20px; border: 1px solid #000; text-align: center; line-height: 20px; margin-left: 5px;">${isSalida ? 'X' : '&nbsp;'}</span>
                    </div>
                </div>

                <div style="border: 1px solid #000; padding: 10px; font-size: 12px; text-align: justify; margin-bottom: 20px; background-color: #f9f9f9;">
                    <strong>Nota:</strong> El trabajador declara haber recibido las herramientas descritas en este documento en buen estado y se compromete a usarlas correctamente, cuidarlas y devolverlas cuando la empresa lo requiera. En caso de perdida, daño o deterioro por mal uso o negligencia, el trabajador acepta asumir el valor correspondiente, conforme a la normatividad laboral vigente.
                </div>

                <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; border: 1px solid #000;">
                    <thead>
                        <tr style="background-color: #f4f4f4;">
                            <th style="padding: 8px; border: 1px solid #000; width: 8%;">CANT.</th>
                            <th style="padding: 8px; border: 1px solid #000; width: 30%;">DESCRIPCIÓN DE HERRAMIENTA</th>
                            <th style="padding: 8px; border: 1px solid #000; width: 12%;">CÓDIGO</th>
                            <th style="padding: 8px; border: 1px solid #000; width: 15%;">SERIAL</th>
                            <th style="padding: 8px; border: 1px solid #000; width: 10%;">ESTADO</th>
                            <th style="padding: 8px; border: 1px solid #000; width: 25%;">OBSERVACIONES</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${selectedMovement.items.map(item => `
                            <tr>
                                <td style="padding: 8px; border: 1px solid #000; text-align: center;">${item.cantidad}</td>
                                <td style="padding: 8px; border: 1px solid #000;">${item.tool_nombre}</td>
                                <td style="padding: 8px; border: 1px solid #000; text-align: center;">${item.tool_codigo}</td>
                                <td style="padding: 8px; border: 1px solid #000; text-align: center;">${item.tool_serial || 'N/R'}</td>
                                <td style="padding: 8px; border: 1px solid #000; text-align: center;">${item.estado_insumo || 'OPERATIVO'}</td>
                                <td style="padding: 8px; border: 1px solid #000;"></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div style="display: flex; justify-content: space-between; margin-top: 80px;">
                    <div style="width: 40%; text-align: center;">
                        <div style="border-top: 1px solid #000; padding-top: 5px; font-weight: bold; font-size: 12px;">Firma Almacén</div>
                    </div>
                    <div style="width: 40%; text-align: center;">
                        <div style="border-top: 1px solid #000; padding-top: 5px; font-weight: bold; font-size: 12px;">Firma Trabajador</div>
                    </div>
                </div>
            </div>
        `;

        try {
            if (Platform.OS === 'web') {
                const style = document.createElement('style');
                style.id = 'print-style-mov';
                style.innerHTML = `
                    @media print {
                        body > :not(#print-container-mov) { display: none !important; }
                        #print-container-mov { display: block !important; position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
                    }
                `;
                document.head.appendChild(style);

                const printDiv = document.createElement('div');
                printDiv.id = 'print-container-mov';
                printDiv.style.position = 'absolute';
                printDiv.style.top = '0';
                printDiv.style.left = '0';
                printDiv.style.width = '100%';
                printDiv.style.backgroundColor = 'white';
                printDiv.style.zIndex = '99999';
                printDiv.innerHTML = htmlContent;
                document.body.appendChild(printDiv);
                
                window.print();
                
                setTimeout(() => {
                    if (document.head.contains(style)) document.head.removeChild(style);
                    if (document.body.contains(printDiv)) document.body.removeChild(printDiv);
                }, 500);
            } else {
                const { uri } = await Print.printToFileAsync({ html: htmlContent });
                if (uri) await Sharing.shareAsync(uri);
            }
        } catch (error) {
            console.error('Error generando PDF:', error);
            Alert.alert('Error', 'No se pudo generar el documento.');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.secondary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Historial de Movimientos</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.filterSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    <TouchableOpacity
                        style={[styles.filterChip, !filterType && styles.filterChipActive]}
                        onPress={() => setFilterType(undefined)}
                    >
                        <Text style={[styles.filterChipText, !filterType && styles.filterChipTextActive]}>Todos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterChip, filterType === 'ENTRADA' && styles.filterChipActive]}
                        onPress={() => setFilterType('ENTRADA')}
                    >
                        <Text style={[styles.filterChipText, filterType === 'ENTRADA' && styles.filterChipTextActive]}>Entradas</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterChip, filterType === 'SALIDA' && styles.filterChipActive]}
                        onPress={() => setFilterType('SALIDA')}
                    >
                        <Text style={[styles.filterChipText, filterType === 'SALIDA' && styles.filterChipTextActive]}>Salidas</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.dateButton, filterCollaboratorId && styles.dateButtonActive]}
                        onPress={() => setShowCollaboratorPicker(true)}
                    >
                        <Users size={14} color={filterCollaboratorId ? '#FFF' : Colors.textSecondary} style={{ marginRight: 6 }} />
                        <Text style={[styles.dateButtonText, filterCollaboratorId && styles.dateButtonTextActive]} numberOfLines={1}>
                            {filterCollaboratorId ? collaborators.find(c => c.id === filterCollaboratorId)?.nombre : 'Colaborador'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.dateButton, filterLocationId && styles.dateButtonActive]}
                        onPress={() => setShowLocationPicker(true)}
                    >
                        <MapPin size={14} color={filterLocationId ? '#FFF' : Colors.textSecondary} style={{ marginRight: 6 }} />
                        <Text style={[styles.dateButtonText, filterLocationId && styles.dateButtonTextActive]} numberOfLines={1}>
                            {filterLocationId ? locations.find(l => l.id === filterLocationId)?.nombre_obra : 'Ubicación'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.dateButton, filterBusinessLineId && styles.dateButtonActive]}
                        onPress={() => setShowBusinessLinePicker(true)}
                    >
                        <Briefcase size={14} color={filterBusinessLineId ? '#FFF' : Colors.textSecondary} style={{ marginRight: 6 }} />
                        <Text style={[styles.dateButtonText, filterBusinessLineId && styles.dateButtonTextActive]} numberOfLines={1}>
                            {filterBusinessLineId ? businessLines.find(bl => bl.id === filterBusinessLineId)?.nombre : 'Línea Negocio'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.dateButton, startDate && styles.dateButtonActive]}
                        onPress={() => setShowPicker('start')}
                    >
                        <Calendar size={14} color={startDate ? '#FFF' : Colors.textSecondary} style={{ marginRight: 6 }} />
                        <Text style={[styles.dateButtonText, startDate && styles.dateButtonTextActive]}>
                            {startDate ? startDate.toLocaleDateString() : 'Desde'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.dateButton, endDate && styles.dateButtonActive]}
                        onPress={() => setShowPicker('end')}
                    >
                        <Calendar size={14} color={endDate ? '#FFF' : Colors.textSecondary} style={{ marginRight: 6 }} />
                        <Text style={[styles.dateButtonText, endDate && styles.dateButtonTextActive]}>
                            {endDate ? endDate.toLocaleDateString() : 'Hasta'}
                        </Text>
                    </TouchableOpacity>

                    {(startDate || endDate || filterCollaboratorId || filterLocationId || filterCode || filterSerial) && (
                        <TouchableOpacity onPress={() => {
                            setStartDate(null);
                            setEndDate(null);
                            setFilterCollaboratorId(undefined);
                            setFilterLocationId(undefined);
                            setFilterBusinessLineId(undefined);
                            setFilterCode('');
                            setFilterSerial('');
                        }}>
                            <Text style={styles.clearText}>Limpiar</Text>
                        </TouchableOpacity>
                    )}

                </ScrollView>
            </View>

            <View style={styles.searchBarSection}>
                <View style={styles.searchField}>
                    <Search size={16} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInputSmall}
                        placeholder="Código..."
                        value={filterCode}
                        onChangeText={setFilterCode}
                        autoCorrect={false}
                    />
                </View>
                <View style={[styles.searchField, { marginLeft: 10 }]}>
                    <Search size={16} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInputSmall}
                        placeholder="Serial..."
                        value={filterSerial}
                        onChangeText={setFilterSerial}
                        autoCorrect={false}
                    />
                </View>
            </View>

            {showPicker && (
                Platform.OS === 'web' ? (
                    <View style={styles.webOverlay}>
                        <View style={styles.webPickerContainer}>
                            <Text style={styles.webPickerLabel}>Seleccione Fecha:</Text>
                            {React.createElement('input', {
                                type: 'date',
                                style: {
                                    padding: '10px',
                                    borderRadius: '8px',
                                    border: '1px solid #ccc',
                                    fontSize: '16px',
                                    flex: 1,
                                    height: '45px',
                                    outline: 'none'
                                },
                                value: (showPicker === 'start' ? startDate : endDate)?.toISOString().split('T')[0] || '',
                                onChange: (e: any) => {
                                    const val = e.target.value;
                                    if (val) {
                                        const [y, m, d] = val.split('-').map(Number);
                                        const date = new Date(y, m - 1, d, 12);
                                        if (showPicker === 'start') setStartDate(date);
                                        else setEndDate(date);
                                    }
                                    setShowPicker(null);
                                }
                            })}
                            <TouchableOpacity onPress={() => setShowPicker(null)} style={styles.webPickerClose}>
                                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>X</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={styles.overlayClose} onPress={() => setShowPicker(null)} />
                    </View>
                ) : (
                    <DateTimePicker
                        value={showPicker === 'start' ? (startDate || new Date()) : (endDate || new Date())}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event: any, selectedDate?: Date) => {
                            setShowPicker(null);
                            if (selectedDate) {
                                if (showPicker === 'start') setStartDate(selectedDate);
                                else setEndDate(selectedDate);
                            }
                        }}
                    />
                )
            )}

            {/* Collaborator Picker Modal */}
            <Modal visible={showCollaboratorPicker} animationType="slide" transparent={true}>
                <View style={[styles.webOverlay, { justifyContent: 'flex-end' }]}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Filtrar por Colaborador</Text>
                            <TouchableOpacity onPress={() => setShowCollaboratorPicker(false)}>
                                <X size={24} color={Colors.secondary} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={collaborators}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.toolItem}
                                    onPress={() => {
                                        setFilterCollaboratorId(item.id);
                                        setShowCollaboratorPicker(false);
                                    }}
                                >
                                    <View style={[styles.toolItemIcon, { backgroundColor: Colors.primary + '15' }]}>
                                        <Users size={20} color={Colors.primary} />
                                    </View>
                                    <View style={styles.toolItemInfo}>
                                        <Text style={styles.toolItemName}>{item.nombre}</Text>
                                        <Text style={styles.toolItemCode}>{item.cargo}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            ListHeaderComponent={
                                <TouchableOpacity
                                    style={styles.toolItem}
                                    onPress={() => {
                                        setFilterCollaboratorId(undefined);
                                        setShowCollaboratorPicker(false);
                                    }}
                                >
                                    <View style={[styles.toolItemIcon, { backgroundColor: Colors.border }]}>
                                        <Filter size={20} color={Colors.textSecondary} />
                                    </View>
                                    <View style={styles.toolItemInfo}>
                                        <Text style={styles.toolItemName}>Todos los colaboradores</Text>
                                    </View>
                                </TouchableOpacity>
                            }
                        />
                    </View>
                </View>
            </Modal>

            {/* Location Picker Modal */}
            <Modal visible={showLocationPicker} animationType="slide" transparent={true}>
                <View style={[styles.webOverlay, { justifyContent: 'flex-end' }]}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Filtrar por Ubicación</Text>
                            <TouchableOpacity onPress={() => setShowLocationPicker(false)}>
                                <X size={24} color={Colors.secondary} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={locations}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.toolItem}
                                    onPress={() => {
                                        setFilterLocationId(item.id);
                                        setShowLocationPicker(false);
                                    }}
                                >
                                    <View style={[styles.toolItemIcon, { backgroundColor: Colors.success + '15' }]}>
                                        <MapPin size={20} color={Colors.success} />
                                    </View>
                                    <View style={styles.toolItemInfo}>
                                        <Text style={styles.toolItemName}>{item.nombre_obra}</Text>
                                        <Text style={styles.toolItemCode}>{item.estado}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            ListHeaderComponent={
                                <TouchableOpacity
                                    style={styles.toolItem}
                                    onPress={() => {
                                        setFilterLocationId(undefined);
                                        setShowLocationPicker(false);
                                    }}
                                >
                                    <View style={[styles.toolItemIcon, { backgroundColor: Colors.border }]}>
                                        <Filter size={20} color={Colors.textSecondary} />
                                    </View>
                                    <View style={styles.toolItemInfo}>
                                        <Text style={styles.toolItemName}>Todas las ubicaciones</Text>
                                    </View>
                                </TouchableOpacity>
                            }
                        />
                    </View>
                </View>
            </Modal>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={movements}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    onEndReached={() => hasMore && !loadingMore && loadMovements()}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        loadingMore ? (
                            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 20 }} />
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Search size={64} color={Colors.border} />
                            <Text style={styles.emptyText}>No se encontraron movimientos</Text>
                        </View>
                    }
                />
            )}

            {/* Detail Modal */}
            <Modal visible={!!selectedMovement} animationType="fade" transparent={true}>
                <View style={styles.detailOverlay}>
                    <View style={styles.detailContent}>
                        <View style={styles.detailHeader}>
                            <Text style={styles.detailTitle}>Detalle del Movimiento</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <TouchableOpacity onPress={generateMovementPDF} style={{ marginRight: 20 }}>
                                    <Download size={24} color={Colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setSelectedMovement(null)}>
                                    <X size={24} color={Colors.secondary} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView style={styles.detailBody}>
                            <View style={styles.detailSection}>
                                <Text style={styles.detailSectionTitle}>Resumen</Text>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Tipo:</Text>
                                    <Text style={[styles.detailValue, { fontWeight: 'bold' }]}>{selectedMovement?.tipo_movimiento}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Fecha:</Text>
                                    <Text style={styles.detailValue}>{formatDate(selectedMovement?.fecha)}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Referencia:</Text>
                                    <Text style={styles.detailValue}>{selectedMovement?.id || 'N/A'}</Text>
                                </View>
                            </View>

                            <View style={styles.detailSection}>
                                <Text style={styles.detailSectionTitle}>Destino / Responsable</Text>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Ubicación:</Text>
                                    <Text style={styles.detailValue}>{selectedMovement?.location_nombre || 'N/A'}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Colaborador:</Text>
                                    <Text style={styles.detailValue}>{selectedMovement?.collaborator_nombre || 'N/A'}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Línea de Negocio:</Text>
                                    <Text style={styles.detailValue}>{selectedMovement?.business_line_nombre || 'N/A'}</Text>
                                </View>
                            </View>

                            <View style={styles.detailSection}>
                                <Text style={styles.detailSectionTitle}>Ítems ({selectedMovement?.items.length})</Text>
                                {selectedMovement?.items.map((it, idx) => (
                                    <View key={idx} style={styles.detailItemBox}>
                                        <Text style={styles.detailItemName}>{it.tool_nombre}</Text>
                                        <Text style={styles.detailItemSub}>Cod: {it.tool_codigo} {it.tool_serial ? `| S/N: ${it.tool_serial}` : ''}</Text>
                                        <Text style={styles.detailItemQty}>Cantidad: {it.cantidad}</Text>
                                    </View>
                                ))}
                            </View>

                            {selectedMovement?.observaciones && (
                                <View style={styles.detailSection}>
                                    <Text style={styles.detailSectionTitle}>Observaciones</Text>
                                    <Text style={styles.detailObsText}>"{selectedMovement.observaciones}"</Text>
                                </View>
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setSelectedMovement(null)}
                        >
                            <Text style={styles.closeButtonText}>Cerrar</Text>
                        </TouchableOpacity>
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
    filterSection: {
        backgroundColor: '#FFF',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    filterScroll: {
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: Colors.surface,
        marginRight: 10,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    filterChipActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    filterChipText: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    filterChipTextActive: {
        color: '#FFF',
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        paddingHorizontal: 12,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: Colors.border,
        marginLeft: 8,
    },
    dateButtonActive: {
        backgroundColor: Colors.secondary,
        borderColor: Colors.secondary,
    },
    dateButtonText: {
        fontSize: 13,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    dateButtonTextActive: {
        color: '#FFF',
    },
    clearText: {
        fontSize: 13,
        color: Colors.primary,
        fontWeight: '600',
        marginLeft: 12,
    },
    webOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
    },
    overlayClose: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: -1,
    },
    webPickerContainer: {
        backgroundColor: '#FFF',
        padding: 24,
        borderRadius: 20,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        width: '90%',
        maxWidth: 400,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    webPickerLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        marginRight: 10,
    },
    webPickerInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: 8,
        borderRadius: 8,
        fontSize: 14,
    },
    webPickerClose: {
        backgroundColor: Colors.primary,
        padding: 10,
        borderRadius: 8,
        marginLeft: 10,
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: '70%',
        padding: 24,
        width: '100%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.secondary,
    },
    toolItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    toolItemIcon: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    toolItemInfo: {
        flex: 1,
    },
    toolItemName: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.secondary,
    },
    toolItemCode: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    listContent: {
        padding: 16,
    },
    card: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Colors.border,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: Colors.surface,
    },
    typeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    typeText: {
        fontSize: 12,
        fontWeight: '700',
        marginLeft: 4,
    },
    dateText: {
        fontSize: 11,
        color: Colors.textSecondary,
    },
    cardBody: {
        gap: 2,
    },
    groupedToolRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    toolName: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.secondary,
        flex: 1,
    },
    toolQty: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.primary,
        marginLeft: 8,
    },
    cardFooter: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 12,
        flexWrap: 'wrap',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoValue: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    headerRight: {
        alignItems: 'flex-end',
    },
    referenceBadge: {
        backgroundColor: Colors.secondary,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        marginTop: 2,
    },
    referenceText: {
        color: '#FFF',
        fontSize: 9,
        fontWeight: 'bold',
    },
    observations: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontStyle: 'italic',
        marginTop: 8,
        backgroundColor: Colors.surface,
        padding: 8,
        borderRadius: 8,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    toolDetail: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    // Detail Modal Styles
    detailOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    detailContent: {
        backgroundColor: '#FFF',
        borderRadius: 24,
        width: '100%',
        maxWidth: 500,
        maxHeight: '80%',
        padding: 24,
        elevation: 10,
    },
    detailHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        paddingBottom: 16,
    },
    detailTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.secondary,
    },
    detailBody: {
        marginBottom: 20,
    },
    detailSection: {
        marginBottom: 20,
    },
    detailSectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: Colors.primary,
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    detailLabel: {
        fontSize: 14,
        color: Colors.textSecondary,
        flex: 1,
    },
    detailValue: {
        fontSize: 14,
        color: Colors.text,
        flex: 2,
        textAlign: 'right',
    },
    detailItemBox: {
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    detailItemName: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.secondary,
    },
    detailItemSub: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    detailItemQty: {
        fontSize: 13,
        fontWeight: 'bold',
        color: Colors.primary,
        marginTop: 4,
    },
    detailObsText: {
        fontSize: 14,
        color: Colors.text,
        fontStyle: 'italic',
        lineHeight: 20,
    },
    closeButton: {
        backgroundColor: Colors.secondary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    emptyState: {
        alignItems: 'center',
        padding: 40,
        marginTop: 40,
    },
    emptyText: {
        color: Colors.textSecondary,
        fontSize: 16,
        marginTop: 16,
    },
    // Search bars
    searchBarSection: {
        flexDirection: 'row',
        backgroundColor: '#FFF',
        paddingHorizontal: 20,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    searchField: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 40,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    searchInputSmall: {
        flex: 1,
        fontSize: 14,
        color: Colors.text,
        height: '100%',
    },
});

export default MovementHistoryScreen;
