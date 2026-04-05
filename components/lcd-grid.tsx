import React from 'react';
import { StyleSheet, View } from 'react-native';

interface LCDGridProps {
    width: number;
    height: number;
}

export const LCDGrid = ({ width, height }: LCDGridProps) => {
    const vLines = [];
    for (let i = 0; i < width; i += 3) {
        vLines.push(<View key={`v-${i}`} style={[styles.vLine, { left: i }]} />);
    }
    const hLines = [];
    for (let i = 0; i < height; i += 3) {
        hLines.push(<View key={`h-${i}`} style={[styles.hLine, { top: i }]} />);
    }
    return (
        <View style={styles.gridOverlay} pointerEvents="none">
            {vLines}
            {hLines}
        </View>
    );
};

const styles = StyleSheet.create({
    gridOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
        opacity: 0.15,
    },
    vLine: {
        position: 'absolute',
        width: 0.5,
        height: '100%',
        backgroundColor: '#2d332f',
    },
    hLine: {
        position: 'absolute',
        height: 0.5,
        width: '100%',
        backgroundColor: '#2d332f',
    },
});
