import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedImage = Reanimated.createAnimatedComponent(Image);

const SCREEN_WIDTH = 360;
const SCREEN_HEIGHT = 140;
const NUM_COLS = 5;
const GAP = 2;
const TILE = (SCREEN_WIDTH - 16 - GAP * (NUM_COLS - 1)) / NUM_COLS;

interface CasioGalleryProps {
    onClose: () => void;
    onSelect?: (uri: string, extra?: string[]) => void;
}

type GalleryMode = 'grid' | 'camera' | 'preview';

export const CasioGallery = ({ onClose, onSelect }: CasioGalleryProps) => {
    const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();

    const [photos, setPhotos] = useState<MediaLibrary.Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState<GalleryMode>('grid');
    const [selected, setSelected] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [capturedUri, setCapturedUri] = useState<string | null>(null);
    const [cameraOrientation, setCameraOrientation] = useState<'landscape' | 'portrait'>('landscape');
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [isCameraReady, setIsCameraReady] = useState(false);

    const cameraRef = useRef<CameraView>(null);

    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const resetZoom = useCallback(() => {
        'worklet';
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
    }, [scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: Math.max(0.5, scale.value) }
        ],
    }));

    const pinchGesture = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value = savedScale.value * e.scale;
        })
        .onEnd(() => {
            savedScale.value = scale.value;
        });

    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            translateX.value = savedTranslateX.value + e.translationX;
            translateY.value = savedTranslateY.value + e.translationY;
        })
        .onEnd(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        });

    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .onStart(() => {
            resetZoom();
        });

    const composed = Gesture.Simultaneous(pinchGesture, panGesture, doubleTap);

    const loadPhotos = useCallback(async () => {
        setLoading(true);
        const { assets } = await MediaLibrary.getAssetsAsync({
            mediaType: 'photo',
            first: 200,
            sortBy: MediaLibrary.SortBy.creationTime,
        });
        setPhotos(assets);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (mediaPermission?.granted) {
            loadPhotos();
        }
    }, [mediaPermission, loadPhotos]);

    const handleTakePhoto = async () => {
        if (!cameraRef.current || isCapturing || capturedUri || !isCameraReady) return;
        setIsCapturing(true);
        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
            if (photo?.uri) {
                setCapturedUri(photo.uri);
                const asset = await MediaLibrary.createAssetAsync(photo.uri);
                setPhotos(prev => [asset, ...prev]);
            }
        } catch (e) {
            console.error('Capture failed:', e);
        } finally {
            setIsCapturing(false);
        }
    };

    const toggleSelect = (uri: string) => {
        if (!onSelect) {
            setSelected(uri);
            setMode('preview');
            return;
        }

        setSelectedItems(prev => {
            const exists = prev.includes(uri);
            if (exists) return prev.filter(u => u !== uri);
            if (prev.length >= 10) return prev;
            return [...prev, uri];
        });
    };

    const openCameraMode = async () => {
        if (!cameraPermission?.granted) {
            const res = await requestCameraPermission();
            if (!res.granted) return;
        }
        setCapturedUri(null);
        setIsCameraReady(false);
        setMode('camera');
    };

    if (!mediaPermission?.granted) {
        return (
            <View style={styles.permBox}>
                <Text style={styles.permText}>MEDIA ACCESS REQUIRED</Text>
                <Pressable style={styles.permBtn} onPress={requestMediaPermission}>
                    <Text style={styles.permBtnText}>ALLOW</Text>
                </Pressable>
                <Pressable style={styles.closeTopRight} onPress={onClose}>
                    <Ionicons name="close" size={14} color="#003399" />
                </Pressable>
            </View>
        );
    }

    if (mode === 'camera') {
        return (
            <View style={styles.cameraFill}>
                {capturedUri ? (
                    <Image source={{ uri: capturedUri }} style={cameraOrientation === 'portrait' ? styles.cameraPortrait : StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                    <CameraView
                        ref={cameraRef}
                        style={cameraOrientation === 'portrait' ? styles.cameraPortrait : StyleSheet.absoluteFill}
                        facing="back"
                        onCameraReady={() => setIsCameraReady(true)}
                    />
                )}
                <View style={styles.camOverlay}>
                    <View style={styles.controlsRow}>
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

                        {capturedUri ? (
                            <View style={styles.confirmRow}>
                                <Pressable style={[styles.captureButton, styles.retakeButton]} onPress={() => setCapturedUri(null)}>
                                    <Ionicons name="refresh" size={30} color="#fff" />
                                </Pressable>
                                <Pressable style={[styles.captureButton, styles.captureButtonActive]} onPress={() => setMode('grid')}>
                                    <Ionicons name="checkmark-circle" size={40} color="#e3f2e8" />
                                </Pressable>
                            </View>
                        ) : (
                            <Pressable
                                style={[styles.captureButton, (!isCameraReady || isCapturing) && { opacity: 0.5 }]}
                                onPress={handleTakePhoto}
                                disabled={!isCameraReady || isCapturing}
                            >
                                <Ionicons name="scan-circle" size={40} color="rgba(255,255,255,0.8)" />
                            </Pressable>
                        )}
                    </View>
                    <Pressable style={styles.closeButton} onPress={() => setMode('grid')}>
                        <Ionicons name="close-circle" size={32} color="rgba(255,255,255,0.6)" />
                    </Pressable>
                </View>
            </View>
        );
    }

    if (mode === 'preview' && selected) {
        return (
            <View style={styles.cameraFill}>
                <GestureDetector gesture={composed}>
                    <Reanimated.View style={StyleSheet.absoluteFill}>
                        <AnimatedImage 
                            source={{ uri: selected }} 
                            style={[StyleSheet.absoluteFill, animatedStyle]} 
                            contentFit="contain"
                            priority="high"
                            transition={0}
                            cachePolicy="memory-disk"
                        />
                    </Reanimated.View>
                </GestureDetector>
                <Pressable style={styles.closeButton} onPress={() => { resetZoom(); setSelected(null); setMode('grid'); }}>
                    <Ionicons name="close-circle" size={28} color="rgba(255,255,255,0.8)" />
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{onSelect ? `PICK (${selectedItems.length}/10)` : 'GALLERY'}</Text>
                <View style={styles.headerActions}>
                    {onSelect && selectedItems.length > 0 && (
                        <Pressable style={[styles.iconBtn, styles.confirmBtn]} onPress={() => onSelect(selectedItems[0], selectedItems.slice(1))}>
                            <Ionicons name="checkmark" size={18} color="#fff" />
                        </Pressable>
                    )}
                    <Pressable style={styles.iconBtn} onPress={openCameraMode}>
                        <Ionicons name="camera-outline" size={18} color="#003399" />
                    </Pressable>
                    <Pressable style={styles.iconBtn} onPress={onClose}>
                        <Ionicons name="close" size={18} color="#003399" />
                    </Pressable>
                </View>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="small" color="#003399" /></View>
            ) : (
                <FlatList
                    data={photos}
                    keyExtractor={(item) => item.id}
                    numColumns={NUM_COLS}
                    contentContainerStyle={styles.grid}
                    columnWrapperStyle={{ gap: GAP }}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <Pressable onPress={() => toggleSelect(item.uri)} style={styles.thumbWrapper}>
                            <Image source={{ uri: item.uri }} style={[styles.thumb, { width: TILE, height: TILE }]} contentFit="cover" />
                            {selectedItems.includes(item.uri) && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{selectedItems.indexOf(item.uri) + 1}</Text>
                                </View>
                            )}
                        </Pressable>
                    )}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, width: '100%', paddingHorizontal: 8, paddingTop: 4 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
    title: { fontFamily: 'DotGothic16', fontSize: 10, fontWeight: '900', color: '#003399', letterSpacing: 1 },
    headerActions: { flexDirection: 'row', gap: 6 },
    iconBtn: { width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: '#003399', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,51,153,0.06)' },
    confirmBtn: { backgroundColor: '#003399', borderColor: '#003399' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    grid: { paddingBottom: 6 },
    thumbWrapper: { position: 'relative' },
    thumb: { borderRadius: 1, backgroundColor: '#74967e' },
    badge: { position: 'absolute', top: 2, right: 2, backgroundColor: '#003399', width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fff' },
    badgeText: { color: '#fff', fontSize: 8, fontWeight: '900' },
    permBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    permText: { fontFamily: 'DotGothic16', fontSize: 9, color: '#003399', textAlign: 'center' },
    permBtn: { paddingHorizontal: 14, paddingVertical: 5, borderWidth: 0.8, borderColor: '#003399', borderRadius: 3, backgroundColor: 'rgba(0,51,153,0.05)' },
    permBtnText: { fontFamily: 'DotGothic16', fontSize: 9, color: '#003399' },
    closeTopRight: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 0.8, borderColor: '#003399', borderRadius: 3 },
    cameraFill: { position: 'absolute', top: -16, left: 0, right: 0, bottom: 0 },
    cameraPortrait: { position: 'absolute', width: SCREEN_HEIGHT * (9 / 16), height: SCREEN_HEIGHT, left: 0, top: 0 },
    camOverlay: { flex: 1, backgroundColor: 'rgba(227, 242, 232, 0.1)', justifyContent: 'center', alignItems: 'center' },
    controlsRow: { position: 'absolute', right: 20, bottom: 20, alignItems: 'center' },
    orientationToggle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(45, 51, 47, 0.3)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 8, marginRight: 24 },
    orientationToggleActive: { backgroundColor: 'rgba(45, 51, 47, 0.6)', borderColor: '#e3f2e8' },
    confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    retakeButton: { width: 44, height: 44, backgroundColor: 'rgba(255, 255, 255, 0.2)' },
    captureButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(45, 51, 47, 0.4)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
    captureButtonActive: { backgroundColor: '#2d332f', borderColor: '#e3f2e8' },
    closeButton: { position: 'absolute', top: 10, right: 10 },
});
