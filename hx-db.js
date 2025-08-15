// hx-db.js
// MIT Licensed — see LICENSE in hx-v2 repo

const hxDb = (() => {
    const databases = {};

    function createDatabase(name) {
        if (!name) throw new Error("Database name required");
        if (databases[name]) return databases[name];
        databases[name] = {};
        return databases[name];
    }

    function createTable(dbName, tableName, schema = {}) {
        const db = databases[dbName] || createDatabase(dbName);
        if (!tableName) throw new Error("Table name required");
        db[tableName] = {
            schema,
            rows: [],
        };
        return db[tableName];
    }

    function insert(dbName, tableName, row) {
        const table = databases[dbName]?.[tableName];
        if (!table) throw new Error(`Table ${tableName} not found in ${dbName}`);
        table.rows.push(row);
        return row;
    }

    function query(dbName, tableName, predicate = () => true) {
        const table = databases[dbName]?.[tableName];
        if (!table) return [];
        return table.rows.filter(predicate);
    }

    function edit(dbName, tableName, predicate, updater) {
        const table = databases[dbName]?.[tableName];
        if (!table) return 0;
        let count = 0;
        table.rows = table.rows.map(row => {
            if (predicate(row)) {
                count++;
                return updater(row);
            }
            return row;
        });
        return count;
    }

    function remove(dbName, tableName, predicate) {
        const table = databases[dbName]?.[tableName];
        if (!table) return 0;
        const originalLength = table.rows.length;
        table.rows = table.rows.filter(row => !predicate(row));
        return originalLength - table.rows.length;
    }

    return {
        createDatabase,
        createTable,
        insert,
        query,
        edit,
        remove,
    };
})();

export default hxDb;
