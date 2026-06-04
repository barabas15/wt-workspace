use std::collections::HashSet;
use rusqlite::{Connection, Result};
use crate::parsing::{derive_organizations, Aggregated, ContactAgg, OrgAgg, PERSONAL_DOMAIN};

/// Kontakt- és szervezet-táblák kiürítése. A teljes sync ezt hívja a perzisztálás
/// előtt, hogy az eredmény a postafiók AKTUÁLIS állapotát tükrözze (ne adódjon hozzá
/// a korábbi szinkronokhoz, és ne maradjanak benn elavult/átkulcsolt sorok).
pub fn clear_all(conn: &Connection) -> Result<()> {
    conn.execute("DELETE FROM contacts", [])?;
    conn.execute("DELETE FROM organizations", [])?;
    Ok(())
}

/// A felhasználó által törölt (Egyéb alá olvasztott) szervezet-SLD-k. A sync ezeket is
/// az "Egyéb" gyűjtőbe sorolja, így a törlés re-sync után is megmarad.
pub fn read_merged_orgs(conn: &Connection) -> Result<HashSet<String>> {
    let mut stmt = conn.prepare("SELECT sld FROM merged_orgs")?;
    let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
    rows.collect()
}

/// Egy SLD felvétele a "törölt" szervezetek közé (idempotens).
pub fn add_merged_org(conn: &Connection, sld: &str) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO merged_orgs (sld) VALUES (?1)",
        rusqlite::params![sld],
    )?;
    Ok(())
}

/// Csoport törlése: az SLD-t tartósan a "törölt" közé veszi, a tagjait az "Egyéb"-be
/// sorolja, és újraszámolja a szervezet-listát (hálózati sync nélkül, a tárolt kontaktokból).
pub fn delete_organization(conn: &Connection, sld: &str) -> Result<()> {
    add_merged_org(conn, sld)?;
    let mut contacts = read_contacts(conn)?;
    for c in &mut contacts {
        if c.organization_domain == sld {
            c.organization_domain = PERSONAL_DOMAIN.to_string();
        }
    }
    let organizations = derive_organizations(&contacts);
    clear_all(conn)?;
    persist_aggregated(conn, &Aggregated { contacts, organizations })?;
    Ok(())
}

/// Upsert: a számlálók ÖSSZEADÓDNAK (inkrementális sync), a név/last_seen frissül.
pub fn persist_aggregated(conn: &Connection, agg: &Aggregated) -> Result<()> {
    for o in &agg.organizations {
        conn.execute(
            "INSERT INTO organizations (domain, label, is_personal, member_count)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(domain) DO UPDATE SET
               member_count = member_count + excluded.member_count,
               label = excluded.label,
               is_personal = excluded.is_personal",
            rusqlite::params![o.domain, o.label, o.is_personal as i64, o.member_count],
        )?;
    }
    for c in &agg.contacts {
        conn.execute(
            "INSERT INTO contacts
               (email, display_name, organization_domain, message_count, sent_count, received_count, first_seen, last_seen)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(email) DO UPDATE SET
               display_name = CASE WHEN excluded.display_name <> '' THEN excluded.display_name ELSE contacts.display_name END,
               message_count = message_count + excluded.message_count,
               sent_count = sent_count + excluded.sent_count,
               received_count = received_count + excluded.received_count,
               first_seen = MIN(contacts.first_seen, excluded.first_seen),
               last_seen = MAX(contacts.last_seen, excluded.last_seen)",
            rusqlite::params![
                c.email, c.display_name, c.organization_domain,
                c.message_count, c.sent_count, c.received_count,
                c.first_seen, c.last_seen
            ],
        )?;
    }
    Ok(())
}

pub fn read_organizations(conn: &Connection) -> Result<Vec<OrgAgg>> {
    let mut stmt = conn.prepare(
        "SELECT domain, label, is_personal, member_count FROM organizations ORDER BY is_personal, label",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(OrgAgg {
            domain: r.get(0)?,
            label: r.get(1)?,
            is_personal: r.get::<_, i64>(2)? != 0,
            member_count: r.get(3)?,
        })
    })?;
    rows.collect()
}

pub fn read_contacts(conn: &Connection) -> Result<Vec<ContactAgg>> {
    let mut stmt = conn.prepare(
        "SELECT email, display_name, organization_domain, message_count, sent_count, received_count, first_seen, last_seen
         FROM contacts ORDER BY organization_domain, display_name",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(ContactAgg {
            email: r.get(0)?,
            display_name: r.get(1)?,
            organization_domain: r.get(2)?,
            message_count: r.get(3)?,
            sent_count: r.get(4)?,
            received_count: r.get(5)?,
            first_seen: r.get(6)?,
            last_seen: r.get(7)?,
        })
    })?;
    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_schema;
    use crate::parsing::{Aggregated, ContactAgg, OrgAgg};
    use rusqlite::Connection;

    fn mem() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        init_schema(&c).unwrap();
        c
    }

    fn sample() -> Aggregated {
        Aggregated {
            organizations: vec![OrgAgg { domain: "acme.hu".into(), label: "Acme".into(), is_personal: false, member_count: 1 }],
            contacts: vec![ContactAgg {
                email: "anna@acme.hu".into(), display_name: "Anna".into(),
                organization_domain: "acme.hu".into(),
                message_count: 3, sent_count: 1, received_count: 2,
                first_seen: "2026-01-01".into(), last_seen: "2026-03-01".into(),
            }],
        }
    }

    #[test]
    fn persists_and_reads_back() {
        let conn = mem();
        persist_aggregated(&conn, &sample()).unwrap();
        let orgs = read_organizations(&conn).unwrap();
        assert_eq!(orgs.len(), 1);
        assert_eq!(orgs[0].member_count, 1);
        let contacts = read_contacts(&conn).unwrap();
        assert_eq!(contacts.len(), 1);
        assert_eq!(contacts[0].email, "anna@acme.hu");
        assert_eq!(contacts[0].message_count, 3);
    }

    #[test]
    fn upsert_accumulates_counts() {
        let conn = mem();
        persist_aggregated(&conn, &sample()).unwrap();
        persist_aggregated(&conn, &sample()).unwrap();
        let contacts = read_contacts(&conn).unwrap();
        assert_eq!(contacts[0].message_count, 6);
        let orgs = read_organizations(&conn).unwrap();
        assert_eq!(orgs[0].member_count, 2);
    }
}
