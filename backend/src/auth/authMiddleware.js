const { createHttpError } = require("../lib/errors");

function parseBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== "string") {
    return null;
  }

  const [scheme, token] = headerValue.split(/\s+/, 2);
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token.trim();
}

/**
 * Authorization is centralized here so every protected route gets the same
 * behavior and error codes. The debug x-user-id fallback stays opt-in via
 * config to avoid breaking the existing frontend/demo flow during transition.
 */
function createRequireAuthMiddleware({ authService, allowDebugUserHeader }) {
  return (req, _res, next) => {
    try {
      const bearerToken = parseBearerToken(req.header("authorization"));
      if (bearerToken) {
        req.auth = authService.authenticateAccessToken(bearerToken);
        return next();
      }

      if (allowDebugUserHeader) {
        const debugUserId = (req.header("x-user-id") || "").trim();
        if (debugUserId) {
          req.auth = authService.authenticateDebugUser(debugUserId);
          return next();
        }
      }

      throw createHttpError(401, "AUTH_REQUIRED", "authorization token is required");
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { createRequireAuthMiddleware };
