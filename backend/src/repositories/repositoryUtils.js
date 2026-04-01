function parseJson(rawValue, fallbackValue = null) {
  if (!rawValue) {
    return fallbackValue;
  }

  return JSON.parse(rawValue);
}

function getEffectiveRole(user, storedRole, ownerUserId) {
  if (user.globalRole === "admin") {
    return ownerUserId === user.userId ? "owner" : "editor";
  }

  if (ownerUserId === user.userId) {
    return "owner";
  }

  if (storedRole === "owner" || storedRole === "editor" || storedRole === "viewer") {
    return storedRole;
  }

  return null;
}

module.exports = {
  parseJson,
  getEffectiveRole,
};
