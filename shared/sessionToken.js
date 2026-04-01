const crypto = require("crypto");

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

/**
 * The session token is intentionally simple and framework-free so both the
 * REST API and realtime service can verify the same payload without adding a
 * JWT dependency. The payload is still signed and expiry-bound.
 */
function signSessionToken(payload, secret) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token, secret) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    throw new Error("invalid session token");
  }

  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = signValue(encodedPayload, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new Error("invalid session token signature");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload));
  if (typeof payload.exp !== "number" || Date.now() > payload.exp) {
    throw new Error("session token expired");
  }

  return payload;
}

module.exports = {
  signSessionToken,
  verifySessionToken,
};
