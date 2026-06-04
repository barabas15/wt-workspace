use std::sync::Mutex;
use std::sync::mpsc;
use rusqlite::Connection;
use crate::db::{clear_all, persist_aggregated, read_merged_orgs};
use crate::gmail::client::GmailApi;
use crate::parsing::{aggregate_with_merges, ParsedMessage};

/// Hány párhuzamos szál töltse le a levél-fejléceket egyszerre.
const FETCH_WORKERS: usize = 8;

/// Teljes sync: lekéri az üzenet-azonosítókat, PÁRHUZAMOSAN letölti a fejléceket
/// (worker-pool), parse-ol, aggregál, perzisztál. A `progress` callback
/// (feldolgozott, összes) párokat kap — kizárólag a koordináló szálból hívva, így
/// szálbiztos. Az `A: Sync` megkötés kell, hogy a `&A`-t a szálak megoszthassák.
pub fn run_full_sync<A: GmailApi + Sync>(
    api: &A,
    conn: &Connection,
    progress: &mut dyn FnMut(usize, usize),
) -> anyhow::Result<()> {
    let self_email = api.profile_email()?;
    let ids = api.list_message_ids()?;
    let total = ids.len();

    let work = Mutex::new(ids.into_iter());
    let (tx, rx) = mpsc::channel::<Option<ParsedMessage>>();
    let workers = FETCH_WORKERS.min(total.max(1));
    let self_email_ref: &str = &self_email;

    let parsed: Vec<ParsedMessage> = std::thread::scope(|s| {
        for _ in 0..workers {
            let tx = tx.clone();
            let work = &work;
            s.spawn(move || loop {
                // egy azonosító kivétele a közös sorból
                let next = { work.lock().unwrap().next() };
                let Some(m) = next else { break };
                let parsed = api
                    .get_message(&m.id)
                    .ok()
                    .and_then(|gm| gm.to_parsed(self_email_ref));
                if tx.send(parsed).is_err() {
                    break;
                }
            });
        }
        // az eredeti küldő eldobása, hogy az rx a workerek végeztével lezáruljon
        drop(tx);

        let mut collected = Vec::new();
        let mut done = 0usize;
        for item in rx {
            done += 1;
            progress(done, total);
            if let Some(p) = item {
                collected.push(p);
            }
        }
        collected
    });

    // a felhasználó által törölt szervezeteket is az "Egyéb"-be soroljuk (tartós törlés)
    let merged = read_merged_orgs(conn)?;
    let agg = aggregate_with_merges(&parsed, &merged);
    // teljes sync = csere: előbb ürítünk, hogy ne duplázódjanak a számlálók és ne
    // maradjanak elavult sorok (pl. korábbi, full-domain kulcsú szervezetek).
    clear_all(conn)?;
    persist_aggregated(conn, &agg)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{init_schema, read_contacts};
    use crate::gmail::client::{GmailApi, MessageRef};
    use crate::gmail::model::GmailMessage;
    use rusqlite::Connection;
    use std::collections::HashMap;

    struct MockApi { email: String, msgs: HashMap<String, GmailMessage> }
    impl GmailApi for MockApi {
        fn profile_email(&self) -> anyhow::Result<String> { Ok(self.email.clone()) }
        fn list_message_ids(&self) -> anyhow::Result<Vec<MessageRef>> {
            let mut ids: Vec<_> = self.msgs.keys().cloned().collect();
            ids.sort();
            Ok(ids.into_iter().map(|id| MessageRef { id }).collect())
        }
        fn get_message(&self, id: &str) -> anyhow::Result<GmailMessage> {
            Ok(self.msgs.get(id).cloned().unwrap())
        }
    }

    fn gm(id: &str, label: &str, from: &str, to: &str, date: &str) -> GmailMessage {
        GmailMessage { id: id.into(), label_ids: vec![label.into()],
            headers: vec![("From".into(), from.into()), ("To".into(), to.into()), ("Date".into(), date.into())] }
    }

    #[test]
    fn full_sync_populates_db_and_reports_progress() {
        let mut msgs = HashMap::new();
        msgs.insert("a".into(), gm("a", "INBOX", "Anna <anna@acme.hu>", "me@f.hu", "Wed, 10 Jan 2026 09:00:00 +0100"));
        msgs.insert("b".into(), gm("b", "SENT", "me@f.hu", "bela@acme.hu", "Thu, 20 Feb 2026 12:00:00 +0100"));
        let api = MockApi { email: "me@f.hu".into(), msgs };

        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();

        let mut progress = Vec::new();
        run_full_sync(&api, &conn, &mut |done, total| progress.push((done, total))).unwrap();

        let contacts = read_contacts(&conn).unwrap();
        assert_eq!(contacts.len(), 2);
        assert_eq!(progress.last().unwrap(), &(2, 2));
    }

    #[test]
    fn parallel_sync_aggregates_all_messages_correctly() {
        // 30 levél (több mint a worker-szám), hogy a párhuzamos sor kiürítése
        // és az aggregálás helyességét igazoljuk: 20 Annától kapott, 10 Bélának küldött.
        let mut msgs = HashMap::new();
        for i in 0..20 {
            msgs.insert(
                format!("r{i}"),
                gm(&format!("r{i}"), "INBOX", "Anna <anna@acme.hu>", "me@f.hu", "Wed, 10 Jan 2026 09:00:00 +0100"),
            );
        }
        for i in 0..10 {
            msgs.insert(
                format!("s{i}"),
                gm(&format!("s{i}"), "SENT", "me@f.hu", "bela@acme.hu", "Thu, 20 Feb 2026 12:00:00 +0100"),
            );
        }
        let api = MockApi { email: "me@f.hu".into(), msgs };

        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();

        let mut count = 0usize;
        run_full_sync(&api, &conn, &mut |_done, _total| count += 1).unwrap();

        // a progress pontosan annyiszor hívódott, ahány levél van
        assert_eq!(count, 30);

        let contacts = read_contacts(&conn).unwrap();
        assert_eq!(contacts.len(), 2);
        let anna = contacts.iter().find(|c| c.email == "anna@acme.hu").unwrap();
        assert_eq!(anna.message_count, 20);
        assert_eq!(anna.received_count, 20);
        let bela = contacts.iter().find(|c| c.email == "bela@acme.hu").unwrap();
        assert_eq!(bela.message_count, 10);
        assert_eq!(bela.sent_count, 10);
    }
}
