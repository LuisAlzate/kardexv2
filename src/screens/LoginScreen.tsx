import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../theme/colors';
import Logo from '../components/Logo';
import { Mail, Lock, LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react-native';

const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login, isOnline } = useAuth();

    // Mensaje estándar de seguridad para evitar enumeración de usuarios
    const GENERIC_CREDENTIALS_ERROR = 'Usuario o contraseña incorrectos. Verifique sus credenciales e intente nuevamente.';

    const handleLogin = async () => {
        setErrorMessage(null);

        if (!email.trim() || !password) {
            const emptyMsg = 'Por favor ingrese tanto el correo como la contraseña.';
            setErrorMessage(emptyMsg);
            Alert.alert('Campos Incompletos', emptyMsg);
            return;
        }

        setIsSubmitting(true);
        try {
            const success = await login(email.trim(), password);
            if (!success) {
                // Mensaje genérico: no revela si el error fue el usuario o la contraseña
                setErrorMessage(GENERIC_CREDENTIALS_ERROR);
                Alert.alert('Error de Acceso', GENERIC_CREDENTIALS_ERROR);
            }
        } catch (error: any) {
            console.error('Login Screen Error:', error);
            // Mensaje genérico para proteger la seguridad de los accesos
            setErrorMessage(GENERIC_CREDENTIALS_ERROR);
            Alert.alert('Error de Acceso', GENERIC_CREDENTIALS_ERROR);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <View style={styles.content}>
                    <Logo size={280} style={styles.logo} />

                    <Text style={styles.title}>Bienvenido</Text>
                    <Text style={styles.subtitle}>Inicia sesión para gestionar el inventario</Text>

                    <View style={styles.form}>
                        {/* Mensaje de error general si las credenciales fallan */}
                        {errorMessage ? (
                            <View style={styles.errorContainer}>
                                <AlertCircle size={18} color={Colors.error} style={styles.errorIcon} />
                                <Text style={styles.errorText}>{errorMessage}</Text>
                            </View>
                        ) : null}

                        <View style={styles.inputContainer}>
                            <Mail size={20} color={Colors.textSecondary} style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Correo electrónico"
                                placeholderTextColor={Colors.textSecondary}
                                value={email}
                                onChangeText={(text) => {
                                    setEmail(text);
                                    if (errorMessage) setErrorMessage(null);
                                }}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Lock size={20} color={Colors.textSecondary} style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Contraseña"
                                placeholderTextColor={Colors.textSecondary}
                                value={password}
                                onChangeText={(text) => {
                                    setPassword(text);
                                    if (errorMessage) setErrorMessage(null);
                                }}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                style={styles.eyeButton}
                                accessibilityRole="button"
                                accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                            >
                                {showPassword ? (
                                    <EyeOff size={20} color={Colors.textSecondary} />
                                ) : (
                                    <Eye size={20} color={Colors.textSecondary} />
                                )}
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleLogin}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <>
                                    <Text style={styles.buttonText}>Entrar</Text>
                                    <LogIn size={20} color="#FFF" style={styles.buttonIcon} />
                                </>
                            )}
                        </TouchableOpacity>

                        <View style={styles.statusContainer}>
                            <View style={[styles.statusDot, { backgroundColor: isOnline ? '#4CAF50' : '#F44336' }]} />
                            <Text style={styles.footerText}>
                                {isOnline ? 'Conectado a Supabase (Online)' : 'Modo Fuera de Línea (SQLite Local)'}
                            </Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    content: {
        padding: 30,
        alignItems: 'center',
    },
    logo: {
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: Colors.secondary,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textSecondary,
        marginBottom: 32,
        textAlign: 'center',
    },
    form: {
        width: '100%',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 12,
        marginBottom: 16,
        paddingHorizontal: 16,
        height: 56,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    icon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: Colors.text,
        fontSize: 16,
    },
    button: {
        backgroundColor: Colors.primary,
        borderRadius: 12,
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '600',
    },
    buttonIcon: {
        marginLeft: 8,
    },
    statusContainer: {
        marginTop: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 8,
    },
    footerText: {
        textAlign: 'center',
        color: Colors.textSecondary,
        fontSize: 13,
        fontWeight: '500',
    },
    eyeButton: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.error + '15',
        borderColor: Colors.error + '40',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 16,
    },
    errorIcon: {
        marginRight: 8,
    },
    errorText: {
        flex: 1,
        color: Colors.error,
        fontSize: 13,
        fontWeight: '500',
        lineHeight: 18,
    },
});

export default LoginScreen;
