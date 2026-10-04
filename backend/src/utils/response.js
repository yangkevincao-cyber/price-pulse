// backend/src/utils/response.js

/**
 * Success Response
 */
const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString(),
    });
};

/**
 * Created Response
 */
const createdResponse = (res, data = null, message = 'Resource created successfully') => {
    return successResponse(res, data, message, 201);
};

/**
 * No Content Response
 */
const noContentResponse = (res) => {
    return res.status(204).send();
};

/**
 * Error Response
 */
const errorResponse = (res, error, statusCode = 500) => {
    const message = error.message || 'Internal server error';
    const code = error.code || 'INTERNAL_ERROR';
    const details = error.details || null;

    return res.status(statusCode).json({
        success: false,
        error: message,
        code,
        details,
        timestamp: new Date().toISOString(),
    });
};

/**
 * Bad Request Response
 */
const badRequestResponse = (res, message = 'Bad request', details = null) => {
    return errorResponse(res, { message, code: 'BAD_REQUEST', details }, 400);
};

/**
 * Unauthorized Response
 */
const unauthorizedResponse = (res, message = 'Unauthorized') => {
    return errorResponse(res, { message, code: 'UNAUTHORIZED' }, 401);
};

/**
 * Forbidden Response
 */
const forbiddenResponse = (res, message = 'Forbidden') => {
    return errorResponse(res, { message, code: 'FORBIDDEN' }, 403);
};

/**
 * Not Found Response
 */
const notFoundResponse = (res, message = 'Resource not found') => {
    return errorResponse(res, { message, code: 'NOT_FOUND' }, 404);
};

/**
 * Conflict Response
 */
const conflictResponse = (res, message = 'Resource conflict') => {
    return errorResponse(res, { message, code: 'CONFLICT' }, 409);
};

/**
 * Validation Error Response
 */
const validationErrorResponse = (res, errors) => {
    return res.status(422).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        errors,
        timestamp: new Date().toISOString(),
    });
};

/**
 * Paginated Response
 */
const paginatedResponse = (res, data, pagination, message = 'Success') => {
    return res.status(200).json({
        success: true,
        message,
        data,
        pagination: {
            total: pagination.total,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: pagination.totalPages,
        },
        timestamp: new Date().toISOString(),
    });
};

module.exports = {
    successResponse,
    createdResponse,
    noContentResponse,
    errorResponse,
    badRequestResponse,
    unauthorizedResponse,
    forbiddenResponse,
    notFoundResponse,
    conflictResponse,
    validationErrorResponse,
    paginatedResponse,
};