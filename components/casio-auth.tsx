import { BlinkingCursor } from '@/components/blinking-cursor';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import React, { useImperativeHandle, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

interface CasioAuthProps {
    onLogin: (user: { id: string; username: string }) => void;
    onStepChange?: (step: 'username' | 'pin') => void;
    keyboardVisible?: boolean;
}

export interface CasioAuthHandle {
    typeKey: (char: string) => void;
    deleteKey: () => void;
    enterKey: () => void;
}

export const CasioAuth = React.forwardRef<CasioAuthHandle, CasioAuthProps>(({ onLogin, onStepChange, keyboardVisible }, ref) => {
    const [step, setStep] = useState<'username' | 'pin'>('username');

    React.useEffect(() => {
        onStepChange?.(step);
    }, [step]);
    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(ref, () => ({
        typeKey: (char) => {
            if (step === 'username') {
                setUsername(prev => (prev + char).toUpperCase().slice(0, 12));
            } else {
                handlePinInput(char);
            }
        },
        deleteKey: () => {
            if (step === 'username') {
                setUsername(prev => prev.slice(0, -1));
            } else {
                setPin(prev => prev.slice(0, -1));
            }
        },
        enterKey: () => {
            if (step === 'username') {
                handleUsernameSubmit();
            }
        }
    }));

    const handleUsernameSubmit = () => {
        const clean = username.trim().toUpperCase();
        if (clean.length < 3) {
            setError('NAME TOO SHORT');
            return;
        }
        setUsername(clean);
        setError(null);
        setStep('pin');
    };

    const handlePinInput = async (digit: string) => {
        if (!/^\d$/.test(digit)) return; // Only allow digits for pin

        if (pin.length < 4) {
            const newPin = pin + digit;
            setPin(newPin);
            if (newPin.length === 4) {
                await processAuth(newPin, username);
            }
        }
    };

    const processAuth = async (finalPin: string, uname: string) => {
        setLoading(true);
        setError(null);
        try {
            const { data: existingUser, error: fetchError } = await supabase
                .from('casio_users')
                .select('id, username, pin')
                .eq('username', uname)
                .maybeSingle();

            if (fetchError) throw fetchError;

            if (existingUser) {
                if (existingUser.pin === finalPin) {
                    onLogin({ id: existingUser.id, username: existingUser.username });
                } else {
                    setError('ACCESS DENIED');
                    setPin('');
                }
            } else {
                // Signup
                const { data: newUser, error: insertError } = await supabase
                    .from('casio_users')
                    .insert([{ username: uname, pin: finalPin }])
                    .select()
                    .single();

                if (insertError) {
                    if (insertError.code === '23505') { // Conflict race
                        setError('ACCOUNT EXISTS');
                        setStep('username');
                    } else {
                        throw insertError;
                    }
                } else {
                    onLogin({ id: newUser.id, username: newUser.username });
                }
            }
        } catch (e: any) {
            setError('SYS ERR: ' + (e.message || 'ER').toUpperCase().slice(0, 15));
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Ionicons name="shield-checkmark" size={10} color="#003399" />
                <Text style={styles.header}>SECURE TERMINAL LOGIN</Text>
            </View>

            {step === 'username' ? (
                <View style={styles.inputBox}>
                    <Text style={styles.label}>ENTER IDENTIFIER:</Text>
                    <View style={styles.inputWrapper}>
                        <View style={styles.customInput}>
                            <Text style={[styles.inputText, !username && styles.placeholderText]}>
                                {username || 'USER_NAME'}
                            </Text>
                            <BlinkingCursor visible={true} style={styles.cursor} />
                        </View>
                    </View>
                    <Pressable style={styles.btn} onPress={handleUsernameSubmit}>
                        <Text style={styles.btnText}>VALIDATE USER &gt;</Text>
                    </Pressable>
                </View>
            ) : (
                <View style={styles.inputBox}>
                    <View style={styles.pinHeader}>
                        <Pressable onPress={() => { setStep('username'); setPin(''); setError(null); }}>
                            <Ionicons name="chevron-back" size={10} color="#003399" />
                        </Pressable>
                        <Text style={styles.pinLabel}>USER: {username}</Text>
                    </View>

                    {!keyboardVisible && (
                        <>
                            <View style={styles.pinDisplay}>
                                {[...Array(4)].map((_, i) => (
                                    <View key={i} style={[styles.pinDot, pin.length > i && styles.pinDotFilled]} />
                                ))}
                            </View>

                            <View style={styles.numpad}>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => (
                                    <Pressable key={n} style={styles.numBtn} onPress={() => handlePinInput(n.toString())}>
                                        <Text style={styles.numText}>{n}</Text>
                                    </Pressable>
                                ))}
                                <Pressable style={styles.numBtn} onPress={() => setPin('')}>
                                    <Ionicons name="close" size={12} color="#003399" />
                                </Pressable>
                            </View>
                        </>
                    )}
                    {keyboardVisible && (
                        <View style={styles.keyboardVisibleInfo}>
                            <View style={styles.pinDisplayMini}>
                                {[...Array(4)].map((_, i) => (
                                    <View key={i} style={[styles.pinDot, pin.length > i && styles.pinDotFilled]} />
                                ))}
                            </View>
                            <Text style={styles.helperText}>USE TERMINAL KEYS</Text>
                        </View>
                    )}
                </View>
            )}

            <View style={styles.footer}>
                {loading ? <ActivityIndicator size="small" color="#003399" /> : (
                    <Text style={error ? styles.errorText : styles.statusText}>
                        {error ? `!! ${error} !!` : 'PROTOCOL: STANDBY'}
                    </Text>
                )}
            </View>
        </View>
    );
});

