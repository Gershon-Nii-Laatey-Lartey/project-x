import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface CasioTableProps {
    data: {
        title?: string;
        headers: string[];
        rows: string[][];
    };
}

export const CasioTable: React.FC<CasioTableProps> = ({ data }) => {
    if (!data || !data.headers || !data.rows) return null;

    return (
        <View style={styles.container}>
            {data.title && <Text style={styles.title}>{data.title.toUpperCase()}</Text>}
            <View style={styles.table}>
                {/* Header */}
                <View style={styles.headerRow}>
                    {data.headers.map((header, i) => (
                        <View key={i} style={[styles.cell, i === 0 && { borderLeftWidth: 0 }, { backgroundColor: 'rgba(0, 51, 153, 0.1)' }]}>
                            <Text style={styles.headerText}>{header}</Text>
                        </View>
                    ))}
                </View>
                {/* Rows */}
                {data.rows.map((row, i) => (
                    <View key={i} style={styles.row}>
                        {row.map((cell, j) => (
                            <View key={j} style={[styles.cell, j === 0 && { borderLeftWidth: 0 }]}>
                                <Text style={styles.cellText}>{cell}</Text>
                            </View>
                        ))}
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginVertical: 8,
        padding: 4,
        borderWidth: 1,
        borderColor: '#003399',
        borderRadius: 2,
        backgroundColor: 'rgba(0, 51, 153, 0.02)',
    },
    title: {
        fontFamily: 'DotGothic16',
        fontSize: 14,
        color: '#003399',
        textAlign: 'center',
        marginBottom: 4,
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },
    table: {
        borderWidth: 1,
        borderColor: '#003399',
    },
    headerRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderColor: '#003399',
    },
    row: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderColor: '#003399',
    },
    cell: {
        flex: 1,
        padding: 4,
        borderLeftWidth: 1,
        borderColor: '#003399',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        fontFamily: 'DotGothic16',
        fontSize: 12,
        color: '#003399',
        fontWeight: 'bold',
    },
    cellText: {
        fontFamily: 'DotGothic16',
        fontSize: 12,
        color: '#003399',
    },
});
