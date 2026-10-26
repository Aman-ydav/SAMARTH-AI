import { setupServer } from "msw/node";
import { authHandlers } from "@/mocks/handlers/authHandlers";
import { profileHandlers } from "@/mocks/handlers/profileHandlers";

/** Node MSW server for Vitest. Tests only: never imported by application code (FE-51). */
export const server = setupServer(...authHandlers, ...profileHandlers);
