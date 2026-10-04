// frontend/src/components/Common/ScrollToTop.jsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function ScrollToTop() {
    const { pathname, search, hash } = useLocation();

    useEffect(() => {
        // If there's a hash, scroll to it after a small delay
        if (hash) {
            const element = document.getElementById(hash.replace('#', ''));
            if (element) {
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth' });
                }, 100);
                return;
            }
        }

        // Otherwise scroll to top
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }, [pathname, search, hash]);

    return null;
}

export default ScrollToTop;