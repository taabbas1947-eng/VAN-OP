/* C2M tests: the throwaway test database (push 10k, audit C-27, 21 Nov 2026).
 *
 * RUNS ONLY AGAINST A THROWAWAY DATABASE. Every route test empties it and builds it again from C2M's migrations.
 * Never point it at van_platform on XAMPP or at production.
 *
 *   C2M_TEST_DB=throwaway C2M_TEST_DATABASE_URL=mysql://root:@127.0.0.1:3306/c2m_test node apps/c2m/tests/run.js
 *
 * The database name must end in _test, and the database must already exist (CREATE DATABASE c2m_test in phpMyAdmin).
 * It holds the 3 platform tables C2M reads, in their smallest form (auth_users, user_module_roles, app_state), then C2M's
 * migrations 001 onwards (the local files, never the .PRODUCTION ones), then 5 test people, 4 of them with a C2M role. */
const fs = require('fs'), path = require('path');
const mysql = require('mysql2/promise');

function target() {
  const refuse = why => { console.error('Refusing: ' + why + ' Set C2M_TEST_DB=throwaway and C2M_TEST_DATABASE_URL=mysql://user:pass@127.0.0.1:3306/<name ending _test>. See apps/c2m/tests/README.md.'); process.exit(2); };
  if (process.env.C2M_TEST_DB !== 'throwaway') refuse('C2M_TEST_DB is not "throwaway".');
  let u; try { u = new URL(process.env.C2M_TEST_DATABASE_URL || ''); } catch (e) { refuse('C2M_TEST_DATABASE_URL is not a URL.'); }
  const database = decodeURIComponent(u.pathname.replace(/^\//, ''));
  if (u.protocol !== 'mysql:' || u.search || u.hash || !/^\w+_test$/.test(database)) refuse('the database name must end in _test (and no ?options).');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!['localhost', '127.0.0.1', '::1'].includes(host) && process.env.C2M_TEST_ALLOW_REMOTE !== '1') refuse('the database must be on this computer (localhost); C2M_TEST_ALLOW_REMOTE=1 allows another host.');
  return { host, port: u.port ? +u.port : 3306, user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database, dateStrings: true };
}

/** A pool on the test database, like server.js's C2M pool (dateStrings), with n connections. */
function pool(n) { return mysql.createPool({ ...target(), connectionLimit: n || 5 }); }

const PLATFORM = `
CREATE TABLE auth_users (username VARCHAR(64) NOT NULL PRIMARY KEY, name VARCHAR(120) DEFAULT NULL, active TINYINT DEFAULT 1) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE user_module_roles (username VARCHAR(64) NOT NULL, module VARCHAR(32) NOT NULL, role VARCHAR(64) DEFAULT NULL, PRIMARY KEY (username, module)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE app_state (id INT NOT NULL PRIMARY KEY, data LONGTEXT DEFAULT NULL, rev INT DEFAULT 0, updated_at DATETIME DEFAULT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO auth_users (username, name) VALUES ('tahir','Tahir Abbas'),('yawar','Yawar'),('ali','Muhammad Ali'),('saad','Saad Jamal'),('majid','Majid');
INSERT INTO user_module_roles (username, module, role) VALUES ('tahir','c2m','coo'),('yawar','c2m','cfo'),('ali','c2m','viewer'),('saad','c2m','viewer');`;

/** Empties the test database and builds it again: platform tables, every C2M migration in order, the test people. */
async function fresh() {
  const c = await mysql.createConnection({ ...target(), multipleStatements: true });
  try {
    const [t] = await c.query('SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()');
    await c.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const { t: name } of t) await c.query('DROP TABLE `' + name + '`');
    await c.query('SET FOREIGN_KEY_CHECKS = 1');
    await c.query(PLATFORM);
    const dir = path.join(__dirname, '..', 'migrations');
    for (const f of fs.readdirSync(dir).filter(f => /^\d{3}_.*\.sql$/.test(f) && !/PRODUCTION/.test(f)).sort()) {
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      const code = sql.replace(/\/\*(?!!)[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, ''); // comments may say anything; /*! ... */ is run, so it is kept
      if (/(^|;)\s*USE\s+\w/im.test(code) || /`?\b(van_platform|jodilkah_\w+)`?\s*\./i.test(code)) throw new Error('migration ' + f + ' names a database; the tests run it only on the test database.');
      try { await c.query(sql); } catch (e) { throw new Error('migration ' + f + ': ' + e.message); }
      const [[now]] = await c.query('SELECT DATABASE() AS d'); if (now.d !== target().database) throw new Error('migration ' + f + ' moved to another database (' + now.d + '); stopped.');
    }
  } finally { await c.end(); }
}

module.exports = { target, pool, fresh };
if (require.main === module) fresh().then(() => console.log('test database built: ' + target().database)).catch(e => { console.error(e.message); process.exit(1); });
