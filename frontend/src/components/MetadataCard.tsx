import type { CreateDocumentResponse, GetDocumentResponse } from "../types/api";

type DocumentSummary = CreateDocumentResponse | GetDocumentResponse;

interface MetadataCardProps {
  document: DocumentSummary;
}

function hasOwnerId(document: DocumentSummary): document is CreateDocumentResponse {
  return "ownerId" in document;
}

/**
 * The metadata card makes backend contract fields explicit during demos, which
 * helps reviewers confirm the frontend is using the documented JSON shape.
 */
export function MetadataCard({ document }: MetadataCardProps) {
  return (
    <section className="panel metadata-card">
      <div className="panel-header">
        <h2>Document Metadata</h2>
      </div>
      <dl className="metadata-grid">
        <div>
          <dt>Document ID</dt>
          <dd>{document.documentId}</dd>
        </div>
        <div>
          <dt>Title</dt>
          <dd>{document.title}</dd>
        </div>
        <div>
          <dt>Updated At</dt>
          <dd>{document.updatedAt}</dd>
        </div>
        <div>
          <dt>Current Version ID</dt>
          <dd>{document.currentVersionId}</dd>
        </div>
        {hasOwnerId(document) ? (
          <>
            <div>
              <dt>Owner ID</dt>
              <dd>{document.ownerId}</dd>
            </div>
            <div>
              <dt>Created At</dt>
              <dd>{document.createdAt}</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>Role</dt>
              <dd>{document.role}</dd>
            </div>
            <div>
              <dt>Revision ID</dt>
              <dd>{document.revisionId}</dd>
            </div>
          </>
        )}
      </dl>
    </section>
  );
}
