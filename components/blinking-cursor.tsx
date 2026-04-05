import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';

interface BlinkingCursorProps {
    visible: boolean;
    style?: ViewStyle | ViewStyle[];
}

export const BlinkingCursor = ({ visible, style }: BlinkingCursorProps) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let animation: Animated.CompositeAnimation | null = null;

        if (visible) {
            animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(opacity, {
                        toValue: 1,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 0,
                        duration: 500,
                        useNativeDriver: true,
                    }),
                ])
            );
            animation.start();
        } else {
            opacity.setValue(0);
        }

        return () => {
            if (animation) {
                animation.stop();
            }
        };
    }, [visible]);

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.cursorContainer,
                { opacity },
                style
            ]}
        >
            {Array.from({ length: 16 }).map((_, i) => (
                <View key={i} style={styles.pixel} />
            ))}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    cursorContainer: {
        width: 8,
        height: 30,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignContent: 'center',
        gap: 0.5,
        marginLeft: 2,
    },
    pixel: {
        width: 3.5,
        height: 3.5,
        backgroundColor: '#003399',
        borderRadius: 0,
    }
});
