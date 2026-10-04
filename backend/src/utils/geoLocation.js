// backend/src/utils/geoLocation.js

/**
 * GeoLocation Utility
 */
class GeoLocation {
    /**
     * Calculate distance between two coordinates (Haversine formula)
     */
    static calculateDistance(lat1, lon1, lat2, lon2, unit = 'km') {
        const R = unit === 'km' ? 6371 : 3959; // Earth's radius
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Convert degrees to radians
     */
    static toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Convert radians to degrees
     */
    static toDegrees(radians) {
        return radians * (180 / Math.PI);
    }

    /**
     * Get bounding box for a radius
     */
    static getBoundingBox(lat, lon, radius, unit = 'km') {
        const R = unit === 'km' ? 6371 : 3959;
        const radLat = this.toRadians(lat);
        const radLon = this.toRadians(lon);
        const radRadius = radius / R;

        const minLat = lat - this.toDegrees(radRadius);
        const maxLat = lat + this.toDegrees(radRadius);
        const minLon = lon - this.toDegrees(radRadius / Math.cos(radLat));
        const maxLon = lon + this.toDegrees(radRadius / Math.cos(radLat));

        return {
            minLat,
            maxLat,
            minLon,
            maxLon,
        };
    }

    /**
     * Validate coordinates
     */
    static isValidCoordinates(lat, lon) {
        return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    }

    /**
     * Format coordinates as string
     */
    static formatCoordinates(lat, lon, format = 'decimal') {
        if (format === 'decimal') {
            return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        }
        if (format === 'dms') {
            const latDms = this.toDMS(lat);
            const lonDms = this.toDMS(lon);
            return `${latDms}, ${lonDms}`;
        }
        return `${lat}, ${lon}`;
    }

    /**
     * Convert decimal to DMS
     */
    static toDMS(decimal) {
        const degrees = Math.floor(Math.abs(decimal));
        const minutes = Math.floor((Math.abs(decimal) - degrees) * 60);
        const seconds = ((Math.abs(decimal) - degrees - minutes / 60) * 3600).toFixed(2);
        const direction = decimal >= 0 ? 'N' : 'S';
        return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
    }

    /**
     * Get distance between two addresses (using geocoding API)
     */
    static async getDistanceBetweenAddresses(address1, address2) {
        // This would typically use a geocoding API
        // Implement with Google Maps API, Mapbox, or similar
        throw new Error('Geocoding API not implemented');
    }

    /**
     * Get coordinates from address (geocoding)
     */
    static async geocodeAddress(address) {
        // This would typically use a geocoding API
        // Implement with Google Maps API, Mapbox, or similar
        throw new Error('Geocoding API not implemented');
    }

    /**
     * Get address from coordinates (reverse geocoding)
     */
    static async reverseGeocode(lat, lon) {
        // This would typically use a geocoding API
        // Implement with Google Maps API, Mapbox, or similar
        throw new Error('Reverse geocoding API not implemented');
    }

    /**
     * Calculate midpoint between two coordinates
     */
    static getMidpoint(lat1, lon1, lat2, lon2) {
        const latMid = (lat1 + lat2) / 2;
        const lonMid = (lon1 + lon2) / 2;
        return { lat: latMid, lon: lonMid };
    }

    /**
     * Generate random coordinates within a radius
     */
    static getRandomCoordinates(lat, lon, radius, unit = 'km') {
        const R = unit === 'km' ? 6371 : 3959;
        const u = Math.random();
        const v = Math.random();
        const w = R * Math.sqrt(u);
        const t = 2 * Math.PI * v;
        const x = w * Math.cos(t);
        const y = w * Math.sin(t);
        const newLat = lat + (y / R) * (180 / Math.PI);
        const newLon = lon + (x / (R * Math.cos(this.toRadians(lat)))) * (180 / Math.PI);
        return { lat: newLat, lon: newLon };
    }
}

module.exports = GeoLocation;