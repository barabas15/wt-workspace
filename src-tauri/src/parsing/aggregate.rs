use std::collections::HashMap;
use crate::parsing::{domain_of, is_public_domain, org_label, sld_of, Address};

pub const PERSONAL_DOMAIN: &str = "__personal__";

/// Egy feldolgozandó levél lényege az aggregáláshoz.
pub struct ParsedMessage {
    pub counterparts: Vec<Address>,
    pub received: bool,
    pub date: String,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ContactAgg {
    pub email: String,
    pub display_name: String,
    pub organization_domain: String,
    pub message_count: i64,
    pub sent_count: i64,
    pub received_count: i64,
    pub first_seen: String,
    pub last_seen: String,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct OrgAgg {
    pub domain: String,
    pub label: String,
    pub is_personal: bool,
    pub member_count: i64,
}

pub struct Aggregated {
    pub contacts: Vec<ContactAgg>,
    pub organizations: Vec<OrgAgg>,
}

pub fn aggregate(messages: &[ParsedMessage]) -> Aggregated {
    let mut contacts: HashMap<String, ContactAgg> = HashMap::new();

    for msg in messages {
        for cp in &msg.counterparts {
            // org-kulcs: publikus domain -> közös "Egyéb"; egyébként az SLD
            // (TLD-független, így a1.si és a1.at egy szervezet: "a1").
            let org_domain = match domain_of(&cp.email) {
                Some(d) if is_public_domain(&d) => PERSONAL_DOMAIN.to_string(),
                Some(d) => sld_of(&d),
                None => continue,
            };

            let entry = contacts.entry(cp.email.clone()).or_insert(ContactAgg {
                email: cp.email.clone(),
                display_name: String::new(),
                organization_domain: org_domain.clone(),
                message_count: 0,
                sent_count: 0,
                received_count: 0,
                first_seen: msg.date.clone(),
                last_seen: msg.date.clone(),
            });

            entry.message_count += 1;
            if msg.received { entry.received_count += 1; } else { entry.sent_count += 1; }
            if msg.date < entry.first_seen { entry.first_seen = msg.date.clone(); }
            // FONTOS: a nevet a last_seen FRISSÍTÉSE ELŐTT döntsd el, hogy a
            // legutóbbi dátumú nem-üres név nyerjen.
            if !cp.name.is_empty() && msg.date >= entry.last_seen {
                entry.display_name = cp.name.clone();
            }
            if msg.date > entry.last_seen { entry.last_seen = msg.date.clone(); }
        }
    }

    // tagszám org-kulcsonként
    let mut counts: HashMap<String, i64> = HashMap::new();
    for c in contacts.values() {
        *counts.entry(c.organization_domain.clone()).or_insert(0) += 1;
    }

    // egytagú (nem-"Egyéb") szervezeteket beolvasztjuk a közös "Egyéb" gyűjtőbe:
    // egy szereplőből álló domain ne legyen külön csoport.
    for c in contacts.values_mut() {
        if c.organization_domain != PERSONAL_DOMAIN
            && counts.get(&c.organization_domain).copied().unwrap_or(0) <= 1
        {
            c.organization_domain = PERSONAL_DOMAIN.to_string();
        }
    }

    // végleges szervezet-lista a (frissített) kontaktokból
    let mut orgs: HashMap<String, OrgAgg> = HashMap::new();
    for c in contacts.values() {
        let is_personal = c.organization_domain == PERSONAL_DOMAIN;
        let label = if is_personal {
            "Egyéb".to_string()
        } else {
            org_label(&c.organization_domain)
        };
        let org = orgs.entry(c.organization_domain.clone()).or_insert(OrgAgg {
            domain: c.organization_domain.clone(),
            label,
            is_personal,
            member_count: 0,
        });
        org.member_count += 1;
    }

    Aggregated {
        contacts: contacts.into_values().collect(),
        organizations: orgs.into_values().collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parsing::Address;

    fn addr(name: &str, email: &str) -> Address {
        Address { name: name.into(), email: email.into() }
    }

    #[test]
    fn groups_by_domain_and_counts_direction() {
        let msgs = vec![
            ParsedMessage { counterparts: vec![addr("Anna", "anna@acme.hu")], received: true, date: "2026-01-10".into() },
            ParsedMessage { counterparts: vec![addr("Anna", "anna@acme.hu")], received: false, date: "2026-02-20".into() },
            ParsedMessage { counterparts: vec![addr("Béla", "bela@acme.hu")], received: true, date: "2026-01-05".into() },
        ];
        let agg = aggregate(&msgs);
        let anna = agg.contacts.iter().find(|c| c.email == "anna@acme.hu").unwrap();
        // a szervezet kulcsa az SLD ("acme"), nem a teljes domain
        assert_eq!(anna.organization_domain, "acme");
        assert_eq!(anna.message_count, 2);
        assert_eq!(anna.received_count, 1);
        assert_eq!(anna.sent_count, 1);
        assert_eq!(anna.first_seen, "2026-01-10");
        assert_eq!(anna.last_seen, "2026-02-20");
        let org = agg.organizations.iter().find(|o| o.domain == "acme").unwrap();
        assert_eq!(org.member_count, 2);
        assert_eq!(org.label, "Acme");
        assert!(!org.is_personal);
    }

    #[test]
    fn merges_same_sld_across_tlds() {
        // a1.si és a1.at ugyanaz a szervezet ("a1")
        let msgs = vec![
            ParsedMessage { counterparts: vec![addr("X", "x@a1.si")], received: true, date: "2026-01-01".into() },
            ParsedMessage { counterparts: vec![addr("Y", "y@a1.at")], received: true, date: "2026-01-02".into() },
        ];
        let agg = aggregate(&msgs);
        let org = agg.organizations.iter().find(|o| o.domain == "a1").unwrap();
        assert_eq!(org.member_count, 2);
        assert_eq!(org.label, "A1");
        assert!(!org.is_personal);
        for c in &agg.contacts {
            assert_eq!(c.organization_domain, "a1");
        }
        // nincs külön "a1.si" / "a1.at" szervezet
        assert!(agg.organizations.iter().all(|o| !o.domain.contains('.')));
    }

    #[test]
    fn singleton_org_goes_to_others() {
        // egyetlen kontakt a solo.hu-nál -> ne legyen külön csoport, "Egyéb" alá
        let msgs = vec![
            ParsedMessage { counterparts: vec![addr("Solo", "solo@solo.hu")], received: true, date: "2026-01-01".into() },
            // egy valódi (2+ tagú) szervezet, hogy legyen mihez hasonlítani
            ParsedMessage { counterparts: vec![addr("A", "a@acme.hu")], received: true, date: "2026-01-01".into() },
            ParsedMessage { counterparts: vec![addr("B", "b@acme.hu")], received: true, date: "2026-01-01".into() },
        ];
        let agg = aggregate(&msgs);
        // nincs "solo" szervezet
        assert!(agg.organizations.iter().all(|o| o.domain != "solo"));
        // a solo kontakt az "Egyéb" gyűjtőben van
        let solo = agg.contacts.iter().find(|c| c.email == "solo@solo.hu").unwrap();
        assert_eq!(solo.organization_domain, PERSONAL_DOMAIN);
        let others = agg.organizations.iter().find(|o| o.domain == PERSONAL_DOMAIN).unwrap();
        assert!(others.is_personal);
        assert_eq!(others.label, "Egyéb");
        assert_eq!(others.member_count, 1);
        // az acme viszont valódi 2 tagú szervezet maradt
        let acme = agg.organizations.iter().find(|o| o.domain == "acme").unwrap();
        assert_eq!(acme.member_count, 2);
    }

    #[test]
    fn public_domains_go_to_personal_bucket() {
        let msgs = vec![
            ParsedMessage { counterparts: vec![addr("X", "x@gmail.com")], received: true, date: "2026-01-01".into() },
            ParsedMessage { counterparts: vec![addr("Y", "y@freemail.hu")], received: true, date: "2026-01-02".into() },
        ];
        let agg = aggregate(&msgs);
        let org = agg.organizations.iter().find(|o| o.domain == PERSONAL_DOMAIN).unwrap();
        assert!(org.is_personal);
        assert_eq!(org.member_count, 2);
        for c in &agg.contacts { assert_eq!(c.organization_domain, PERSONAL_DOMAIN); }
    }

    #[test]
    fn keeps_latest_nonempty_name() {
        let msgs = vec![
            ParsedMessage { counterparts: vec![addr("", "z@acme.hu")], received: true, date: "2026-01-01".into() },
            ParsedMessage { counterparts: vec![addr("Zoltán", "z@acme.hu")], received: true, date: "2026-03-01".into() },
        ];
        let agg = aggregate(&msgs);
        let z = agg.contacts.iter().find(|c| c.email == "z@acme.hu").unwrap();
        assert_eq!(z.display_name, "Zoltán");
    }
}
