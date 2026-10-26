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
    Alert,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { ArrowLeft, Tag, Plus, Save, X, Edit2, Trash2, Search, Info } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { getMovementRepository, Category } from '../database/repositories/MovementRepository';
import { useAuth } from '../context/AuthContext';
import { generateUUID } from '../lib/uuid';

/**
 * Propiedades del componente CategoryScreen
 */
interface CategoryScreenProps {
    onBack: () => void;
}

/**
 * Pantalla de Maestro de Categorías
 * 
 * Permite a los usuarios autorizados (Admin / Revisor / Operario según permisos)
 * visualizar, registrar, editar y administrar las categorías del inventario
 * (ej: Herramientas, Insumos, Equipos, Consumibles).
 * 
 * Principios aplicados:
 * - Responsabilidad Única (SRP): Se encarga exclusivamente de la gestión del catálogo maestro de categorías.
 * - Código documentado: Explicación paso a paso para desarrolladores Junior.
 */
const CategoryScreen: React.FC<CategoryScreenProps> = ({ onBack }) => {
    // -------------------------------------------------------------------------
    // ESTADOS Y CONTEXTO
    // -------------------------------------------------------------------------
    const { isOnline, can, user } = useAuth();
    const canEdit = user?.rol === 'admin' || can('categories', 'editar');

    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<Category[]>([]);
    const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Estado del modal de creación/edición
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [codigo, setCodigo] = useState('');
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [saving, setSaving] = useState(false);

    // -------------------------------------------------------------------------
    // EFECTOS (CICLO DE VIDA)
    // -------------------------------------------------------------------------
    useEffect(() => {
        loadCategories();
    }, []);

    // Filtro de búsqueda en tiempo real
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredCategories(categories);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = categories.filter(
                c => c.nombre.toLowerCase().includes(query) ||
                     c.codigo.toLowerCase().includes(query) ||
                     (c.descripcion && c.descripcion.toLowerCase().includes(query))
            );
            setFilteredCategories(filtered);
        }
    }, [searchQuery, categories]);

    // -------------------------------------------------------------------------
    // MÉTODOS DE DATOS (CRUD)
    // -------------------------------------------------------------------------
    /**
     * Carga todas las categorías desde el repositorio activo (SQLite o Supabase)
     */
    const loadCategories = async () => {
        setLoading(true);
        try {
            const repo = await getMovementRepository(isOnline);
            const data = await repo.getAllCategories();
            setCategories(data);
        } catch (error: any) {
            console.error('Error al cargar categorías:', error);
            Alert.alert('Error', 'No se pudieron cargar las categorías: ' + (error.message || 'Error desconocido'));
        } finally {
            setLoading(false);
        }
    };

    /**
     * Abre el modal para crear una nueva categoría
     */
    const handleOpenCreateModal = () => {
        setEditingCategory(null);
        setCodigo('');
        setNombre('');
        setDescripcion('');
        setIsModalVisible(true);
    };

    /**
     * Abre el modal para editar una categoría existente
     */
    const handleOpenEditModal = (category: Category) => {
        setEditingCategory(category);
        setCodigo(category.codigo);
        setNombre(category.nombre);
        setDescripcion(category.descripcion || '');
        setIsModalVisible(true);
    };

    /**
     * Guarda (crea o actualiza) una categoría
     */
    const handleSave = async () => {
        // Validaciones básicas de formulario
        const cleanCodigo = codigo.trim().toUpperCase();
        const cleanNombre = nombre.trim();

        if (!cleanCodigo || !cleanNombre) {
            Alert.alert('Campos requeridos', 'Por favor ingresa tanto el código como el nombre de la categoría.');
            return;
        }

        setSaving(true);
        try {
            const repo = await getMovementRepository(isOnline);

            if (editingCategory) {
                // Modo Edición
                await repo.updateCategory({
                    id: editingCategory.id,
                    codigo: cleanCodigo,
                    nombre: cleanNombre,
                    descripcion: descripcion.trim() || undefined,
                });
                Alert.alert('Éxito', 'Categoría actualizada correctamente.');
            } else {
                // Modo Creación
                await repo.createCategory({
                    id: generateUUID(),
                    codigo: cleanCodigo,
                    nombre: cleanNombre,
                    descripcion: descripcion.trim() || undefined,
                });
                Alert.alert('Éxito', 'Categoría creada correctamente.');
            }

            setIsModalVisible(false);
            setEditingCategory(null);
            setCodigo('');
            setNombre('');
            setDescripcion('');
            await loadCategories();
        } catch (error: any) {
            console.error('Error al guardar categoría:', error);
            Alert.alert('Error', error.message || 'Ocurrió un error al guardar la categoría.');
        } finally {
            setSaving(false);
        }
    };

    /**
     * Elimina una categoría si no tiene artículos asociados
     */
    const handleDelete = (category: Category) => {
        Alert.alert(
            'Confirmar eliminación',
            `¿Estás seguro de que deseas eliminar la categoría "${category.nombre}"?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const repo = await getMovementRepository(isOnline);
                            await repo.deleteCategory(category.id);
                            Alert.alert('Éxito', 'Categoría eliminada.');
                            await loadCategories();
                        } catch (error: any) {
                            Alert.alert('No se pudo eliminar', error.message || 'Error al eliminar.');
                        }
                    },
                },
            ]
        );
    };

    // -------------------------------------------------------------------------
    // RENDERIZADO DE ITEMS
    // -------------------------------------------------------------------------
    const renderCategoryItem = ({ item }: { item: Category }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.iconContainer}>
                    <Tag size={20} color={Colors.primary} />
                </View>
                <View style={styles.cardTitleSection}>
                    <Text style={styles.categoryName}>{item.nombre}</Text>
                    <View style={styles.codeBadge}>
                        <Text style={styles.codeBadgeText}>{item.codigo}</Text>
                    </View>
                </View>

                {canEdit && (
                    <View style={styles.cardActions}>
                        <TouchableOpacity
                            onPress={() => handleOpenEditModal(item)}
                            style={styles.actionButton}
                            accessibilityLabel="Editar categoría"
                        >
                            <Edit2 size={18} color={Colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleDelete(item)}
                            style={[styles.actionButton, styles.deleteButton]}
                            accessibilityLabel="Eliminar categoría"
                        >
                            <Trash2 size={18} color={Colors.error} />
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {item.descripcion ? (
                <Text style={styles.categoryDescription}>{item.descripcion}</Text>
            ) : (
                <Text style={styles.noDescription}>Sin descripción adicional</Text>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            {/* Header Principal */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft size={24} color={Colors.secondary} />
                </TouchableOpacity>
                <View style={styles.headerTitles}>
                    <Text style={styles.title}>Maestro de Categorías</Text>
                    <Text style={styles.subtitle}>Herramientas, Insumos, Equipos y más</Text>
                </View>
                {canEdit && (
                    <TouchableOpacity onPress={handleOpenCreateModal} style={styles.createButton}>
                        <Plus size={20} color="#fff" />
                        <Text style={styles.createButtonText}>Nueva</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Buscador */}
            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <Search size={18} color={Colors.textSecondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar por código, nombre o descripción..."
                        placeholderTextColor={Colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={18} color={Colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Lista de Categorías */}
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Cargando categorías...</Text>
                </View>
            ) : filteredCategories.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Info size={48} color={Colors.textSecondary} />
                    <Text style={styles.emptyTitle}>No se encontraron categorías</Text>
                    <Text style={styles.emptySubtitle}>
                        {searchQuery ? 'Prueba con otro término de búsqueda' : 'Presiona "Nueva" para registrar la primera categoría.'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredCategories}
                    keyExtractor={item => item.id}
                    renderItem={renderCategoryItem}
                    contentContainerStyle={styles.listContent}
                />
            )}

            {/* Modal de Creación / Edición */}
            <Modal
                visible={isModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setIsModalVisible(false)}
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalHeaderTitleRow}>
                                <Tag size={22} color={Colors.primary} />
                                <Text style={styles.modalTitle}>
                                    {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setIsModalVisible(false)}
                                style={styles.modalCloseButton}
                            >
                                <X size={20} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalDescription}>
                            Las categorías clasifican los artículos del inventario (por ejemplo: HERRAMIENTAS, INSUMOS, EQUIPOS).
                        </Text>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Código Identificador *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ej: INSUMOS, HERRAMIENTAS, CONSUMIBLES"
                                placeholderTextColor={Colors.textSecondary}
                                autoCapitalize="characters"
                                value={codigo}
                                onChangeText={setCodigo}
                            />
                            <Text style={styles.helperText}>Se guardará en mayúsculas automáticamente.</Text>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Nombre de la Categoría *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ej: Insumos de Construcción"
                                placeholderTextColor={Colors.textSecondary}
                                value={nombre}
                                onChangeText={setNombre}
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Descripción (Opcional)</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Breve descripción o ejemplos de artículos incluidos..."
                                placeholderTextColor={Colors.textSecondary}
                                multiline
                                numberOfLines={3}
                                value={descripcion}
                                onChangeText={setDescripcion}
                            />
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                onPress={() => setIsModalVisible(false)}
                                style={styles.cancelButton}
                                disabled={saving}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSave}
                                style={styles.saveButton}
                                disabled={saving}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Save size={18} color="#fff" />
                                        <Text style={styles.saveButtonText}>Guardar</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
};

export default CategoryScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 40 : 15,
        paddingBottom: 15,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    backButton: {
        padding: 8,
        marginRight: 10,
        borderRadius: 8,
        backgroundColor: '#f5f5f5',
    },
    headerTitles: {
        flex: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.secondary,
    },
    subtitle: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 10,
        gap: 6,
    },
    createButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    searchSection: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#fff',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#e9ecef',
        gap: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: Colors.text,
        padding: 0,
    },
    listContent: {
        padding: 20,
        gap: 12,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#f0f0f0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: 'rgba(235, 100, 39, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    cardTitleSection: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
    },
    categoryName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.secondary,
    },
    codeBadge: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    codeBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
        letterSpacing: 0.5,
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actionButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f8f9fa',
    },
    deleteButton: {
        backgroundColor: '#fff1f2',
    },
    categoryDescription: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginTop: 4,
        lineHeight: 18,
    },
    noDescription: {
        fontSize: 12,
        color: '#94a3b8',
        fontStyle: 'italic',
        marginTop: 4,
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 14,
        color: Colors.textSecondary,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.secondary,
        marginTop: 12,
    },
    emptySubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginTop: 6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 24,
        width: '100%',
        maxWidth: 500,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    modalHeaderTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.secondary,
    },
    modalCloseButton: {
        padding: 4,
    },
    modalDescription: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginBottom: 18,
        lineHeight: 18,
    },
    formGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.secondary,
        marginBottom: 6,
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
    helperText: {
        fontSize: 11,
        color: Colors.textSecondary,
        marginTop: 4,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 12,
        marginTop: 10,
    },
    cancelButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: Colors.primary,
        gap: 6,
    },
    saveButtonText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
    },
});
