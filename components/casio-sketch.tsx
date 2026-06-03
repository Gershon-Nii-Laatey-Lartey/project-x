import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Path, Rect, Ellipse, Text as SvgText, G } from 'react-native-svg';

interface SketchElement {
    type: 'circle' | 'line' | 'triangle' | 'point' | 'path' | 'rect' | 'arc' | 'ellipse' | 'text' | 'angle';
    coords?: number[]; 
    d?: string;
    label?: string;
    labelOffset?: { x: number; y: number };
    stroke?: string;
    strokeWidth?: number;
    fill?: string;
    dash?: boolean;
    // Geometric properties from AI payloads
    center?: number[];
    radius?: number;
    coordinate?: number[];
    start?: number[];
    end?: number[];
    vertex?: number[];
    arms?: number[][];
    points?: number[][];
    angles?: number[];
    rx?: number;
    ry?: number;
    size?: number[];
}

interface CasioSketchProps {
    data: {
        title?: string;
        elements?: SketchElement[];
        // Graph style schema properties
        type?: string;
        center?: number[];
        radius?: number;
        points?: any[];
        lines?: any[];
        angles?: any[];
    };
}

const CANVAS_SIZE = 180;

export const CasioSketch = ({ data }: CasioSketchProps) => {
    const rawData = data;
    let rawElements: SketchElement[] = [];

    // Check if data has elements array or if it uses the alternate graph format (circle + points + lines)
    if (Array.isArray(rawData?.elements)) {
        rawElements = rawData.elements;
    } else {
        // Circle/Points/Lines/Angles Graph Format
        const pointsList = Array.isArray(rawData?.points) ? rawData.points : [];
        const linesList = Array.isArray(rawData?.lines) ? rawData.lines : [];
        const anglesList = Array.isArray(rawData?.angles) ? rawData.angles : [];

        const generatedElements: SketchElement[] = [];

        // 1. Add primary circle
        if (rawData?.type === 'circle' && rawData.center && rawData.radius) {
            generatedElements.push({
                type: 'circle',
                center: rawData.center,
                radius: rawData.radius,
            });
        }

        // Map point labels to positions for quick endpoint lookup
        const pointMap: Record<string, number[]> = {};
        
        // 2. Add points
        pointsList.forEach((pt: any) => {
            if (pt && pt.label && pt.pos) {
                pointMap[pt.label] = pt.pos;
                generatedElements.push({
                    type: 'point',
                    coordinate: pt.pos,
                    label: pt.label,
                });
            }
        });

        // 3. Add lines
        linesList.forEach((line: any) => {
            const startPos = pointMap[line.from] || pointMap[line.start];
            const endPos = pointMap[line.to] || pointMap[line.end];
            if (startPos && endPos) {
                generatedElements.push({
                    type: 'line',
                    start: startPos,
                    end: endPos,
                    label: line.label,
                });
            }
        });

        // 4. Add angles
        anglesList.forEach((ang: any) => {
            const vertexLabel = ang.at || ang.vertex;
            const vertexPos = pointMap[vertexLabel];
            if (vertexPos) {
                // Find points connected to this vertex to construct arms
                const connectedPoints: number[][] = [];
                linesList.forEach((line: any) => {
                    const fromLabel = line.from || line.start;
                    const toLabel = line.to || line.end;
                    
                    if (fromLabel === vertexLabel && pointMap[toLabel]) {
                        connectedPoints.push(pointMap[toLabel]);
                    } else if (toLabel === vertexLabel && pointMap[fromLabel]) {
                        connectedPoints.push(pointMap[fromLabel]);
                    }
                });

                if (connectedPoints.length >= 2) {
                    generatedElements.push({
                        type: 'angle',
                        vertex: vertexPos,
                        arms: [connectedPoints[0], connectedPoints[1]],
                        label: ang.value || ang.label,
                    });
                } else {
                    // Fallback to text label near the vertex
                    generatedElements.push({
                        type: 'text',
                        coordinate: vertexPos,
                        label: ang.value || ang.label,
                    });
                }
            }
        });

        rawElements = generatedElements;
    }

    // 1. Normalize element coordinate inputs (mapping custom coordinates to standardized coords array)
    const normalizedElements = rawElements.map(el => {
        if (!el) return null;
        
        let coords: number[] = [...(el.coords || [])];

        if (coords.length === 0) {
            const raw = el as any;
            if (el.type === 'circle') {
                const cx = raw.center?.[0] ?? 0;
                const cy = raw.center?.[1] ?? 0;
                const r = raw.radius ?? 10;
                coords = [cx, cy, r];
            } else if (el.type === 'point' || el.type === 'text') {
                const px = raw.coordinate?.[0] ?? 0;
                const py = raw.coordinate?.[1] ?? 0;
                coords = [px, py];
            } else if (el.type === 'line') {
                const x1 = raw.start?.[0] ?? 0;
                const y1 = raw.start?.[1] ?? 0;
                const x2 = raw.end?.[0] ?? 0;
                const y2 = raw.end?.[1] ?? 0;
                coords = [x1, y1, x2, y2];
            } else if (el.type === 'rect') {
                const x = raw.start?.[0] ?? 0;
                const y = raw.start?.[1] ?? 0;
                const w = raw.size?.[0] ?? 10;
                const h = raw.size?.[1] ?? 10;
                coords = [x, y, w, h];
            } else if (el.type === 'ellipse') {
                const cx = raw.center?.[0] ?? 0;
                const cy = raw.center?.[1] ?? 0;
                const rx = raw.rx ?? 10;
                const ry = raw.ry ?? 10;
                coords = [cx, cy, rx, ry];
            } else if (el.type === 'arc') {
                const cx = raw.center?.[0] ?? 0;
                const cy = raw.center?.[1] ?? 0;
                const r = raw.radius ?? 10;
                const startA = raw.angles?.[0] ?? 0;
                const endA = raw.angles?.[1] ?? 360;
                coords = [cx, cy, r, startA, endA];
            } else if (el.type === 'triangle') {
                if (Array.isArray(raw.points) && raw.points.length >= 3) {
                    coords = [
                        raw.points[0]?.[0] ?? 0, raw.points[0]?.[1] ?? 0,
                        raw.points[1]?.[0] ?? 0, raw.points[1]?.[1] ?? 0,
                        raw.points[2]?.[0] ?? 0, raw.points[2]?.[1] ?? 0
                    ];
                }
            } else if ((el.type as string) === 'angle') {
                const vx = raw.vertex?.[0] ?? 0;
                const vy = raw.vertex?.[1] ?? 0;
                const a1x = raw.arms?.[0]?.[0] ?? 0;
                const a1y = raw.arms?.[0]?.[1] ?? 0;
                const a2x = raw.arms?.[1]?.[0] ?? 0;
                const a2y = raw.arms?.[1]?.[1] ?? 0;
                coords = [vx, vy, a1x, a1y, a2x, a2y];
            }
        }

        return {
            ...el,
            coords
        };
    }).filter((el): el is typeof el & { coords: number[] } => el !== null && el.coords !== undefined);

    // 2. Compute the bounding box of the diagram in math coordinate space
    const pts: { x: number; y: number }[] = [];
    
    normalizedElements.forEach(el => {
        const coords = el.coords;
        if (!coords || coords.length === 0) return;
        
        if (el.type === 'circle') {
            const [cx, cy, r] = coords;
            pts.push({ x: cx - r, y: cy });
            pts.push({ x: cx + r, y: cy });
            pts.push({ x: cx, y: cy - r });
            pts.push({ x: cx, y: cy + r });
        } else if (el.type === 'ellipse') {
            const [cx, cy, rx, ry] = coords;
            pts.push({ x: cx - rx, y: cy });
            pts.push({ x: cx + rx, y: cy });
            pts.push({ x: cx, y: cy - ry });
            pts.push({ x: cx, y: cy + ry });
        } else if (el.type === 'line') {
            const [x1, y1, x2, y2] = coords;
            pts.push({ x: x1, y: y1 });
            pts.push({ x: x2, y: y2 });
        } else if (el.type === 'point' || el.type === 'text') {
            const [px, py] = coords;
            pts.push({ x: px, y: py });
        } else if (el.type === 'triangle') {
            const [x1, y1, x2, y2, x3, y3] = coords;
            pts.push({ x: x1, y: y1 });
            pts.push({ x: x2, y: y2 });
            pts.push({ x: x3, y: y3 });
        } else if (el.type === 'rect') {
            const [x, y, w, h] = coords;
            pts.push({ x, y });
            pts.push({ x: x + w, y: y + h });
        } else if (el.type === 'arc') {
            const [cx, cy, r] = coords;
            pts.push({ x: cx - r, y: cy });
            pts.push({ x: cx + r, y: cy });
            pts.push({ x: cx, y: cy - r });
            pts.push({ x: cx, y: cy + r });
        } else if ((el.type as string) === 'angle') {
            const [vx, vy, a1x, a1y, a2x, a2y] = coords;
            pts.push({ x: vx, y: vy });
            pts.push({ x: a1x, y: a1y });
            pts.push({ x: a2x, y: a2y });
        }
    });

    // 3. Setup dynamic viewport mapping from math coordinates to SVG coordinates [15, 85] (preserving aspect ratio)
    let minX = -100;
    let maxX = 100;
    let minY = -100;
    let maxY = 100;

    if (pts.length > 0) {
        minX = Math.min(...pts.map(p => p.x));
        maxX = Math.max(...pts.map(p => p.x));
        minY = Math.min(...pts.map(p => p.y));
        maxY = Math.max(...pts.map(p => p.y));
    }

    const width = maxX - minX || 1;
    const height = maxY - minY || 1;
    
    // Fit within viewBox bounds [15, 85] to leave safety margins for outer labels (e.g. tangent lines, vertex letters)
    const scale = Math.min(70 / width, 70 / height);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const mapX = (x: number) => 50 + (x - centerX) * scale;
    const mapY = (y: number) => 50 - (y - centerY) * scale; // Note the minus sign flips Y so positive Y is up
    const mapDist = (d: number) => d * scale;

    return (
        <View style={styles.container}>
            {rawData?.title && <Text style={styles.title}>{rawData.title.toUpperCase()}</Text>}
            <View style={styles.canvasWrapper}>
                <Svg width="100%" height="100%" viewBox="0 0 100 100" style={{ backgroundColor: 'transparent' }}>
                    {/* Grid Lines */}
                    {Array.from({ length: 11 }).map((_, i) => (
                        <React.Fragment key={i}>
                            <Line x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="rgba(0, 51, 153, 0.05)" strokeWidth="0.2" />
                            <Line x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="rgba(0, 51, 153, 0.05)" strokeWidth="0.2" />
                        </React.Fragment>
                    ))}

                    {/* Geometry Elements */}
                    {normalizedElements.map((el, i) => {
                        const stroke = el.stroke || "#003399";
                        const fill = el.fill || "none";
                        const sw = (el.strokeWidth || 1.2) * (scale > 0.5 ? 1 : scale * 2);
                        const dashArray = el.dash ? "3,3" : undefined;
                        const coords = el.coords;

                        if (el.type === 'circle' && coords.length >= 3) {
                            const [cx, cy, r] = coords;
                            const svgCx = mapX(cx);
                            const svgCy = mapY(cy);
                            const svgR = mapDist(r);
                            return (
                                <G key={i}>
                                    <Circle cx={svgCx} cy={svgCy} r={svgR} stroke={stroke} strokeWidth={sw} fill={fill} strokeDasharray={dashArray} />
                                    {el.label && (
                                        <SvgText 
                                            x={svgCx} 
                                            y={svgCy} 
                                            fill={stroke} 
                                            fontSize="5" 
                                            fontWeight="bold"
                                            textAnchor="middle" 
                                            alignmentBaseline="middle" 
                                            dx={el.labelOffset?.x || 0} 
                                            dy={el.labelOffset?.y || 0}
                                        >
                                            {el.label}
                                        </SvgText>
                                    )}
                                </G>
                            );
                        }

                        if (el.type === 'line' && coords.length >= 4) {
                            const [x1, y1, x2, y2] = coords;
                            const svgX1 = mapX(x1);
                            const svgY1 = mapY(y1);
                            const svgX2 = mapX(x2);
                            const svgY2 = mapY(y2);
                            return (
                                <G key={i}>
                                    <Line x1={svgX1} y1={svgY1} x2={svgX2} y2={svgY2} stroke={stroke} strokeWidth={sw} strokeDasharray={dashArray} />
                                    {el.label && (
                                        <SvgText 
                                            x={(svgX1 + svgX2) / 2} 
                                            y={(svgY1 + svgY2) / 2} 
                                            fill={stroke} 
                                            fontSize="4.5" 
                                            textAnchor="middle" 
                                            dx={el.labelOffset?.x || 0} 
                                            dy={(el.labelOffset?.y || 0) - 2}
                                        >
                                            {el.label}
                                        </SvgText>
                                    )}
                                </G>
                            );
                        }

                        if (el.type === 'point' && coords.length >= 2) {
                            const [px, py] = coords;
                            const svgPx = mapX(px);
                            const svgPy = mapY(py);

                            // Smart label positioning away from diagram center to prevent text overlapping with diagram shapes
                            let offsetDx = 3;
                            let offsetDy = 3;
                            const dirX = px - centerX;
                            const dirY = py - centerY;
                            const dist = Math.sqrt(dirX * dirX + dirY * dirY);
                            if (dist > 2) {
                                offsetDx = (dirX / dist) * 6;
                                offsetDy = -(dirY / dist) * 6;
                            }

                            return (
                                <G key={i}>
                                    <Circle cx={svgPx} cy={svgPy} r="1.2" fill={stroke} />
                                    {el.label && (
                                        <SvgText 
                                            x={svgPx} 
                                            y={svgPy} 
                                            fill={stroke} 
                                            fontSize="4.5"
                                            fontWeight="bold"
                                            textAnchor={offsetDx < -1 ? "end" : (offsetDx > 1 ? "start" : "middle")}
                                            alignmentBaseline="middle"
                                            dx={offsetDx} 
                                            dy={offsetDy}
                                        >
                                            {el.label}
                                        </SvgText>
                                    )}
                                </G>
                            );
                        }

                        if (el.type === 'text' && coords.length >= 2) {
                            const [tx, ty] = coords;
                            const svgTx = mapX(tx);
                            const svgTy = mapY(ty);
                            return (
                                <SvgText 
                                    key={i} 
                                    x={svgTx} 
                                    y={svgTy} 
                                    fill={stroke} 
                                    fontSize="5.5" 
                                    fontWeight="bold" 
                                    dx={el.labelOffset?.x || 0} 
                                    dy={el.labelOffset?.y || 0}
                                >
                                    {el.label}
                                </SvgText>
                            );
                        }

                        if (el.type === 'triangle' && coords.length >= 6) {
                            const [x1, y1, x2, y2, x3, y3] = coords;
                            const svgX1 = mapX(x1);
                            const svgY1 = mapY(y1);
                            const svgX2 = mapX(x2);
                            const svgY2 = mapY(y2);
                            const svgX3 = mapX(x3);
                            const svgY3 = mapY(y3);
                            return (
                                <Polyline 
                                    key={i} 
                                    points={`${svgX1},${svgY1} ${svgX2},${svgY2} ${svgX3},${svgY3} ${svgX1},${svgY1}`} 
                                    fill={fill !== "none" ? fill : "rgba(0, 51, 153, 0.04)"} 
                                    stroke={stroke} 
                                    strokeWidth={sw} 
                                    strokeDasharray={dashArray} 
                                />
                            );
                        }

                        if (el.type === 'rect' && coords.length >= 4) {
                            const [x, y, w, h] = coords;
                            const svgX = mapX(x);
                            const svgY = mapY(y);
                            const svgW = mapDist(w);
                            const svgH = mapDist(h);
                            return (
                                <G key={i}>
                                    <Rect x={svgX} y={svgY - svgH} width={svgW} height={svgH} stroke={stroke} strokeWidth={sw} fill={fill} strokeDasharray={dashArray} />
                                    {el.label && (
                                        <SvgText x={svgX + svgW / 2} y={svgY - svgH / 2} fill={stroke} fontSize="5" textAnchor="middle" dy={el.labelOffset?.y || 0}>{el.label}</SvgText>
                                    )}
                                </G>
                            );
                        }

                        if (el.type === 'ellipse' && coords.length >= 4) {
                            const [cx, cy, rx, ry] = coords;
                            const svgCx = mapX(cx);
                            const svgCy = mapY(cy);
                            const svgRx = mapDist(rx);
                            const svgRy = mapDist(ry);
                            return (
                                <G key={i}>
                                    <Ellipse cx={svgCx} cy={svgCy} rx={svgRx} ry={svgRy} stroke={stroke} strokeWidth={sw} fill={fill} strokeDasharray={dashArray} />
                                    {el.label && (
                                        <SvgText x={svgCx} y={svgCy} fill={stroke} fontSize="5" textAnchor="middle" dy={el.labelOffset?.y || 0}>{el.label}</SvgText>
                                    )}
                                </G>
                            );
                        }

                        if (el.type === 'arc' && coords.length >= 5) {
                            const [cx, cy, r, startA, endA] = coords;
                            const svgCx = mapX(cx);
                            const svgCy = mapY(cy);
                            const svgR = mapDist(r);
                            
                            // Map CCW math angles to SVG CW angles (since we flip Y)
                            const startRad = (-startA) * Math.PI / 180;
                            const endRad = (-endA) * Math.PI / 180;
                            
                            const x1 = svgCx + svgR * Math.cos(startRad);
                            const y1 = svgCy + svgR * Math.sin(startRad);
                            const x2 = svgCx + svgR * Math.cos(endRad);
                            const y2 = svgCy + svgR * Math.sin(endRad);
                            
                            const largeArc = Math.abs(endA - startA) <= 180 ? 0 : 1;
                            const sweepFlag = startA < endA ? 0 : 1;
                            
                            const d = `M ${x1} ${y1} A ${svgR} ${svgR} 0 ${largeArc} ${sweepFlag} ${x2} ${y2}`;
                            return (
                                <G key={i}>
                                    <Path d={d} stroke={stroke} strokeWidth={sw} fill="none" strokeDasharray={dashArray} />
                                    {el.label && <SvgText x={x1} y={y1} fill={stroke} fontSize="5" dy="-2">{el.label}</SvgText>}
                                </G>
                            );
                        }

                        if ((el.type as string) === 'angle' && coords.length >= 6) {
                            const [vx, vy, a1x, a1y, a2x, a2y] = coords;
                            const svgVx = mapX(vx);
                            const svgVy = mapY(vy);
                            const svgA1x = mapX(a1x);
                            const svgA1y = mapY(a1y);
                            const svgA2x = mapX(a2x);
                            const svgA2y = mapY(a2y);
                            
                            const angle1 = Math.atan2(a1y - vy, a1x - vx);
                            const angle2 = Math.atan2(a2y - vy, a2x - vx);
                            
                            let startA = angle1;
                            let diff = angle2 - startA;
                            while (diff < -Math.PI) diff += 2 * Math.PI;
                            while (diff > Math.PI) diff -= 2 * Math.PI;
                            
                            const svgArcR = 8; 
                            
                            const a1Rad = -angle1;
                            const a2Rad = -angle2;
                            
                            const x1 = svgVx + svgArcR * Math.cos(a1Rad);
                            const y1 = svgVy + svgArcR * Math.sin(a1Rad);
                            const x2 = svgVx + svgArcR * Math.cos(a2Rad);
                            const y2 = svgVy + svgArcR * Math.sin(a2Rad);
                            
                            const largeArc = Math.abs(diff) <= Math.PI ? 0 : 1;
                            const sweepFlag = diff < 0 ? 0 : 1;
                            
                            const d = `M ${x1} ${y1} A ${svgArcR} ${svgArcR} 0 ${largeArc} ${sweepFlag} ${x2} ${y2}`;
                            
                            const midAngle = -(angle1 + diff / 2);
                            const labelR = svgArcR + 6;
                            const lx = svgVx + labelR * Math.cos(midAngle);
                            const ly = svgVy + labelR * Math.sin(midAngle);
                            
                            return (
                                <G key={i}>
                                    <Path d={d} stroke={stroke} strokeWidth={sw} fill="none" strokeDasharray={dashArray} />
                                    <Line x1={svgVx} y1={svgVy} x2={svgA1x} y2={svgA1y} stroke={stroke} strokeWidth={sw * 0.4} strokeDasharray="1,1" />
                                    <Line x1={svgVx} y1={svgVy} x2={svgA2x} y2={svgA2y} stroke={stroke} strokeWidth={sw * 0.4} strokeDasharray="1,1" />
                                    {el.label && (
                                        <SvgText x={lx} y={ly} fill={stroke} fontSize="4.5" textAnchor="middle" alignmentBaseline="middle">{el.label}</SvgText>
                                    )}
                                </G>
                            );
                        }

                        if (el.type === 'path' && el.d) {
                            return (
                                <G key={i}>
                                    <Path d={el.d} stroke={stroke} strokeWidth={sw} fill={fill} strokeDasharray={dashArray} />
                                    {el.label && (
                                        <SvgText
                                            x={coords[0] ? mapX(coords[0]) : 50}
                                            y={coords[1] ? mapY(coords[1]) : 50}
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
