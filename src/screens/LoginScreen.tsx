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
import { Mail, Lock, LogIn } from 'lucide-react-native';

const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { login, isOnline } = useAuth();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Por favor ingresa todos los campos');
            return;
        }

        setIsSubmitting(true);
        try {
            const success = await login(email, password);
            if (!success) {
                Alert.alert('Error de Acceso', 'El correo o la contraseña son incorrectos.');
            }
        } catch (error: any) {
            console.error('Login Screen Error:', error);
            Alert.alert(
                'Error de Sistema',
                'No se pudo completar el inicio de sesión.\n\nDetalle: ' + (error.message || 'Error desconocido')
            );
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
                        <View style={styles.inputContainer}>
                            <Mail size={20} color={Colors.textSecondary} style={styles.icon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Correo electrónico"
                                placeholderTextColor={Colors.textSecondary}
                                value={email}
                                onChangeText={setEmail}
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
                                onChangeText={setPassword}
                                secureTextEntry
                            />
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
});

export default LoginScreen;
