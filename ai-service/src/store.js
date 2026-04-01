"use strict";

const jobsById = new Map();

function cloneSelection(selection) {
  return {
    start: selection.start,
    end: selection.end,
  };
}

/**
 * The store deliberately clones records so tests and future backend integration
 * cannot accidentally mutate shared in-memory state by reference.
 */
function cloneJobRecord(job) {
  return {
    jobId: job.jobId,
    documentId: job.documentId,
    action: job.action,
    selection: cloneSelection(job.selection),
    instruction: job.instruction,
    targetLanguage: job.targetLanguage,
    requestId: job.requestId,
    baseVersionId: job.baseVersionId,
    userId: job.userId,
    selectedText: job.selectedText,
    contextBefore: job.contextBefore,
    contextAfter: job.contextAfter,
    status: job.status,
    proposedText: job.proposedText,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function insertAiJob(job) {
  const record = cloneJobRecord(job);
  jobsById.set(record.jobId, record);
  return cloneJobRecord(record);
}

function getAiJob(jobId) {
  const record = jobsById.get(jobId);
  return record ? cloneJobRecord(record) : null;
}

function updateAiJob(jobId, updater) {
  const current = jobsById.get(jobId);
  if (!current) {
    return null;
  }

  const next = updater(cloneJobRecord(current));
  const record = cloneJobRecord(next);
  jobsById.set(jobId, record);
  return cloneJobRecord(record);
}

function resetAiJobsStore() {
  jobsById.clear();
}

module.exports = {
  insertAiJob,
  getAiJob,
  updateAiJob,
  resetAiJobsStore,
};
