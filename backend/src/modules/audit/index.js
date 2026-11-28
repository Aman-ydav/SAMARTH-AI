/** Public API of the audit module (FS-42). Other modules append and verify audit entries only through this file. */
export { createAuditRouter } from "./audit.routes.js";
export {
    appendAudit,
    canonicalJson,
    checkChainSegment,
    computeAuditHash,
    verifyAuditChain,
} from "./audit.service.js";
export { AuditLog } from "./auditLog.model.js";
