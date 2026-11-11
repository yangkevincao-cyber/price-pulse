// frontend/src/hooks/useProduct.js
import { useQuery } from 'react-query';
import api from '../services/api';

/**
 * Fetch a single product by ID
 */
export function useProduct(productId) {
    const { data, isLoading, error, refetch } = useQuery(
        ['product', productId],
        () => api.get(/products/).then(res => res.data.data),
        {
            enabled: !!productId,
            staleTime: 5 * 60 * 1000, // 5 minutes
            cacheTime: 10 * 60 * 1000,
        }
    );

    return {
        product: data?.product || data || null,
        pricePrediction: data?.price_prediction || null,
        similarProducts: data?.similar_products || [],
        loading: isLoading,
        error,
        refetch,
    };
}

/**
 * Fetch a product by slug
 */
export function useProductBySlug(slug) {
    const { data, isLoading, error, refetch } = useQuery(
        ['product', 'slug', slug],
        () => api.get('/products/slug/').then(res => res.data.data),
        {
            enabled: !!slug,
            staleTime: 5 * 60 * 1000,
        }
    );

    return {
        product: data?.product || null,
        pricePrediction: data?.price_prediction || null,
        loading: isLoading,
        error,
        refetch,
    };
}

export default useProduct;
