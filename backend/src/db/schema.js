const { makeId, nowIso } = require("../lib/ids");

const DEFAULT_USERS = [
  { userId: "user_1", displayName: "User One", globalRole: "user", accessToken: "token_user_1" },
  { userId: "user_2", displayName: "User Two", globalRole: "user", accessToken: "token_user_2" },
  { userId: "admin_1", displayName: "Admin One", globalRole: "admin", accessToken: "token_admin_1" },
];

function initializeSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      global_role TEXT NOT NULL CHECK (global_role IN ('user', 'admin')),
      access_token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      document_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      owner_user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      current_version_id TEXT NOT NULL,
      revision_id TEXT NOT NULL,
      FOREIGN KEY (owner_user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS document_permissions (
      document_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
      updated_at TEXT NOT NULL,
      PRIMARY KEY (document_id, user_id),
      FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS document_versions (
      version_id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      created_by_user_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      snapshot_content TEXT NOT NULL,
      base_revision_id TEXT,
      UNIQUE (document_id, version_number),
      FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE,
      FOREIGN KEY (created_by_user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      scope TEXT NOT NULL,
      request_id TEXT NOT NULL,
      response_status INTEGER NOT NULL,
      response_body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (scope, request_id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      log_id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      document_id TEXT,
      action_type TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (actor_user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS ai_policies (
      document_id TEXT PRIMARY KEY,
      ai_enabled INTEGER NOT NULL DEFAULT 1,
      allowed_roles_csv TEXT NOT NULL DEFAULT 'owner,editor',
      daily_quota INTEGER NOT NULL DEFAULT 5,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_jobs (
      job_id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
      request_json TEXT NOT NULL,
      result_json TEXT,
      error_code TEXT,
      error_message TEXT,
      base_version_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS export_jobs (
      job_id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      format TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
      result_json TEXT,
      error_code TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(document_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    );

    CREATE TABLE IF NOT EXISTS realtime_events (
      event_id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      delivered_at TEXT
    );
  `);

  const existingUsers = db.prepare("SELECT COUNT(*) AS count FROM users").get();
  if (existingUsers.count > 0) {
    return;
  }

  const insertUser = db.prepare(`
    INSERT INTO users (user_id, display_name, global_role, access_token, created_at, updated_at)
    VALUES (@userId, @displayName, @globalRole, @accessToken, @createdAt, @updatedAt)
  `);

  const seedUsers = db.transaction(() => {
    for (const user of DEFAULT_USERS) {
      const createdAt = nowIso();
      insertUser.run({
        ...user,
        createdAt,
        updatedAt: createdAt,
      });
    }
  });

  seedUsers();
}

function resetBusinessTables(db) {
  db.exec(`
    DELETE FROM realtime_events;
    DELETE FROM export_jobs;
    DELETE FROM ai_jobs;
    DELETE FROM ai_policies;
    DELETE FROM audit_logs;
    DELETE FROM idempotency_keys;
    DELETE FROM document_versions;
    DELETE FROM document_permissions;
    DELETE FROM documents;
  `);
}

function appendAuditLog(db, { actorUserId, documentId = null, actionType, metadata }) {
  db.prepare(`
    INSERT INTO audit_logs (log_id, actor_user_id, document_id, action_type, metadata_json, created_at)
    VALUES (@logId, @actorUserId, @documentId, @actionType, @metadataJson, @createdAt)
  `).run({
    logId: makeId("audit"),
    actorUserId,
    documentId,
    actionType,
    metadataJson: JSON.stringify(metadata || {}),
    createdAt: nowIso(),
  });
}

module.exports = {
  initializeSchema,
  resetBusinessTables,
  appendAuditLog,
};
