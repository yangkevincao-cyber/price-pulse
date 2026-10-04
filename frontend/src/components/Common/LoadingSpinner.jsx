// frontend/src/components/Common/LoadingSpinner.jsx
import React from 'react';

function LoadingSpinner({ size = 'md', color = 'blue' }) {
    const sizeMap = {
        sm: 'h-8 w-8',
        md: 'h-12 w-12',
        lg: 'h-16 w-16',
        xl: 'h-24 w-24',
    };

    const colorMap = {
        blue: 'border-blue-600',
        white: 'border-white',
        gray: 'border-gray-600',
    };

    return (
        <div className="flex items-center justify-center min-h-[200px]">
            <div
                className={`
                    ${sizeMap[size] || sizeMap.md} 
                    ${colorMap[color] || colorMap.blue}
                    border-4 border-t-transparent rounded-full animate-spin
                `}
                role="status"
                aria-label="Loading"
            >
                <span className="sr-only">Loading...</span>
            </div>
        </div>
    );
}

export default LoadingSpinner;