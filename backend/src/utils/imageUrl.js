// backend/src/utils/imageUrl.js

/**
 * Generate image URLs for different sizes
 */
class ImageUrlGenerator {
    /**
     * Get product image URLs
     */
    static getProductImageUrls(product) {
        const baseUrl = process.env.CDN_URL || process.env.API_URL;
        const images = product.images || [];
        const mainImage = product.main_image || images[0];

        if (!mainImage) return null;

        const sizes = {
            'original': mainImage,
            'large': mainImage.replace('/originals/', '/large/'),
            'medium': mainImage.replace('/originals/', '/medium/'),
            'small': mainImage.replace('/originals/', '/small/'),
            'thumb': mainImage.replace('/originals/', '/thumbnails/'),
            'micro': mainImage.replace('/originals/', '/thumbnails/').replace('-thumb', '-micro')
        };

        return {
            original: `${baseUrl}${sizes.original}`,
            large: `${baseUrl}${sizes.large}`,
            medium: `${baseUrl}${sizes.medium}`,
            small: `${baseUrl}${sizes.small}`,
            thumbnail: `${baseUrl}${sizes.thumb}`,
            micro: `${baseUrl}${sizes.micro}`
        };
    }

    /**
     * Get user avatar URL
     */
    static getUserAvatarUrl(user, size = 'medium') {
        if (!user.avatar) {
            return `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name + ' ' + user.last_name)}&size=200&background=1E3A8A&color=FFFFFF`;
        }

        const baseUrl = process.env.CDN_URL || process.env.API_URL;

        const sizes = {
            'original': user.avatar,
            'large': user.avatar.replace('/avatars/', '/avatars/large/'),
            'medium': user.avatar.replace('/avatars/', '/avatars/medium/'),
            'small': user.avatar.replace('/avatars/', '/avatars/small/'),
            'thumb': user.avatar.replace('/avatars/', '/avatars/thumbnails/')
        };

        return `${baseUrl}${sizes[size] || sizes.original}`;
    }

    /**
     * Get listing image URLs
     */
    static getListingImageUrls(listing, index = 0) {
        const images = listing.images || [];
        const image = images[index] || images[0];

        if (!image) return null;

        const baseUrl = process.env.CDN_URL || process.env.API_URL;

        const sizes = {
            'original': image,
            'large': image.replace('/originals/', '/large/'),
            'medium': image.replace('/originals/', '/medium/'),
            'small': image.replace('/originals/', '/small/'),
            'thumb': image.replace('/originals/', '/thumbnails/')
        };

        return {
            original: `${baseUrl}${sizes.original}`,
            large: `${baseUrl}${sizes.large}`,
            medium: `${baseUrl}${sizes.medium}`,
            small: `${baseUrl}${sizes.small}`,
            thumbnail: `${baseUrl}${sizes.thumb}`
        };
    }

    /**
     * Generate responsive image srcset
     */
    static getSrcSet(imageUrls) {
        if (!imageUrls) return '';
        return `
            ${imageUrls.thumbnail} 200w,
            ${imageUrls.small} 600w,
            ${imageUrls.medium} 1200w,
            ${imageUrls.large} 1920w
        `.trim();
    }

    /**
     * Generate image with WebP fallback
     */
    static getPictureElement(imageUrls, alt = '', className = '') {
        if (!imageUrls) return '';
        return `
            <picture class="${className}">
                <source srcset="${imageUrls.original}" type="image/webp">
                <source srcset="${imageUrls.original.replace('.webp', '.jpg')}" type="image/jpeg">
                <img src="${imageUrls.original}" alt="${alt}" loading="lazy">
            </picture>
        `;
    }
}

module.exports = ImageUrlGenerator;