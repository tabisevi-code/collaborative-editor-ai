const { makeId, nowIso } = require("../lib/ids");
const { insertDocument, getDocument } = require("../storage/documentsStore");

function getUserId(req) {
  const raw = (req.header("x-user-id") || "").trim();
  return raw.length > 0 ? raw : "user_poc";
}

function computeRole(userId, doc) {
  return userId === doc.ownerId ? "owner" : "viewer";
}

function createDocument({ title, content }, ownerId) {
  const createdAt = nowIso();

  const doc = {
    documentId: makeId("doc"),
    title,
    content,
    ownerId,
    createdAt,
    updatedAt: createdAt,
    currentVersionId: "ver_1",
    revisionId: "rev_1",
  };

  return insertDocument(doc);
}

function fetchDocument(documentId) {
  return getDocument(documentId);
}

module.exports = {
  getUserId,
  computeRole,
  createDocument,
  fetchDocument,
};
