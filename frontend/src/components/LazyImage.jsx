// frontend/src/components/LazyImage.jsx
import React, { useState, useEffect, useRef } from 'react';

export default function LazyImage({ src, alt, className }) {
    const [imageSrc, setImageSrc] = useState(null);
    const imageRef = useRef();

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setImageSrc(src);
                    observer.disconnect();
                }
            });
        });

        if (imageRef.current) {
            observer.observe(imageRef.current);
        }

        return () => observer.disconnect();
    }, [src]);

    return (
        <img
            ref={imageRef}
            src={imageSrc || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E'}
            alt={alt}
            className={className}
        />
    );
}
