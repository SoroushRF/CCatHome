/**
 * Test isolation helpers (remediation R7.1).
 * Prefer these over reaching into core modules ad hoc from suites.
 */
export { resetRulesCache } from "../core/permission-gate.js";
export { closeDb, resetDbForTests, getDb } from "../core/db.js";
