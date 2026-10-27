import { z } from "zod";
import { INVITE_BODY_ROLES, ROLE_LIST } from "#constants/roles.js";
import {
    INVITE_STATUS_LIST,
    USER_STATUS_LIST,
    USER_STATUSES,
} from "#constants/statuses.js";
import { paginationQueryShape } from "#utils/pagination.js";
import { hasControlCharacters } from "#utils/strings.js";
import { ASSIGNABLE_ROLES, SEARCH_MAX_LENGTH } from "./admin.constants.js";

// Request schemas for /admin (BE-23). validate() makes them strict, so `orgId`, `invitedBy`, `status` or `tokenId` in a body are refused.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

const email = z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(254)
    .refine((value) => EMAIL_PATTERN.test(value), "Enter a valid email address")
    .refine((value) => !hasControlCharacters(value), "Invalid characters");

/** Ids in the path are checked by the services (`toObjectId` answers 400 INVALID_ID); here only the shape and size. */
export const idParams = z.object({ id: z.string().min(1).max(64) });

export const createInviteBody = z.object({
    email,
    role: z.enum(INVITE_BODY_ROLES),
    departmentId: z
        .string()
        .regex(OBJECT_ID_PATTERN, "Invalid identifier")
        .optional(),
});

export const listInvitesQuery = z.object({
    ...paginationQueryShape,
    status: z.enum(INVITE_STATUS_LIST).optional(),
});

export const listUsersQuery = z.object({
    ...paginationQueryShape,
    role: z.enum(ROLE_LIST).optional(),
    status: z.enum(USER_STATUS_LIST).optional(),
    q: z
        .string()
        .trim()
        .min(1)
        .max(SEARCH_MAX_LENGTH)
        .refine((value) => !hasControlCharacters(value), "Invalid characters")
        .optional(),
});

export const setStatusBody = z.object({
    status: z.enum([USER_STATUSES.ACTIVE, USER_STATUSES.SUSPENDED]),
});

export const changeRoleBody = z.object({ role: z.enum(ASSIGNABLE_ROLES) });
