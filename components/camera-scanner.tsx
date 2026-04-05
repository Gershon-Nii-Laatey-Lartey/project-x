import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';

const SCREEN_WIDTH = 360;
const SCREEN_HEIGHT = 140;

interface CameraScannerProps {
    onCapture: (base64: string) => void;
    onClose: () => void;
}

export const CameraScanner = ({ onCapture, onClose }: CameraScannerProps) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [isCapturing, setIsCapturing] = useState(false);
    const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
    const [cameraOrientation, setCameraOrientation] = useState<'landscape' | 'portrait'>('landscape');
    const scanAnim = useRef(new Animated.Value(0)).current;
    const cameraRef = useRef<CameraView>(null);

    useEffect(() => {
        if (permission?.granted) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(scanAnim, {
                        toValue: 1,
                        duration: 2000,
                        easing: Easing.linear,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scanAnim, {
                        toValue: 0,
                        duration: 2000,
                        easing: Easing.linear,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [permission, scanAnim]);

    if (!permission) {
        return <View style={styles.center}><Text style={styles.statusText}>Initializing...</Text></View>;
    }

    if (!permission.granted) {
        return (
            <View style={styles.permissionOverlay}>
                <View style={styles.permissionGlassContainer}>
                    <Text style={styles.permissionSubText}>CAMERA PERMISSION REQUIRED</Text>

                    <Pressable
                        style={({ pressed }) => [
                            styles.keyboardTileButton,
                            pressed && styles.keyboardTileButtonPressed
                        ]}
                        onPress={requestPermission}
                    >
                        <Text style={styles.keyboardTileButtonText}>ALLOW</Text>
                    </Pressable>
                </View>
                <Pressable style={styles.closeControl} onPress={onClose}>
                    <Ionicons name="close-circle" size={28} color="rgba(45, 51, 47, 0.3)" />
                </Pressable>
            </View>
        );
    }

    const handleCapture = async () => {
        if (cameraRef.current && !isCapturing && !capturedBase64) {
            setIsCapturing(true);
            try {
                console.log('Starting photo capture...');
                const photo = await cameraRef.current.takePictureAsync({
                    base64: true,
                    quality: 0.2, // Lower quality to avoid 400 gateway errors
                });
                console.log('Photo captured:', photo ? 'Success' : 'Failed');
                if (photo?.base64) {
                    console.log('Base64 length:', photo.base64.length);
                    setCapturedBase64(photo.base64);
                } else {
                    console.error('No base64 data in photo');
                    alert('Failed to capture image - no data');
                }
            } catch (error) {
                console.error("Capture failed:", error);
                alert(`Failed to capture image: ${error}`);
            } finally {
                setIsCapturing(false);
            }
        }
    };

    const handleConfirm = () => {
        if (capturedBase64) {
            onCapture(capturedBase64);
        }
    };

    const translateY = scanAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 140], // Height of the LCD screen
    });

    return (
        <View style={StyleSheet.absoluteFill}>
            {/* Show captured photo preview or live camera */}
            {capturedBase64 ? (
                <Image
                    source={{ uri: `data:image/jpeg;base64,${capturedBase64}` }}
                    style={cameraOrientation === 'portrait' ? styles.cameraPortrait : StyleSheet.absoluteFill}
                    resizeMode="cover"
                />
            ) : (
                <CameraView
                    ref={cameraRef}
                    style={cameraOrientation === 'portrait' ? styles.cameraPortrait : StyleSheet.absoluteFill}
                    facing="back"
                />
            )}

            {/* Transparent Overlay for LCD look - Moved outside CameraView */}
            <View style={styles.overlay} pointerEvents="box-none">
                <View style={styles.controlsRow}>
                    {/* Orientation Toggle - Above and to the left of capture button */}
                    <Pressable
                        style={[styles.orientationToggle, cameraOrientation === 'portrait' && styles.orientationToggleActive]}
                        onPress={() => setCameraOrientation(prev => prev === 'landscape' ? 'portrait' : 'landscape')}
                    >
                        <Ionicons
                            name={cameraOrientation === 'landscape' ? 'phone-portrait-outline' : 'phone-landscape-outline'}
                            size={20}
                            color="rgba(255,255,255,0.8)"
                        />
                    </Pressable>

                    {capturedBase64 ? (
                        <View style={styles.confirmRow}>
                            <Pressable
                                style={[styles.captureButton, styles.retakeButton]}
                                onPress={() => setCapturedBase64(null)}
                            >
                                <Ionicons name="refresh" size={30} color="#fff" />
                            </Pressable>
                            <Pressable
                                style={[styles.captureButton, styles.captureButtonActive]}
                                onPress={handleConfirm}
                            >
                                <Ionicons name="checkmark-circle" size={40} color="#e3f2e8" />
                            </Pressable>
                        </View>
                    ) : (
                        <Pressable
                            style={({ pressed }) => [
                                styles.captureButton,
                                pressed && styles.captureButtonPressed,
                                isCapturing && styles.captureButtonActive
                            ]}
                            onPress={handleCapture}
                            disabled={isCapturing}
                        >
                            <Ionicons name="scan-circle" size={40} color="rgba(255,255,255,0.8)" />
                        </Pressable>
                    )}
                </View>

                <Pressable style={styles.closeButton} onPress={onClose}>
                    <Ionicons name="close-circle" size={32} color="rgba(255,255,255,0.6)" />
                </Pressable>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    permissionOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(227, 242, 232, 0.85)', // Glassy LCD effect
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    permissionGlassContainer: {
        width: '80%',
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    lcdPermissionContainer: {
        flex: 1,
        backgroundColor: '#e3f2e8', // Match LCD background
        justifyContent: 'center',
        alignItems: 'center',
    },
    displayArea: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    permissionContent: {
        padding: 20,
    },
    typingText: {
        fontSize: 32,
        fontFamily: 'System',
        fontWeight: '700',
        color: '#2d332f',
        letterSpacing: 2,
    },
    alertText: {
        color: '#a00', // Subtle red for alert
    },
    permissionSubText: {
        fontSize: 12,
        fontFamily: 'System',
        fontWeight: '800',
        color: '#2d332f',
        letterSpacing: 1,
        marginTop: 4,
        marginBottom: 16,
        textAlign: 'center',
    },
    keyboardTileButton: {
        width: 80,
        height: 30,
        backgroundColor: 'rgba(45, 51, 47, 0.05)',
        borderWidth: 0.8,
        borderColor: '#2d332f',
        borderRadius: 3,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
    },
    keyboardTileButtonPressed: {
        backgroundColor: 'rgba(45, 51, 47, 0.2)',
        transform: [{ scale: 0.96 }],
    },
    keyboardTileButtonText: {
        color: '#2d332f',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    casioButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: '#1a1a1a', // Dark physical button look
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#333',
        elevation: 4,
    },
    casioButtonPressed: {
        backgroundColor: '#333',
        transform: [{ scale: 0.98 }],
    },
    casioButtonText: {
        color: '#e3f2e8', // LCD color text on button
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    closeControl: {
        position: 'absolute',
        top: 10,
        right: 10,
    },
    statusText: {
        color: '#e3f2e8',
        fontSize: 14,
        fontFamily: 'System',
        marginBottom: 20,
    },
    grantButton: {
        padding: 10,
        backgroundColor: '#e3f2e8',
        borderRadius: 5,
    },
    grantButtonText: {
        color: '#1a1a1a',
        fontWeight: 'bold',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(227, 242, 232, 0.1)', // Subtle green tint
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlsRow: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        alignItems: 'center',
    },
    orientationToggle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(45, 51, 47, 0.3)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        marginRight: 24,
    },
    orientationToggleActive: {
        backgroundColor: 'rgba(45, 51, 47, 0.6)',
        borderColor: '#e3f2e8',
    },
    cameraPortrait: {
        position: 'absolute',
        width: SCREEN_HEIGHT * (9 / 16), // Portrait aspect ratio
        height: SCREEN_HEIGHT,
        left: 0, // Align to left edge
        top: 0,
    },
    confirmRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    retakeButton: {
        width: 44,
        height: 44,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    scanLine: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: 'rgba(255, 0, 0, 0.5)',
        shadowColor: '#f00',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
    },
    captureButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(45, 51, 47, 0.4)',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    captureButtonPressed: {
        backgroundColor: 'rgba(45, 51, 47, 0.8)',
    },
    captureButtonActive: {
        backgroundColor: '#2d332f',
        borderColor: '#e3f2e8',
    },
    captureText: {
        fontSize: 10,
        color: '#fff',
        fontWeight: 'bold',
    },
    closeButton: {
        position: 'absolute',
        top: 10,
        right: 10,
    },
    closeFloat: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 5
    }
});
