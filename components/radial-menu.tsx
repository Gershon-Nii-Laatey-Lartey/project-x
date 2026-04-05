import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

interface RadialMenuProps {
    visible: boolean;
    onSelectKeyboard: () => void;
    onSelectMore: () => void;
    onSelectCamera: () => void;
    onClose: () => void;
}

export const RadialMenu = ({ visible, onSelectKeyboard, onSelectMore, onSelectCamera, onClose }: RadialMenuProps) => {
    const animValue = useRef(new Animated.Value(0)).current;
    const [isRendered, setIsRendered] = useState(visible);

    useEffect(() => {
        if (visible) {
            setIsRendered(true);
            Animated.spring(animValue, {
                toValue: 1,
                useNativeDriver: true,
                friction: 7,
                tension: 40,
            }).start();
        } else {
            Animated.spring(animValue, {
                toValue: 0,
                useNativeDriver: true,
                friction: 7,
                tension: 40,
            }).start(() => {
                setIsRendered(false);
            });
        }
    }, [visible]);

    if (!isRendered) return null;

    const getStyle = (index: number) => {
        const angles = [90, 135, 180];
        const angle = angles[index];

        const radius = 70;
        const x = Math.cos((angle * Math.PI) / 180) * radius;
        const y = Math.sin((angle * Math.PI) / 180) * radius;

        return {
            transform: [
                { scale: animValue },
                { translateX: animValue.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
                { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [0, y] }) },
            ],
            opacity: animValue,
        };
    };

    return (
        <View style={styles.overlay} pointerEvents="box-none">
            <Pressable style={styles.backdrop} onPress={onClose} />
            <View style={styles.container}>
                <Animated.View style={[styles.menuItem, getStyle(2)]}>
                    <Pressable style={styles.button} onPress={onSelectKeyboard}>
                        <Ionicons name="keypad" size={18} color="#2d332f" />
                        <Text style={styles.label}>KEYS</Text>
                    </Pressable>
                </Animated.View>

                <Animated.View style={[styles.menuItem, getStyle(1)]}>
                    <Pressable style={styles.button} onPress={onSelectMore}>
                        <Ionicons name="grid" size={18} color="#2d332f" />
                        <Text style={styles.label}>MORE</Text>
                    </Pressable>
                </Animated.View>

                <Animated.View style={[styles.menuItem, getStyle(0)]}>
                    <Pressable style={styles.button} onPress={onSelectCamera}>
                        <Ionicons name="camera" size={18} color="#2d332f" />
                        <Text style={styles.label}>SCAN</Text>
                    </Pressable>
                </Animated.View>

                <Animated.View style={{
                    transform: [{ scale: animValue }],
                    opacity: animValue
                }}>
                    <Pressable style={styles.centerButton} onPress={onClose}>
                        <Ionicons name="close" size={20} color="#2d332f" />
                    </Pressable>
                </Animated.View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 100,
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    container: {
        width: 40,
        height: 40,
        marginTop: 12,
        marginRight: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuItem: {
        position: 'absolute',
        width: 44,
        height: 44,
    },
    button: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#74967e',
        borderWidth: 1.2,
        borderColor: '#4a554f',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
    },
    label: {
        fontSize: 7,
        fontWeight: '900',
        color: '#000',
        marginTop: -1,
    },
    centerButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#cce0d0',
        borderWidth: 1.5,
        borderColor: '#2d332f',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 101,
    },
});
