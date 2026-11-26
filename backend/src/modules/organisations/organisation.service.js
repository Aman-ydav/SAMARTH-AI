import mongoose from "mongoose";
import { DEFAULT_ORG_ID } from "#constants/org.js";
import { AUDIT_ACTIONS } from "#constants/auditActions.js";
import { ERROR_CODES } from "#constants/errorCodes.js";
import { SESSION_REVOKED_REASONS } from "#constants/statuses.js";
import { withTransaction } from "#db/transaction.js";
import { appendAudit } from "#modules/audit/index.js";
import { User } from "#modules/users/index.js";
import { ApiError } from "#utils/apiError.js";
import { escapeRegex, toObjectId } from "#utils/mongo.js";
import { ne } from "#utils/mongoOps.js";
import { buildPageMeta, parsePagination } from "#utils/pagination.js";
import { normalizeEmail } from "#utils/strings.js";
import { Organisation } from "./organisation.model.js";

const DEFAULT_ORGANISATION = Object.freeze({
    name: "SAMARTH AI",
    nameKey: "samarth ai",
    code: "default",
});
const ORGANISATION_SORTS = Object.freeze({
    name: "nameKey",
    code: "code",
    createdAt: "createdAt",
});

const isDuplicateKey = (error) => error?.code === 11000;
const unavailable = () =>
    ApiError.forbidden(ERROR_CODES.ORGANISATION_UNAVAILABLE);
const normaliseName = (value) =>
    value.trim().normalize("NFKC").replace(/\s+/g, " ").toLowerCase();

export function toOrganisationView(organisation) {
    const plain =
        typeof organisation.toObject === "function"
            ? organisation.toObject()
            : organisation;
    return {
        id: String(plain._id ?? plain.id),
        name: plain.name,
        code: plain.code,
        settings: {
            allowSelfRegistration: plain.settings.allowSelfRegistration,
            allowedEmailDomains: [...plain.settings.allowedEmailDomains],
            requireEmailVerification:
                plain.settings.requireEmailVerification,
            allowGoogleLogin: plain.settings.allowGoogleLogin,
        },
        active: plain.deletedAt === null || plain.deletedAt === undefined,
        version: plain.__v ?? 0,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
    };
}

/** Idempotent bootstrap for the stable tenant used by existing accounts. */
export async function ensureDefaultOrganisation() {
    const organisation = await Organisation.findByIdAndUpdate(
        DEFAULT_ORG_ID,
        {
            $setOnInsert: {
                ...DEFAULT_ORGANISATION,
                settings: {
                    allowSelfRegistration: true,
                    allowedEmailDomains: [],
                    requireEmailVerification: true,
                    allowGoogleLogin: true,
                },
            },
            $set: { deletedAt: null },
        },
        {
            upsert: true,
            returnDocument: "after",
            runValidators: true,
            setDefaultsOnInsert: true,
            withDeleted: true,
        }
    );
    return toOrganisationView(organisation);
}

export async function getActiveOrganisationById(id) {
    return Organisation.findById(toObjectId(id));
}

export async function assertOrganisationActive(id) {
    const organisation = await getActiveOrganisationById(id);
    if (!organisation)
        throw ApiError.forbidden(ERROR_CODES.ORGANISATION_INACTIVE);
    return organisation;
}

export function assertOrganisationEmailAllowed(email, organisation) {
    const allowed = organisation.settings.allowedEmailDomains;
    if (allowed.length === 0) return;
    const domain = normalizeEmail(email).split("@").pop();
    if (allowed.some((item) => domain === item || domain.endsWith(`.${item}`)))
        return;
    throw ApiError.forbidden(ERROR_CODES.DOMAIN_NOT_ALLOWED, {
        errors: [
            {
                field: "email",
                message: "This email domain is not allowed.",
                code: ERROR_CODES.DOMAIN_NOT_ALLOWED,
            },
        ],
    });
}

export async function resolveOrganisationForSignup({
    organisationCode,
    email,
}) {
    const organisation = organisationCode
        ? await Organisation.findOne({
              code: organisationCode.trim().toLowerCase(),
          })
        : await Organisation.findById(DEFAULT_ORG_ID);
    if (!organisation || !organisation.settings.allowSelfRegistration)
        throw unavailable();
    assertOrganisationEmailAllowed(email, organisation);
    return organisation;
}

export async function assertGoogleLoginAllowed(id) {
    const organisation = await assertOrganisationActive(id);
    if (!organisation.settings.allowGoogleLogin)
        throw ApiError.forbidden(ERROR_CODES.FORBIDDEN);
    return organisation;
}

export async function listOrganisations(query = {}) {
    const page = parsePagination(query, {
        allowedSort: ORGANISATION_SORTS,
        defaultSort: "name",
        defaultOrder: "asc",
    });
    const filter = {
        ...(query.status === "active"
            ? { deletedAt: null }
            : query.status === "inactive"
              ? { deletedAt: ne(null) }
              : {}),
        ...(query.q
            ? {
                  $or: [
                      {
                          nameKey: new RegExp(
                              `^${escapeRegex(normaliseName(query.q))}`
                          ),
                      },
                      {
                          code: new RegExp(
                              `^${escapeRegex(query.q.toLowerCase())}`
                          ),
                      },
                  ],
              }
            : {}),
    };
    const [rows, total] = await Promise.all([
        Organisation.find(filter)
            .setOptions({ withDeleted: true })
            .sort(page.sort)
            .skip(page.skip)
            .limit(page.limit)
            .lean(),
        Organisation.countDocuments(filter).setOptions({
            withDeleted: true,
        }),
    ]);
    return {
        items: rows.map(toOrganisationView),
        meta: buildPageMeta({ page: page.page, limit: page.limit, total }),
    };
}

