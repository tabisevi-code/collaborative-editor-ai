"use strict";

const crypto = require("node:crypto");

function makeAiJobId() {
  return `aijob_${crypto.randomBytes(6).toString("hex")}`;
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  makeAiJobId,
  nowIso,
};
