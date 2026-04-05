import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ChartDataPoint {
    x: number;
    y: number;
    label?: string;
}

interface CasioChartProps {
    data: {
        type: 'line' | 'bar' | 'area' | 'scatter';
        title: string;
        xLabel: string;
        yLabel: string;
        data: ChartDataPoint[];
        scales?: {
            x?: number[];
            y?: number[];
        };
    };
}

const PLOT_HEIGHT = 160;
const PLOT_WIDTH = 300;

export const CasioChart: React.FC<CasioChartProps> = ({ data }) => {
    if (!data || !data.data || data.data.length === 0) return null;

    const points = data.data;

    // Find ranges
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));

    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;

    const getX = (val: number) => ((val - minX) / xRange) * PLOT_WIDTH;
    const getY = (val: number) => PLOT_HEIGHT - ((val - minY) / yRange) * PLOT_HEIGHT;

    return (
        <View style={styles.container}>
            {data.title && <Text style={styles.title}>{data.title.toUpperCase()}</Text>}

            <View style={styles.content}>
                {/* Y Axis Scale */}
                <View style={styles.yScaleArea}>
                    {data.scales?.y?.map((val, idx) => (
                        <View key={idx} style={[styles.tickY, { top: getY(val) }]}>
                            <Text style={styles.tickText}>{val}</Text>
                            <View style={styles.tickLineY} />
                        </View>
                    ))}
                    <Text style={styles.axisLabelVertical}>{data.yLabel}</Text>
                </View>

                <View style={styles.plotArea}>
                    {/* Main Axes */}
                    <View style={[styles.mainAxisX, { top: getY(0) }]} />
                    <View style={[styles.mainAxisY, { left: getX(0) }]} />

                    {/* Data Rendering */}
                    {points.map((p, i) => {
                        const x = getX(p.x);
                        const y = getY(p.y);

                        // Connect with line if type is line and not last point
                        let lineSegment = null;
                        if (data.type === 'line' && i < points.length - 1) {
                            const nextP = points[i + 1];
                            const nx = getX(nextP.x);
                            const ny = getY(nextP.y);

                            const dx = nx - x;
                            const dy = ny - y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            const angle = Math.atan2(dy, dx) * (180 / Math.PI);

                            lineSegment = (
                                <View
                                    key={`line-${i}`}
                                    style={[
                                        styles.lineSegment,
                                        {
                                            width: distance + 1, // Add +1 to close gaps
                                            transform: [
                                                { translateX: -distance / 2 }, // Move to center line
                                                { rotate: `${angle}deg` },
                                                { translateX: distance / 2 }   // Move back
                                            ],
                                            position: 'absolute',
                                            left: x,
                                            top: y - 0.75 // Half of height (1.5) to center
                                        }
                                    ]}
                                />
                            );
                        }

                        if (data.type === 'bar') {
                            const zeroY = getY(0);
                            const barHeight = Math.abs(y - zeroY);
                            const barTop = Math.min(y, zeroY);
                            return (
                                <View
                                    key={i}
                                    style={[styles.bar, { left: x - 6, top: barTop, height: barHeight, width: 12 }]}
                                />
                            );
                        }

                        return (
                            <React.Fragment key={i}>
                                {lineSegment}
                                <View style={[styles.dot, { left: x - 2, top: y - 2 }]} />
                            </React.Fragment>
                        );
                    })}
                </View>
            </View>

            {/* X Axis Scale */}
            <View style={styles.xScaleArea}>
                {data.scales?.x?.map((val, idx) => (
                    <View key={idx} style={[styles.tickX, { left: getX(val) + 33 }]}>
                        <View style={styles.tickLineX} />
                        <Text style={styles.tickText}>{val}</Text>
                    </View>
                ))}
            </View>
            <Text style={styles.axisLabelHorizontal}>{data.xLabel}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginVertical: 10,
        backgroundColor: 'transparent',
        padding: 8,
        borderWidth: 1,
        borderColor: '#003399',
        borderRadius: 4,
    },
    title: {
        fontFamily: 'DotGothic16',
        fontSize: 14,
        color: '#003399',
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    content: {
        flexDirection: 'row',
    },
    yScaleArea: {
        width: 35,
        height: PLOT_HEIGHT,
        position: 'relative',
        justifyContent: 'center',
    },
    plotArea: {
        width: PLOT_WIDTH,
        height: PLOT_HEIGHT,
        backgroundColor: 'transparent',
        borderLeftWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#003399',
        position: 'relative',
        overflow: 'hidden',
    },
    xScaleArea: {
        height: 20,
        width: '100%',
        position: 'relative',
    },
    mainAxisX: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: 'rgba(0, 51, 153, 0.3)',
    },
    mainAxisY: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 1,
        backgroundColor: 'rgba(0, 51, 153, 0.3)',
    },
    lineSegment: {
        position: 'absolute',
        height: 1.5,
        backgroundColor: '#003399',
    },
    dot: {
        position: 'absolute',
        width: 4,
        height: 4,
        backgroundColor: '#003399',
        borderRadius: 1,
    },
    bar: {
        position: 'absolute',
        backgroundColor: '#003399',
    },
    tickY: {
        position: 'absolute',
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: -6,
    },
    tickX: {
        position: 'absolute',
        alignItems: 'center',
    },
    tickLineY: {
        width: 4,
        height: 1,
        backgroundColor: '#003399',
    },
    tickLineX: {
        width: 1,
        height: 4,
        backgroundColor: '#003399',
    },
    tickText: {
        fontFamily: 'DotGothic16',
        fontSize: 8,
        color: '#003399',
        marginHorizontal: 2,
    },
    axisLabelVertical: {
        fontFamily: 'DotGothic16',
        fontSize: 9,
        color: '#003399',
        transform: [{ rotate: '-90deg' }],
        position: 'absolute',
        left: -20,
        width: 60,
        textAlign: 'center',
    },
    axisLabelHorizontal: {
        fontFamily: 'DotGothic16',
        fontSize: 9,
        color: '#003399',
        textAlign: 'center',
        marginTop: 2,
    },
});
