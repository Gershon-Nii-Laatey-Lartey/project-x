import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface CasioStatusBarProps {
    mode: 'calculator' | 'chat';
    sessionName?: string;
    isFrozen?: boolean;
}

export const CasioStatusBar = ({ mode, sessionName, isFrozen }: CasioStatusBarProps) => {
    return (
        <View style={styles.statusBar}>
            <View style={styles.statusGroup}>
                <Text style={[styles.statusText, (styles.statusFaded || isFrozen) && styles.statusFaded]}>S</Text>
                <Text style={[styles.statusText, (styles.statusFaded || isFrozen) && styles.statusFaded]}>A</Text>
                <Text style={[styles.statusText, isFrozen && styles.statusFaded]}>M</Text>
            </View>

            <View style={styles.statusGroup}>
                <Text style={[styles.statusText, (styles.statusFaded || isFrozen) && styles.statusFaded]}>D</Text>
                <Text style={[styles.statusText, isFrozen && styles.statusFaded]}>R</Text>
                <Text style={[styles.statusText, (styles.statusFaded || isFrozen) && styles.statusFaded]}>G</Text>
            </View>

            <View style={styles.statusGroup}>
                <Text style={[styles.statusText, (styles.statusFaded || isFrozen) && styles.statusFaded]}>FIX</Text>
                <Text style={[styles.statusText, (styles.statusFaded || isFrozen) && styles.statusFaded]}>SCI</Text>
            </View>

            <View style={styles.statusGroup}>
                <Text style={[styles.statusText, { color: '#003399', fontWeight: '900' }, isFrozen && styles.statusFaded]}>
                    {mode === 'chat' ? 'CHAT' : 'MATH'}
                </Text>
            </View>

            <View style={styles.statusGroup}>
                <Text style={[styles.statusText, isFrozen && styles.statusFaded]}>▲</Text>
                <Text style={[styles.statusText, (styles.statusFaded || isFrozen) && styles.statusFaded]}>▼</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    statusBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 16,
        paddingHorizontal: 2,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(0, 77, 230, 0.1)',
    },
    statusGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statusText: {
        fontSize: 8,
        fontFamily: 'monospace',
        fontWeight: '900',
        color: '#003399',
    },
    statusFaded: {
        color: 'rgba(0, 77, 230, 0.15)',
    },
});
