/**
 * ============================================================================
 * PANTALLA DE INFORMES Y VALORIZACIÓN DE INVENTARIO (KARDEX V2)
 * ============================================================================
 * 
 * Cumple con los requerimientos de:
 * 1. Discriminar reportes por Categoría y por Proyecto (Sitio).
 * 2. Conocer con exactitud cuánto dinero ($ COP) hay en cada proyecto configurado.
 * 3. Proporcionar un informe general consolidado de activos de la empresa.
 * 4. Exportar a PDF oficial (imprimible) y hoja de cálculo CSV.
 * 
 * Principios de desarrollo:
 * - SOLID: El componente consume el contrato IReportRepository vía DIP.
 * - DRY: Centralización del formato de moneda COP, filtros y exportaciones.
 * - Comentarios pedagógicos para programadores nivel Junior.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    TextInput,
    Modal,
    Platform,
    Alert,
    Dimensions
} from 'react-native';
import {
    ArrowLeft,
    Printer,
    FileSpreadsheet,
    Building2,
    Tag,
    Search,
    X,
    Filter,
    DollarSign,
    Package,
    ChevronDown,
    TrendingUp,
    Check,
    Layers,
    RefreshCw,
    AlertCircle,
    HardHat
} from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { LOGO_BASE64 } from '../constants/LogoBase64';
import {
    IReportRepository,
    getReportRepository,
    GeneralValuationReport,
    ReportInventoryItem,
    LocationValuationSummary,
    CategoryValuationSummary
} from '../database/repositories/ReportRepository';
import { Category, Location } from '../database/repositories/MovementRepository';

interface ReportsScreenProps {
    onBack: () => void;
}

type TabType = 'general' | 'project' | 'category' | 'detailed';

/**
 * Función utilitaria para formatear valores numéricos a Pesos Colombianos (COP).
 * Ejemplo: 1500000 -> "$ 1.500.000"
 */
const formatCOP = (amount: number): string => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    }).format(amount || 0);
};

/**
 * Función utilitaria para formatear números de unidades.
 */
const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('es-CO').format(num || 0);
};

