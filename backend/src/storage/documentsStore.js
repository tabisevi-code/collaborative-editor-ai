const documentsById = new Map();

function cloneDocument(doc) {
  return { ...doc };
}

function insertDocument(doc) {
  const record = cloneDocument(doc);
  documentsById.set(record.documentId, record);
  return cloneDocument(record);
}

function getDocument(documentId) {
  const record = documentsById.get(documentId);
  return record ? cloneDocument(record) : null;
}

function resetDocumentsStore() {
  documentsById.clear();
}

module.exports = {
  insertDocument,
  getDocument,
  resetDocumentsStore,
};
