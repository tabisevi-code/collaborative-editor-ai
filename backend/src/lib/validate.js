const { sendError } = require("./errors");

function formatIssue(issue) {
  return {
    path: issue.path.length > 0 ? issue.path.join(".") : "(root)",
    message: issue.message,
    code: issue.code,
  };
}

function validateBody(schema) {
  return (req, res, next) => {
    if (req.body === null || typeof req.body !== "object" || Array.isArray(req.body)) {
      return sendError(res, 400, "INVALID_INPUT", "request body must be a JSON object");
    }

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const issues = parsed.error.issues.map(formatIssue);
      return sendError(res, 400, "INVALID_INPUT", "invalid request body", {
        issues,
      });
    }

    req.validatedBody = parsed.data;
    return next();
  };
}

module.exports = { validateBody };
