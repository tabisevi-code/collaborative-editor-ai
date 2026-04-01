const { createHttpError } = require("../lib/errors");
const { logInfo } = require("../lib/logger");

function createAuthService({ repository, authTokenTtlSeconds }) {
  return {
    login({ userId, displayName }) {
      const globalRole = userId.startsWith("admin") ? "admin" : "user";
      const user = repository.ensureUser({
        userId,
        displayName: displayName || userId,
        globalRole,
      });

      logInfo("auth_login", {
        userId: user.userId,
        globalRole: user.globalRole,
      });

      return {
        userId: user.userId,
        displayName: user.displayName,
        globalRole: user.globalRole,
        accessToken: user.accessToken,
        expiresIn: authTokenTtlSeconds,
      };
    },

    authenticateAccessToken(accessToken) {
      const user = repository.findUserByToken(accessToken);
      if (!user) {
        throw createHttpError(401, "AUTH_FAILED", "invalid access token");
      }

      return user;
    },

    authenticateDebugUser(userId) {
      return repository.ensureUser({
        userId,
        displayName: userId,
        globalRole: userId.startsWith("admin") ? "admin" : "user",
      });
    },
  };
}

module.exports = { createAuthService };
