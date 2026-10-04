// frontend/src/hooks/useAuth.js
import { useAuthStore } from '../store';

export const useAuth = () => {
    const {
        user,
        isAuthenticated,
        token,
        login,
        register,
        logout,
        updateProfile,
        loading
    } = useAuthStore();

    const isSeller = user?.role === 'seller';
    const isAdmin = user?.role === 'admin';
    const isBuyer = user?.role === 'buyer' || !user?.role;

    return {
        user,
        isAuthenticated,
        token,
        isSeller,
        isAdmin,
        isBuyer,
        loading,
        login,
        register,
        logout,
        updateProfile,
    };
};

export default useAuth;