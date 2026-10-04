// frontend/src/components/Common/Pagination.jsx
import React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

function Pagination({ currentPage, totalPages, onPageChange, className = '' }) {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);

            // Calculate range around current page
            let start = Math.max(2, currentPage - 1);
            let end = Math.min(totalPages - 1, currentPage + 1);

            // Adjust if near beginning
            if (currentPage <= 3) {
                end = 4;
            }

            // Adjust if near end
            if (currentPage >= totalPages - 2) {
                start = totalPages - 3;
            }

            // Add ellipsis if needed
            if (start > 2) {
                pages.push('...');
            }

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            // Add ellipsis if needed
            if (end < totalPages - 1) {
                pages.push('...');
            }

            // Always show last page
            if (totalPages > 1) {
                pages.push(totalPages);
            }
        }

        return pages;
    };

    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            onPageChange(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <nav className={`flex items-center justify-center space-x-2 ${className}`}>
            <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg border border-gray-300 ${currentPage === 1
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                    } transition`}
                aria-label="Previous page"
            >
                <ChevronLeft className="h-4 w-4" />
            </button>

            {getPageNumbers().map((page, index) => (
                <React.Fragment key={index}>
                    {page === '...' ? (
                        <span className="px-2 text-gray-400">
                            <MoreHorizontal className="h-4 w-4" />
                        </span>
                    ) : (
                        <button
                            onClick={() => goToPage(page)}
                            className={`w-10 h-10 rounded-lg font-medium transition ${page === currentPage
                                    ? 'bg-pulse-blue-600 text-white'
                                    : 'text-gray-700 hover:bg-gray-100'
                                }`}
                            aria-label={`Go to page ${page}`}
                            aria-current={page === currentPage ? 'page' : undefined}
                        >
                            {page}
                        </button>
                    )}
                </React.Fragment>
            ))}

            <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`p-2 rounded-lg border border-gray-300 ${currentPage === totalPages
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                    } transition`}
                aria-label="Next page"
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </nav>
    );
}

export default Pagination;