const ReportsScreen: React.FC<ReportsScreenProps> = ({ onBack }) => {
    const { user, isOnline } = useAuth();

    // Estado principal
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<TabType>('general');

    // Datos del repositorio
    const [generalReport, setGeneralReport] = useState<GeneralValuationReport | null>(null);
    const [detailedItems, setDetailedItems] = useState<ReportInventoryItem[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);

    // Filtros de búsqueda
    const [selectedLocationId, setSelectedLocationId] = useState<string>('ALL');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Modales de selección interactiva
    const [showLocationModal, setShowLocationModal] = useState<boolean>(false);
    const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
    const [modalSearch, setModalSearch] = useState<string>('');

    const [error, setError] = useState<string | null>(null);

    // Cargar datos al montar el componente
    useEffect(() => {
        loadReportData();
    }, [isOnline]);

    /**
     * Carga todos los datos consolidados y maestros a través del repositorio.
     */
    const loadReportData = async () => {
        setLoading(true);
        setError(null);
        try {
            const repo: IReportRepository = await getReportRepository(isOnline);

            const [genReport, allItems, locs, cats] = await Promise.all([
                repo.getGeneralValuationReport(),
                repo.getDetailedInventoryReport(),
                repo.getAllLocations(),
                repo.getAllCategories()
            ]);

            setGeneralReport(genReport);
            setDetailedItems(allItems);
            setLocations(locs);
            setCategories(cats);
        } catch (err: any) {
            console.error('Error cargando reportes:', err);
            setError(err?.message || 'No se pudieron calcular los datos del reporte');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    /**
     * Filtra los ítems detallados según los criterios activos.
     */
    const filteredDetailedItems = useMemo(() => {
        return detailedItems.filter(item => {
            // Filtro por ubicación / proyecto
            if (selectedLocationId !== 'ALL') {
                if (selectedLocationId === 'MANTENIMIENTO') {
                    if (item.tipo_sitio !== 'MANTENIMIENTO') return false;
                } else if (item.ubicacion_id !== selectedLocationId) {
                    return false;
                }
            }

            // Filtro por categoría
            if (selectedCategoryId !== 'ALL') {
                if (item.categoria_id !== selectedCategoryId) return false;
            }

            // Filtro por búsqueda textual
            if (searchQuery.trim().length > 0) {
                const q = searchQuery.toLowerCase().trim();
                const matchNombre = item.tool_nombre.toLowerCase().includes(q);
                const matchCodigo = item.tool_codigo.toLowerCase().includes(q);
                const matchSerial = item.tool_serial ? item.tool_serial.toLowerCase().includes(q) : false;
                const matchMarca = item.tool_marca ? item.tool_marca.toLowerCase().includes(q) : false;
                const matchCollab = item.colaborador_nombre ? item.colaborador_nombre.toLowerCase().includes(q) : false;
                const matchUbic = item.ubicacion_nombre.toLowerCase().includes(q);

                if (!matchNombre && !matchCodigo && !matchSerial && !matchMarca && !matchCollab && !matchUbic) {
                    return false;
                }
            }

            return true;
        });
    }, [detailedItems, selectedLocationId, selectedCategoryId, searchQuery]);

    /**
     * Totales acumulados de la selección filtrada actual.
     */
    const filteredTotals = useMemo(() => {
        let totalValor = 0;
        let totalUnidades = 0;
        const toolSet = new Set<string>();

        filteredDetailedItems.forEach(i => {
            totalValor += i.subtotal;
            totalUnidades += i.cantidad;
            toolSet.add(i.tool_id);
        });

        return {
            valor: totalValor,
            unidades: totalUnidades,
            referencias: toolSet.size
        };
    }, [filteredDetailedItems]);

    /**
     * Nombre descriptivo de la ubicación seleccionada.
     */
    const selectedLocationLabel = useMemo(() => {
        if (selectedLocationId === 'ALL') return 'Todas las Ubicaciones / Proyectos';
        if (selectedLocationId === 'MANTENIMIENTO') return 'Taller / En Mantenimiento';
        const found = locations.find(l => l.id === selectedLocationId);
        return found ? found.nombre_obra : 'Ubicación seleccionada';
    }, [selectedLocationId, locations]);

    /**
     * Nombre descriptivo de la categoría seleccionada.
     */
    const selectedCategoryLabel = useMemo(() => {
        if (selectedCategoryId === 'ALL') return 'Todas las Categorías';
        const found = categories.find(c => c.id === selectedCategoryId);
        return found ? found.nombre : 'Categoría seleccionada';
    }, [selectedCategoryId, categories]);

    /**
     * Helper para seleccionar un proyecto específico y cambiar de pestaña automáticamente.
     */
    const inspectProject = (locId: string) => {
        setSelectedLocationId(locId);
        setActiveTab('project');
    };

    /**
     * Helper para seleccionar una categoría específica y cambiar de pestaña automáticamente.
     */
    const inspectCategory = (catId: string) => {
        setSelectedCategoryId(catId);
        setActiveTab('category');
    };

    /**
     * ========================================================================
     * GENERACIÓN DE REPORTE OFICIAL EN PDF (IMPRIMIBLE)
     * ========================================================================
     * Diseñado con estilos CSS limpios, membrete oficial, firmas y formato corporativo.
     */
    const generatePDFReport = async () => {
        if (!generalReport) return;

        const now = new Date();
        const dateString = now.toLocaleDateString('es-CO', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const timeString = now.toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Título dinámico según la vista
        let reportTitle = 'INFORME GENERAL CONSOLIDADO DE ACTIVOS Y VALORIZACIÓN';
        if (activeTab === 'project' && selectedLocationId !== 'ALL') {
            reportTitle = `INFORME DE VALORIZACIÓN DE PROYECTO: ${selectedLocationLabel.toUpperCase()}`;
        } else if (activeTab === 'category' && selectedCategoryId !== 'ALL') {
            reportTitle = `INFORME DE VALORIZACIÓN POR CATEGORÍA: ${selectedCategoryLabel.toUpperCase()}`;
        }

        // Determinar qué ítems van en la tabla detallada del PDF
        const itemsToPrint = activeTab === 'general' ? detailedItems.slice(0, 100) : filteredDetailedItems;

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>${reportTitle}</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                        color: #1e293b;
                        margin: 0;
                        padding: 24px;
                        background: #fff;
                        font-size: 11px;
                    }
                    .header-table {
                        width: 100%;
                        border-collapse: collapse;
                        border: 2px solid #2e3a50;
                        margin-bottom: 20px;
                    }
                    .header-table td {
                        border: 1px solid #cbd5e1;
                        padding: 8px 12px;
                        vertical-align: middle;
                    }
                    .logo-cell {
                        width: 25%;
                        text-align: center;
                        background: #f8fafc;
                    }
                    .title-cell {
                        width: 50%;
                        text-align: center;
                        font-weight: 800;
                        font-size: 14px;
                        color: #2e3a50;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .meta-cell {
                        width: 25%;
                        font-size: 10px;
                        background: #f8fafc;
                        color: #475569;
                    }
                    .meta-cell strong {
                        color: #0f172a;
                    }

                    /* Cajas de resumen financiero (KPIs) */
                    .kpi-container {
                        display: flex;
                        gap: 12px;
                        margin-bottom: 20px;
                    }
                    .kpi-card {
                        flex: 1;
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-left: 4px solid #e88f11;
                        border-radius: 6px;
                        padding: 10px 14px;
                    }
                    .kpi-card.blue {
                        border-left-color: #2e3a50;
                    }
                    .kpi-card.green {
                        border-left-color: #10b981;
                    }
                    .kpi-label {
                        font-size: 9px;
                        font-weight: 700;
                        text-transform: uppercase;
                        color: #64748b;
                        margin-bottom: 4px;
                    }
                    .kpi-value {
                        font-size: 16px;
                        font-weight: 800;
                        color: #1e293b;
                    }
                    .kpi-sub {
                        font-size: 9px;
                        color: #64748b;
                        margin-top: 2px;
                    }

                    /* Tablas de datos */
                    .section-title {
                        font-size: 12px;
                        font-weight: 700;
                        color: #2e3a50;
                        text-transform: uppercase;
                        margin-top: 18px;
                        margin-bottom: 8px;
                        border-bottom: 2px solid #e88f11;
                        padding-bottom: 4px;
                    }
                    .data-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 18px;
                        font-size: 10px;
                    }
                    .data-table th {
                        background: #2e3a50;
                        color: #ffffff;
                        font-weight: 700;
                        text-align: left;
                        padding: 6px 8px;
                        border: 1px solid #2e3a50;
                        font-size: 9px;
                        text-transform: uppercase;
                    }
                    .data-table td {
                        padding: 5px 8px;
                        border: 1px solid #e2e8f0;
                        color: #334155;
                    }
                    .data-table tr:nth-child(even) td {
                        background: #f8fafc;
                    }
                    .text-right {
                        text-align: right;
                    }
                    .text-center {
                        text-align: center;
                    }
                    .badge {
                        display: inline-block;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-size: 8px;
                        font-weight: 700;
                        text-transform: uppercase;
                    }
                    .badge-bodega { background: #e0e7ff; color: #3730a3; }
                    .badge-proyecto { background: #fef3c7; color: #92400e; }
                    .badge-mantenimiento { background: #fee2e2; color: #991b1b; }

                    .total-row td {
                        background: #f1f5f9 !important;
                        font-weight: 800;
                        color: #0f172a;
                        border-top: 2px solid #2e3a50;
                        font-size: 10px;
                    }

                    /* Firmas */
                    .signatures-container {
                        margin-top: 45px;
                        display: flex;
                        justify-content: space-between;
                        page-break-inside: avoid;
                    }
                    .sig-block {
                        width: 42%;
                        text-align: center;
                    }
                    .sig-line {
                        border-top: 1px solid #0f172a;
                        margin-bottom: 4px;
                    }
                    .sig-name {
                        font-weight: 700;
                        font-size: 11px;
                        color: #0f172a;
                    }
                    .sig-role {
                        font-size: 9px;
                        color: #64748b;
                    }

                    @media print {
                        body { padding: 10px; }
                        .kpi-container { break-inside: avoid; }
                        .signatures-container { break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <!-- Encabezado Oficial -->
                <table class="header-table">
                    <tr>
                        <td class="logo-cell" rowspan="3">
                            <img src="${LOGO_BASE64}" style="max-width: 140px; max-height: 60px; object-fit: contain;" />
                        </td>
                        <td class="title-cell" rowspan="3">
                            ${reportTitle}
                        </td>
                        <td class="meta-cell">
                            <strong>Código Doc:</strong> KDX-VAL-01
                        </td>
                    </tr>
                    <tr>
                        <td class="meta-cell">
                            <strong>Fecha / Hora:</strong> ${dateString} ${timeString}
                        </td>
                    </tr>
                    <tr>
                        <td class="meta-cell">
                            <strong>Generado por:</strong> ${user?.nombre || 'Administrador'} (${user?.rol || 'admin'})
                        </td>
                    </tr>
                </table>

                <!-- Cajas de Resumen Ejecutivo Financiero -->
                <div class="kpi-container">
                    <div class="kpi-card">
                        <div class="kpi-label">Valor Total en Dinero</div>
                        <div class="kpi-value">${formatCOP(filteredTotals.valor)}</div>
                        <div class="kpi-sub">${formatNumber(filteredTotals.unidades)} unidades físicas en total</div>
                    </div>
                    <div class="kpi-card blue">
                        <div class="kpi-label">Ubicación / Proyecto</div>
                        <div class="kpi-value" style="font-size: 13px;">${selectedLocationLabel}</div>
                        <div class="kpi-sub">${formatNumber(filteredTotals.referencias)} referencias distintas</div>
                    </div>
                    <div class="kpi-card green">
                        <div class="kpi-label">Filtro de Categoría</div>
                        <div class="kpi-value" style="font-size: 13px;">${selectedCategoryLabel}</div>
                        <div class="kpi-sub">${itemsToPrint.length} registros en el informe</div>
                    </div>
                </div>

                ${activeTab === 'general' ? `
                    <!-- Resumen por Proyecto / Obra -->
                    <div class="section-title">Consolidado por Proyecto / Ubicación</div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="width: 35%;">Ubicación / Proyecto</th>
                                <th style="width: 20%;">Tipo de Sitio</th>
                                <th class="text-center" style="width: 15%;">Referencias</th>
                                <th class="text-center" style="width: 15%;">Unidades</th>
                                <th class="text-right" style="width: 15%;">Valor Total (COP)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${generalReport.por_ubicacion.map(loc => `
                                <tr>
                                    <td><strong>${loc.ubicacion_nombre}</strong></td>
                                    <td>
                                        <span class="badge ${loc.tipo_sitio === 'BODEGA' ? 'badge-bodega' : loc.tipo_sitio === 'MANTENIMIENTO' ? 'badge-mantenimiento' : 'badge-proyecto'}">
                                            ${loc.tipo_sitio}
                                        </span>
                                    </td>
                                    <td class="text-center">${formatNumber(loc.total_items)}</td>
                                    <td class="text-center">${formatNumber(loc.total_unidades)}</td>
                                    <td class="text-right"><strong>${formatCOP(loc.valor_total)}</strong></td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="2">GRAN TOTAL DE ACTIVOS</td>
                                <td class="text-center">${formatNumber(generalReport.gran_total_referencias)}</td>
                                <td class="text-center">${formatNumber(generalReport.gran_total_unidades)}</td>
                                <td class="text-right">${formatCOP(generalReport.gran_total_valor)}</td>
                            </tr>
                        </tbody>
                    </table>

                    <!-- Resumen por Categoría -->
                    <div class="section-title">Consolidado por Categoría de Activo</div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="width: 40%;">Categoría</th>
                                <th class="text-center" style="width: 15%;">Referencias</th>
                                <th class="text-center" style="width: 15%;">Unidades</th>
                                <th class="text-center" style="width: 15%;">% Participación</th>
                                <th class="text-right" style="width: 15%;">Valor Total (COP)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${generalReport.por_categoria.map(cat => `
                                <tr>
                                    <td><strong>${cat.categoria_nombre}</strong> (${cat.categoria_codigo})</td>
                                    <td class="text-center">${formatNumber(cat.total_items)}</td>
                                    <td class="text-center">${formatNumber(cat.total_unidades)}</td>
                                    <td class="text-center">${cat.porcentaje_valor.toFixed(1)}%</td>
                                    <td class="text-right"><strong>${formatCOP(cat.valor_total)}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : ''}

                <!-- Tabla Detallada de Artículos -->
                <div class="section-title">Detalle Individual de Activos e Insumos</div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 8%;">Código</th>
                            <th style="width: 24%;">Nombre / Equipo / Insumo</th>
                            <th style="width: 12%;">Serial / Ref</th>
                            <th style="width: 12%;">Categoría</th>
                            <th style="width: 16%;">Ubicación / Proyecto</th>
                            <th style="width: 12%;">Responsable</th>
                            <th class="text-center" style="width: 5%;">Cant.</th>
                            <th class="text-right" style="width: 11%;">Vlr. Unitario</th>
                            <th class="text-right" style="width: 11%;">Subtotal COP</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsToPrint.map(item => `
                            <tr>
                                <td><strong>${item.tool_codigo}</strong></td>
                                <td>${item.tool_nombre} ${item.tool_marca ? `(${item.tool_marca})` : ''}</td>
                                <td>${item.tool_serial || '-'}</td>
                                <td>${item.categoria_nombre}</td>
                                <td>${item.ubicacion_nombre}</td>
                                <td>${item.colaborador_nombre || '-'}</td>
                                <td class="text-center"><strong>${item.cantidad}</strong></td>
                                <td class="text-right">${formatCOP(item.precio_unitario)}</td>
                                <td class="text-right"><strong>${formatCOP(item.subtotal)}</strong></td>
                            </tr>
                        `).join('')}
                        <tr class="total-row">
                            <td colspan="6">TOTAL CONSOLIDADO EN ESTE INFORME</td>
                            <td class="text-center">${formatNumber(filteredTotals.unidades)}</td>
                            <td class="text-right">-</td>
                            <td class="text-right">${formatCOP(filteredTotals.valor)}</td>
                        </tr>
                    </tbody>
                </table>

                <!-- Firmas Legales y de Auditoría -->
                <div class="signatures-container">
                    <div class="sig-block">
                        <div class="sig-line"></div>
                        <div class="sig-name">Responsable de Almacén / Kardex</div>
                        <div class="sig-role">Entrega y Verificación de Inventario</div>
                    </div>
                    <div class="sig-block">
                        <div class="sig-line"></div>
                        <div class="sig-name">Director / Auditor de Operaciones</div>
                        <div class="sig-role">Revisión y Conformidad Financiera</div>
                    </div>
                </div>
            </body>
            </html>
        `;

        try {
            if (Platform.OS === 'web') {
                const style = document.createElement('style');
                style.id = 'print-style-rep';
                style.innerHTML = `
                    @media print {
                        body > :not(#print-container-rep) { display: none !important; }
                        #print-container-rep { display: block !important; position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
                    }
                `;
                document.head.appendChild(style);

                const printDiv = document.createElement('div');
                printDiv.id = 'print-container-rep';
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
            console.error('Error generando PDF de reporte:', error);
            Alert.alert('Error', 'No se pudo generar el documento PDF.');
        }
    };

    /**
     * ========================================================================
     * EXPORTACIÓN A CSV / EXCEL
     * ========================================================================
     * Genera un archivo CSV con BOM UTF-8 para apertura directa en Microsoft Excel.
     */
    const exportToCSV = async () => {
        if (filteredDetailedItems.length === 0) {
            Alert.alert('Aviso', 'No hay registros para exportar con los filtros actuales.');
            return;
        }

        // Encabezados del CSV
        const headers = [
            'Código',
            'Nombre',
            'Marca',
            'Serial',
            'Categoría',
            'Ubicación / Proyecto',
            'Tipo Sitio',
            'Responsable / Colaborador',
            'Cantidad',
            'Precio Unitario (COP)',
            'Subtotal (COP)'
        ];

        // Filas formateadas escapando comillas
        const rows = filteredDetailedItems.map(item => [
            `"${item.tool_codigo || ''}"`,
            `"${(item.tool_nombre || '').replace(/"/g, '""')}"`,
            `"${(item.tool_marca || '').replace(/"/g, '""')}"`,
            `"${(item.tool_serial || '').replace(/"/g, '""')}"`,
            `"${(item.categoria_nombre || '').replace(/"/g, '""')}"`,
            `"${(item.ubicacion_nombre || '').replace(/"/g, '""')}"`,
            `"${item.tipo_sitio}"`,
            `"${(item.colaborador_nombre || '').replace(/"/g, '""')}"`,
            item.cantidad,
            item.precio_unitario,
            item.subtotal
        ]);

        // Fila final con sumatoria
        rows.push([
            '"TOTALES"',
            '""',
            '""',
            '""',
            '""',
            '""',
            '""',
            '""',
            filteredTotals.unidades,
            '""',
            filteredTotals.valor
        ]);

        // Agregar BOM UTF-8 (\uFEFF) para que Excel reconozca tildes y caracteres en español
        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
        const filename = `reporte_valorizacion_${new Date().getTime()}.csv`;

        try {
            if (Platform.OS === 'web') {
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                const fileUri = `${FileSystem.documentDirectory}${filename}`;
                await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
                await Sharing.shareAsync(fileUri);
            }
        } catch (error) {
            console.error('Error exportando CSV:', error);
            Alert.alert('Error', 'No se pudo exportar el archivo CSV.');
        }
    };

    /**
     * Renderizado condicional del contenido de las pestañas
     */
    const renderActiveTabContent = () => {
        if (!generalReport) return null;

        switch (activeTab) {
            case 'general':
                return renderGeneralTab();
            case 'project':
                return renderProjectTab();
            case 'category':
                return renderCategoryTab();
            case 'detailed':
                return renderDetailedTab();
            default:
                return null;
        }
    };

    /**
     * PESTAÑA 1: RESUMEN GENERAL (DASHBOARD EJECUTIVO)
     */
    const renderGeneralTab = () => {
        if (!generalReport) return null;

        return (
            <View>
                {/* Métricas Principales (KPI Cards) */}
                <View style={styles.kpiContainer}>
                    <View style={[styles.kpiBox, styles.kpiBoxPrimary]}>
                        <View style={styles.kpiIconWrapPrimary}>
                            <DollarSign size={24} color="#FFF" />
                        </View>
                        <Text style={styles.kpiLabelPrimary}>VALOR TOTAL ACTIVOS</Text>
                        <Text style={styles.kpiNumberPrimary}>
                            {formatCOP(generalReport.gran_total_valor)}
                        </Text>
                        <Text style={styles.kpiSubPrimary}>
                            {formatNumber(generalReport.gran_total_unidades)} unidades físicas • {formatNumber(generalReport.gran_total_referencias)} referencias
                        </Text>
                    </View>
                </View>

                {/* Distribución por Estado / Ubicación física */}
                <View style={styles.distributionRow}>
                    <View style={[styles.distCard, { borderLeftColor: '#3B82F6' }]}>
                        <Text style={styles.distLabel}>EN BODEGA CENTRAL</Text>
                        <Text style={styles.distValue}>{formatCOP(generalReport.valor_en_bodega)}</Text>
                        <Text style={styles.distUnits}>{formatNumber(generalReport.unidades_en_bodega)} unidades</Text>
                    </View>

                    <View style={[styles.distCard, { borderLeftColor: Colors.primary }]}>
                        <Text style={styles.distLabel}>EN PROYECTOS / OBRAS</Text>
                        <Text style={styles.distValue}>{formatCOP(generalReport.valor_en_proyectos)}</Text>
                        <Text style={styles.distUnits}>{formatNumber(generalReport.unidades_en_proyectos)} unidades</Text>
                    </View>

                    <View style={[styles.distCard, { borderLeftColor: Colors.error }]}>
                        <Text style={styles.distLabel}>EN MANTENIMIENTO</Text>
                        <Text style={styles.distValue}>{formatCOP(generalReport.valor_en_mantenimiento)}</Text>
                        <Text style={styles.distUnits}>{formatNumber(generalReport.unidades_en_mantenimiento)} unidades</Text>
                    </View>
                </View>

                {/* Listado Consolidado por Proyecto / Ubicación */}
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionHeaderTitleWrap}>
                        <Building2 size={18} color={Colors.secondary} />
                        <Text style={styles.sectionHeaderTitle}>Valorización por Proyecto / Ubicación</Text>
                    </View>
                    <Text style={styles.sectionHeaderBadge}>
                        {generalReport.por_ubicacion.length} sitios
                    </Text>
                </View>

                <View style={styles.locationCardsGrid}>
                    {generalReport.por_ubicacion.map((loc) => (
                        <TouchableOpacity
                            key={loc.ubicacion_id}
                            style={styles.locationCard}
                            onPress={() => inspectProject(loc.ubicacion_id)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.locationCardTop}>
                                <View style={styles.locationCardIconWrap}>
                                    <Building2 size={18} color={Colors.primary} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={styles.locationCardTitle} numberOfLines={1}>
                                        {loc.ubicacion_nombre}
                                    </Text>
                                    <Text style={styles.locationCardType}>
                                        {loc.tipo_sitio === 'BODEGA' ? 'Almacén Principal' : loc.tipo_sitio === 'MANTENIMIENTO' ? 'Taller Externo' : 'Proyecto / Obra Activa'}
                                    </Text>
                                </View>
                                <View style={styles.inspectBadge}>
                                    <Text style={styles.inspectBadgeText}>Ver Detalle →</Text>
                                </View>
                            </View>

                            <View style={styles.locationCardMoneyRow}>
                                <Text style={styles.locationCardMoneyLabel}>Dinero en este sitio:</Text>
                                <Text style={styles.locationCardMoneyValue}>{formatCOP(loc.valor_total)}</Text>
                            </View>

                            <View style={styles.locationCardStatsRow}>
                                <Text style={styles.locationCardStatText}>
                                    <Text style={{ fontWeight: '700', color: Colors.secondary }}>{formatNumber(loc.total_unidades)}</Text> unidades físicas
                                </Text>
                                <Text style={styles.locationCardStatText}>
                                    <Text style={{ fontWeight: '700', color: Colors.secondary }}>{formatNumber(loc.total_items)}</Text> referencias
                                </Text>
                            </View>

                            {/* Desglose de categorías dentro del proyecto */}
                            {loc.desglose_categorias.length > 0 && (
                                <View style={styles.categoryPillsWrap}>
                                    {loc.desglose_categorias.slice(0, 3).map((cat, idx) => (
                                        <View key={idx} style={styles.catPill}>
                                            <Text style={styles.catPillText}>
                                                {cat.categoria_nombre}: {formatCOP(cat.valor)}
                                            </Text>
                                        </View>
                                    ))}
                                    {loc.desglose_categorias.length > 3 && (
                                        <Text style={styles.catPillMore}>+{loc.desglose_categorias.length - 3} más</Text>
                                    )}
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Listado Consolidado por Categoría */}
                <View style={[styles.sectionHeader, { marginTop: 24 }]}>
                    <View style={styles.sectionHeaderTitleWrap}>
                        <Tag size={18} color={Colors.secondary} />
                        <Text style={styles.sectionHeaderTitle}>Valorización por Categoría General</Text>
                    </View>
                    <Text style={styles.sectionHeaderBadge}>
                        {generalReport.por_categoria.length} categorías
                    </Text>
                </View>

                <View style={styles.categoryGrid}>
                    {generalReport.por_categoria.map((cat) => (
                        <TouchableOpacity
                            key={cat.categoria_id || cat.categoria_nombre}
                            style={styles.categoryCard}
                            onPress={() => inspectCategory(cat.categoria_id)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.categoryCardHeader}>
                                <Tag size={16} color={Colors.primary} />
                                <Text style={styles.categoryCardTitle} numberOfLines={1}>
                                    {cat.categoria_nombre}
                                </Text>
                                <View style={styles.percentageBadge}>
                                    <Text style={styles.percentageBadgeText}>
                                        {cat.porcentaje_valor.toFixed(1)}%
                                    </Text>
                                </View>
                            </View>

                            <Text style={styles.categoryCardValue}>{formatCOP(cat.valor_total)}</Text>

                            <View style={styles.categoryCardFooter}>
                                <Text style={styles.categoryCardSub}>
                                    {formatNumber(cat.total_unidades)} unidades • {formatNumber(cat.total_items)} referencias
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    };

    /**
     * PESTAÑA 2: REPORTE POR PROYECTO / SITIO
     */
    const renderProjectTab = () => {
        // Obtenemos los proyectos disponibles (todas las ubicaciones excepto 'ALL')
        const currentLocSummary = generalReport?.por_ubicacion.find(l => l.ubicacion_id === selectedLocationId);

        return (
            <View>
                {/* Selector Interactivo de Proyecto */}
                <View style={styles.filterBarCard}>
                    <Text style={styles.filterBarTitle}>Proyecto / Ubicación a Inspeccionar:</Text>
                    <TouchableOpacity
                        style={styles.pickerSelectorButton}
                        onPress={() => setShowLocationModal(true)}
                    >
                        <Building2 size={18} color={Colors.primary} />
                        <Text style={styles.pickerSelectorText} numberOfLines={1}>
                            {selectedLocationLabel}
                        </Text>
                        <ChevronDown size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Banner de Valor Total en este Proyecto */}
                <View style={styles.projectHeroCard}>
                    <View style={styles.projectHeroHeader}>
                        <HardHat size={22} color="#FFF" />
                        <Text style={styles.projectHeroTitle} numberOfLines={1}>
                            {selectedLocationLabel}
                        </Text>
                    </View>
                    <Text style={styles.projectHeroAmountLabel}>VALOR TOTAL EN ESTE PROYECTO</Text>
                    <Text style={styles.projectHeroAmount}>{formatCOP(filteredTotals.valor)}</Text>
                    <View style={styles.projectHeroFooterRow}>
                        <Text style={styles.projectHeroFooterText}>
                            📦 {formatNumber(filteredTotals.unidades)} unidades físicas asignadas
                        </Text>
                        <Text style={styles.projectHeroFooterText}>
                            🏷️ {formatNumber(filteredTotals.referencias)} referencias únicas
                        </Text>
                    </View>
                </View>

                {/* Desglose de categorías dentro de este proyecto */}
                {currentLocSummary && currentLocSummary.desglose_categorias.length > 0 && (
                    <View style={styles.projectCatBreakdownCard}>
                        <Text style={styles.projectCatBreakdownTitle}>
                            Distribución de Dinero por Categoría en este Proyecto:
                        </Text>
                        <View style={styles.projectCatBreakdownGrid}>
                            {currentLocSummary.desglose_categorias.map((c, i) => (
                                <View key={i} style={styles.projectCatItem}>
                                    <Text style={styles.projectCatItemName}>{c.categoria_nombre}</Text>
                                    <Text style={styles.projectCatItemValue}>{formatCOP(c.valor)}</Text>
                                    <Text style={styles.projectCatItemUnits}>{formatNumber(c.unidades)} unids.</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Barra de Filtro de Categoría y Búsqueda */}
                <View style={styles.subFilterRow}>
                    <TouchableOpacity
                        style={styles.subFilterButton}
                        onPress={() => setShowCategoryModal(true)}
                    >
                        <Tag size={16} color={Colors.primary} />
                        <Text style={styles.subFilterButtonText} numberOfLines={1}>
                            {selectedCategoryId === 'ALL' ? 'Todas las Categorías' : selectedCategoryLabel}
                        </Text>
                        <ChevronDown size={16} color={Colors.textSecondary} />
                    </TouchableOpacity>

                    <View style={styles.searchBarWrap}>
                        <Search size={16} color={Colors.textSecondary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar herramienta / insumo..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <X size={16} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Lista de Artículos en este Proyecto */}
                <View style={styles.itemsListContainer}>
                    <Text style={styles.itemsListHeader}>
                        Artículos Presentes ({filteredDetailedItems.length})
                    </Text>

                    {filteredDetailedItems.length === 0 ? (
                        <View style={styles.emptyStateBox}>
                            <AlertCircle size={32} color={Colors.textSecondary} />
                            <Text style={styles.emptyStateTitle}>Sin artículos encontrados</Text>
                            <Text style={styles.emptyStateSub}>No hay activos que coincidan con los filtros en este proyecto.</Text>
                        </View>
                    ) : (
                        filteredDetailedItems.map((item) => (
                            <View key={item.id} style={styles.itemRowCard}>
                                <View style={styles.itemRowHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.itemRowCode}>{item.tool_codigo}</Text>
                                        <Text style={styles.itemRowName}>{item.tool_nombre}</Text>
                                        {item.tool_marca && (
                                            <Text style={styles.itemRowBrand}>Marca: {item.tool_marca}</Text>
                                        )}
                                        {item.tool_serial && (
                                            <Text style={styles.itemRowSerial}>Serial: {item.tool_serial}</Text>
                                        )}
                                    </View>
                                    <View style={styles.itemRowSubtotalBox}>
                                        <Text style={styles.itemRowSubtotalLabel}>Subtotal</Text>
                                        <Text style={styles.itemRowSubtotalValue}>{formatCOP(item.subtotal)}</Text>
                                    </View>
                                </View>

                                <View style={styles.itemRowFooter}>
                                    <View style={styles.itemRowBadge}>
                                        <Text style={styles.itemRowBadgeText}>{item.categoria_nombre}</Text>
                                    </View>
                                    <Text style={styles.itemRowCollab} numberOfLines={1}>
                                        Resp: {item.colaborador_nombre}
                                    </Text>
                                    <Text style={styles.itemRowMath}>
                                        {item.cantidad} unids × {formatCOP(item.precio_unitario)}
                                    </Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </View>
        );
    };

    /**
     * PESTAÑA 3: REPORTE POR CATEGORÍA
     */
    const renderCategoryTab = () => {
        const currentCatSummary = generalReport?.por_categoria.find(c => c.categoria_id === selectedCategoryId);

        return (
            <View>
                {/* Selector Interactivo de Categoría */}
                <View style={styles.filterBarCard}>
                    <Text style={styles.filterBarTitle}>Categoría a Inspeccionar:</Text>
                    <TouchableOpacity
                        style={styles.pickerSelectorButton}
                        onPress={() => setShowCategoryModal(true)}
                    >
                        <Tag size={18} color={Colors.primary} />
                        <Text style={styles.pickerSelectorText} numberOfLines={1}>
                            {selectedCategoryLabel}
                        </Text>
                        <ChevronDown size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Banner de Valor Total en esta Categoría */}
                <View style={[styles.projectHeroCard, { backgroundColor: Colors.primary }]}>
                    <View style={styles.projectHeroHeader}>
                        <Tag size={22} color="#FFF" />
                        <Text style={styles.projectHeroTitle} numberOfLines={1}>
                            {selectedCategoryLabel}
                        </Text>
                    </View>
                    <Text style={styles.projectHeroAmountLabel}>VALOR TOTAL EN ESTA CATEGORÍA</Text>
                    <Text style={styles.projectHeroAmount}>{formatCOP(filteredTotals.valor)}</Text>
                    <View style={styles.projectHeroFooterRow}>
                        <Text style={styles.projectHeroFooterText}>
                            📦 {formatNumber(filteredTotals.unidades)} unidades físicas
                        </Text>
                        <Text style={styles.projectHeroFooterText}>
                            🏷️ {formatNumber(filteredTotals.referencias)} referencias
                        </Text>
                        {currentCatSummary && (
                            <Text style={styles.projectHeroFooterText}>
                                📊 {currentCatSummary.porcentaje_valor.toFixed(1)}% del inventario total
                            </Text>
                        )}
                    </View>
                </View>

                {/* Filtro de Ubicación y Búsqueda */}
                <View style={styles.subFilterRow}>
                    <TouchableOpacity
                        style={styles.subFilterButton}
                        onPress={() => setShowLocationModal(true)}
                    >
                        <Building2 size={16} color={Colors.primary} />
                        <Text style={styles.subFilterButtonText} numberOfLines={1}>
                            {selectedLocationId === 'ALL' ? 'Todas las Ubicaciones' : selectedLocationLabel}
                        </Text>
                        <ChevronDown size={16} color={Colors.textSecondary} />
                    </TouchableOpacity>

                    <View style={styles.searchBarWrap}>
                        <Search size={16} color={Colors.textSecondary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar por nombre, código..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <X size={16} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Lista de Artículos de esta Categoría */}
                <View style={styles.itemsListContainer}>
                    <Text style={styles.itemsListHeader}>
                        Artículos en esta Categoría ({filteredDetailedItems.length})
                    </Text>

                    {filteredDetailedItems.length === 0 ? (
                        <View style={styles.emptyStateBox}>
                            <AlertCircle size={32} color={Colors.textSecondary} />
                            <Text style={styles.emptyStateTitle}>Sin artículos encontrados</Text>
                            <Text style={styles.emptyStateSub}>No hay activos que coincidan con los filtros seleccionados.</Text>
                        </View>
                    ) : (
                        filteredDetailedItems.map((item) => (
                            <View key={item.id} style={styles.itemRowCard}>
                                <View style={styles.itemRowHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.itemRowCode}>{item.tool_codigo}</Text>
                                        <Text style={styles.itemRowName}>{item.tool_nombre}</Text>
                                        <Text style={styles.itemRowBrand}>
                                            📍 Ubicación: <Text style={{ fontWeight: '700', color: Colors.secondary }}>{item.ubicacion_nombre}</Text>
                                        </Text>
                                    </View>
                                    <View style={styles.itemRowSubtotalBox}>
                                        <Text style={styles.itemRowSubtotalLabel}>Subtotal</Text>
                                        <Text style={styles.itemRowSubtotalValue}>{formatCOP(item.subtotal)}</Text>
                                    </View>
                                </View>

                                <View style={styles.itemRowFooter}>
                                    <Text style={styles.itemRowCollab} numberOfLines={1}>
                                        Resp: {item.colaborador_nombre}
                                    </Text>
                                    <Text style={styles.itemRowMath}>
                                        {item.cantidad} unids × {formatCOP(item.precio_unitario)}
                                    </Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </View>
        );
    };

    /**
     * PESTAÑA 4: TABLA DETALLADA COMPLETA
     */
    const renderDetailedTab = () => {
        return (
            <View>
                {/* Barra de Filtros Combinados */}
                <View style={styles.filterBarCard}>
                    <Text style={styles.filterBarTitle}>Filtros Avanzados de Inventario:</Text>

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                        <TouchableOpacity
                            style={[styles.pickerSelectorButton, { flex: 1 }]}
                            onPress={() => setShowLocationModal(true)}
                        >
                            <Building2 size={16} color={Colors.primary} />
                            <Text style={styles.pickerSelectorText} numberOfLines={1}>
                                {selectedLocationId === 'ALL' ? 'Todos los Sitios' : selectedLocationLabel}
                            </Text>
                            <ChevronDown size={14} color={Colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.pickerSelectorButton, { flex: 1 }]}
                            onPress={() => setShowCategoryModal(true)}
                        >
                            <Tag size={16} color={Colors.primary} />
                            <Text style={styles.pickerSelectorText} numberOfLines={1}>
                                {selectedCategoryId === 'ALL' ? 'Todas las Cat.' : selectedCategoryLabel}
                            </Text>
                            <ChevronDown size={14} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Buscador de texto */}
                    <View style={[styles.searchBarWrap, { marginTop: 10 }]}>
                        <Search size={16} color={Colors.textSecondary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Filtrar por nombre, código, serial o responsable..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <X size={16} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Banner Flotante de Totales Filtrados */}
                <View style={styles.filteredSummaryCard}>
                    <View>
                        <Text style={styles.filteredSummaryLabel}>VALOR FILTRADO</Text>
                        <Text style={styles.filteredSummaryValue}>{formatCOP(filteredTotals.valor)}</Text>
                    </View>
                    <View style={styles.filteredSummaryDivider} />
                    <View>
                        <Text style={styles.filteredSummaryLabel}>UNIDADES</Text>
                        <Text style={styles.filteredSummaryValue}>{formatNumber(filteredTotals.unidades)}</Text>
                    </View>
                    <View style={styles.filteredSummaryDivider} />
                    <View>
                        <Text style={styles.filteredSummaryLabel}>REGISTROS</Text>
                        <Text style={styles.filteredSummaryValue}>{formatNumber(filteredDetailedItems.length)}</Text>
                    </View>
                </View>

                {/* Tabla de Registros */}
                <View style={styles.itemsListContainer}>
                    {filteredDetailedItems.length === 0 ? (
                        <View style={styles.emptyStateBox}>
                            <AlertCircle size={32} color={Colors.textSecondary} />
                            <Text style={styles.emptyStateTitle}>No hay datos con los filtros seleccionados</Text>
                        </View>
                    ) : (
                        filteredDetailedItems.map((item) => (
                            <View key={item.id} style={styles.itemRowCard}>
                                <View style={styles.itemRowHeader}>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={styles.itemRowCode}>{item.tool_codigo}</Text>
                                            <View style={[
                                                styles.siteTypeBadge,
                                                item.tipo_sitio === 'BODEGA' ? styles.badgeBodega :
                                                item.tipo_sitio === 'MANTENIMIENTO' ? styles.badgeMaint : styles.badgeProject
                                            ]}>
                                                <Text style={styles.siteTypeBadgeText}>{item.tipo_sitio}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.itemRowName}>{item.tool_nombre}</Text>
                                        <Text style={styles.itemRowBrand}>
                                            📍 {item.ubicacion_nombre} • 🏷️ {item.categoria_nombre}
                                        </Text>
                                        {item.tool_serial && (
                                            <Text style={styles.itemRowSerial}>S/N: {item.tool_serial}</Text>
                                        )}
                                    </View>
                                    <View style={styles.itemRowSubtotalBox}>
                                        <Text style={styles.itemRowSubtotalLabel}>Subtotal</Text>
                                        <Text style={styles.itemRowSubtotalValue}>{formatCOP(item.subtotal)}</Text>
                                    </View>
                                </View>

                                <View style={styles.itemRowFooter}>
                                    <Text style={styles.itemRowCollab} numberOfLines={1}>
                                        Resp: {item.colaborador_nombre}
                                    </Text>
                                    <Text style={styles.itemRowMath}>
                                        {item.cantidad} unids × {formatCOP(item.precio_unitario)}
                                    </Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </View>
        );
    };

    /**
     * MODAL: Selector de Ubicación / Proyecto
     */
    const renderLocationModal = () => {
        const filteredLocs = locations.filter(l =>
            l.nombre_obra.toLowerCase().includes(modalSearch.toLowerCase())
        );

        return (
            <Modal visible={showLocationModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Seleccionar Proyecto o Ubicación</Text>
                            <TouchableOpacity onPress={() => { setShowLocationModal(false); setModalSearch(''); }}>
                                <X size={22} color={Colors.secondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalSearchBox}>
                            <Search size={16} color={Colors.textSecondary} />
                            <TextInput
                                style={styles.modalSearchInput}
                                placeholder="Buscar proyecto..."
                                value={modalSearch}
                                onChangeText={setModalSearch}
                            />
                        </View>

                        <ScrollView style={styles.modalScroll}>
                            {/* Opción Todas */}
                            <TouchableOpacity
                                style={[styles.modalOption, selectedLocationId === 'ALL' && styles.modalOptionSelected]}
                                onPress={() => {
                                    setSelectedLocationId('ALL');
                                    setShowLocationModal(false);
                                    setModalSearch('');
                                }}
                            >
                                <Building2 size={18} color={selectedLocationId === 'ALL' ? Colors.primary : Colors.secondary} />
                                <Text style={[styles.modalOptionText, selectedLocationId === 'ALL' && styles.modalOptionTextSelected]}>
                                    Todas las Ubicaciones / Proyectos
                                </Text>
                                {selectedLocationId === 'ALL' && <Check size={18} color={Colors.primary} />}
                            </TouchableOpacity>

                            {/* Opción Mantenimiento */}
                            <TouchableOpacity
                                style={[styles.modalOption, selectedLocationId === 'MANTENIMIENTO' && styles.modalOptionSelected]}
                                onPress={() => {
                                    setSelectedLocationId('MANTENIMIENTO');
                                    setShowLocationModal(false);
                                    setModalSearch('');
                                }}
                            >
                                <Building2 size={18} color={selectedLocationId === 'MANTENIMIENTO' ? Colors.primary : Colors.secondary} />
                                <Text style={[styles.modalOptionText, selectedLocationId === 'MANTENIMIENTO' && styles.modalOptionTextSelected]}>
                                    Taller / En Mantenimiento
                                </Text>
                                {selectedLocationId === 'MANTENIMIENTO' && <Check size={18} color={Colors.primary} />}
                            </TouchableOpacity>

                            {/* Lista de Ubicaciones registradas */}
                            {filteredLocs.map((loc) => {
                                const isSelected = selectedLocationId === loc.id;
                                return (
                                    <TouchableOpacity
                                        key={loc.id}
                                        style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                                        onPress={() => {
                                            setSelectedLocationId(loc.id);
                                            setShowLocationModal(false);
                                            setModalSearch('');
                                        }}
                                    >
                                        <Building2 size={18} color={isSelected ? Colors.primary : Colors.secondary} />
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                                                {loc.nombre_obra}
                                            </Text>
                                            <Text style={styles.modalOptionSub}>
                                                {loc.nombre_obra === 'BODEGA' ? 'Almacén Central' : 'Proyecto Activo'}
                                            </Text>
                                        </View>
                                        {isSelected && <Check size={18} color={Colors.primary} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        );
    };

    /**
     * MODAL: Selector de Categoría
     */
    const renderCategoryModal = () => {
        const filteredCats = categories.filter(c =>
            c.nombre.toLowerCase().includes(modalSearch.toLowerCase()) ||
            c.codigo.toLowerCase().includes(modalSearch.toLowerCase())
        );

        return (
            <Modal visible={showCategoryModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Seleccionar Categoría</Text>
                            <TouchableOpacity onPress={() => { setShowCategoryModal(false); setModalSearch(''); }}>
                                <X size={22} color={Colors.secondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalSearchBox}>
                            <Search size={16} color={Colors.textSecondary} />
                            <TextInput
                                style={styles.modalSearchInput}
                                placeholder="Buscar categoría..."
                                value={modalSearch}
                                onChangeText={setModalSearch}
                            />
                        </View>

                        <ScrollView style={styles.modalScroll}>
                            {/* Opción Todas */}
                            <TouchableOpacity
                                style={[styles.modalOption, selectedCategoryId === 'ALL' && styles.modalOptionSelected]}
                                onPress={() => {
                                    setSelectedCategoryId('ALL');
                                    setShowCategoryModal(false);
                                    setModalSearch('');
                                }}
                            >
                                <Tag size={18} color={selectedCategoryId === 'ALL' ? Colors.primary : Colors.secondary} />
                                <Text style={[styles.modalOptionText, selectedCategoryId === 'ALL' && styles.modalOptionTextSelected]}>
                                    Todas las Categorías
                                </Text>
                                {selectedCategoryId === 'ALL' && <Check size={18} color={Colors.primary} />}
                            </TouchableOpacity>

                            {/* Categorías registradas */}
                            {filteredCats.map((cat) => {
                                const isSelected = selectedCategoryId === cat.id;
                                return (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                                        onPress={() => {
                                            setSelectedCategoryId(cat.id);
                                            setShowCategoryModal(false);
                                            setModalSearch('');
                                        }}
                                    >
                                        <Tag size={18} color={isSelected ? Colors.primary : Colors.secondary} />
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                                                {cat.nombre}
                                            </Text>
                                            <Text style={styles.modalOptionSub}>Código: {cat.codigo}</Text>
                                        </View>
                                        {isSelected && <Check size={18} color={Colors.primary} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        );
    };

    return (
        <View style={styles.container}>
            {/* Cabecera Principal */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <ArrowLeft size={20} color={Colors.secondary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.headerTitle}>Informes y Valorización</Text>
                        <Text style={styles.headerSubtitle}>
                            Consolidado financiero por proyecto y categoría
                        </Text>
                    </View>

                    {/* Botones de Exportación en Cabecera */}
                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={exportToCSV}
                            accessibilityLabel="Exportar a Excel o CSV"
                        >
                            <FileSpreadsheet size={18} color={Colors.secondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, styles.actionButtonPrimary]}
                            onPress={generatePDFReport}
                            accessibilityLabel="Imprimir o Exportar PDF"
                        >
                            <Printer size={18} color="#FFF" />
                            <Text style={styles.actionButtonText}>Imprimir</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Barra de Pestañas de Navegación */}
                <View style={styles.tabsRow}>
                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'general' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('general')}
                    >
                        <TrendingUp size={16} color={activeTab === 'general' ? Colors.primary : Colors.textSecondary} />
                        <Text style={[styles.tabButtonText, activeTab === 'general' && styles.tabButtonTextActive]}>
                            Consolidado General
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'project' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('project')}
                    >
                        <Building2 size={16} color={activeTab === 'project' ? Colors.primary : Colors.textSecondary} />
                        <Text style={[styles.tabButtonText, activeTab === 'project' && styles.tabButtonTextActive]}>
                            Por Proyecto
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'category' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('category')}
                    >
                        <Tag size={16} color={activeTab === 'category' ? Colors.primary : Colors.textSecondary} />
                        <Text style={[styles.tabButtonText, activeTab === 'category' && styles.tabButtonTextActive]}>
                            Por Categoría
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tabButton, activeTab === 'detailed' && styles.tabButtonActive]}
                        onPress={() => setActiveTab('detailed')}
                    >
                        <Layers size={16} color={activeTab === 'detailed' ? Colors.primary : Colors.textSecondary} />
                        <Text style={[styles.tabButtonText, activeTab === 'detailed' && styles.tabButtonTextActive]}>
                            Inventario Detallado
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Contenido Principal con Scroll */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Calculando valorización de inventario...</Text>
                </View>
            ) : error ? (
                <View style={styles.errorBox}>
                    <AlertCircle size={44} color={Colors.error} />
                    <Text style={styles.errorTitle}>Error al consultar la valorización</Text>
                    <Text style={styles.errorSub}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={loadReportData}>
                        <RefreshCw size={16} color="#FFF" />
                        <Text style={styles.retryButtonText}>Reintentar</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView
                    style={styles.scrollArea}
                    contentContainerStyle={styles.scrollContent}
                >
                    {renderActiveTabContent()}
                </ScrollView>
            )}

            {/* Modales de selección */}
            {renderLocationModal()}
            {renderCategoryModal()}
        </View>
    );
};

// ============================================================================
// ESTILOS VISUALES (MODERNOS, INTUITIVOS Y CORPORATIVOS)
// ============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        backgroundColor: '#FFFFFF',
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingHorizontal: 20,
        paddingBottom: 0,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    backButton: {
        padding: 8,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.secondary,
    },
    headerSubtitle: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionButton: {
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionButtonPrimary: {
        backgroundColor: Colors.primary,
    },
    actionButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 12,
    },
    tabsRow: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    tabButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    tabButtonActive: {
        borderBottomColor: Colors.primary,
    },
    tabButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    tabButtonTextActive: {
        color: Colors.primary,
        fontWeight: '700',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: Colors.textSecondary,
    },
    scrollArea: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },

    // KPI Box
    kpiContainer: {
        marginBottom: 16,
    },
    kpiBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    kpiBoxPrimary: {
        backgroundColor: Colors.secondary,
        borderColor: Colors.secondary,
    },
    kpiIconWrapPrimary: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    kpiLabelPrimary: {
        fontSize: 11,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: 0.5,
    },
    kpiNumberPrimary: {
        fontSize: 32,
        fontWeight: '800',
        color: '#FFFFFF',
        marginVertical: 4,
    },
    kpiSubPrimary: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.85)',
    },

    // Distribución
    distributionRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    distCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderLeftWidth: 4,
    },
    distLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: Colors.textSecondary,
        marginBottom: 4,
    },
    distValue: {
        fontSize: 15,
        fontWeight: '800',
        color: Colors.secondary,
    },
    distUnits: {
        fontSize: 11,
        color: Colors.textSecondary,
        marginTop: 2,
    },

    // Secciones
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionHeaderTitleWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionHeaderTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.secondary,
    },
    sectionHeaderBadge: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.textSecondary,
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },

    // Tarjetas de Proyecto
    locationCardsGrid: {
        gap: 12,
    },
    locationCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
    },
    locationCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    locationCardIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: Colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    locationCardTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.secondary,
    },
    locationCardType: {
        fontSize: 11,
        color: Colors.textSecondary,
    },
    inspectBadge: {
        backgroundColor: Colors.primary + '15',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    inspectBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.primary,
    },
    locationCardMoneyRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 10,
        borderRadius: 8,
        marginBottom: 10,
    },
    locationCardMoneyLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    locationCardMoneyValue: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.secondary,
    },
    locationCardStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    locationCardStatText: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    categoryPillsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 8,
    },
    catPill: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    catPillText: {
        fontSize: 10,
        color: Colors.secondary,
        fontWeight: '600',
    },
    catPillMore: {
        fontSize: 10,
        color: Colors.textSecondary,
        alignSelf: 'center',
    },

    // Categorías Grid
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    categoryCard: {
        width: '48%',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    categoryCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    categoryCardTitle: {
        flex: 1,
        fontSize: 13,
        fontWeight: '700',
        color: Colors.secondary,
    },
    percentageBadge: {
        backgroundColor: Colors.primary + '15',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    percentageBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.primary,
    },
    categoryCardValue: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.secondary,
        marginBottom: 4,
    },
    categoryCardFooter: {
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 6,
    },
    categoryCardSub: {
        fontSize: 10,
        color: Colors.textSecondary,
    },

    // Filtros
    filterBarCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 16,
    },
    filterBarTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.secondary,
        textTransform: 'uppercase',
    },
    pickerSelectorButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 8,
        gap: 8,
    },
    pickerSelectorText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: Colors.secondary,
    },
    subFilterRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    subFilterButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        gap: 6,
    },
    subFilterButtonText: {
        flex: 1,
        fontSize: 12,
        fontWeight: '600',
        color: Colors.secondary,
    },
    searchBarWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        gap: 6,
    },
    searchInput: {
        flex: 1,
        fontSize: 12,
        color: Colors.secondary,
        padding: 0,
    },

    // Hero Project Card
    projectHeroCard: {
        backgroundColor: Colors.secondary,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
    },
    projectHeroHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    projectHeroTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    projectHeroAmountLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: 0.5,
    },
    projectHeroAmount: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FFFFFF',
        marginVertical: 4,
    },
    projectHeroFooterRow: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 6,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.15)',
        paddingTop: 8,
    },
    projectHeroFooterText: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.85)',
    },

    // Desglose por categoría en proyecto
    projectCatBreakdownCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 16,
    },
    projectCatBreakdownTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.secondary,
        marginBottom: 10,
    },
    projectCatBreakdownGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    projectCatItem: {
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    projectCatItemName: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.secondary,
    },
    projectCatItemValue: {
        fontSize: 12,
        fontWeight: '800',
        color: Colors.primary,
        marginTop: 2,
    },
    projectCatItemUnits: {
        fontSize: 9,
        color: Colors.textSecondary,
    },

    // Lista de Items
    itemsListContainer: {
        gap: 10,
    },
    itemsListHeader: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.secondary,
        marginBottom: 4,
    },
    itemRowCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    itemRowHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    itemRowCode: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.primary,
    },
    itemRowName: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.secondary,
        marginTop: 2,
    },
    itemRowBrand: {
        fontSize: 11,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    itemRowSerial: {
        fontSize: 10,
        color: '#64748B',
        fontStyle: 'italic',
    },
    itemRowSubtotalBox: {
        alignItems: 'flex-end',
    },
    itemRowSubtotalLabel: {
        fontSize: 9,
        color: Colors.textSecondary,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    itemRowSubtotalValue: {
        fontSize: 15,
        fontWeight: '800',
        color: Colors.secondary,
        marginTop: 2,
    },
    itemRowFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#F8FAFC',
        paddingTop: 8,
    },
    itemRowBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    itemRowBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.secondary,
    },
    itemRowCollab: {
        fontSize: 11,
        color: Colors.textSecondary,
        flex: 1,
        marginHorizontal: 8,
    },
    itemRowMath: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.secondary,
    },
    siteTypeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
    },
    badgeBodega: {
        backgroundColor: '#E0E7FF',
    },
    badgeProject: {
        backgroundColor: '#FEF3C7',
    },
    badgeMaint: {
        backgroundColor: '#FEE2E2',
    },
    siteTypeBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#1E293B',
    },

    // Resumen filtrado
    filteredSummaryCard: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 14,
    },
    filteredSummaryLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    filteredSummaryValue: {
        fontSize: 15,
        fontWeight: '800',
        color: Colors.secondary,
        textAlign: 'center',
        marginTop: 2,
    },
    filteredSummaryDivider: {
        width: 1,
        height: '80%',
        backgroundColor: '#E2E8F0',
        alignSelf: 'center',
    },

    // Empty state
    emptyStateBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 30,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    emptyStateTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.secondary,
        marginTop: 10,
    },
    emptyStateSub: {
        fontSize: 11,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginTop: 4,
    },

    // Modales
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.secondary,
    },
    modalSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 12,
        gap: 8,
    },
    modalSearchInput: {
        flex: 1,
        fontSize: 13,
        color: Colors.secondary,
        padding: 0,
    },
    modalScroll: {
        maxHeight: 350,
    },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 10,
        marginBottom: 4,
    },
    modalOptionSelected: {
        backgroundColor: Colors.primary + '15',
    },
    modalOptionText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.secondary,
        marginLeft: 8,
        flex: 1,
    },
    modalOptionTextSelected: {
        color: Colors.primary,
        fontWeight: '700',
    },
    modalOptionSub: {
        fontSize: 11,
        color: Colors.textSecondary,
    },
    errorBox: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
        margin: 20,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    errorTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.secondary,
        marginTop: 14,
    },
    errorSub: {
        fontSize: 12,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginTop: 6,
        marginBottom: 18,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 13,
    },
});

export default ReportsScreen;
