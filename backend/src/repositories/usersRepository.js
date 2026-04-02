const { nowIso } = require("../lib/ids");

function createUsersRepository({ db }) {
  const statements = {
    findUserByToken: db.prepare(`
      SELECT user_id, display_name, global_role, access_token, created_at, updated_at
      FROM users
      WHERE access_token = ?
    `),
    findUserById: db.prepare(`
      SELECT user_id, display_name, global_role, access_token, created_at, updated_at
      FROM users
      WHERE user_id = ?
    `),
    upsertUser: db.prepare(`
      INSERT INTO users (user_id, display_name, global_role, access_token, created_at, updated_at)
      VALUES (@userId, @displayName, @globalRole, @accessToken, @createdAt, @updatedAt)
      ON CONFLICT(user_id) DO UPDATE SET
        display_name = excluded.display_name,
        updated_at = excluded.updated_at
    `),
  };

  function mapUser(row) {
    if (!row) {
      return null;
    }

    return {
      userId: row.user_id,
      displayName: row.display_name,
      globalRole: row.global_role,
      accessToken: row.access_token,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function ensureUser({ userId, displayName = userId, globalRole = "user" }) {
    const existingUser = mapUser(statements.findUserById.get(userId));
    if (existingUser) {
      return existingUser;
    }

    const createdAt = nowIso();
    const accessToken = `token_${userId}`;
    statements.upsertUser.run({
      userId,
      displayName,
      globalRole,
      accessToken,
      createdAt,
      updatedAt: createdAt,
    });

    return mapUser(statements.findUserById.get(userId));
  }

  function findUserByToken(token) {
    return mapUser(statements.findUserByToken.get(token));
  }

  function findUserById(userId) {
    return mapUser(statements.findUserById.get(userId));
  }

  return {
    ensureUser,
    findUserByToken,
    findUserById,
  };
}

module.exports = {
  createUsersRepository,
};
