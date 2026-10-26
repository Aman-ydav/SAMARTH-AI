import mongoose from "mongoose";

// connectDb() turns on Mongoose `sanitizeFilter` (BE-62), which neutralises `{ $gt: ... }` objects in filters. These
// helpers mark operators that WE write (never request input) as trusted, so server-built filters keep working.
const trusted = (operators) => mongoose.trusted(operators);

/** `{ field: gt(date) }` means field > date. Use only with server-computed values. */
export const gt = (value) => trusted({ $gt: value });
export const gte = (value) => trusted({ $gte: value });
export const lt = (value) => trusted({ $lt: value });
export const lte = (value) => trusted({ $lte: value });
export const ne = (value) => trusted({ $ne: value });
export const anyOf = (values) => trusted({ $in: values });
export const noneOf = (values) => trusted({ $nin: values });
