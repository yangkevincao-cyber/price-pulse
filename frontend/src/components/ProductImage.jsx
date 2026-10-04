// frontend/src/components/ProductImage.jsx
import React from 'react';
import ImageUrlGenerator from '../utils/imageUrl';

const ProductImage = ({ product, size = 'medium', className = '' }) => {
    const imageUrls = ImageUrlGenerator.getProductImageUrls(product, size);

    if (!imageUrls) {
        return (
            <div className={`bg-gray-200 flex items-center justify-center ${className}`}>
                <span className="text-gray-400">No Image</span>
            </div>
        );
    }

    return (
        <picture className={className}>
            <source srcSet={imageUrls.original} type="image/webp" />
            <source srcSet={imageUrls.original.replace('.webp', '.jpg')} type="image/jpeg" />
            <img
                src={imageUrls.medium}
                alt={product.name}
                loading="lazy"
                className="w-full h-full object-cover"
                srcSet={ImageUrlGenerator.getSrcSet(imageUrls)}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
        </picture>
    );
};

export default ProductImage;