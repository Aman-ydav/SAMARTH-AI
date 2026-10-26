/**
 * Success envelope `{ statusCode, success: true, message, data, meta? }` (charter section 5).
 * Build it only with `ok`, `created`, `accepted` or `noContent`; controllers `return ApiResponse.ok(...).send(res)`.
 */
export class ApiResponse {
    constructor(statusCode, data = null, message = "OK", meta = undefined) {
        this.statusCode = statusCode;
        this.success = true;
        this.message = message;
        this.data = data;
        if (meta !== undefined) this.meta = meta;
    }

    static ok(data = null, message = "OK", meta = undefined) {
        return new ApiResponse(200, data, message, meta);
    }

    static created(data = null, message = "Created", meta = undefined) {
        return new ApiResponse(201, data, message, meta);
    }

    /** 202: accepted for async work, or a neutral anti-enumeration answer. */
    static accepted(data = null, message = "Accepted", meta = undefined) {
        return new ApiResponse(202, data, message, meta);
    }

    /** 204: no body is sent. */
    static noContent() {
        return new ApiResponse(204, null, "No Content");
    }

    /** Writes the response and returns this instance so a controller can `return` it. */
    send(res) {
        if (this.statusCode === 204) res.status(204).end();
        else res.status(this.statusCode).json(this);
        return this;
    }
}
