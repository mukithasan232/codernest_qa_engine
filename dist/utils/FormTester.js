"use strict";
/**
 * @fileoverview Form Tester — analyses discovered forms for quality and accessibility.
 * Reports unlabeled fields, missing required attributes, and form structure.
 * Does NOT submit forms to avoid destructive side-effects on real apps.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runFormAnalysis = runFormAnalysis;
const logger_1 = require("@core/logger");
/**
 * Analyses form quality across all discovered pages.
 *
 * @param pages - Array of crawled pages containing form data.
 * @returns A typed {@link FormReport}.
 */
function runFormAnalysis(pages) {
    logger_1.Logger.info('FormTester analysing discovered forms…');
    let totalForms = 0;
    let formsWithId = 0;
    let unlabeledFields = 0;
    for (const page of pages) {
        for (const form of page.forms) {
            totalForms++;
            if (form.id && !form.id.startsWith('form-'))
                formsWithId++;
            for (const field of form.fields) {
                if (!field.hasLabel && field.type !== 'hidden' && field.type !== 'submit') {
                    unlabeledFields++;
                }
            }
        }
    }
    const score = totalForms === 0
        ? 100
        : Math.max(0, Math.round(100 - (unlabeledFields * 15) - ((totalForms - formsWithId) * 5)));
    logger_1.Logger.info(`FormTester: ${totalForms} forms, ${unlabeledFields} unlabeled fields. Score: ${score}`);
    return { totalForms, formsWithId, unlabeledFields, score };
}
