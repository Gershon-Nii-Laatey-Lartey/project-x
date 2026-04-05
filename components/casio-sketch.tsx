import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Path, Rect, Ellipse, Text as SvgText, G } from 'react-native-svg';

interface SketchElement {
    type: 'circle' | 'line' | 'triangle' | 'point' | 'path' | 'rect' | 'arc' | 'ellipse' | 'text';
    coords: number[]; 
    d?: string;
    label?: string;
    labelOffset?: { x: number; y: number };
    stroke?: string;
    strokeWidth?: number;
    fill?: string;
    dash?: boolean;
}

interface CasioSketchProps {
    data: {
        title: string;
        elements: SketchElement[];
    };
}

const CANVAS_SIZE = 180;

export const CasioSketch = ({ data }: CasioSketchProps) => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>{data.title.toUpperCase()}</Text>
            <View style={styles.canvasWrapper}>
                <View style={StyleSheet.absoluteFill}>
                    <Svg width="100%" height="100%" viewBox="0 0 100 100">
                        {Array.from({ length: 11 }).map((_, i) => (
                            <React.Fragment key={i}>
                                <Line x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="rgba(0, 51, 153, 0.05)" strokeWidth="0.2" />
                                <Line x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="rgba(0, 51, 153, 0.05)" strokeWidth="0.2" />
                            </React.Fragment>
                        ))}
                    </Svg>
                </View>

                <Svg width="100%" height={CANVAS_SIZE} viewBox="0 0 100 100">
                    {data.elements?.map((el, i) => {
                        if (!el || !el.type) return null;
                        
                        const stroke = el.stroke || "#003399";
                        const fill = el.fill || "none";
                        const sw = el.strokeWidth || 1.2;
                        const dashArray = el.dash ? "3,3" : undefined;
                        const coords = el.coords || [];

                        if (el.type === 'path' && el.d) {
                            return (
                                <G key={i}>
                                    <Path d={el.d} stroke={stroke} strokeWidth={sw} fill={fill} strokeDasharray={dashArray} />
                                    {el.label && (
                                        <SvgText
                                            x={coords[0] || 50}
                                            y={coords[1] || 50}
                                            fill={stroke}
                                            fontSize="5"
                                            fontWeight="bold"
                                            dx={el.labelOffset?.x || 0}
                                            dy={el.labelOffset?.y || 0}
                                        >
                                            {el.label}
                                        </SvgText>
                                    )}
                                </G>
                            );
                        }
                        if (el.type === 'rect' && coords.length >= 4) {
                            const [x, y, w, h] = coords;
                            return (
                                <G key={i}>
                                    <Rect x={x} y={y} width={w} height={h} stroke={stroke} strokeWidth={sw} fill={fill} strokeDasharray={dashArray} />
                                    {el.label && (
                                        <SvgText x={x + w / 2} y={y + h / 2} fill={stroke} fontSize="5" textAnchor="middle" dy={el.labelOffset?.y || 0}>{el.label}</SvgText>
                                    )}
                                </G>
                            );
                        }
                        if (el.type === 'circle' && coords.length >= 3) {
                            const [cx, cy, r] = coords;
                            return (
                                <G key={i}>
                                    <Circle cx={cx} cy={cy} r={r} stroke={stroke} strokeWidth={sw} fill={fill} strokeDasharray={dashArray} />
                                    {el.label && (
                                        <SvgText x={cx} y={cy} fill={stroke} fontSize="5" textAnchor="middle" alignmentBaseline="middle" dx={el.labelOffset?.x || 0} dy={el.labelOffset?.y || 0}>{el.label}</SvgText>
                                    )}
                                </G>
                            );
                        }
                        if (el.type === 'ellipse' && coords.length >= 4) {
                            const [cx, cy, rx, ry] = coords;
                            return (
                                <G key={i}>
                                    <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke={stroke} strokeWidth={sw} fill={fill} strokeDasharray={dashArray} />
                                    {el.label && (
                                        <SvgText x={cx} y={cy} fill={stroke} fontSize="5" textAnchor="middle" dy={el.labelOffset?.y || 0}>{el.label}</SvgText>
                                    )}
                                </G>
                            );
                        }
                        if (el.type === 'line' && coords.length >= 4) {
                            const [x1, y1, x2, y2] = coords;
                            return (
                                <G key={i}>
                                    <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={sw} strokeDasharray={dashArray} />
                                    {el.label && (
                                        <SvgText x={(x1 + x2) / 2} y={(y1 + y2) / 2} fill={stroke} fontSize="5" textAnchor="middle" dx={el.labelOffset?.x || 0} dy={el.labelOffset?.y || 0}>{el.label}</SvgText>
                                    )}
                                </G>
                            );
                        }
                        if (el.type === 'triangle' && coords.length >= 6) {
                            const [x1, y1, x2, y2, x3, y3] = coords;
                            return (
                                <Polyline key={i} points={`${x1},${y1} ${x2},${y2} ${x3},${y3} ${x1},${y1}`} fill={fill !== "none" ? fill : "rgba(0, 51, 153, 0.04)"} stroke={stroke} strokeWidth={sw} strokeDasharray={dashArray} />
                            );
                        }
                        if (el.type === 'point' && coords.length >= 2) {
                            const [px, py] = coords;
                            return (
                                <G key={i}>
                                    <Circle cx={px} cy={py} r="1" fill={stroke} />
                                    {el.label && (
                                        <SvgText x={px + 3} y={py + 3} fill={stroke} fontSize="5">{el.label}</SvgText>
                                    )}
                                </G>
                            );
                        }
                        if (el.type === 'text' && coords.length >= 2) {
                            const [tx, ty] = coords;
                            return (
                                <SvgText key={i} x={tx} y={ty} fill={stroke} fontSize="6" fontWeight="bold" dx={el.labelOffset?.x || 0} dy={el.labelOffset?.y || 0}>{el.label}</SvgText>
                            );
                        }
                        if (el.type === 'arc' && coords.length >= 5) {
                            const [cx, cy, r, startA, endA] = coords;
                            const startRad = (startA - 90) * Math.PI / 180;
                            const endRad = (endA - 90) * Math.PI / 180;
                            const x1 = cx + r * Math.cos(startRad);
                            const y1 = cy + r * Math.sin(startRad);
                            const x2 = cx + r * Math.cos(endRad);
                            const y2 = cy + r * Math.sin(endRad);
                            const largeArc = Math.abs(endA - startA) <= 180 ? 0 : 1;
                            const d = `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
                            return (
                                <G key={i}>
                                    <Path d={d} stroke={stroke} strokeWidth={sw} fill="none" strokeDasharray={dashArray} />
                                    {el.label && <SvgText x={x1} y={y1} fill={stroke} fontSize="5" dy="-2">{el.label}</SvgText>}
                                </G>
                            );
                        }
                        return null;
                    })}
                </Svg>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginVertical: 10,
        backgroundColor: 'rgba(0, 51, 153, 0.03)',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(0, 51, 153, 0.15)',
        padding: 6,
    },
    title: {
        fontFamily: 'DotGothic16',
        fontSize: 8,
        color: '#003399',
        textAlign: 'center',
        marginBottom: 4,
        letterSpacing: 1,
        opacity: 0.8,
    },
    canvasWrapper: {
        width: '100%',
        height: CANVAS_SIZE,
        backgroundColor: 'rgba(227, 242, 232, 0.4)',
        borderRadius: 2,
        overflow: 'hidden',
    }
});