CasioAuth.displayName = 'CasioAuth';
const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(0,51,153,0.2)',
    },
    header: {
        fontFamily: 'DotGothic16',
        fontSize: 10,
        fontWeight: '900',
        color: '#003399',
        letterSpacing: 1,
    },
    inputBox: {
        width: '100%',
        gap: 6,
    },
    label: {
        fontFamily: 'DotGothic16',
        fontSize: 9,
        color: '#003399',
        fontWeight: '700',
    },
    inputWrapper: {
        borderWidth: 1,
        borderColor: '#003399',
        borderRadius: 2,
        paddingHorizontal: 8,
        backgroundColor: 'rgba(0,51,153,0.05)',
        height: 32,
        justifyContent: 'center',
    },
    customInput: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    inputText: {
        fontFamily: 'DotGothic16',
        fontSize: 16,
        color: '#003399',
        letterSpacing: 1,
    },
    placeholderText: {
        opacity: 0.3,
    },
    cursor: {
        height: 18,
        marginLeft: 4,
    },
    btn: {
        backgroundColor: '#003399',
        height: 28,
        borderRadius: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnText: {
        fontFamily: 'DotGothic16',
        fontSize: 10,
        color: '#85a78f',
        fontWeight: '900',
    },
    pinHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
    },
    pinLabel: {
        fontFamily: 'DotGothic16',
        fontSize: 9,
        color: '#003399',
    },
    pinDisplay: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginVertical: 4,
    },
    pinDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 1.2,
        borderColor: '#003399',
    },
    pinDotFilled: {
        backgroundColor: '#003399',
    },
    numpad: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 4,
    },
    numBtn: {
        width: 38,
        height: 24,
        borderRadius: 2,
        borderWidth: 0.8,
        borderColor: '#003399',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,51,153,0.05)',
    },
    numText: {
        fontFamily: 'DotGothic16',
        fontSize: 12,
        fontWeight: '900',
        color: '#003399',
    },
    footer: {
        marginTop: 6,
        alignItems: 'center',
    },
    statusText: {
        fontFamily: 'DotGothic16',
        fontSize: 8,
        color: '#003399',
        opacity: 0.4,
    },
    errorText: {
        fontFamily: 'DotGothic16',
        fontSize: 9,
        color: '#990000',
        fontWeight: '900',
    },
    keyboardVisibleInfo: {
        alignItems: 'center',
        paddingVertical: 10,
        gap: 8,
    },
    pinDisplayMini: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    helperText: {
        fontFamily: 'DotGothic16',
        fontSize: 8,
        color: '#003399',
        opacity: 0.6,
        letterSpacing: 1,
    },
});
