/**
 * Wraps an async handler or middleware: a rejection or sync throw goes to `next`. It never sends a response itself (BE-22).
 */
export const asyncHandler = (handler) => (req, res, next) => {
    try {
        Promise.resolve(handler(req, res, next)).catch(next);
    } catch (error) {
        next(error);
    }
};
