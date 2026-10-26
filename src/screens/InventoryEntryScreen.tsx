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
  KeyboardAvoidingView,
} from 'react-native';
import { ArrowLeft, Save, Package, Tag, Info, Search, X, Shield, CheckSquare, Square, Calendar, DollarSign, ChevronDown } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { getMovementRepository, Tool, Category } from '../database/repositories/MovementRepository';
import { useAuth } from '../context/AuthContext';
import * as SQLite from 'expo-sqlite';
import { Modal, FlatList, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface InventoryEntryScreenProps {
  onBack: () => void;
}

const InventoryEntryScreen: React.FC<InventoryEntryScreenProps> = ({ onBack }) => {
  const { user, can, isOnline } = useAuth();
  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [hasSerial, setHasSerial] = useState(false);
  const [serials, setSerials] = useState<string[]>(['']);
  const [marca, setMarca] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [existingTool, setExistingTool] = useState<Tool | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);
  const [showToolPicker, setShowToolPicker] = useState(false);
  const [allTools, setAllTools] = useState<Tool[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [fechaCompra, setFechaCompra] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [estanteria, setEstanteria] = useState('');
  // Categoría y Precio (Herramienta vs Insumo, Valor unitario)
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [precio, setPrecio] = useState<string>('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Sync serials array size with cantidad
  useEffect(() => {
    const qty = parseInt(cantidad) || 0;
    if (qty > 0 && qty <= 50) { // Limit to 50 for safety
      setSerials(prev => {
        const newSerials = [...prev];
        if (newSerials.length < qty) {
          return [...newSerials, ...Array(qty - newSerials.length).fill('')];
        } else if (newSerials.length > qty) {
          return newSerials.slice(0, qty);
        }
        return newSerials;
      });
    }
  }, [cantidad]);

  // Cargar categorías disponibles al montar
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const repo = await getMovementRepository(isOnline);
      const cats = await repo.getAllCategories();
      setCategories(cats);
      if (cats.length > 0 && !selectedCategoryId) {
        // Por defecto seleccionar Herramientas o la primera disponible
        const defaultCat = cats.find(c => c.codigo.includes('HERRAMIENTA')) || cats[0];
        setSelectedCategoryId(defaultCat.id);
      }
    } catch (error) {
      console.error('Error al cargar categorías en ingreso:', error);
    }
  };

  useEffect(() => {
    if (codigo.length >= 2) {
      lookupTool();
    } else {
      setExistingTool(null);
    }
  }, [codigo]);

  const lookupTool = async () => {
    setCheckingCode(true);
    try {
      const repo = await getMovementRepository(isOnline);
      // Look for a generic tool (no serial) with this code
      const tool = await repo.getToolByCode(codigo);
      if (tool) {
        setExistingTool(tool);
        setNombre(tool.nombre);
        setMarca(tool.marca || '');
        setDescripcion(tool.descripcion || '');
        setEstanteria(tool.estanteria || '');
        if (tool.categoria_id) setSelectedCategoryId(tool.categoria_id);
        if (tool.precio !== undefined && tool.precio !== null) setPrecio(String(tool.precio));
      } else {
        setExistingTool(null);
        setEstanteria('');
        setDescripcion('');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setCheckingCode(false);
    }
  };

  const loadAllTools = async () => {
    try {
      const repo = await getMovementRepository(isOnline);
      const tools = await repo.getAllTools();
      setAllTools(tools);
      setShowToolPicker(true);
    } catch (error) {
      console.error(error);
    }
  };

  const selectSuggestedTool = (tool: Tool) => {
    setCodigo(tool.codigo_referencia);
    setNombre(tool.nombre);
    setMarca(tool.marca || '');
    setDescripcion(tool.descripcion || '');
    setEstanteria(tool.estanteria || '');
    if (tool.categoria_id) setSelectedCategoryId(tool.categoria_id);
    if (tool.precio !== undefined && tool.precio !== null) setPrecio(String(tool.precio));
    setExistingTool(tool);
    setShowToolPicker(false);
  };

  const filteredTools = allTools.filter(t =>
    t.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.codigo_referencia.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const updateSerial = (index: number, val: string) => {
    const newSerials = [...serials];
    newSerials[index] = val.toUpperCase();
    setSerials(newSerials);
  };

  const handleSave = async () => {
    if (!nombre || !codigo || !cantidad) {
      Alert.alert('Error', 'Nombre, código y cantidad son obligatorios');
      return;
    }

    const qtyNum = parseInt(cantidad);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      Alert.alert('Error', 'La cantidad debe ser un número positivo');
      return;
    }

    if (hasSerial) {
      // Validate serials are not empty
      if (serials.some(s => !s.trim())) {
        Alert.alert('Error', 'Debes ingresar todos los números de serie');
        return;
      }
      // Check for duplicates in current list
      const uniqueSerials = new Set(serials.map(s => s.trim()));
      if (uniqueSerials.size !== serials.length) {
        Alert.alert('Error', 'No puedes ingresar números de serie duplicados');
        return;
      }
    }

    setLoading(true);

    try {
      const repo = await getMovementRepository(isOnline);
      const userId = user?.id || '00000000-0000-0000-0000-000000000001';
      const bodegaId = await repo.getBodegaId();

      const newMovements: any[] = [];

      const numericPrecio = parseFloat(precio) || 0;

      if (hasSerial) {
        for (const serial of serials) {
          const trimmedSerial = serial.trim();
          
          let tool = await repo.getToolByCodeAndSerial(codigo, trimmedSerial);
          let toolId = tool ? tool.id : generateUUID();
          
          if (!tool) {
            await repo.createTool({
              id: toolId,
              nombre,
              marca: marca || undefined,
              descripcion: descripcion || undefined,
              codigo_referencia: codigo,
              num_serial: trimmedSerial,
              fecha_compra: fechaCompra.toISOString().split('T')[0],
              estanteria: estanteria || undefined,
              categoria_id: selectedCategoryId || undefined,
              precio: numericPrecio
            });
          }

          newMovements.push({
            id: generateUUID(),
            herramienta_id: toolId,
            ubicacion_id: bodegaId,
            tipo_movimiento: 'ENTRADA',
            cantidad: 1,
            estado_insumo: 'BUENA',
            observaciones: `Ingreso serializado: ${trimmedSerial}.`,
            usuario_sistema_id: userId,
            fecha: new Date().toISOString()
          });
        }
      } else {
        const toolId = existingTool ? existingTool.id : generateUUID();
        if (!existingTool) {
          await repo.createTool({
            id: toolId,
            nombre,
            marca: marca || undefined,
            descripcion: descripcion || undefined,
            codigo_referencia: codigo,
            fecha_compra: fechaCompra.toISOString().split('T')[0],
            estanteria: estanteria || undefined,
            categoria_id: selectedCategoryId || undefined,
            precio: numericPrecio
          });
        }

        newMovements.push({
          id: generateUUID(),
          herramienta_id: toolId,
          ubicacion_id: bodegaId,
          tipo_movimiento: 'ENTRADA',
          cantidad: qtyNum,
          estado_insumo: 'BUENA',
          observaciones: existingTool 
            ? `Ingreso adicional de stock.`
            : `Ingreso inicial.`,
          usuario_sistema_id: userId,
          fecha: new Date().toISOString()
        });
      }

      await repo.registerMovements(newMovements);

      Alert.alert('Éxito', 'Registros guardados correctamente');
      onBack();
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', 'No se pudo guardar el registro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ingreso de Material</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        enabled={Platform.OS !== 'web'}
      >
        <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Datos de la Herramienta</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Código / Referencia *</Text>
            <View style={styles.inputContainer}>
              <Tag size={20} color={Colors.textSecondary} style={styles.icon} />
              <TextInput
                style={styles.input}
                value={codigo}
                onChangeText={(text) => setCodigo(text.toUpperCase())}
                placeholder="Ej. CF1"
                autoCapitalize="characters"
              />
              {checkingCode ? (
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 8 }} />
              ) : (
                <TouchableOpacity onPress={loadAllTools} style={styles.searchIcon}>
                  <Search size={20} color={Colors.primary} />
                </TouchableOpacity>
              )}
              {existingTool && <View style={styles.existsBadge}><Text style={styles.existsText}>EXISTE</Text></View>}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nombre del Insumo / Herramienta *</Text>
            <View style={[styles.inputContainer, existingTool && styles.inputDisabled]}>
              <Package size={20} color={Colors.textSecondary} style={styles.icon} />
              <TextInput
                style={styles.input}
                value={nombre}
                onChangeText={setNombre}
                placeholder="Ej. Martillo, Tubo PVC, Broca"
                editable={!existingTool}
              />
            </View>
          </View>

          {/* Selector de Categoría (Maestro: Herramienta, Insumo, etc.) */}
          <View style={styles.field}>
            <Text style={styles.label}>Categoría del Artículo *</Text>
            <TouchableOpacity
              style={[styles.inputContainer, existingTool && styles.inputDisabled]}
              onPress={() => !existingTool && setShowCategoryPicker(true)}
              disabled={!!existingTool}
            >
              <Tag size={20} color={Colors.primary} style={styles.icon} />
              <Text style={[styles.input, !selectedCategoryId && { color: Colors.textSecondary }]}>
                {categories.find(c => c.id === selectedCategoryId)?.nombre || 'Seleccionar Categoría...'}
              </Text>
              <ChevronDown size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
            </TouchableOpacity>
          </View>

          {/* Campo de Precio / Valor Unitario */}
          <View style={styles.field}>
            <Text style={styles.label}>Precio / Valor Unitario (COP)</Text>
            <View style={[styles.inputContainer, existingTool && styles.inputDisabled]}>
              <DollarSign size={20} color={Colors.textSecondary} style={styles.icon} />
              <TextInput
                style={styles.input}
                value={precio}
                onChangeText={setPrecio}
                placeholder="Ej. 45000"
                keyboardType="numeric"
                editable={!existingTool}
              />
              {precio && !isNaN(Number(precio)) && (
                <Text style={styles.priceFormatted}>
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(precio))}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Marca</Text>
            <View style={[styles.inputContainer, existingTool && styles.inputDisabled]}>
              <Info size={20} color={Colors.textSecondary} style={styles.icon} />
              <TextInput
                style={styles.input}
                value={marca}
                onChangeText={setMarca}
                placeholder="Ej. DeWalt"
                editable={!existingTool}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Estantería</Text>
            <View style={[styles.inputContainer, existingTool && styles.inputDisabled]}>
              <Info size={20} color={Colors.textSecondary} style={styles.icon} />
              <TextInput
                style={styles.input}
                value={estanteria}
                onChangeText={setEstanteria}
                placeholder="Ej. Estante A"
                editable={!existingTool}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Fecha de Compra</Text>
            <TouchableOpacity
              style={[styles.inputContainer, existingTool && styles.inputDisabled]}
              onPress={() => !existingTool && setShowDatePicker(true)}
              disabled={!!existingTool}
            >
              <Calendar size={20} color={Colors.textSecondary} style={styles.icon} />
              <Text style={[styles.input, !fechaCompra && { color: Colors.textSecondary }]}>
                {fechaCompra ? fechaCompra.toLocaleDateString() : 'Seleccionar fecha'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Detalles del Ingreso</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Cantidad *</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={cantidad}
                onChangeText={setCantidad}
                keyboardType="numeric"
                placeholder="1"
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setHasSerial(!hasSerial)}
          >
            {hasSerial ? (
              <CheckSquare size={24} color={Colors.primary} />
            ) : (
              <Square size={24} color={Colors.textSecondary} />
            )}
            <Text style={styles.checkboxLabel}>¿Lleva número serial?</Text>
          </TouchableOpacity>

          {hasSerial && (
            <View style={styles.serialsList}>
              <Text style={styles.label}>Números de Serie</Text>
              {serials.map((serial, index) => (
                <View key={index} style={[styles.field, { marginBottom: 8 }]}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.serialIndex}>{index + 1}.</Text>
                    <TextInput
                      style={styles.input}
                      value={serial}
                      onChangeText={(text) => updateSerial(index, text)}
                      placeholder={`Serial para unidad ${index + 1}`}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={descripcion}
              onChangeText={setDescripcion}
              placeholder="Detalles adicionales del insumo..."
              editable={!existingTool}
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {can('inventory_entry', 'editar') ? (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Save size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>Guardar Ingreso</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.permissionInfo}>
            <Shield size={20} color={Colors.textSecondary} />
            <Text style={styles.permissionText}>No tienes permisos para realizar ingresos.</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
      <Modal visible={showToolPicker} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seleccionar Insumo Existente</Text>
              <TouchableOpacity onPress={() => setShowToolPicker(false)}>
                <X size={24} color={Colors.secondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchContainer}>
              <Search size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Buscar por nombre o código..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <FlatList
              data={filteredTools}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.toolItem}
                  onPress={() => selectSuggestedTool(item)}
                >
                  <View style={styles.toolItemIcon}>
                    <Package size={20} color={Colors.primary} />
                  </View>
                  <View style={styles.toolItemInfo}>
                    <Text style={styles.toolItemName}>{item.nombre}</Text>
                    <Text style={styles.toolItemCode}>{item.codigo_referencia} • {item.marca || 'Sin marca'}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No se encontraron insumos</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Modal para Seleccionar Categoría */}
      <Modal visible={showCategoryPicker} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Tag size={20} color={Colors.primary} />
                <Text style={styles.modalTitle}>Seleccionar Categoría</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <X size={24} color={Colors.secondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={categories}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = item.id === selectedCategoryId;
                return (
                  <TouchableOpacity
                    style={[
                      styles.toolItem,
                      isSelected && { backgroundColor: '#fff7ed', borderColor: Colors.primary, borderWidth: 1 }
                    ]}
                    onPress={() => {
                      setSelectedCategoryId(item.id);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <View style={[styles.toolItemIcon, isSelected && { backgroundColor: Colors.primary }]}>
                      <Tag size={18} color={isSelected ? '#fff' : Colors.primary} />
                    </View>
                    <View style={styles.toolItemInfo}>
                      <Text style={[styles.toolItemName, isSelected && { color: Colors.primary, fontWeight: 'bold' }]}>
                        {item.nombre}
                      </Text>
                      <Text style={styles.toolItemCode}>
                        {item.codigo} {item.descripcion ? `• ${item.descripcion}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No hay categorías disponibles.</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Date Picker Overlay for Web/Native */}
      {showDatePicker && (
        Platform.OS === 'web' ? (
          <View style={styles.webOverlay}>
            <View style={styles.webPickerContainer}>
              <Text style={styles.webPickerLabel}>Fecha de Compra:</Text>
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
                value: fechaCompra.toISOString().split('T')[0],
                onChange: (e: any) => {
                  const val = e.target.value;
                  if (val) {
                    const [y, m, d] = val.split('-').map(Number);
                    const date = new Date(y, m - 1, d, 12);
                    setFechaCompra(date);
                  }
                  setShowDatePicker(false);
                }
              })}
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.webPickerClose}>
                <X size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.overlayClose} onPress={() => setShowDatePicker(false)} />
          </View>
        ) : (
          <DateTimePicker
            value={fechaCompra}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event: any, selectedDate?: Date) => {
              setShowDatePicker(false);
              if (selectedDate) {
                setFechaCompra(selectedDate);
              }
            }}
          />
        )
      )}
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
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  inputDisabled: {
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1',
  },
  existsBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  existsText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  searchIcon: {
    padding: 4,
    marginLeft: 8,
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
    height: '80%',
    padding: 24,
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
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 15,
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
    backgroundColor: Colors.primary + '15',
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
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  textArea: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    height: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 40,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  permissionText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  checkboxLabel: {
    marginLeft: 12,
    fontSize: 15,
    color: Colors.secondary,
    fontWeight: '600',
  },
  serialsList: {
    marginBottom: 20,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: Colors.primary,
  },
  serialIndex: {
    marginRight: 8,
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '700',
    width: 25,
  },
  // Web Date Picker Styles
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
  webPickerClose: {
    backgroundColor: Colors.primary,
    padding: 10,
    borderRadius: 8,
    marginLeft: 10,
  },
  priceFormatted: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
});

export default InventoryEntryScreen;
