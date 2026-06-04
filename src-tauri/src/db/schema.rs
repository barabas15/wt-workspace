use rusqlite::{Connection, Result};

pub fn init_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS organizations (
            domain        TEXT PRIMARY KEY,
            label         TEXT NOT NULL,
            is_personal   INTEGER NOT NULL DEFAULT 0,
            member_count  INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS contacts (
            email               TEXT PRIMARY KEY,
            display_name        TEXT NOT NULL DEFAULT '',
            organization_domain TEXT NOT NULL REFERENCES organizations(domain),
            message_count       INTEGER NOT NULL DEFAULT 0,
            sent_count          INTEGER NOT NULL DEFAULT 0,
            received_count      INTEGER NOT NULL DEFAULT 0,
            first_seen          TEXT NOT NULL DEFAULT '',
            last_seen           TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_domain);

        CREATE TABLE IF NOT EXISTS sync_state (
            id                INTEGER PRIMARY KEY CHECK (id = 1),
            last_history_id   TEXT,
            last_full_sync_at TEXT,
            progress_total    INTEGER NOT NULL DEFAULT 0,
            progress_done     INTEGER NOT NULL DEFAULT 0
        );
        INSERT OR IGNORE INTO sync_state (id) VALUES (1);
        "#,
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn creates_all_tables() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |r| r.get(0)).unwrap()
            .map(|r| r.unwrap()).collect();
        assert!(tables.contains(&"organizations".to_string()));
        assert!(tables.contains(&"contacts".to_string()));
        assert!(tables.contains(&"sync_state".to_string()));
    }

    #[test]
    fn schema_is_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        init_schema(&conn).unwrap();
    }
}
