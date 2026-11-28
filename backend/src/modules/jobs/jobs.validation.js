import { z } from "zod";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

/** `GET /jobs/:id`: only the id, strictly an ObjectId (a bad id is a 400, never a 500; EDGE-13). */
export const jobIdParams = z.object({
    id: z.string().regex(OBJECT_ID_PATTERN),
});
