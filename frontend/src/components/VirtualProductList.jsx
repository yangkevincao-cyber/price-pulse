// frontend/src/components/VirtualProductList.jsx
import React from 'react';
import { FixedSizeList as List } from 'react-window';
import ProductCard from './ProductCard';

export default function VirtualProductList({ products }) {
    const Row = ({ index, style }) => (
        <div style={style}>
            <ProductCard product={products[index]} />
        </div>
    );

    return (
        <List
            height={600}
            itemCount={products.length}
            itemSize={120}
            width="100%"
        >
            {Row}
        </List>
    );
}
