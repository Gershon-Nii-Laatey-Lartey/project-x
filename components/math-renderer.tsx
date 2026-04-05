import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface MathRendererProps {
    latex: string;
}

/**
 * A simplified Math Renderer for Casio-style 2D fractions and roots.
 * Handles: \frac{a}{b}, \sqrt{x}, x^{y}, and basic symbols.
 */
// Map basic Greek letters and LaTeX symbols to Unicode for the dot-matrix screen
const SYMBOL_MAP: Record<string, string> = {
    '\\rho': 'ρ',
    '\\theta': 'θ',
    '\\pi': 'π',
    '\\Delta': 'Δ',
    '\\phi': 'ϕ',
    '\\cdot': '·',
    '\\approx': '≈',
    '\\pm': '±',
    '\\therefore': '∴',
    '\\alpha': 'α',
    '\\beta': 'β',
    '\\gamma': 'γ',
    '\\lambda': 'λ',
    '\\sigma': 'σ',
    '\\omega': 'ω',
    '\\mu': 'μ',
    '\\times': '×',
    '\\div': '÷',
    '\\infty': '∞',
    '\\Rightarrow': '⇒',
    '\\rightarrow': '→',
    '\\Longrightarrow': '⇒',
    '\\sin': 'sin',
    '\\cos': 'cos',
    '\\tan': 'tan',
    '\\log': 'log',
    '\\ln': 'ln',
    '\\det': 'det',
    '\\lim': 'lim',
    '\\sum': 'Σ',
    '\\int': '∫',
    '\\partial': '∂',
    '\\nabla': '∇',
    '\\sqrt': '√',
    '\\angle': '∠',
    '\\degree': '°',
    '\\deg': '°',
};

