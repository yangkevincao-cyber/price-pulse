// frontend/src/components/Common/SortDropdown.jsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

function SortDropdown({ value, onChange, options = [], className = '' }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const selectedOption = options.find(opt => opt.value === value) || options[0];

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition min-w-[180px]"
            >
                <span>{selectedOption?.label || 'Sort By'}</span>
                <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50 min-w-[180px]">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => handleSelect(option.value)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition flex items-center justify-between"
                        >
                            <span className={option.value === value ? 'font-medium text-pulse-blue-600' : 'text-gray-700'}>
                                {option.label}
                            </span>
                            {option.value === value && (
                                <Check className="h-4 w-4 text-pulse-blue-600" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default SortDropdown;