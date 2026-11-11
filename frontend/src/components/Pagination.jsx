// frontend/src/components/Pagination.jsx
import React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

export default function Pagination({ currentPage, totalPages, onPageChange, className = '' }) {
    if (!totalPages || totalPages <= 1) return null;

    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
            return pages;
        }

        pages.push(1);
        let start = Math.max(2, currentPage - 1);
        let end = Math.min(totalPages - 1, currentPage + 1);
        if (currentPage <= 3) end = 4;
        if (currentPage >= totalPages - 2) start = totalPages - 3;

        if (start > 2) pages.push('...');
        for (let i = start; i <= end; i++) pages.push(i);
        if (end < totalPages - 1) pages.push('...');
        pages.push(totalPages);

        return pages;
    };

    const goTo = (page) => {
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            onPageChange?.(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <nav className={`flex items-center justify-center space-x-2 ${className}`}>
            <button
                onClick={() => goTo(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                aria-label="Previous page"
            >
                <ChevronLeft className="h-4 w-4" />
            </button>

            {getPageNumbers().map((page, i) =>
                page === '...' ? (
                    <span key={i} className="px-2 text-gray-400">
                        <MoreHorizontal className="h-4 w-4" />
                    </span>
                ) : (
                    <button
                        key={i}
                        onClick={() => goTo(page)}
                        className={`w-10 h-10 rounded-lg font-medium ${
                            page === currentPage
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        {page}
                    </button>
                )
            )}

            <button
                onClick={() => goTo(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                aria-label="Next page"
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </nav>
    );
}