export const MathRenderer = ({ latex }: MathRendererProps) => {
    // Advanced splitting: extracts matrices, multi-arg commands, and standalone symbols
    const tokens = latex.split(/(\\begin\{(?:p|b|v)matrix\}[\s\S]*?\\end\{(?:p|b|v)matrix\}|\\frac\s*\{(?:[^{}]|\{[^{}]*\})*\}\s*\{(?:[^{}]|\{[^{}]*\})*\}|\\sqrt\{(?:[^{}]|\{[^{}]*\})*\}|\\text\{(?:[^{}]|\{[^{}]*\})*\}|\\\w+\{[^{}]*\}\{[^{}]*\}|\\\w+\{[^{}]*\}|\^\{[^{}]*\}|_\{[^{}]*\}|\^{[^\}]*\}|_\{[^\}]*\}|\^[a-zA-Z0-9]|_[a-zA-Z0-9]|\\\w+|[\+\-\=\(\)\[\]\/\*])|(\s+)/g).filter(Boolean);

    const renderToken = (token: string, index: number) => {
        if (token.trim() === '' && token.length > 0) {
            return <Text key={index} style={styles.mathText}> </Text>;
        }

        // 0. Matrices: \begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}
        if (token.startsWith('\\begin')) {
            const isSquare = token.includes('bmatrix');
            const isPipe = token.includes('vmatrix');
            const content = token.replace(/\\begin\{(?:p|b|v)matrix\}|\\end\{(?:p|b|v)matrix\}/g, '').trim();
            const rows = content.split('\\\\').map(r => r.split('&').map(c => c.trim()));
            
            return (
                <View key={index} style={styles.matrixWrapper}>
                    <Text style={styles.matrixBracket}>{isSquare ? '[' : (isPipe ? '|' : '(')}</Text>
                    <View style={styles.matrixGrid}>
                        {rows.map((row, rIdx) => (
                            <View key={rIdx} style={styles.matrixRow}>
                                {row.map((cell, cIdx) => (
                                    <View key={cIdx} style={styles.matrixCell}>
                                        <MathRenderer latex={cell} />
                                    </View>
                                ))}
                            </View>
                        ))}
                    </View>
                    <Text style={styles.matrixBracket}>{isSquare ? ']' : (isPipe ? '|' : ')')}</Text>
                </View>
            );
        }

        // Special handling for degrees ^{ \circ } or ^{\circ}
        if (token.includes('\\circ')) {
            return <Text key={index} style={styles.exponentText}>°</Text>;
        }

        if (SYMBOL_MAP[token]) {
            return <Text key={index} style={styles.mathText}>{SYMBOL_MAP[token]}</Text>;
        }

        // 1. Fractions: \frac{num}{den}
        if (token.startsWith('\\frac')) {
            const parts = token.match(/\{(?:[^{}]|\{[^{}]*\})*\}/g);
            if (parts && parts.length === 2) {
                const num = parts[0].slice(1, -1);
                const den = parts[1].slice(1, -1);
                return (
                    <View key={index} style={styles.fractionContainer}>
                        <MathRenderer latex={num} />
                        <View style={styles.fractionLine} />
                        <MathRenderer latex={den} />
                    </View>
                );
            }
        }

        // 2. Roots: \sqrt{...}
        if (token.startsWith('\\sqrt')) {
            const content = token.match(/\{([^{}]*)\}/)?.[1] || token.slice(6, -1);
            return (
                <View key={index} style={styles.rootOuter}>
                    <Text style={styles.rootSymbol}>√</Text>
                    <View style={styles.rootContent}>
                        <View style={styles.rootOverline} />
                        <MathRenderer latex={content} />
                    </View>
                </View>
            );
        }

        // 3. Binomial: \binom{n}{r}
        if (token.startsWith('\\binom')) {
            const parts = token.match(/\{([^{}]*)\}/g);
            if (parts && parts.length === 2) {
                const n = parts[0].slice(1, -1);
                const r = parts[1].slice(1, -1);
                return (
                    <View key={index} style={styles.binContainer}>
                        <Text style={styles.binBracket}>{'('}</Text>
                        <View style={styles.binContent}>
                            <MathRenderer latex={n} />
                            <MathRenderer latex={r} />
                        </View>
                        <Text style={styles.binBracket}>{')'}</Text>
                    </View>
                );
            }
        }

        // 4. Text: \text{...}
        if (token.startsWith('\\text')) {
            const content = token.match(/\{([^{}]*)\}/)?.[1] || token.slice(6, -1);
            return <Text key={index} style={styles.mathText}>{content}</Text>;
        }

        // 5. Exponents / Subscripts
        if (token.startsWith('^')) {
            const content = token.startsWith('^{') ? token.slice(2, -1) : token.slice(1);
            if (content === '\\circ') return <Text key={index} style={styles.exponentText}>°</Text>;
            return <Text key={index} style={styles.exponentText}>{content}</Text>;
        }
        if (token.startsWith('_')) {
            const content = token.startsWith('_{') ? token.slice(2, -1) : token.slice(1);
            return <Text key={index} style={styles.subscriptText}>{content}</Text>;
        }

        let cleanToken = token.replace(/\\/g, '').replace(/\{/g, '').replace(/\}/g, '');
        if (cleanToken.trim() === '') return null;

        return <Text key={index} style={styles.mathText}>{cleanToken}</Text>;
    };

    return (
        <View style={styles.container}>
            {tokens.map((token, i) => renderToken(token, i))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        // We use wrap on the main container so long equations break, 
        // but tokens themselves are atomic.
        flexWrap: 'wrap',
    },
    mathText: {
        fontFamily: 'DotGothic16',
        fontSize: 24,
        color: '#003399',
        lineHeight: 32,
    },
    fractionContainer: {
        alignItems: 'center',
        marginHorizontal: 2,
        paddingTop: 4,
    },
    fractionLine: {
        height: 1.5,
        width: '100%',
        minWidth: 10,
        backgroundColor: '#003399',
        marginVertical: 1,
    },
    rootOuter: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginHorizontal: 2,
        marginTop: 4,
    },
    rootSymbol: {
        fontFamily: 'DotGothic16',
        fontSize: 28,
        color: '#003399',
        marginRight: -2,
    },
    rootContent: {
        marginTop: 6,
    },
    rootOverline: {
        height: 1.5,
        backgroundColor: '#003399',
        width: '100%',
        marginBottom: -2,
    },
    dotContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    dotIndicator: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#003399',
        marginBottom: -4,
    },
    exponentText: {
        fontFamily: 'DotGothic16',
        fontSize: 14,
        color: '#003399',
        alignSelf: 'flex-start',
        marginTop: -4,
    },
    subscriptText: {
        fontFamily: 'DotGothic16',
        fontSize: 14,
        color: '#003399',
        alignSelf: 'flex-end',
        marginBottom: 2,
    },
    matrixWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 4,
        marginVertical: 4,
    },
    matrixBracket: {
        fontFamily: 'DotGothic16',
        fontSize: 32,
        color: '#003399',
        fontWeight: '100',
    },
    matrixGrid: {
        paddingHorizontal: 4,
    },
    matrixRow: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    matrixCell: {
        padding: 4,
        minWidth: 20,
        alignItems: 'center',
    },
    binContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 2,
    },
    binBracket: {
        fontFamily: 'DotGothic16',
        fontSize: 36,
        color: '#003399',
        fontWeight: '200',
    },
    binContent: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 2,
    }
});