export async function createOrganisation(input, actor, now = new Date()) {
    const document = {
        name: input.name.trim().normalize("NFKC").replace(/\s+/g, " "),
        nameKey: normaliseName(input.name),
        code: input.code.trim().toLowerCase(),
        settings: input.settings,
    };
    try {
        return await withTransaction(async (session) => {
            const [organisation] = await Organisation.create([document], {
                session,
            });
            await appendAudit(
                {
                    actorId: actor.userId,
                    orgId: actor.orgId,
                    action: AUDIT_ACTIONS.ORGANISATION_CREATED,
                    entityType: "organisation",
                    entityId: organisation._id,
                },
                { session, now }
            );
            return toOrganisationView(organisation);
        });
    } catch (error) {
        if (isDuplicateKey(error)) throw ApiError.conflict(ERROR_CODES.CONFLICT);
        throw error;
    }
}

export async function updateOrganisation(
    id,
    input,
    actor,
    now = new Date()
) {
    try {
        return await withTransaction(async (session) => {
            const organisation = await Organisation.findById(
                toObjectId(id)
            ).session(session);
            if (!organisation)
                throw ApiError.notFound(ERROR_CODES.NOT_FOUND);
            if (organisation.__v !== input.expectedVersion)
                throw ApiError.conflict(ERROR_CODES.CONFLICT);

            const fields = [];
            if (input.name !== undefined) {
                organisation.name = input.name
                    .trim()
                    .normalize("NFKC")
                    .replace(/\s+/g, " ");
                organisation.nameKey = normaliseName(input.name);
                fields.push("name");
            }
            if (input.code !== undefined) {
                organisation.code = input.code.trim().toLowerCase();
                fields.push("code");
            }
            if (input.settings !== undefined) {
                organisation.settings = {
                    ...organisation.settings.toObject(),
                    ...input.settings,
                };
                fields.push("settings");
            }

            await organisation.save({ session });
            await appendAudit(
                {
                    actorId: actor.userId,
                    orgId: actor.orgId,
                    action: AUDIT_ACTIONS.ORGANISATION_UPDATED,
                    entityType: "organisation",
                    entityId: organisation._id,
                    meta: { fields },
                },
                { session, now }
            );
            return toOrganisationView(organisation);
        });
    } catch (error) {
        if (isDuplicateKey(error)) throw ApiError.conflict(ERROR_CODES.CONFLICT);
        if (error instanceof mongoose.Error.VersionError)
            throw ApiError.conflict(ERROR_CODES.CONFLICT);
        throw error;
    }
}

export async function deactivateOrganisation(id, actor, now = new Date()) {
    const objectId = toObjectId(id);
    if (String(objectId) === DEFAULT_ORG_ID)
        throw ApiError.conflict(ERROR_CODES.CONFLICT);
    return withTransaction(async (session) => {
        const organisation = await Organisation.findById(objectId).session(
            session
        );
        if (!organisation) {
            const deleted = await Organisation.findById(objectId)
                .setOptions({ withDeleted: true })
                .session(session);
            if (!deleted) throw ApiError.notFound(ERROR_CODES.NOT_FOUND);
            throw ApiError.conflict(ERROR_CODES.CONFLICT);
        }
        organisation.deletedAt = now;
        await organisation.save({ session });
        await User.updateMany(
            { orgId: organisation._id },
            { $inc: { tokenVersion: 1 } },
            { session, runValidators: true }
        );
        await mongoose.model("RefreshSession").updateMany(
            { orgId: organisation._id, revokedAt: null },
            {
                $set: {
                    revokedAt: now,
                    revokedReason: SESSION_REVOKED_REASONS.ADMIN,
                },
            },
            { session }
        );
        await appendAudit(
            {
                actorId: actor.userId,
                orgId: actor.orgId,
                action: AUDIT_ACTIONS.ORGANISATION_DEACTIVATED,
                entityType: "organisation",
                entityId: organisation._id,
                meta: { organisationId: String(organisation._id) },
            },
            { session, now }
        );
        return toOrganisationView(organisation);
    });
}

export async function restoreOrganisation(id, actor, now = new Date()) {
    try {
        return await withTransaction(async (session) => {
            const organisation = await Organisation.findById(toObjectId(id))
                .setOptions({ withDeleted: true })
                .session(session);
            if (!organisation)
                throw ApiError.notFound(ERROR_CODES.NOT_FOUND);
            if (
                organisation.deletedAt === null ||
                organisation.deletedAt === undefined
            )
                throw ApiError.conflict(ERROR_CODES.CONFLICT);
            organisation.deletedAt = null;
            await organisation.save({ session });
            await appendAudit(
                {
                    actorId: actor.userId,
                    orgId: actor.orgId,
                    action: AUDIT_ACTIONS.ORGANISATION_RESTORED,
                    entityType: "organisation",
                    entityId: organisation._id,
                    meta: { organisationId: String(organisation._id) },
                },
                { session, now }
            );
            return toOrganisationView(organisation);
        });
    } catch (error) {
        if (isDuplicateKey(error)) throw ApiError.conflict(ERROR_CODES.CONFLICT);
        if (error instanceof mongoose.Error.VersionError)
            throw ApiError.conflict(ERROR_CODES.CONFLICT);
        throw error;
    }
}
