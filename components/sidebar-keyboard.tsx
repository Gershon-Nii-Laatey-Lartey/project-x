import React, { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const row1 = "QWERTYUIOP".split("");
const row2 = "ASDFGHJKL".split("");
const row3 = "ZXCVBNM,".split("");
const numGrid = [
    ["1", "2", "3", "+"],
    ["4", "5", "6", "-"],
    ["7", "8", "9", "*"],
    [".", "0", "=", "/"]
];
const shortcuts = [
    ["TABULATE", "SOLVE Q#"],
    ["STEP-BY-STEP", "SUMMARIZE"],
    ["SOLVE ALL", "CHECK ERRORS"]
];

const shortcutValues: Record<string, string> = {
    "TABULATE": "Tabulate the results professionally.",
    "SOLVE Q#": "Solve question number ",
    "STEP-BY-STEP": "Explain step-by-step for question ",
    "SUMMARIZE": "Summarize key findings for question ",
    "SOLVE ALL": "Solve all objective questions found.",
    "CHECK ERRORS": "Analyze the solution for question "
};

interface SidebarKeyboardProps {
    visible: boolean;
    animValue: Animated.Value;
    onKeyTyping: (char: string) => void;
    onDelete: () => void;
    onClear: () => void;
    onEnter?: () => void;
    mode?: 'alpha' | 'num' | 'shorts' | 'mods';
    onModeChange?: (mode: 'alpha' | 'num' | 'shorts' | 'mods') => void;
    currentModel?: 'flash' | 'pro';
    onModelSelect?: (model: 'flash' | 'pro') => void;
}

export const SidebarKeyboard = ({
    visible,
    animValue,
    onKeyTyping,
    onDelete,
    onClear,
    onEnter,
    mode: externalMode,
    onModeChange,
    currentModel,
    onModelSelect
}: SidebarKeyboardProps) => {
    const [internalMode, setInternalMode] = useState<'alpha' | 'num' | 'shorts' | 'mods'>('alpha');
    const mode = externalMode !== undefined ? externalMode : internalMode;

    const toggleMode = () => {
        let nextMode: 'alpha' | 'num' | 'shorts' | 'mods' = 'alpha';
        if (mode === 'alpha') nextMode = 'num';
        else if (mode === 'num') nextMode = 'shorts';
        else if (mode === 'shorts') nextMode = 'mods';
        else nextMode = 'alpha';

        if (onModeChange) {
            onModeChange(nextMode);
        } else {
            setInternalMode(nextMode);
        }
    };

    return (
        <Animated.View
            style={[
                styles.keyboardOverlay,
                {
                    transform: [{ translateX: animValue }],
                }
            ]}
        >
            <Pressable style={styles.keyboardInner}>
                <View style={styles.gridContainer}>
                    {mode === 'alpha' ? (
                        <>
                            <View style={styles.row}>
                                {row1.map(char => (
                                    <Pressable key={char} style={({ pressed }) => [styles.alphaKey, pressed && styles.keyPressed]} onPress={() => onKeyTyping(char)}>
                                        <Text style={styles.keyText}>{char}</Text>
                                    </Pressable>
                                ))}
                            </View>
                            <View style={styles.row}>
                                {row2.map(char => (
                                    <Pressable key={char} style={({ pressed }) => [styles.alphaKey, pressed && styles.keyPressed]} onPress={() => onKeyTyping(char)}>
                                        <Text style={styles.keyText}>{char}</Text>
                                    </Pressable>
                                ))}
                            </View>
                            <View style={styles.row}>
                                {row3.map(char => (
                                    <Pressable key={char} style={({ pressed }) => [styles.alphaKey, pressed && styles.keyPressed]} onPress={() => onKeyTyping(char)}>
                                        <Text style={styles.keyText}>{char}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </>
                    ) : mode === 'num' ? (
                        numGrid.map((row, rIdx) => (
                            <View key={rIdx} style={styles.row}>
                                {row.map(char => (
                                    <Pressable key={char} style={({ pressed }) => [styles.numKey, pressed && styles.keyPressed]} onPress={() => onKeyTyping(char)}>
                                        <Text style={styles.keyText}>{char}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        ))
                    ) : mode === 'shorts' ? (
                        <View style={styles.shortcutsGrid}>
                            {shortcuts.map((row, rIdx) => (
                                <View key={rIdx} style={styles.row}>
                                    {row.map(label => (
                                        <Pressable 
                                            key={label} 
                                            style={({ pressed }) => [styles.shortcutKey, pressed && styles.keyPressed]} 
                                            onPress={() => onKeyTyping(shortcutValues[label])}
                                        >
                                            <Text style={styles.shortcutKeyText}>{label}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View style={styles.modsContainer}>
                            <Text style={styles.modsTitle}>SELECT AI ENGINE</Text>
                            <Pressable 
                                style={[styles.modItem, currentModel === 'flash' && styles.modItemActive]}
                                onPress={() => onModelSelect?.('flash')}
                            >
                                <Ionicons name={currentModel === 'flash' ? "radio-button-on" : "radio-button-off"} size={16} color="#003399" />
                                <View style={styles.modTextContainer}>
                                    <Text style={styles.modName}>GEMINI FLASH</Text>
                                    <Text style={styles.modDesc}>ULTRA FAST / GENERAL TASKS</Text>
                                </View>
                            </Pressable>
                            <Pressable 
                                style={[styles.modItem, currentModel === 'pro' && styles.modItemActive]}
                                onPress={() => onModelSelect?.('pro')}
                            >
                                <Ionicons name={currentModel === 'pro' ? "radio-button-on" : "radio-button-off"} size={16} color="#003399" />
                                <View style={styles.modTextContainer}>
                                    <Text style={styles.modName}>GEMINI PRO</Text>
                                    <Text style={styles.modDesc}>HIGH PROCESSING / COMPLEX STEPS</Text>
                                </View>
                            </Pressable>
                        </View>
                    )}
                </View>

                {/* Bottom Controls */}
                <View style={styles.controlsRow}>
                    <Pressable
                        style={[styles.numKey, styles.modeKey]}
                        onPress={toggleMode}
                    >
                        <Text style={styles.modeKeyText}>{mode === 'alpha' ? '123' : mode === 'num' ? 'SHRT' : mode === 'shorts' ? 'MODS' : 'ABC'}</Text>
                    </Pressable>

                    <Pressable
                        style={[styles.numKey, styles.acKey]}
                        onPress={onClear}
                    >
                        <Text style={[styles.keyText, styles.acText]}>AC</Text>
                    </Pressable>

                    <Pressable
                        style={[styles.numKey, styles.spaceKey]}
                        onPress={() => onKeyTyping(' ')}
                    >
                        <Text style={styles.keyText}>SPACE</Text>
                    </Pressable>

                    <Pressable
                        style={[styles.numKey, styles.delKey]}
                        onPress={onDelete}
                    >
                        <Text style={[styles.keyText, styles.delText]}>DEL</Text>
                    </Pressable>

                    <Pressable
                        style={[styles.numKey, styles.enterKey]}
                        onPress={onEnter}
                    >
                        <Text style={[styles.keyText, styles.enterText]}>EXE</Text>
                    </Pressable>
                </View>
            </Pressable>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    keyboardOverlay: {
        position: 'absolute',
        right: 0,
        top: 8,
        bottom: 0,
        width: 240,
        padding: 4,
        zIndex: 50,
    },
    keyboardInner: {
        flex: 1,
        justifyContent: 'space-between',
        paddingBottom: 4,
    },
    gridContainer: {
        width: '100%',
        alignItems: 'center',
    },
    row: {
        flexDirection: 'row',
        gap: 2,
        marginBottom: 3,
        justifyContent: 'center',
        width: '100%',
    },
    controlsRow: {
        flexDirection: 'row',
        gap: 3,
        justifyContent: 'center',
    },
    alphaKey: {
        width: 21,
        height: 32,
        backgroundColor: '#74967e',
        borderWidth: 0.5,
        borderColor: '#003399',
        borderRadius: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    numKey: {
        width: 45,
        height: 23,
        backgroundColor: '#74967e',
        borderWidth: 0.5,
        borderColor: '#003399',
        borderRadius: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modeKey: {
        width: 32,
        height: 32, // Increased
        backgroundColor: '#63856d',
    },
    acKey: {
        width: 30,
        height: 32, // Increased
        backgroundColor: 'rgba(255, 68, 68, 0.05)',
    },
    spaceKey: {
        width: 60,
        height: 32, // Increased
    },
    delKey: {
        width: 32,
        height: 32, // Increased
        backgroundColor: 'rgba(255, 0, 0, 0.05)',
    },
    enterKey: {
        width: 32,
        height: 32, // Increased
        backgroundColor: 'rgba(45, 51, 47, 0.2)',
    },
    modeKeyText: {
        fontSize: 8,
        fontWeight: '900',
        color: '#2d332f',
    },
    keyPressed: {
        backgroundColor: 'rgba(45, 51, 47, 0.2)',
    },
    delText: {
        color: '#800',
    },
    acText: {
        color: '#d00',
    },
    enterText: {
        color: '#2d332f',
    },
    keyText: {
        color: '#003399',
        fontSize: 9,
        fontWeight: '900',
        fontFamily: 'System',
    },
    shortcutsGrid: {
        width: '100%',
        paddingHorizontal: 10,
    },
    shortcutKey: {
        flex: 1,
        height: 32, // Increased for consistency
        backgroundColor: '#74967e',
        borderWidth: 0.5,
        borderColor: '#003399',
        borderRadius: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shortcutKeyText: {
        color: '#003399',
        fontSize: 8,
        fontWeight: '900',
    },
    modsContainer: {
        width: '100%',
        paddingHorizontal: 12,
        paddingTop: 4,
    },
    modsTitle: {
        fontSize: 10,
        fontFamily: 'DotGothic16',
        color: '#003399',
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: 2,
    },
    modItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        backgroundColor: 'rgba(0, 51, 153, 0.03)',
        borderWidth: 0.5,
        borderColor: 'rgba(0, 51, 153, 0.15)',
        borderRadius: 4,
        marginBottom: 6,
        gap: 8,
    },
    modItemActive: {
        backgroundColor: 'rgba(0, 51, 153, 0.1)',
        borderColor: '#003399',
    },
    modTextContainer: {
        flex: 1,
    },
    modName: {
        fontSize: 9,
        fontWeight: '900',
        color: '#003399',
    },
    modDesc: {
        fontSize: 7,
        color: '#003399',
        opacity: 0.6,
        fontWeight: '700',
        marginTop: 1,
    }
});



