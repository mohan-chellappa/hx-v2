// hx-db.js
// MIT Licensed — see LICENSE in hx-v2 repo

const hxDb = (() => {
  const databases = {};
  const auditHooks = {
    onInsert: null,
    onEdit: null,
    onDelete: null,
  };

  function createDatabase(name) {
    if (!name) throw new Error("Database name required");
    if (databases[name]) return databases[name];
    databases[name] = {};
    syncToLocalStorage();
    return databases[name];
  }

  function createTable(dbName, tableName, schema = {}) {
    const db = databases[dbName] || createDatabase(dbName);
    if (!tableName) throw new Error("Table name required");
    db[tableName] = {
      schema,
      rows: [],
      index: {},
    };
    syncToLocalStorage();
    return db[tableName];
  }

  function validate(schema, row) {
    for (const key in schema) {
      if (!(key in row)) throw new Error(`Missing field: ${key}`);
      if (typeof row[key] !== schema[key]) {
        throw new Error(`Invalid type for ${key}: expected ${schema[key]}`);
      }
    }
  }

  function insert(dbName, tableName, row) {
    const table = databases[dbName]?.[tableName];
    if (!table) throw new Error(`Table ${tableName} not found in ${dbName}`);
    validate(table.schema, row);
    table.rows.push(row);
    if ("id" in row) table.index[row.id] = row;
    auditHooks.onInsert?.(row);
    syncToLocalStorage();
    return row;
  }

  function query(dbName, tableName, predicate = () => true) {
    const table = databases[dbName]?.[tableName];
    if (!table) return [];
    return table.rows.filter(predicate);
  }

  function getById(dbName, tableName, id) {
    const table = databases[dbName]?.[tableName];
    return table?.index?.[id] || null;
  }

  function edit(dbName, tableName, predicate, updater) {
    const table = databases[dbName]?.[tableName];
    if (!table) return 0;
    let count = 0;
    table.rows = table.rows.map(row => {
      if (predicate(row)) {
        const updated = updater(row);
        validate(table.schema, updated);
        if ("id" in updated) table.index[updated.id] = updated;
        auditHooks.onEdit?.(updated);
        count++;
        return updated;
      }
      return row;
    });
    syncToLocalStorage();
    return count;
  }

  function remove(dbName, tableName, predicate) {
    const table = databases[dbName]?.[tableName];
    if (!table) return 0;
    const originalLength = table.rows.length;
    table.rows = table.rows.filter(row => {
      const shouldDelete = predicate(row);
      if (shouldDelete && "id" in row) delete table.index[row.id];
      if (shouldDelete) auditHooks.onDelete?.(row);
      return !shouldDelete;
    });
    syncToLocalStorage();
    return originalLength - table.rows.length;
  }

  function syncToLocalStorage() {
    try {
      localStorage.setItem("hx-db", JSON.stringify(databases));
    } catch (e) {
      console.warn("LocalStorage sync failed:", e);
    }
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem("hx-db");
      if (raw) Object.assign(databases, JSON.parse(raw));
    } catch (e) {
      console.warn("LocalStorage load failed:", e);
    }
  }

  function setAuditHooks(hooks = {}) {
    Object.assign(auditHooks, hooks);
  }

  // Load on init
  loadFromLocalStorage();

  return {
    createDatabase,
    createTable,
    insert,
    query,
    getById,
    edit,
    remove,
    setAuditHooks,
  };
})();

export default hxDb;
