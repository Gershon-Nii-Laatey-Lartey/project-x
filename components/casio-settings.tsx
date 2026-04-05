import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface CasioSettingsProps {
    onClose: () => void;
    settings: {
        lcdContrast: number;
        typewriterSpeed: 'fast' | 'realistic';
        systemBrightness: number;
    };
    batteryLevel: number | null;
    onUpdate: (key: string, value: any) => void;
    onResetHistory: () => void;
}

export const CasioSettings = ({ onClose, settings, batteryLevel, onUpdate, onResetHistory }: CasioSettingsProps) => {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>SYSTEM SETUP</Text>
                <View style={styles.headerRight}>
                    <View style={styles.batteryContainer}>
                        <Ionicons name="flash" size={10} color="#003399" style={styles.batteryIcon} />
                        <Text style={styles.batteryText}>{batteryLevel !== null ? `${Math.round(batteryLevel * 100)}%` : '--%'}</Text>
                    </View>
                    <Pressable style={styles.closeBtn} onPress={onClose}>
                        <Ionicons name="close" size={14} color="#003399" />
                    </Pressable>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.settingRow}>
                    <Text style={styles.label}>LCD CONTRAST (TEXT DARKNESS)</Text>
                    <View style={styles.controlRow}>
                        {[0.3, 0.6, 0.8, 1.0].map((val) => (
                            <Pressable
                                key={val}
                                style={[styles.optionBtn, settings.lcdContrast === val && styles.optionBtnActive]}
                                onPress={() => onUpdate('lcdContrast', val)}
                            >
                                <Text style={[styles.optionText, settings.lcdContrast === val && styles.optionTextActive]}>
                                    {val === 0.3 ? 'MIN' : val === 1.0 ? 'MAX' : `${Math.round(val * 100)}%`}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                <View style={styles.settingRow}>
                    <Text style={styles.label}>BACKLIGHT INTENSITY</Text>
                    <View style={styles.controlRow}>
                        {[0.0, 0.3, 0.6, 1.0].map((val) => (
                            <Pressable
                                key={val}
                                style={[styles.optionBtn, settings.systemBrightness === val && styles.optionBtnActive]}
                                onPress={() => onUpdate('systemBrightness', val)}
                            >
                                <Text style={[styles.optionText, settings.systemBrightness === val && styles.optionTextActive]}>
                                    {val === 0 ? 'OFF' : val === 1.0 ? 'MAX' : `${Math.round(val * 100)}%`}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                <View style={styles.dangerZone}>
                    <Pressable style={styles.resetBtn} onPress={onResetHistory}>
                        <Ionicons name="trash" size={12} color="#990000" />
                        <Text style={styles.resetText}>WIPE DEVICE MEMORY</Text>
                    </Pressable>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.versionText}>CASIO AI OS v3.0 // BUILD 060326</Text>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        paddingHorizontal: 10,
        paddingTop: 5,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        borderBottomWidth: 1,
        borderColor: '#003399',
        paddingBottom: 4,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    batteryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: 'rgba(0,51,153,0.1)',
        paddingHorizontal: 4,
        borderRadius: 2,
    },
    batteryIcon: {
        marginTop: 1,
    },
    batteryText: {
        fontFamily: 'DotGothic16',
        fontSize: 10,
        color: '#003399',
        fontWeight: '900',
    },
    title: {
        fontFamily: 'DotGothic16',
        fontSize: 11,
        fontWeight: '900',
        color: '#003399',
        letterSpacing: 2,
    },
    closeBtn: {
        width: 22,
        height: 22,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#003399',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,51,153,0.05)',
    },
    scroll: {
        paddingBottom: 25,
    },
    settingRow: {
        marginBottom: 12,
    },
    label: {
        fontFamily: 'DotGothic16',
        fontSize: 9,
        color: '#003399',
        marginBottom: 6,
        fontWeight: 'bold',
        opacity: 0.8,
    },
    controlRow: {
        flexDirection: 'row',
        gap: 6,
    },
    optionBtn: {
        flex: 1,
        height: 24,
        borderWidth: 1,
        borderColor: '#003399',
        borderRadius: 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    optionBtnActive: {
        backgroundColor: '#003399',
    },
    optionText: {
        fontFamily: 'DotGothic16',
        fontSize: 9,
        color: '#003399',
        fontWeight: '700',
    },
    optionTextActive: {
        color: '#85a78f', // Screen Color
    },
    dangerZone: {
        marginTop: 10,
        borderTopWidth: 0.5,
        borderStyle: 'dashed',
        borderColor: '#990000',
        paddingTop: 10,
    },
    resetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#990000',
        borderRadius: 2,
        backgroundColor: 'rgba(153,0,0,0.02)',
    },
    resetText: {
        fontFamily: 'DotGothic16',
        fontSize: 9,
        color: '#990000',
        fontWeight: '900',
    },
    footer: {
        marginTop: 20,
        alignItems: 'center',
    },
    versionText: {
        fontFamily: 'DotGothic16',
        fontSize: 7,
        color: '#003399',
        opacity: 0.5,
    }
});
