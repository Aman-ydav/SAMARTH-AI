import { ensureDefaultOrganisation } from "#modules/organisations/index.js";

export async function seed({ log }) {
    const organisation = await ensureDefaultOrganisation();
    log.info({ organisationId: organisation.id }, "default organisation ensured");
    return { organisationId: organisation.id };
}
