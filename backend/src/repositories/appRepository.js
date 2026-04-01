const { resetBusinessTables } = require("../db/schema");
const { createAiRepository } = require("./aiRepository");
const { createDocumentsRepository } = require("./documentsRepository");
const { createExportsRepository } = require("./exportsRepository");
const { createPermissionsRepository } = require("./permissionsRepository");
const { createUsersRepository } = require("./usersRepository");

/**
 * Services still depend on one repository facade today, but the SQL is now
 * grouped by domain so each persistence area is easier to reason about.
 */
function createAppRepository(db) {
  const usersRepository = createUsersRepository({ db });
  const documentsRepository = createDocumentsRepository({ db });
  const permissionsRepository = createPermissionsRepository({
    db,
    ensureUser: usersRepository.ensureUser,
  });
  const aiRepository = createAiRepository({ db });
  const exportsRepository = createExportsRepository({ db });

  return {
    db,
    ...usersRepository,
    ...documentsRepository,
    ...permissionsRepository,
    ...aiRepository,
    ...exportsRepository,
    resetForTests() {
      resetBusinessTables(db);
    },
    close() {
      db.close();
    },
  };
}

module.exports = { createAppRepository };
