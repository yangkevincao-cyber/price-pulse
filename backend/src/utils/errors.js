// backend/src/utils/errors.js

/**
 * Base Error class
 */
class BaseError extends Error {
    constructor(message, statusCode, code, details = null) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * 400 - Bad Request Error
 */
class BadRequestError extends BaseError {
    constructor(message = 'Bad request', code = 'BAD_REQUEST', details = null) {
        super(message, 400, code, details);
    }
}

/**
 * 401 - Unauthorized Error
 */
class UnauthorizedError extends BaseError {
    constructor(message = 'Unauthorized', code = 'UNAUTHORIZED', details = null) {
        super(message, 401, code, details);
    }
}

/**
 * 403 - Forbidden Error
 */
class ForbiddenError extends BaseError {
    constructor(message = 'Forbidden', code = 'FORBIDDEN', details = null) {
        super(message, 403, code, details);
    }
}

/**
 * 404 - Not Found Error
 */
class NotFoundError extends BaseError {
    constructor(message = 'Resource not found', code = 'NOT_FOUND', details = null) {
        super(message, 404, code, details);
    }
}

/**
 * 409 - Conflict Error
 */
class ConflictError extends BaseError {
    constructor(message = 'Resource conflict', code = 'CONFLICT', details = null) {
        super(message, 409, code, details);
    }
}

/**
 * 422 - Validation Error
 */
class ValidationError extends BaseError {
    constructor(message = 'Validation error', code = 'VALIDATION_ERROR', details = null) {
        super(message, 422, code, details);
    }
}

/**
 * 429 - Too Many Requests Error
 */
class TooManyRequestsError extends BaseError {
    constructor(message = 'Too many requests', code = 'TOO_MANY_REQUESTS', details = null) {
        super(message, 429, code, details);
    }
}

/**
 * 500 - Internal Server Error
 */
class InternalServerError extends BaseError {
    constructor(message = 'Internal server error', code = 'INTERNAL_ERROR', details = null) {
        super(message, 500, code, details);
    }
}

/**
 * 503 - Service Unavailable Error
 */
class ServiceUnavailableError extends BaseError {
    constructor(message = 'Service unavailable', code = 'SERVICE_UNAVAILABLE', details = null) {
        super(message, 503, code, details);
    }
}

/**
 * Business Logic Errors
 */
class BusinessError extends BaseError {
    constructor(message = 'Business rule violation', code = 'BUSINESS_ERROR', details = null) {
        super(message, 400, code, details);
    }
}

/**
 * Payment Error
 */
class PaymentError extends BaseError {
    constructor(message = 'Payment processing error', code = 'PAYMENT_ERROR', details = null) {
        super(message, 400, code, details);
    }
}

/**
 * Fraud Detection Error
 */
class FraudError extends BaseError {
    constructor(message = 'Fraud detected', code = 'FRAUD_DETECTED', details = null) {
        super(message, 403, code, details);
    }
}

module.exports = {
    BaseError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    ValidationError,
    TooManyRequestsError,
    InternalServerError,
    ServiceUnavailableError,
    BusinessError,
    PaymentError,
    FraudError,
};