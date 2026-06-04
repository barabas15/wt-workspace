# Gmail Kontakt-Workspace Implementációs Terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Asztali „céges workspace" alkalmazás első modulja — a Gmail-leveleidből szervezetenként csoportosított kontaktlistát és szervezet-központú gráfot épít.

**Architecture:** Tauri (Rust mag + React/TS UI). A Rust mag végzi az OAuth-ot, a Gmail API-hívásokat, a fejléc-parse-t, a csoportosítást és a SQLite-perzisztenciát; a React UI háromzónás workspace-héjban (ikon-sáv + lista + Cytoscape gráf) jelenít meg. A tiszta logika (parse, domain, aggregálás, gráf-transzformáció) külön, unit-tesztelt függvényekben él.

**Tech Stack:** Tauri v2, Rust (rusqlite, reqwest, oauth2, keyring, serde), React + TypeScript + Vite, Cytoscape.js, Vitest + Testing Library.

**Forrás-spec:** `docs/superpowers/specs/2026-06-04-gmail-kontakt-workspace-design.md`

---

## Bevezető megjegyzések a végrehajtónak

- **TDD végig:** előbb a bukó teszt, futtatás (lásd, hogy bukik), minimális implementáció, futtatás (zöld), commit.
- **Mappastruktúra** (a scaffold után jön létre):
  - `src-tauri/` — Rust mag. Almodulok: `src-tauri/src/parsing/` (tiszta logika), `src-tauri/src/db/` (SQLite), `src-tauri/src/gmail/` (API + OAuth), `src-tauri/src/sync/` (orchestráció), `src-tauri/src/commands.rs` (Tauri-parancsok).
  - `src/` — React UI. `src/shell/` (workspace-héj), `src/modules/contacts/` (Kontaktok modul: lista, gráf, transzformáció, hooks).
- **Commit** minden task végén, magyar conventional commit üzenettel. **Soha ne pushold** és ne `git init`-elj engedély nélkül — a repo init külön user-engedélyhez kötött (lásd Task 1 megjegyzését).
- **Google Cloud előfeltétel** (a felhasználó végzi, nem kód): OAuth2 „Desktop app" kliens létrehozása a Google Cloud Console-ban, Gmail API engedélyezve, a saját e-mail teszt-felhasználóként felvéve. A `client_id` (és desktop app esetén a `client_secret`) egy `.env`-szerű konfigból jön — lásd Task 12.

---

## Task 1: Projekt-scaffold (Tauri + React + TS)

**Files:**
- Create: teljes Tauri+Vite projekt a repo gyökerében (`/home/botond/Develop/practice/wt-workspace`)
- Create: `package.json`, `src-tauri/Cargo.toml`, `src/main.tsx`, stb. (a generátor hozza létre)

- [ ] **Step 1: Git repo inicializálása (csak felhasználói engedéllyel)**

A mappa jelenleg nem git-repo. Kérd a felhasználó engedélyét, majd:

```bash
cd /home/botond/Develop/practice/wt-workspace
git init
printf "node_modules/\ndist/\nsrc-tauri/target/\n.superpowers/\n*.local\n.env\n" > .gitignore
```

Ha a felhasználó nem ad engedélyt: hagyd ki a git-lépéseket az egész tervben, és csak a fájlokat hozd létre.

- [ ] **Step 2: Tauri + React + TS scaffold generálása**

Run:
```bash
cd /home/botond/Develop/practice/wt-workspace
npm create tauri-app@latest . -- --template react-ts --manager npm --yes
```
Ha a `.` nem üres miatt panaszkodik, generálj egy `tmp-scaffold/` mappába és másold be a tartalmat a gyökérbe, majd töröld a `tmp-scaffold/`-ot.

- [ ] **Step 3: Függőségek telepítése**

Run:
```bash
npm install
```
Expected: `node_modules/` létrejön, hiba nélkül.

- [ ] **Step 4: Fejlesztői build ellenőrzése**

Run:
```bash
npm run tauri dev
```
Expected: megnyílik egy Tauri ablak az alapértelmezett React kezdőlappal. Zárd be (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: Tauri + React + TS projekt scaffold

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Teszt-infrastruktúra (Rust + Vitest)

**Files:**
- Modify: `src-tauri/Cargo.toml` (dev-dependencies)
- Modify: `package.json` (Vitest scriptek + devDeps)
- Create: `vitest.config.ts`
- Create: `src/test-setup.ts`

- [ ] **Step 1: Vitest és Testing Library telepítése**

Run:
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @testing-library/user-event
```

- [ ] **Step 2: `vitest.config.ts` létrehozása**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

- [ ] **Step 3: `src/test-setup.ts` létrehozása**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 4: Teszt-scriptek a `package.json`-ba**

A `package.json` `"scripts"` blokkjába vedd fel:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Smoke-teszt a frontend tesztelőhöz**

Create: `src/smoke.test.ts`
```ts
import { describe, it, expect } from "vitest";

describe("teszt-infra", () => {
  it("fut", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: PASS (1 teszt).

- [ ] **Step 6: Rust teszt smoke**

Run: `cd src-tauri && cargo test`
Expected: lefut (0 vagy a default tesztekkel), hiba nélkül.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: Vitest + Testing Library teszt-infra

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: E-mail fejléc-parse (név + cím kinyerése)

**Files:**
- Create: `src-tauri/src/parsing/mod.rs`
- Create: `src-tauri/src/parsing/address.rs`
- Modify: `src-tauri/src/lib.rs` (modul-deklaráció)

**Cél:** egy `From`/`To`/`Cc` fejléc-érték (ami több, vesszővel elválasztott címet is tartalmazhat) felbontása `(display_name, email)` párokra. Példák:
- `"Kovács Anna" <anna@acme.hu>` → `("Kovács Anna", "anna@acme.hu")`
- `bob@example.com` → `("", "bob@example.com")`
- `A <a@x.hu>, B <b@y.hu>` → két pár

- [ ] **Step 1: Írd meg a bukó tesztet**

A `src-tauri/src/parsing/address.rs` aljára:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_name_and_email() {
        let r = parse_addresses(r#""Kovács Anna" <anna@acme.hu>"#);
        assert_eq!(r, vec![Address { name: "Kovács Anna".into(), email: "anna@acme.hu".into() }]);
    }

    #[test]
    fn parses_bare_email() {
        let r = parse_addresses("bob@example.com");
        assert_eq!(r, vec![Address { name: "".into(), email: "bob@example.com".into() }]);
    }

    #[test]
    fn parses_multiple_addresses() {
        let r = parse_addresses("A <a@x.hu>, B <b@y.hu>");
        assert_eq!(r, vec![
            Address { name: "A".into(), email: "a@x.hu".into() },
            Address { name: "B".into(), email: "b@y.hu".into() },
        ]);
    }

    #[test]
    fn lowercases_email_and_trims_name() {
        let r = parse_addresses("  Big Name  <Anna@ACME.hu> ");
        assert_eq!(r, vec![Address { name: "Big Name".into(), email: "anna@acme.hu".into() }]);
    }

    #[test]
    fn skips_entries_without_at() {
        let r = parse_addresses("notanemail, ok@x.hu");
        assert_eq!(r, vec![Address { name: "".into(), email: "ok@x.hu".into() }]);
    }
}
```

- [ ] **Step 2: Futtasd — bukjon (nincs `parse_addresses`/`Address`)**

Run: `cd src-tauri && cargo test parsing::address`
Expected: FAIL — `cannot find function parse_addresses` / `cannot find type Address`.

- [ ] **Step 3: Minimális implementáció**

`src-tauri/src/parsing/address.rs` teteje:
```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Address {
    pub name: String,
    pub email: String,
}

/// Egy fejléc-érték (több, vesszővel elválasztott cím) felbontása.
/// Az ékezetes/idézőjeles nevet megtartja, az e-mailt kisbetűsíti.
/// A `@`-ot nem tartalmazó töredékeket eldobja.
pub fn parse_addresses(header: &str) -> Vec<Address> {
    header
        .split(',')
        .filter_map(|part| parse_one(part.trim()))
        .collect()
}

fn parse_one(s: &str) -> Option<Address> {
    if s.is_empty() {
        return None;
    }
    // "Név" <email>  vagy  Név <email>
    if let Some(open) = s.find('<') {
        if let Some(close) = s[open + 1..].find('>') {
            let email = s[open + 1..open + 1 + close].trim().to_lowercase();
            let name = s[..open].trim().trim_matches('"').trim().to_string();
            if email.contains('@') {
                return Some(Address { name, email });
            }
        }
    }
    // csupasz e-mail
    let email = s.trim().to_lowercase();
    if email.contains('@') {
        return Some(Address { name: String::new(), email });
    }
    None
}
```

`src-tauri/src/parsing/mod.rs`:
```rust
pub mod address;
pub use address::{parse_addresses, Address};
```

A `src-tauri/src/lib.rs` tetejére (a meglévő tartalom mellé) vedd fel:
```rust
pub mod parsing;
```

- [ ] **Step 4: Futtasd — legyen zöld**

Run: `cd src-tauri && cargo test parsing::address`
Expected: PASS (5 teszt).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: e-mail fejléc-parse (név + cím kinyerés)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Domain-kinyerés és publikus-domain szűrés

**Files:**
- Create: `src-tauri/src/parsing/domain.rs`
- Modify: `src-tauri/src/parsing/mod.rs`

**Cél:** egy e-mailből a domain kinyerése (kisbetűs), és annak eldöntése, hogy publikus/szabad domain-e (beépített feketelista).

- [ ] **Step 1: Bukó teszt**

`src-tauri/src/parsing/domain.rs` aljára:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_domain() {
        assert_eq!(domain_of("anna@acme.hu"), Some("acme.hu".to_string()));
        assert_eq!(domain_of("ANNA@Acme.HU"), Some("acme.hu".to_string()));
    }

    #[test]
    fn returns_none_for_invalid() {
        assert_eq!(domain_of("notanemail"), None);
    }

    #[test]
    fn detects_public_domains() {
        assert!(is_public_domain("gmail.com"));
        assert!(is_public_domain("outlook.com"));
        assert!(is_public_domain("freemail.hu"));
        assert!(is_public_domain("yahoo.co.uk")); // yahoo.* mintát is kezeljük
    }

    #[test]
    fn company_domain_is_not_public() {
        assert!(!is_public_domain("acme.hu"));
        assert!(!is_public_domain("webtown.hu"));
    }
}
```

- [ ] **Step 2: Futtasd — bukjon**

Run: `cd src-tauri && cargo test parsing::domain`
Expected: FAIL — `domain_of` / `is_public_domain` nem létezik.

- [ ] **Step 3: Implementáció**

`src-tauri/src/parsing/domain.rs`:
```rust
/// Az e-mail `@` utáni része, kisbetűsítve. None, ha nincs `@`.
pub fn domain_of(email: &str) -> Option<String> {
    let at = email.rfind('@')?;
    let d = email[at + 1..].trim().to_lowercase();
    if d.is_empty() { None } else { Some(d) }
}

const PUBLIC_DOMAINS: &[&str] = &[
    "gmail.com", "googlemail.com", "outlook.com", "hotmail.com",
    "live.com", "msn.com", "icloud.com", "me.com", "aol.com",
    "proton.me", "protonmail.com", "gmx.com",
    "freemail.hu", "citromail.hu", "indamail.hu", "vipmail.hu",
];

const PUBLIC_PREFIXES: &[&str] = &["yahoo."];

/// Igaz, ha a domain szabad/publikus webmail (nem egy szervezet sajátja).
pub fn is_public_domain(domain: &str) -> bool {
    let d = domain.to_lowercase();
    if PUBLIC_DOMAINS.contains(&d.as_str()) {
        return true;
    }
    PUBLIC_PREFIXES.iter().any(|p| d.starts_with(p))
}
```

`src-tauri/src/parsing/mod.rs` egészítsd ki:
```rust
pub mod domain;
pub use domain::{domain_of, is_public_domain};
```

- [ ] **Step 4: Futtasd — zöld**

Run: `cd src-tauri && cargo test parsing::domain`
Expected: PASS (4 teszt).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: domain-kinyerés és publikus-domain feketelista

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Szervezet-címke a domainből

**Files:**
- Create: `src-tauri/src/parsing/label.rs`
- Modify: `src-tauri/src/parsing/mod.rs`

**Cél:** a domain SLD-jéből emberbarát címke (`acme.hu` → „Acme", `nagy-ceg.co.uk` → „Nagy-Ceg").

- [ ] **Step 1: Bukó teszt**

`src-tauri/src/parsing/label.rs` aljára:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capitalizes_sld() {
        assert_eq!(org_label("acme.hu"), "Acme");
        assert_eq!(org_label("webtown.hu"), "Webtown");
    }

    #[test]
    fn handles_multilevel_tld() {
        assert_eq!(org_label("nagyceg.co.uk"), "Nagyceg");
    }

    #[test]
    fn keeps_hyphenated() {
        assert_eq!(org_label("nagy-ceg.hu"), "Nagy-ceg");
    }

    #[test]
    fn fallback_for_empty() {
        assert_eq!(org_label(""), "Ismeretlen");
    }
}
```

- [ ] **Step 2: Futtasd — bukjon**

Run: `cd src-tauri && cargo test parsing::label`
Expected: FAIL — `org_label` nem létezik.

- [ ] **Step 3: Implementáció**

`src-tauri/src/parsing/label.rs`:
```rust
/// A domain második szintű részéből (SLD) emberbarát címke.
/// Pl. "acme.hu" -> "Acme", "ceg.co.uk" -> "Ceg".
pub fn org_label(domain: &str) -> String {
    let parts: Vec<&str> = domain.split('.').filter(|p| !p.is_empty()).collect();
    // Az SLD a legbaloldalibb címke (parts[0]); ez helyes a többszintű TLD-kre
    // is (pl. nagyceg.co.uk -> "nagyceg"). NE parts[len-2]-t használj.
    let sld = match parts.len() {
        0 => return "Ismeretlen".to_string(),
        _ => parts[0],
    };
    let mut chars = sld.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => "Ismeretlen".to_string(),
    }
}
```

`src-tauri/src/parsing/mod.rs` egészítsd ki:
```rust
pub mod label;
pub use label::org_label;
```

- [ ] **Step 4: Futtasd — zöld**

Run: `cd src-tauri && cargo test parsing::label`
Expected: PASS (4 teszt).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: szervezet-címke a domainből

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Aggregálás (parse-olt levelekből kontaktok + szervezetek)

**Files:**
- Create: `src-tauri/src/parsing/aggregate.rs`
- Modify: `src-tauri/src/parsing/mod.rs`

**Cél:** bemenet egy lista feldolgozandó levélről (`ParsedMessage`: a felek + irány + dátum), kimenet a kontaktok és szervezetek aggregált állapota. A „Magánszemélyek / egyéb" gyűjtő domainje a konstans `PERSONAL_DOMAIN = "__personal__"`.

A `ParsedMessage` modellezi egy levél lényegét: melyik a felhasználó saját címe, kik a többi felek, kapott vagy küldött, mikor.

- [ ] **Step 1: Bukó teszt**

`src-tauri/src/parsing/aggregate.rs` aljára:
```rust
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
            ParsedMessage {
                counterparts: vec![addr("Anna", "anna@acme.hu")],
                received: true,  // tőle kaptam
                date: "2026-01-10".into(),
            },
            ParsedMessage {
                counterparts: vec![addr("Anna", "anna@acme.hu")],
                received: false, // neki küldtem
                date: "2026-02-20".into(),
            },
            ParsedMessage {
                counterparts: vec![addr("Béla", "bela@acme.hu")],
                received: true,
                date: "2026-01-05".into(),
            },
        ];

        let agg = aggregate(&msgs);

        // két kontakt az acme.hu szervezetben
        let anna = agg.contacts.iter().find(|c| c.email == "anna@acme.hu").unwrap();
        assert_eq!(anna.organization_domain, "acme.hu");
        assert_eq!(anna.message_count, 2);
        assert_eq!(anna.received_count, 1);
        assert_eq!(anna.sent_count, 1);
        assert_eq!(anna.first_seen, "2026-01-10");
        assert_eq!(anna.last_seen, "2026-02-20");

        let org = agg.organizations.iter().find(|o| o.domain == "acme.hu").unwrap();
        assert_eq!(org.member_count, 2);
        assert_eq!(org.label, "Acme");
        assert!(!org.is_personal);
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
        for c in &agg.contacts {
            assert_eq!(c.organization_domain, PERSONAL_DOMAIN);
        }
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
```

- [ ] **Step 2: Futtasd — bukjon**

Run: `cd src-tauri && cargo test parsing::aggregate`
Expected: FAIL — `aggregate` / `ParsedMessage` / `PERSONAL_DOMAIN` nem létezik.

- [ ] **Step 3: Implementáció**

`src-tauri/src/parsing/aggregate.rs`:
```rust
use std::collections::HashMap;
use crate::parsing::{domain_of, is_public_domain, org_label, Address};

pub const PERSONAL_DOMAIN: &str = "__personal__";

/// Egy feldolgozandó levél lényege az aggregáláshoz.
pub struct ParsedMessage {
    /// A felhasználón kívüli felek (feladó vagy címzettek).
    pub counterparts: Vec<Address>,
    /// true = kaptam tőlük, false = nekik küldtem.
    pub received: bool,
    /// ISO dátum (YYYY-MM-DD).
    pub date: String,
}

#[derive(Debug, Clone, PartialEq)]
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

#[derive(Debug, Clone, PartialEq)]
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
            let org_domain = match domain_of(&cp.email) {
                Some(d) if is_public_domain(&d) => PERSONAL_DOMAIN.to_string(),
                Some(d) => d,
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
            if msg.date > entry.last_seen { entry.last_seen = msg.date.clone(); }
            if !cp.name.is_empty() && msg.date >= entry.last_seen_name_date() {
                entry.display_name = cp.name.clone();
            }
        }
    }

    // szervezetek származtatása
    let mut orgs: HashMap<String, OrgAgg> = HashMap::new();
    for c in contacts.values() {
        let is_personal = c.organization_domain == PERSONAL_DOMAIN;
        let label = if is_personal {
            "Magánszemélyek / egyéb".to_string()
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

impl ContactAgg {
    // a név-frissítéshez: a legutóbbi nem-üres nevet tartjuk meg.
    // Egyszerűsítés: a last_seen-t használjuk referenciának.
    fn last_seen_name_date(&self) -> String {
        self.last_seen.clone()
    }
}
```

> Megjegyzés a végrehajtónak: a `keeps_latest_nonempty_name` teszt a `>=` összevetésen múlik a `last_seen`-nel szemben. Mivel a `last_seen` már frissült az aktuális dátumra a név-frissítés előtt, az egyenlőség engedett (`>=`), így az aktuális (legutóbbi) nem-üres név nyer. Ha a teszt mégis bukna, told a név-frissítést a `last_seen` frissítése elé, és hasonlítsd a régi `last_seen`-hez.

`src-tauri/src/parsing/mod.rs` egészítsd ki:
```rust
pub mod aggregate;
pub use aggregate::{aggregate, Aggregated, ContactAgg, OrgAgg, ParsedMessage, PERSONAL_DOMAIN};
```

- [ ] **Step 4: Futtasd — zöld**

Run: `cd src-tauri && cargo test parsing::aggregate`
Expected: PASS (3 teszt). Ha a név-teszt bukik, alkalmazd a fenti megjegyzés javítását, és futtasd újra.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: kontakt/szervezet aggregálás parse-olt levelekből

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: SQLite séma és migráció

**Files:**
- Create: `src-tauri/src/db/mod.rs`
- Create: `src-tauri/src/db/schema.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml` (rusqlite)

- [ ] **Step 1: rusqlite függőség**

`src-tauri/Cargo.toml` `[dependencies]` alá:
```toml
rusqlite = { version = "0.31", features = ["bundled"] }
```

- [ ] **Step 2: Bukó teszt a sémára**

`src-tauri/src/db/schema.rs` aljára:
```rust
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
            .query_map([], |r| r.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();

        assert!(tables.contains(&"organizations".to_string()));
        assert!(tables.contains(&"contacts".to_string()));
        assert!(tables.contains(&"sync_state".to_string()));
    }

    #[test]
    fn schema_is_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        init_schema(&conn).unwrap();
        // másodszor is lefuthat hiba nélkül
        init_schema(&conn).unwrap();
    }
}
```

- [ ] **Step 3: Futtasd — bukjon**

Run: `cd src-tauri && cargo test db::schema`
Expected: FAIL — `init_schema` nem létezik.

- [ ] **Step 4: Implementáció**

`src-tauri/src/db/schema.rs`:
```rust
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
```

`src-tauri/src/db/mod.rs`:
```rust
pub mod schema;
pub use schema::init_schema;
```

`src-tauri/src/lib.rs`-be:
```rust
pub mod db;
```

- [ ] **Step 5: Futtasd — zöld**

Run: `cd src-tauri && cargo test db::schema`
Expected: PASS (2 teszt).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: SQLite séma (organizations, contacts, sync_state)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: DB repository (írás/olvasás, perzisztálás)

**Files:**
- Create: `src-tauri/src/db/repo.rs`
- Modify: `src-tauri/src/db/mod.rs`

**Cél:** az `Aggregated` állapot perzisztálása (upsert org + contact), és az összes kontakt/szervezet kiolvasása a UI-nak.

- [ ] **Step 1: Bukó teszt**

`src-tauri/src/db/repo.rs` aljára:
```rust
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
            organizations: vec![OrgAgg {
                domain: "acme.hu".into(), label: "Acme".into(),
                is_personal: false, member_count: 1,
            }],
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
        // ugyanaz mégegyszer -> a számok összeadódnak (inkrementális sync)
        persist_aggregated(&conn, &sample()).unwrap();

        let contacts = read_contacts(&conn).unwrap();
        assert_eq!(contacts[0].message_count, 6);
        let orgs = read_organizations(&conn).unwrap();
        assert_eq!(orgs[0].member_count, 2);
    }
}
```

- [ ] **Step 2: Futtasd — bukjon**

Run: `cd src-tauri && cargo test db::repo`
Expected: FAIL — a `persist_aggregated` / `read_organizations` / `read_contacts` nem létezik.

- [ ] **Step 3: Implementáció**

`src-tauri/src/db/repo.rs`:
```rust
use rusqlite::{Connection, Result};
use crate::parsing::{Aggregated, ContactAgg, OrgAgg};

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
```

`src-tauri/src/db/mod.rs` egészítsd ki:
```rust
pub mod repo;
pub use repo::{persist_aggregated, read_contacts, read_organizations};
```

- [ ] **Step 4: Futtasd — zöld**

Run: `cd src-tauri && cargo test db::repo`
Expected: PASS (2 teszt).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: DB repository (perzisztálás + olvasás, upsert)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Gmail API kliens trait + fixture-mock tesztek

**Files:**
- Create: `src-tauri/src/gmail/mod.rs`
- Create: `src-tauri/src/gmail/client.rs`
- Create: `src-tauri/src/gmail/model.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml` (serde, serde_json)

**Cél:** a Gmail API absztrakciója egy trait mögött, hogy a sync mockolható legyen. A valódi HTTP-implementáció Task 10-ben jön; itt a trait, a modellek, és egy fixture-alapú mock + a fejléc→`ParsedMessage` transzformáció tesztelése.

- [ ] **Step 1: serde függőségek**

`src-tauri/Cargo.toml` `[dependencies]`:
```toml
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 2: Bukó teszt — Gmail üzenet → ParsedMessage**

`src-tauri/src/gmail/model.rs` aljára:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_received_message() {
        let msg = GmailMessage {
            id: "m1".into(),
            label_ids: vec!["INBOX".into()],
            headers: vec![
                ("From".into(), r#""Anna" <anna@acme.hu>"#.into()),
                ("To".into(), "me@firma.hu".into()),
                ("Date".into(), "Wed, 10 Jan 2026 09:00:00 +0100".into()),
            ],
        };
        let parsed = msg.to_parsed("me@firma.hu").unwrap();
        assert!(parsed.received);
        assert_eq!(parsed.date, "2026-01-10");
        assert_eq!(parsed.counterparts.len(), 1);
        assert_eq!(parsed.counterparts[0].email, "anna@acme.hu");
    }

    #[test]
    fn converts_sent_message_collects_recipients() {
        let msg = GmailMessage {
            id: "m2".into(),
            label_ids: vec!["SENT".into()],
            headers: vec![
                ("From".into(), "me@firma.hu".into()),
                ("To".into(), "a@acme.hu, b@acme.hu".into()),
                ("Date".into(), "Thu, 20 Feb 2026 12:00:00 +0100".into()),
            ],
        };
        let parsed = msg.to_parsed("me@firma.hu").unwrap();
        assert!(!parsed.received);
        assert_eq!(parsed.counterparts.len(), 2);
    }

    #[test]
    fn excludes_self_from_counterparts() {
        let msg = GmailMessage {
            id: "m3".into(),
            label_ids: vec!["SENT".into()],
            headers: vec![
                ("From".into(), "me@firma.hu".into()),
                ("To".into(), "a@acme.hu, me@firma.hu".into()),
                ("Date".into(), "Thu, 20 Feb 2026 12:00:00 +0100".into()),
            ],
        };
        let parsed = msg.to_parsed("me@firma.hu").unwrap();
        assert_eq!(parsed.counterparts.len(), 1);
        assert_eq!(parsed.counterparts[0].email, "a@acme.hu");
    }
}
```

- [ ] **Step 3: Futtasd — bukjon**

Run: `cd src-tauri && cargo test gmail::model`
Expected: FAIL — `GmailMessage` nem létezik.

- [ ] **Step 4: Implementáció — model + chrono dátum-parse**

`src-tauri/Cargo.toml` `[dependencies]`:
```toml
chrono = "0.4"
```

`src-tauri/src/gmail/model.rs`:
```rust
use chrono::DateTime;
use crate::parsing::{parse_addresses, ParsedMessage};

/// Egy Gmail üzenet metadat-szinten (csak fejlécek).
#[derive(Debug, Clone)]
pub struct GmailMessage {
    pub id: String,
    pub label_ids: Vec<String>,
    pub headers: Vec<(String, String)>,
}

impl GmailMessage {
    fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(name))
            .map(|(_, v)| v.as_str())
    }

    /// A felhasználó saját címe alapján ParsedMessage-é alakít.
    /// None, ha nincs használható fél vagy dátum.
    pub fn to_parsed(&self, self_email: &str) -> Option<ParsedMessage> {
        let self_lc = self_email.to_lowercase();
        let received = self.label_ids.iter().any(|l| l == "INBOX")
            || !self.label_ids.iter().any(|l| l == "SENT");

        // a felek: kapott levélnél a From, küldöttnél a To+Cc
        let raw = if received {
            self.header("From").unwrap_or("").to_string()
        } else {
            let to = self.header("To").unwrap_or("");
            let cc = self.header("Cc").unwrap_or("");
            format!("{to},{cc}")
        };

        let counterparts: Vec<_> = parse_addresses(&raw)
            .into_iter()
            .filter(|a| a.email != self_lc)
            .collect();
        if counterparts.is_empty() {
            return None;
        }

        let date = parse_date(self.header("Date")?)?;
        Some(ParsedMessage { counterparts, received, date })
    }
}

/// RFC2822-szerű dátum -> "YYYY-MM-DD". NE használj parse_from_rfc2822-t:
/// az validálja a hét napját (sok valós fejléc rossz weekday-jel jön), és nem
/// tűri a lezáró "(UTC)" zónakomment-et. Ezért manuálisan tisztítunk + parse_from_str.
fn parse_date(raw: &str) -> Option<String> {
    let s = raw.trim();
    // Opcionális hétköznap-prefix levágása ("Mon, " / "Wed, " stb.)
    let mut s = if s.len() > 5 && s.as_bytes().get(3) == Some(&b',') {
        s[5..].trim_start().to_string()
    } else {
        s.to_string()
    };
    // Lezáró "(...)" komment levágása, pl. "+0100 (UTC)" -> "+0100".
    if let Some(idx) = s.find('(') {
        s = s[..idx].trim_end().to_string();
    }
    let dt = DateTime::parse_from_str(&s, "%d %b %Y %H:%M:%S %z").ok()?;
    Some(dt.format("%Y-%m-%d").to_string())
}
```

`src-tauri/src/gmail/mod.rs`:
```rust
pub mod model;
pub mod client;
pub use model::GmailMessage;
pub use client::{GmailApi, MessageRef};
```

`src-tauri/src/lib.rs`-be:
```rust
pub mod gmail;
```

- [ ] **Step 5: A trait + mock**

`src-tauri/src/gmail/client.rs`:
```rust
use crate::gmail::model::GmailMessage;

/// Egy üzenet-azonosító + (opcionálisan) a history-hoz tartozó adat.
#[derive(Debug, Clone)]
pub struct MessageRef {
    pub id: String,
}

/// A Gmail API absztrakciója — mockolható a teszteléshez.
pub trait GmailApi {
    /// A profil saját e-mail-címe.
    fn profile_email(&self) -> anyhow::Result<String>;
    /// Üzenet-azonosítók listája (beérkező + elküldött), lapozva belül.
    fn list_message_ids(&self) -> anyhow::Result<Vec<MessageRef>>;
    /// Egy üzenet metadat-fejlécei.
    fn get_message(&self, id: &str) -> anyhow::Result<GmailMessage>;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parsing::aggregate;
    use std::collections::HashMap;

    struct MockApi {
        email: String,
        ids: Vec<String>,
        messages: HashMap<String, GmailMessage>,
    }

    impl GmailApi for MockApi {
        fn profile_email(&self) -> anyhow::Result<String> { Ok(self.email.clone()) }
        fn list_message_ids(&self) -> anyhow::Result<Vec<MessageRef>> {
            Ok(self.ids.iter().map(|id| MessageRef { id: id.clone() }).collect())
        }
        fn get_message(&self, id: &str) -> anyhow::Result<GmailMessage> {
            Ok(self.messages.get(id).cloned().unwrap())
        }
    }

    fn msg(id: &str, label: &str, from: &str, to: &str, date: &str) -> GmailMessage {
        GmailMessage {
            id: id.into(),
            label_ids: vec![label.into()],
            headers: vec![
                ("From".into(), from.into()),
                ("To".into(), to.into()),
                ("Date".into(), date.into()),
            ],
        }
    }

    #[test]
    fn end_to_end_with_mock_api() {
        let mut messages = HashMap::new();
        messages.insert("a".into(), msg("a", "INBOX", r#""Anna" <anna@acme.hu>"#, "me@firma.hu", "Wed, 10 Jan 2026 09:00:00 +0100"));
        messages.insert("b".into(), msg("b", "SENT", "me@firma.hu", "anna@acme.hu", "Thu, 20 Feb 2026 12:00:00 +0100"));
        let api = MockApi { email: "me@firma.hu".into(), ids: vec!["a".into(), "b".into()], messages };

        let self_email = api.profile_email().unwrap();
        let parsed: Vec<_> = api.list_message_ids().unwrap().into_iter()
            .filter_map(|m| api.get_message(&m.id).ok())
            .filter_map(|gm| gm.to_parsed(&self_email))
            .collect();

        let agg = aggregate(&parsed);
        let anna = agg.contacts.iter().find(|c| c.email == "anna@acme.hu").unwrap();
        assert_eq!(anna.message_count, 2);
        assert_eq!(anna.received_count, 1);
        assert_eq!(anna.sent_count, 1);
    }
}
```

`src-tauri/Cargo.toml` `[dependencies]`:
```toml
anyhow = "1"
```

- [ ] **Step 6: Futtasd — zöld**

Run: `cd src-tauri && cargo test gmail`
Expected: PASS (4 teszt: 3 model + 1 client end-to-end).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Gmail API trait + model + fixture-mock end-to-end teszt

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Valódi Gmail HTTP-kliens (reqwest)

**Files:**
- Create: `src-tauri/src/gmail/http.rs`
- Modify: `src-tauri/src/gmail/mod.rs`
- Modify: `src-tauri/Cargo.toml` (reqwest)

**Cél:** a `GmailApi` trait konkrét HTTP-implementációja egy access tokennel. (A hálózatot nem unit-teszteljük; a JSON-deszerializációt igen.)

- [ ] **Step 1: reqwest függőség**

`src-tauri/Cargo.toml` `[dependencies]`:
```toml
reqwest = { version = "0.12", features = ["json", "blocking"] }
```

- [ ] **Step 2: Bukó teszt — JSON-deszerializáció**

`src-tauri/src/gmail/http.rs` aljára:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_message_get_json() {
        let json = r#"{
            "id": "abc",
            "labelIds": ["INBOX", "IMPORTANT"],
            "payload": { "headers": [
                {"name": "From", "value": "Anna <anna@acme.hu>"},
                {"name": "Date", "value": "Wed, 10 Jan 2026 09:00:00 +0100"}
            ]}
        }"#;
        let raw: RawMessage = serde_json::from_str(json).unwrap();
        let gm = raw.into_gmail_message();
        assert_eq!(gm.id, "abc");
        assert_eq!(gm.label_ids, vec!["INBOX", "IMPORTANT"]);
        assert_eq!(gm.headers.iter().find(|(k, _)| k == "From").unwrap().1, "Anna <anna@acme.hu>");
    }
}
```

- [ ] **Step 3: Futtasd — bukjon**

Run: `cd src-tauri && cargo test gmail::http`
Expected: FAIL — `RawMessage` nem létezik.

- [ ] **Step 4: Implementáció**

`src-tauri/src/gmail/http.rs`:
```rust
use serde::Deserialize;
use crate::gmail::client::{GmailApi, MessageRef};
use crate::gmail::model::GmailMessage;

const BASE: &str = "https://gmail.googleapis.com/gmail/v1/users/me";

#[derive(Deserialize)]
pub struct RawMessage {
    pub id: String,
    #[serde(default, rename = "labelIds")]
    pub label_ids: Vec<String>,
    #[serde(default)]
    pub payload: RawPayload,
}

#[derive(Deserialize, Default)]
pub struct RawPayload {
    #[serde(default)]
    pub headers: Vec<RawHeader>,
}

#[derive(Deserialize)]
pub struct RawHeader {
    pub name: String,
    pub value: String,
}

impl RawMessage {
    pub fn into_gmail_message(self) -> GmailMessage {
        GmailMessage {
            id: self.id,
            label_ids: self.label_ids,
            headers: self.payload.headers.into_iter().map(|h| (h.name, h.value)).collect(),
        }
    }
}

#[derive(Deserialize)]
struct ListResponse {
    #[serde(default)]
    messages: Vec<MessageId>,
    #[serde(default, rename = "nextPageToken")]
    next_page_token: Option<String>,
}

#[derive(Deserialize)]
struct MessageId { id: String }

#[derive(Deserialize)]
struct Profile {
    #[serde(rename = "emailAddress")]
    email_address: String,
}

pub struct HttpGmailApi {
    token: String,
    client: reqwest::blocking::Client,
}

impl HttpGmailApi {
    pub fn new(access_token: String) -> Self {
        Self { token: access_token, client: reqwest::blocking::Client::new() }
    }

    fn get(&self, url: &str) -> anyhow::Result<reqwest::blocking::Response> {
        // 429 esetén exponenciális backoff
        let mut delay_ms = 500u64;
        for _ in 0..5 {
            let resp = self.client.get(url).bearer_auth(&self.token).send()?;
            if resp.status().as_u16() == 429 {
                std::thread::sleep(std::time::Duration::from_millis(delay_ms));
                delay_ms *= 2;
                continue;
            }
            return Ok(resp.error_for_status()?);
        }
        anyhow::bail!("Gmail API rate limit: túl sok 429 válasz")
    }
}

impl GmailApi for HttpGmailApi {
    fn profile_email(&self) -> anyhow::Result<String> {
        let p: Profile = self.get(&format!("{BASE}/profile"))?.json()?;
        Ok(p.email_address)
    }

    fn list_message_ids(&self) -> anyhow::Result<Vec<MessageRef>> {
        let mut out = Vec::new();
        let mut page: Option<String> = None;
        loop {
            // FONTOS: a query URL-kódolva (szóköz=%20), különben a reqwest URL-parse hibát ad.
            let mut url = format!("{BASE}/messages?maxResults=500&q=in%3Ainbox%20OR%20in%3Asent");
            if let Some(p) = &page {
                url.push_str(&format!("&pageToken={p}"));
            }
            let resp: ListResponse = self.get(&url)?.json()?;
            out.extend(resp.messages.into_iter().map(|m| MessageRef { id: m.id }));
            match resp.next_page_token {
                Some(t) => page = Some(t),
                None => break,
            }
        }
        Ok(out)
    }

    fn get_message(&self, id: &str) -> anyhow::Result<GmailMessage> {
        let url = format!(
            "{BASE}/messages/{id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Date"
        );
        let raw: RawMessage = self.get(&url)?.json()?;
        Ok(raw.into_gmail_message())
    }
}
```

`src-tauri/src/gmail/mod.rs` egészítsd ki:
```rust
pub mod http;
pub use http::HttpGmailApi;
```

- [ ] **Step 5: Futtasd — zöld**

Run: `cd src-tauri && cargo test gmail::http`
Expected: PASS (1 teszt).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: valódi Gmail HTTP-kliens reqwesttel (429 backoff)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: OAuth2 desktop flow + token-tárolás (keyring)

**Files:**
- Create: `src-tauri/src/gmail/auth.rs`
- Modify: `src-tauri/src/gmail/mod.rs`
- Modify: `src-tauri/Cargo.toml` (oauth2, keyring, tiny_http)

**Cél:** loopback OAuth2 + PKCE folyamat (böngészőben consent), access/refresh token mentése az OS kulcstárba, és access token visszaadása (refresh-sel, ha lejárt).

> A hálózati/böngészős OAuth-folyamatot nem unit-teszteljük; a token-tároló kör (mentés/olvasás) tesztelhető a `keyring` mock nélkül egy memóriás absztrakcióval. Itt a token-store absztrakciót teszteljük.

- [ ] **Step 1: Függőségek**

`src-tauri/Cargo.toml` `[dependencies]` (az `oauth2`-t mindjárt a `reqwest` feature-rel — lásd Step 6, ne vedd fel kétszer):
```toml
oauth2 = { version = "4", features = ["reqwest"] }
keyring = "2"
tiny_http = "0.12"
url = "2"
```

- [ ] **Step 2: Bukó teszt — token-store kerekítés**

`src-tauri/src/gmail/auth.rs` aljára:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_roundtrip_in_memory() {
        let store = InMemoryTokenStore::default();
        assert!(store.load().unwrap().is_none());
        let tok = StoredToken {
            access_token: "at".into(),
            refresh_token: "rt".into(),
            expires_at_unix: 123,
        };
        store.save(&tok).unwrap();
        assert_eq!(store.load().unwrap().unwrap().access_token, "at");
    }

    #[test]
    fn detects_expiry() {
        let tok = StoredToken { access_token: "x".into(), refresh_token: "r".into(), expires_at_unix: 1000 };
        assert!(tok.is_expired(2000));
        assert!(!tok.is_expired(500));
    }
}
```

- [ ] **Step 3: Futtasd — bukjon**

Run: `cd src-tauri && cargo test gmail::auth`
Expected: FAIL — `StoredToken` / `InMemoryTokenStore` nem létezik.

- [ ] **Step 4: Implementáció**

`src-tauri/src/gmail/auth.rs`:
```rust
use serde::{Deserialize, Serialize};
use std::cell::RefCell;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredToken {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at_unix: i64,
}

impl StoredToken {
    pub fn is_expired(&self, now_unix: i64) -> bool {
        now_unix >= self.expires_at_unix
    }
}

/// Token-tároló absztrakció (a kulcstár mögé).
pub trait TokenStore {
    fn load(&self) -> anyhow::Result<Option<StoredToken>>;
    fn save(&self, token: &StoredToken) -> anyhow::Result<()>;
}

/// Teszteléshez használt memóriás tároló.
#[derive(Default)]
pub struct InMemoryTokenStore {
    inner: RefCell<Option<StoredToken>>,
}

impl TokenStore for InMemoryTokenStore {
    fn load(&self) -> anyhow::Result<Option<StoredToken>> {
        Ok(self.inner.borrow().clone())
    }
    fn save(&self, token: &StoredToken) -> anyhow::Result<()> {
        *self.inner.borrow_mut() = Some(token.clone());
        Ok(())
    }
}

const SERVICE: &str = "ceges-workspace-gmail";
const ACCOUNT: &str = "default";

/// Az OS kulcstárat használó tároló (Linux: Secret Service).
pub struct KeyringTokenStore;

impl TokenStore for KeyringTokenStore {
    fn load(&self) -> anyhow::Result<Option<StoredToken>> {
        let entry = keyring::Entry::new(SERVICE, ACCOUNT)?;
        match entry.get_password() {
            Ok(json) => Ok(Some(serde_json::from_str(&json)?)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }
    fn save(&self, token: &StoredToken) -> anyhow::Result<()> {
        let entry = keyring::Entry::new(SERVICE, ACCOUNT)?;
        entry.set_password(&serde_json::to_string(token)?)?;
        Ok(())
    }
}
```

`src-tauri/src/gmail/mod.rs` egészítsd ki:
```rust
pub mod auth;
pub use auth::{KeyringTokenStore, StoredToken, TokenStore};
```

- [ ] **Step 5: Futtasd — zöld**

Run: `cd src-tauri && cargo test gmail::auth`
Expected: PASS (2 teszt).

- [ ] **Step 6: OAuth-folyamat hozzáadása (nem unit-tesztelt)**

`src-tauri/src/gmail/auth.rs` végére (a tesztek elé), a tényleges loopback+PKCE folyamat:
```rust
use oauth2::basic::BasicClient;
use oauth2::{
    AuthUrl, ClientId, ClientSecret, CsrfToken, PkceCodeChallenge,
    RedirectUrl, Scope, TokenUrl, AuthorizationCode, TokenResponse,
};

pub struct OAuthConfig {
    pub client_id: String,
    pub client_secret: String,
}

/// Végigviszi a loopback OAuth2 + PKCE folyamatot, és elmenti a tokent.
/// A böngészőt a hívó (Tauri command) nyitja meg a visszaadott URL-lel,
/// vagy ez a függvény a `open` crate-tel — itt egyszerűen kinyit egy
/// loopback szervert és visszaadja a tokent.
pub fn run_oauth_flow(cfg: &OAuthConfig, store: &dyn TokenStore) -> anyhow::Result<()> {
    let client = BasicClient::new(
        ClientId::new(cfg.client_id.clone()),
        Some(ClientSecret::new(cfg.client_secret.clone())),
        AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".into())?,
        Some(TokenUrl::new("https://oauth2.googleapis.com/token".into())?),
    );

    // loopback szerver egy szabad porton
    let server = tiny_http::Server::http("127.0.0.1:0").map_err(|e| anyhow::anyhow!("{e}"))?;
    let port = server.server_addr().to_ip().unwrap().port();
    let redirect = format!("http://127.0.0.1:{port}");
    let client = client.set_redirect_uri(RedirectUrl::new(redirect)?);

    let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();
    let (auth_url, _csrf) = client
        .authorize_url(CsrfToken::new_random)
        .add_scope(Scope::new("https://www.googleapis.com/auth/gmail.readonly".into()))
        .add_extra_param("access_type", "offline")
        .add_extra_param("prompt", "consent")
        .set_pkce_challenge(pkce_challenge)
        .url();

    // a böngésző megnyitása
    let _ = open::that(auth_url.to_string());

    // várjuk a redirectet a loopback szerveren
    let request = server.recv()?;
    let url = format!("http://localhost{}", request.url());
    let parsed = url::Url::parse(&url)?;
    let code = parsed
        .query_pairs()
        .find(|(k, _)| k == "code")
        .map(|(_, v)| v.to_string())
        .ok_or_else(|| anyhow::anyhow!("Nincs authorization code a redirectben"))?;

    let response = tiny_http::Response::from_string(
        "Bejelentkezés kész. Visszatérhetsz az alkalmazásba.",
    );
    let _ = request.respond(response);

    let token = client
        .exchange_code(AuthorizationCode::new(code))
        .set_pkce_verifier(pkce_verifier)
        .request(oauth2::reqwest::http_client)?;

    let now = chrono::Utc::now().timestamp();
    let expires_in = token.expires_in().map(|d| d.as_secs() as i64).unwrap_or(3600);
    let stored = StoredToken {
        access_token: token.access_token().secret().clone(),
        refresh_token: token.refresh_token().map(|r| r.secret().clone()).unwrap_or_default(),
        expires_at_unix: now + expires_in,
    };
    store.save(&stored)?;
    Ok(())
}

/// Visszaad egy érvényes access tokent; ha lejárt, refresh-eli.
pub fn valid_access_token(cfg: &OAuthConfig, store: &dyn TokenStore) -> anyhow::Result<String> {
    let stored = store.load()?.ok_or_else(|| anyhow::anyhow!("Nincs bejelentkezve"))?;
    let now = chrono::Utc::now().timestamp();
    if !stored.is_expired(now) {
        return Ok(stored.access_token);
    }
    // refresh
    let client = BasicClient::new(
        ClientId::new(cfg.client_id.clone()),
        Some(ClientSecret::new(cfg.client_secret.clone())),
        AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".into())?,
        Some(TokenUrl::new("https://oauth2.googleapis.com/token".into())?),
    );
    let refreshed = client
        .exchange_refresh_token(&oauth2::RefreshToken::new(stored.refresh_token.clone()))
        .request(oauth2::reqwest::http_client)?;
    let expires_in = refreshed.expires_in().map(|d| d.as_secs() as i64).unwrap_or(3600);
    let new_token = StoredToken {
        access_token: refreshed.access_token().secret().clone(),
        refresh_token: stored.refresh_token,
        expires_at_unix: now + expires_in,
    };
    store.save(&new_token)?;
    Ok(new_token.access_token)
}
```

`src-tauri/Cargo.toml` `[dependencies]`:
```toml
open = "5"
```

> Az `oauth2` már a `reqwest` feature-rel lett felvéve a Step 1-ben — itt nincs külön teendő (ne add hozzá újra a `Cargo.toml`-hoz).

- [ ] **Step 7: Fordítás-ellenőrzés**

Run: `cd src-tauri && cargo build`
Expected: lefordul hiba nélkül (warningok megengedettek).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: OAuth2 loopback+PKCE folyamat és kulcstár token-tárolás

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Sync-orchestráció (teljes + inkrementális)

**Files:**
- Create: `src-tauri/src/sync/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Cél:** egy `run_full_sync` függvény, amely egy `GmailApi`-t és egy DB-kapcsolatot kap, végigmegy az üzeneteken, parse-ol, aggregál, perzisztál, és egy progress-callbacken keresztül jelez. Mockolt API-val tesztelhető.

- [ ] **Step 1: Bukó teszt**

`src-tauri/src/sync/mod.rs` aljára:
```rust
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
        // a progress utolsó eleme a teljes feldolgozottság
        assert_eq!(progress.last().unwrap(), &(2, 2));
    }
}
```

- [ ] **Step 2: Futtasd — bukjon**

Run: `cd src-tauri && cargo test sync`
Expected: FAIL — `run_full_sync` nem létezik.

- [ ] **Step 3: Implementáció**

`src-tauri/src/sync/mod.rs`:
```rust
use rusqlite::Connection;
use crate::db::persist_aggregated;
use crate::gmail::client::GmailApi;
use crate::parsing::{aggregate, ParsedMessage};

/// Teljes sync: végigmegy minden üzeneten, parse-ol, aggregál, perzisztál.
/// A `progress` callback (feldolgozott, összes) párokat kap.
pub fn run_full_sync(
    api: &dyn GmailApi,
    conn: &Connection,
    progress: &mut dyn FnMut(usize, usize),
) -> anyhow::Result<()> {
    let self_email = api.profile_email()?;
    let ids = api.list_message_ids()?;
    let total = ids.len();

    let mut parsed: Vec<ParsedMessage> = Vec::new();
    for (i, m) in ids.iter().enumerate() {
        if let Ok(gm) = api.get_message(&m.id) {
            if let Some(p) = gm.to_parsed(&self_email) {
                parsed.push(p);
            }
        }
        progress(i + 1, total);
    }

    let agg = aggregate(&parsed);
    persist_aggregated(conn, &agg)?;
    Ok(())
}
```

`src-tauri/src/lib.rs`-be:
```rust
pub mod sync;
```

- [ ] **Step 4: Futtasd — zöld**

Run: `cd src-tauri && cargo test sync`
Expected: PASS (1 teszt).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: teljes sync orchestráció progress-callbackkel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Tauri parancsok + alkalmazás-állapot

**Files:**
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs` (state, command-regisztráció, DB-init az indításkor)
- Modify: `src-tauri/Cargo.toml` (dirs)

**Cél:** a frontend felé kitett parancsok: `connect_gmail`, `start_sync` (progress-eventtel), `refresh`, `get_contacts`, `get_organizations`, `get_sync_state`, `is_connected`. A DB az app adat-könyvtárában él.

A `client_id`/`client_secret` környezeti változóból (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`) töltődik, a fejlesztő egy `.env`-be teszi (ne kerüljön gitbe).

- [ ] **Step 1: dirs függőség és serde a DTO-khoz**

`src-tauri/Cargo.toml` `[dependencies]`:
```toml
dirs = "5"
```

- [ ] **Step 2: A `ContactAgg`/`OrgAgg` legyen szerializálható**

A `src-tauri/src/parsing/aggregate.rs`-ben a két struct attribútumát egészítsd ki:
```rust
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct ContactAgg { /* ... változatlan mezők ... */ }

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct OrgAgg { /* ... változatlan mezők ... */ }
```
(Csak a `derive` sort bővítsd `serde::Serialize, serde::Deserialize`-zel; a mezők maradnak.)

- [ ] **Step 3: Parancsok implementálása**

`src-tauri/src/commands.rs`:
```rust
use std::sync::Mutex;
use rusqlite::Connection;
use tauri::{State, Emitter, AppHandle};

use crate::db::{init_schema, persist_aggregated, read_contacts, read_organizations};
use crate::gmail::auth::{run_oauth_flow, valid_access_token, KeyringTokenStore, OAuthConfig, TokenStore};
use crate::gmail::HttpGmailApi;
use crate::parsing::{aggregate, ContactAgg, OrgAgg, ParsedMessage};
use crate::sync::run_full_sync;

pub struct AppState {
    pub db: Mutex<Connection>,
}

fn oauth_config() -> Result<OAuthConfig, String> {
    let client_id = std::env::var("GMAIL_CLIENT_ID")
        .map_err(|_| "Hiányzó GMAIL_CLIENT_ID környezeti változó".to_string())?;
    let client_secret = std::env::var("GMAIL_CLIENT_SECRET").unwrap_or_default();
    Ok(OAuthConfig { client_id, client_secret })
}

#[tauri::command]
pub fn is_connected() -> Result<bool, String> {
    let store = KeyringTokenStore;
    Ok(store.load().map_err(|e| e.to_string())?.is_some())
}

#[tauri::command]
pub fn connect_gmail() -> Result<(), String> {
    let cfg = oauth_config()?;
    let store = KeyringTokenStore;
    run_oauth_flow(&cfg, &store).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn start_sync(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    let cfg = oauth_config()?;
    let store = KeyringTokenStore;
    let token = valid_access_token(&cfg, &store).map_err(|e| e.to_string())?;
    let api = HttpGmailApi::new(token);

    let conn = state.db.lock().map_err(|e| e.to_string())?;
    run_full_sync(&api, &conn, &mut |done, total| {
        let _ = app.emit("sync-progress", (done, total));
    })
    .map_err(|e| e.to_string())?;
    let _ = app.emit("sync-done", ());
    Ok(())
}

#[tauri::command]
pub fn get_contacts(state: State<AppState>) -> Result<Vec<ContactAgg>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    read_contacts(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_organizations(state: State<AppState>) -> Result<Vec<OrgAgg>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    read_organizations(&conn).map_err(|e| e.to_string())
}
```

- [ ] **Step 4: State, DB-init és parancs-regisztráció a `lib.rs`-ben**

A `src-tauri/src/lib.rs` `run()` függvényében (a Tauri builder), a meglévő `tauri::Builder::default()`-hoz add hozzá:
```rust
pub mod commands;
use commands::AppState;
use std::sync::Mutex;
use rusqlite::Connection;

// a run() belsejében, a builder előtt:
let data_dir = dirs::data_dir().unwrap().join("ceges-workspace");
std::fs::create_dir_all(&data_dir).expect("adat-könyvtár létrehozása");
let conn = Connection::open(data_dir.join("workspace.sqlite")).expect("DB megnyitás");
crate::db::init_schema(&conn).expect("séma inicializálás");

tauri::Builder::default()
    .manage(AppState { db: Mutex::new(conn) })
    .invoke_handler(tauri::generate_handler![
        commands::is_connected,
        commands::connect_gmail,
        commands::start_sync,
        commands::get_contacts,
        commands::get_organizations,
    ])
    // ... a meglévő plugin/setup hívások ...
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

- [ ] **Step 5: Fordítás-ellenőrzés**

Run: `cd src-tauri && cargo build`
Expected: lefordul. Ha az `Emitter` import hiányzik, ellenőrizd, hogy Tauri v2 van (`tauri = { version = "2", ... }`).

- [ ] **Step 6: Rust tesztek mind zöldek**

Run: `cd src-tauri && cargo test`
Expected: PASS — minden korábbi teszt (parsing, db, gmail, sync) zöld.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Tauri parancsok (connect, sync, get_contacts/orgs) + app state

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Frontend — TS típusok és Tauri-binding réteg

**Files:**
- Create: `src/modules/contacts/types.ts`
- Create: `src/modules/contacts/api.ts`

**Cél:** a Rust DTO-knak megfelelő TS típusok és vékony binding-réteg a Tauri `invoke`-hoz.

- [ ] **Step 1: Típusok**

`src/modules/contacts/types.ts`:
```ts
export interface Contact {
  email: string;
  display_name: string;
  organization_domain: string;
  message_count: number;
  sent_count: number;
  received_count: number;
  first_seen: string;
  last_seen: string;
}

export interface Organization {
  domain: string;
  label: string;
  is_personal: boolean;
  member_count: number;
}

export const PERSONAL_DOMAIN = "__personal__";
```

- [ ] **Step 2: Binding réteg**

`src/modules/contacts/api.ts`:
```ts
import { invoke } from "@tauri-apps/api/core";
import type { Contact, Organization } from "./types";

export const api = {
  isConnected: () => invoke<boolean>("is_connected"),
  connectGmail: () => invoke<void>("connect_gmail"),
  startSync: () => invoke<void>("start_sync"),
  getContacts: () => invoke<Contact[]>("get_contacts"),
  getOrganizations: () => invoke<Organization[]>("get_organizations"),
};
```

- [ ] **Step 3: Fordítás-ellenőrzés**

Run: `npx tsc --noEmit`
Expected: nincs típushiba (ha a `@tauri-apps/api` nincs telepítve, `npm install @tauri-apps/api`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: frontend TS típusok és Tauri binding réteg

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Gráf-transzformáció (contacts → nodes/edges) — tiszta függvény

**Files:**
- Create: `src/modules/contacts/graph.ts`
- Create: `src/modules/contacts/graph.test.ts`

**Cél:** a kontaktokból és szervezetekből Cytoscape-kompatibilis `{nodes, edges}` előállítása. **Szervezet-hub mérete = tagszám; kontakt-pont fix méret; él = tagság.**

- [ ] **Step 1: Bukó teszt**

`src/modules/contacts/graph.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toGraph } from "./graph";
import type { Contact, Organization } from "./types";

const orgs: Organization[] = [
  { domain: "acme.hu", label: "Acme", is_personal: false, member_count: 2 },
  { domain: "__personal__", label: "Magánszemélyek / egyéb", is_personal: true, member_count: 1 },
];
const contacts: Contact[] = [
  { email: "a@acme.hu", display_name: "Anna", organization_domain: "acme.hu", message_count: 5, sent_count: 2, received_count: 3, first_seen: "2026-01-01", last_seen: "2026-03-01" },
  { email: "b@acme.hu", display_name: "Béla", organization_domain: "acme.hu", message_count: 99, sent_count: 9, received_count: 90, first_seen: "2026-01-01", last_seen: "2026-03-01" },
  { email: "x@gmail.com", display_name: "X", organization_domain: "__personal__", message_count: 1, sent_count: 0, received_count: 1, first_seen: "2026-02-01", last_seen: "2026-02-01" },
];

describe("toGraph", () => {
  it("creates org and contact nodes plus membership edges", () => {
    const g = toGraph(contacts, orgs);
    const orgNodes = g.nodes.filter((n) => n.data.kind === "org");
    const personNodes = g.nodes.filter((n) => n.data.kind === "person");
    expect(orgNodes).toHaveLength(2);
    expect(personNodes).toHaveLength(3);
    expect(g.edges).toHaveLength(3); // minden kontakt a szervezetéhez
  });

  it("org node size scales with member_count, person size is constant", () => {
    const g = toGraph(contacts, orgs);
    const acme = g.nodes.find((n) => n.data.id === "org:acme.hu")!;
    const personal = g.nodes.find((n) => n.data.id === "org:__personal__")!;
    expect(acme.data.size).toBeGreaterThan(personal.data.size);

    const anna = g.nodes.find((n) => n.data.id === "person:a@acme.hu")!;
    const bela = g.nodes.find((n) => n.data.id === "person:b@acme.hu")!;
    // a sok levelet váltó Béla pontja UGYANAKKORA, mint Annáé
    expect(anna.data.size).toBe(bela.data.size);
  });
});
```

- [ ] **Step 2: Futtasd — bukjon**

Run: `npm test -- graph`
Expected: FAIL — `toGraph` nincs.

- [ ] **Step 3: Implementáció**

`src/modules/contacts/graph.ts`:
```ts
import type { Contact, Organization } from "./types";

export interface GraphNode {
  data: {
    id: string;
    label: string;
    kind: "org" | "person";
    size: number;
    domain: string;
  };
}
export interface GraphEdge {
  data: { id: string; source: string; target: string };
}
export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const PERSON_SIZE = 18; // minden ember egyforma
const ORG_BASE = 28;
const ORG_PER_MEMBER = 4;

export function toGraph(contacts: Contact[], orgs: Organization[]): Graph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const o of orgs) {
    nodes.push({
      data: {
        id: `org:${o.domain}`,
        label: o.label,
        kind: "org",
        size: ORG_BASE + o.member_count * ORG_PER_MEMBER,
        domain: o.domain,
      },
    });
  }

  for (const c of contacts) {
    nodes.push({
      data: {
        id: `person:${c.email}`,
        label: c.display_name || c.email,
        kind: "person",
        size: PERSON_SIZE,
        domain: c.organization_domain,
      },
    });
    edges.push({
      data: {
        id: `edge:${c.email}`,
        source: `org:${c.organization_domain}`,
        target: `person:${c.email}`,
      },
    });
  }

  return { nodes, edges };
}
```

- [ ] **Step 4: Futtasd — zöld**

Run: `npm test -- graph`
Expected: PASS (2 teszt).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: gráf-transzformáció (org-hub méret=tagszám, fix kontakt-méret)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Kontaktlista logika (csoportosítás, szűrés, rendezés) — tiszta függvények

**Files:**
- Create: `src/modules/contacts/list.ts`
- Create: `src/modules/contacts/list.test.ts`

**Cél:** a lista-megjelenítéshez szükséges tiszta adatfüggvények: kontaktok szervezetenkénti csoportosítása, kereső-szűrés, rendezés gyakoriság/utóbbi kapcsolat szerint. A „Magánszemélyek" mindig a lista végére kerül.

- [ ] **Step 1: Bukó teszt**

`src/modules/contacts/list.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { groupByOrg, filterContacts, sortContacts } from "./list";
import type { Contact, Organization } from "./types";

const orgs: Organization[] = [
  { domain: "acme.hu", label: "Acme", is_personal: false, member_count: 2 },
  { domain: "__personal__", label: "Magánszemélyek / egyéb", is_personal: true, member_count: 1 },
  { domain: "webtown.hu", label: "Webtown", is_personal: false, member_count: 1 },
];
const contacts: Contact[] = [
  { email: "a@acme.hu", display_name: "Anna", organization_domain: "acme.hu", message_count: 5, sent_count: 2, received_count: 3, first_seen: "2026-01-01", last_seen: "2026-03-01" },
  { email: "b@acme.hu", display_name: "Béla", organization_domain: "acme.hu", message_count: 50, sent_count: 9, received_count: 41, first_seen: "2026-01-01", last_seen: "2026-05-01" },
  { email: "x@gmail.com", display_name: "Xavér", organization_domain: "__personal__", message_count: 1, sent_count: 0, received_count: 1, first_seen: "2026-02-01", last_seen: "2026-02-01" },
  { email: "w@webtown.hu", display_name: "Wanda", organization_domain: "webtown.hu", message_count: 9, sent_count: 4, received_count: 5, first_seen: "2026-01-15", last_seen: "2026-04-01" },
];

describe("groupByOrg", () => {
  it("groups contacts under their org and puts personal bucket last", () => {
    const groups = groupByOrg(contacts, orgs);
    expect(groups.map((g) => g.org.domain)).toEqual(["acme.hu", "webtown.hu", "__personal__"]);
    expect(groups[0].contacts).toHaveLength(2);
  });
});

describe("filterContacts", () => {
  it("matches name, email or org label, case-insensitive", () => {
    expect(filterContacts(contacts, orgs, "anna").map((c) => c.email)).toEqual(["a@acme.hu"]);
    expect(filterContacts(contacts, orgs, "ACME").map((c) => c.email).sort()).toEqual(["a@acme.hu", "b@acme.hu"]);
    expect(filterContacts(contacts, orgs, "gmail").map((c) => c.email)).toEqual(["x@gmail.com"]);
  });
});

describe("sortContacts", () => {
  it("sorts by frequency desc", () => {
    const r = sortContacts(contacts, "frequency");
    expect(r[0].email).toBe("b@acme.hu");
  });
  it("sorts by last contact desc", () => {
    const r = sortContacts(contacts, "recent");
    expect(r[0].email).toBe("b@acme.hu"); // 2026-05-01
  });
});
```

- [ ] **Step 2: Futtasd — bukjon**

Run: `npm test -- list`
Expected: FAIL — a függvények nincsenek.

- [ ] **Step 3: Implementáció**

`src/modules/contacts/list.ts`:
```ts
import type { Contact, Organization } from "./types";

export interface OrgGroup {
  org: Organization;
  contacts: Contact[];
}

/** Kontaktok szervezetenként; a personal (is_personal) csoport mindig a végére. */
export function groupByOrg(contacts: Contact[], orgs: Organization[]): OrgGroup[] {
  const byDomain = new Map<string, Contact[]>();
  for (const c of contacts) {
    const arr = byDomain.get(c.organization_domain) ?? [];
    arr.push(c);
    byDomain.set(c.organization_domain, arr);
  }
  const groups = orgs
    .filter((o) => byDomain.has(o.domain))
    .map((o) => ({ org: o, contacts: byDomain.get(o.domain)! }));

  groups.sort((a, b) => {
    if (a.org.is_personal !== b.org.is_personal) return a.org.is_personal ? 1 : -1;
    return a.org.label.localeCompare(b.org.label, "hu");
  });
  return groups;
}

/** Kereső a néven / e-mailen / szervezet-címkén, kis-nagybetű érzéketlen. */
export function filterContacts(
  contacts: Contact[],
  orgs: Organization[],
  query: string,
): Contact[] {
  const q = query.trim().toLowerCase();
  if (!q) return contacts;
  const labelOf = new Map(orgs.map((o) => [o.domain, o.label.toLowerCase()]));
  return contacts.filter((c) => {
    const label = labelOf.get(c.organization_domain) ?? "";
    return (
      c.display_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.organization_domain.toLowerCase().includes(q) ||
      label.includes(q)
    );
  });
}

export type SortKey = "frequency" | "recent" | "name";

/** Rendezés gyakoriság / utóbbi kapcsolat / név szerint (új tömböt ad). */
export function sortContacts(contacts: Contact[], key: SortKey): Contact[] {
  const out = [...contacts];
  out.sort((a, b) => {
    switch (key) {
      case "frequency":
        return b.message_count - a.message_count;
      case "recent":
        return b.last_seen.localeCompare(a.last_seen);
      case "name":
        return (a.display_name || a.email).localeCompare(b.display_name || b.email, "hu");
    }
  });
  return out;
}
```

- [ ] **Step 4: Futtasd — zöld**

Run: `npm test -- list`
Expected: PASS (4 teszt).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: kontaktlista logika (csoportosítás, szűrés, rendezés)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: Avatar-monogram — tiszta függvény

**Files:**
- Create: `src/modules/contacts/avatar.ts`
- Create: `src/modules/contacts/avatar.test.ts`

**Cél:** monogram + determinisztikus szín a névből/e-mailből.

- [ ] **Step 1: Bukó teszt**

`src/modules/contacts/avatar.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { initials, colorFor } from "./avatar";

describe("initials", () => {
  it("uses first letters of two name parts", () => {
    expect(initials("Kovács Anna", "k@x.hu")).toBe("KA");
  });
  it("uses single name initial", () => {
    expect(initials("Béla", "b@x.hu")).toBe("BÉ".slice(0, 2));
  });
  it("falls back to email when no name", () => {
    expect(initials("", "zoltan@x.hu")).toBe("ZO");
  });
});

describe("colorFor", () => {
  it("is deterministic for the same key", () => {
    expect(colorFor("a@x.hu")).toBe(colorFor("a@x.hu"));
  });
  it("returns a hsl string", () => {
    expect(colorFor("a@x.hu")).toMatch(/^hsl\(/);
  });
});
```

- [ ] **Step 2: Futtasd — bukjon**

Run: `npm test -- avatar`
Expected: FAIL — `initials`/`colorFor` nincs.

- [ ] **Step 3: Implementáció**

`src/modules/contacts/avatar.ts`:
```ts
/** Monogram: két névrészből 2 betű, egyrészes névből 2 betű, név nélkül az e-mailből. */
export function initials(name: string, email: string): string {
  const n = name.trim();
  if (n) {
    const parts = n.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

/** Determinisztikus HSL szín egy kulcsból (e-mail). */
export function colorFor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) % 360;
  }
  return `hsl(${hash}, 55%, 55%)`;
}
```

- [ ] **Step 4: Futtasd — zöld**

Run: `npm test -- avatar`
Expected: PASS (5 teszt).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: avatar-monogram + determinisztikus szín

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: Workspace-héj (ikon-sáv, háromzónás elrendezés)

**Files:**
- Create: `src/shell/AppShell.tsx`
- Create: `src/shell/AppShell.css`
- Modify: `src/App.tsx` (a héj használata)

**Cél:** a háromzónás váz: bal ikon-sáv (Kontaktok aktív + Beállítások lent), és a fő terület, ahova a modul renderel. Új modul = új ikon a sávban.

- [ ] **Step 1: Bukó teszt**

Create: `src/shell/AppShell.test.tsx`
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("renders the module rail with Contacts and Settings", () => {
    render(<AppShell activeModule="contacts" onSelectModule={() => {}}>
      <div>modul-tartalom</div>
    </AppShell>);
    expect(screen.getByRole("button", { name: /kontaktok/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /beállítások/i })).toBeInTheDocument();
    expect(screen.getByText("modul-tartalom")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Futtasd — bukjon**

Run: `npm test -- AppShell`
Expected: FAIL — `AppShell` nincs.

- [ ] **Step 3: Implementáció**

`src/shell/AppShell.tsx`:
```tsx
import type { ReactNode } from "react";
import "./AppShell.css";

export type ModuleId = "contacts" | "settings";

interface Props {
  activeModule: ModuleId;
  onSelectModule: (m: ModuleId) => void;
  children: ReactNode;
}

const MODULES: { id: ModuleId; icon: string; label: string }[] = [
  { id: "contacts", icon: "@", label: "Kontaktok" },
];

export function AppShell({ activeModule, onSelectModule, children }: Props) {
  return (
    <div className="shell">
      <nav className="rail" aria-label="Modulok">
        <div className="rail-top">
          {MODULES.map((m) => (
            <button
              key={m.id}
              className={`rail-btn ${activeModule === m.id ? "active" : ""}`}
              aria-label={m.label}
              onClick={() => onSelectModule(m.id)}
            >
              <span className="rail-icon">{m.icon}</span>
              <span className="rail-label">{m.label}</span>
            </button>
          ))}
        </div>
        <div className="rail-bottom">
          <button
            className={`rail-btn ${activeModule === "settings" ? "active" : ""}`}
            aria-label="Beállítások"
            onClick={() => onSelectModule("settings")}
          >
            <span className="rail-icon">⚙</span>
            <span className="rail-label">Beáll.</span>
          </button>
        </div>
      </nav>
      <main className="content">{children}</main>
    </div>
  );
}
```

`src/shell/AppShell.css`:
```css
.shell { display: flex; height: 100vh; width: 100vw; overflow: hidden; }
.rail {
  width: 64px; background: #22262f; color: #c6ccd8;
  display: flex; flex-direction: column; justify-content: space-between;
  padding: 10px 0; flex: none;
}
.rail-btn {
  width: 48px; height: 44px; margin: 4px auto; border: none; cursor: pointer;
  background: #363c49; color: #c6ccd8; border-radius: 9px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
}
.rail-btn.active { background: #4858d8; color: #fff; }
.rail-icon { font-size: 16px; line-height: 1; }
.rail-label { font-size: 8px; }
.content { flex: 1; min-width: 0; overflow: hidden; }
```

- [ ] **Step 4: Futtasd — zöld**

Run: `npm test -- AppShell`
Expected: PASS (1 teszt).

- [ ] **Step 5: `App.tsx` használja a héjat**

`src/App.tsx` teljes tartalma:
```tsx
import { useState } from "react";
import { AppShell, type ModuleId } from "./shell/AppShell";
import { ContactsModule } from "./modules/contacts/ContactsModule";

export default function App() {
  const [active, setActive] = useState<ModuleId>("contacts");
  return (
    <AppShell activeModule={active} onSelectModule={setActive}>
      {active === "contacts" ? <ContactsModule /> : <div style={{ padding: 24 }}>Beállítások (hamarosan)</div>}
    </AppShell>
  );
}
```
> A `ContactsModule` a Task 21-ben jön létre. Addig egy ideiglenes placeholder is megteszi, de a végső sorrendben a Task 21 után fordul tisztán.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: workspace-héj ikon-sávval (háromzónás váz)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: Kontaktlista panel (React komponens)

**Files:**
- Create: `src/modules/contacts/ContactList.tsx`
- Create: `src/modules/contacts/ContactList.css`

**Cél:** a bal panel: kereső + rendezés-választó + szervezetenként csoportosított, összecsukható lista monogram-avatarral. A kijelölést callbackkel jelzi (a kölcsönös kivilágításhoz).

- [ ] **Step 1: Bukó teszt**

Create: `src/modules/contacts/ContactList.test.tsx`
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContactList } from "./ContactList";
import type { Contact, Organization } from "./types";

const orgs: Organization[] = [
  { domain: "acme.hu", label: "Acme", is_personal: false, member_count: 1 },
];
const contacts: Contact[] = [
  { email: "a@acme.hu", display_name: "Anna", organization_domain: "acme.hu", message_count: 5, sent_count: 2, received_count: 3, first_seen: "2026-01-01", last_seen: "2026-03-01" },
];

describe("ContactList", () => {
  it("renders grouped contacts and fires selection", () => {
    const onSelect = vi.fn();
    render(<ContactList contacts={contacts} organizations={orgs} selectedEmail={null} onSelect={onSelect} />);
    expect(screen.getByText("Acme")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Anna"));
    expect(onSelect).toHaveBeenCalledWith("a@acme.hu");
  });

  it("filters by search query", () => {
    render(<ContactList contacts={contacts} organizations={orgs} selectedEmail={null} onSelect={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/keresés/i), { target: { value: "nincs" } });
    expect(screen.queryByText("Anna")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Futtasd — bukjon**

Run: `npm test -- ContactList`
Expected: FAIL — `ContactList` nincs.

- [ ] **Step 3: Implementáció**

`src/modules/contacts/ContactList.tsx`:
```tsx
import { useMemo, useState } from "react";
import type { Contact, Organization } from "./types";
import { groupByOrg, filterContacts, sortContacts, type SortKey } from "./list";
import { initials, colorFor } from "./avatar";
import "./ContactList.css";

interface Props {
  contacts: Contact[];
  organizations: Organization[];
  selectedEmail: string | null;
  onSelect: (email: string) => void;
}

export function ContactList({ contacts, organizations, selectedEmail, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const filtered = filterContacts(contacts, organizations, query);
    const sorted = sortContacts(filtered, sort);
    return groupByOrg(sorted, organizations);
  }, [contacts, organizations, query, sort]);

  return (
    <div className="contact-list">
      <div className="cl-controls">
        <input
          className="cl-search"
          placeholder="Keresés…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="cl-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="name">Név</option>
          <option value="frequency">Gyakoriság</option>
          <option value="recent">Utóbbi kapcsolat</option>
        </select>
      </div>
      <div className="cl-groups">
        {groups.map(({ org, contacts: cs }) => {
          const isCollapsed = collapsed[org.domain] ?? org.is_personal;
          return (
            <div key={org.domain} className="cl-group">
              <button
                className="cl-group-header"
                onClick={() => setCollapsed((c) => ({ ...c, [org.domain]: !isCollapsed }))}
              >
                <span>{isCollapsed ? "▸" : "▾"}</span>
                <span className="cl-group-label">{org.label}</span>
                <span className="cl-group-count">{cs.length}</span>
              </button>
              {!isCollapsed &&
                cs.map((c) => (
                  <button
                    key={c.email}
                    className={`cl-row ${selectedEmail === c.email ? "selected" : ""}`}
                    onClick={() => onSelect(c.email)}
                  >
                    <span className="cl-avatar" style={{ background: colorFor(c.email) }}>
                      {initials(c.display_name, c.email)}
                    </span>
                    <span className="cl-meta">
                      <span className="cl-name">{c.display_name || c.email}</span>
                      <span className="cl-email">{c.email}</span>
                    </span>
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

`src/modules/contacts/ContactList.css`:
```css
.contact-list { display: flex; flex-direction: column; height: 100%; background: #fafafb; border-right: 1px solid #e8e8ee; }
.cl-controls { display: flex; gap: 6px; padding: 8px; border-bottom: 1px solid #eee; }
.cl-search { flex: 1; padding: 5px 8px; border: 1px solid #dfe1e8; border-radius: 6px; }
.cl-sort { border: 1px solid #dfe1e8; border-radius: 6px; }
.cl-groups { overflow-y: auto; flex: 1; }
.cl-group-header { width: 100%; display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: none; border: none; cursor: pointer; font-weight: 600; color: #4858d8; }
.cl-group-count { margin-left: auto; color: #9aa; font-weight: 400; }
.cl-row { width: 100%; display: flex; align-items: center; gap: 8px; padding: 5px 12px; background: none; border: none; cursor: pointer; text-align: left; }
.cl-row.selected { background: #eaedff; }
.cl-avatar { width: 26px; height: 26px; border-radius: 50%; color: #fff; font-size: 10px; display: flex; align-items: center; justify-content: center; flex: none; }
.cl-meta { display: flex; flex-direction: column; min-width: 0; }
.cl-name { font-size: 13px; }
.cl-email { font-size: 11px; color: #889; overflow: hidden; text-overflow: ellipsis; }
```

- [ ] **Step 4: Futtasd — zöld**

Run: `npm test -- ContactList`
Expected: PASS (2 teszt).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: kontaktlista panel (kereső, rendezés, csoportok, avatar)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 20: Gráf panel (Cytoscape, hub & spoke, kölcsönös kivilágítás)

**Files:**
- Create: `src/modules/contacts/ContactGraph.tsx`
- Modify: `package.json` (cytoscape)

**Cél:** a jobb panel: Cytoscape gráf a `toGraph` kimenetéből, force-layout, org-hub méret a `size` mezőből, fix kontakt-méret, a kijelölt node kiemelése, és node-kattintásra `onSelect`.

> A Cytoscape DOM-renderelést nem unit-teszteljük (canvas-alapú); a `toGraph` már tesztelt. Itt egy „render hibamentesen" smoke-teszt elég.

- [ ] **Step 1: Cytoscape telepítése**

Run:
```bash
npm install cytoscape
npm install -D @types/cytoscape
```

- [ ] **Step 2: Smoke-teszt**

Create: `src/modules/contacts/ContactGraph.test.tsx`
```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ContactGraph } from "./ContactGraph";

// a cytoscape-ot mockoljuk, mert canvas-t igényelne
vi.mock("cytoscape", () => ({
  default: () => ({ on: vi.fn(), layout: () => ({ run: vi.fn() }), elements: () => ({ removeClass: vi.fn() }), $: () => ({ addClass: vi.fn() }), destroy: vi.fn() }),
}));

describe("ContactGraph", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <ContactGraph contacts={[]} organizations={[]} selectedEmail={null} onSelect={() => {}} />
    );
    expect(container.querySelector(".contact-graph")).toBeTruthy();
  });
});
```

- [ ] **Step 3: Futtasd — bukjon**

Run: `npm test -- ContactGraph`
Expected: FAIL — `ContactGraph` nincs.

- [ ] **Step 4: Implementáció**

`src/modules/contacts/ContactGraph.tsx`:
```tsx
import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
import type { Contact, Organization } from "./types";
import { toGraph } from "./graph";

interface Props {
  contacts: Contact[];
  organizations: Organization[];
  selectedEmail: string | null;
  onSelect: (email: string) => void;
}

export function ContactGraph({ contacts, organizations, selectedEmail, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const { nodes, edges } = toGraph(contacts, organizations);
    const cy = cytoscape({
      container: ref.current,
      elements: [...nodes, ...edges],
      style: [
        {
          selector: "node",
          style: {
            width: "data(size)",
            height: "data(size)",
            label: "data(label)",
            "font-size": 8,
            "text-valign": "bottom",
            "background-color": "#7c8cff",
            color: "#333",
          },
        },
        { selector: 'node[kind = "org"]', style: { "background-color": "#4858d8", color: "#fff", "font-size": 10, "font-weight": "bold" } },
        { selector: "edge", style: { width: 1, "line-color": "#cfd4ff", "curve-style": "haystack" } },
        { selector: ".highlighted", style: { "border-width": 3, "border-color": "#ff9d6e" } },
      ],
      layout: { name: "cose", animate: false },
    });

    cy.on("tap", 'node[kind = "person"]', (evt) => {
      const id = evt.target.id() as string; // "person:email"
      onSelect(id.replace(/^person:/, ""));
    });

    cyRef.current = cy;
    return () => cy.destroy();
  }, [contacts, organizations, onSelect]);

  // kölcsönös kivilágítás
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass("highlighted");
    if (selectedEmail) {
      cy.$(`#person\\:${CSS.escape(selectedEmail)}`).addClass("highlighted");
    }
  }, [selectedEmail]);

  return <div className="contact-graph" ref={ref} style={{ width: "100%", height: "100%" }} />;
}
```

- [ ] **Step 5: Futtasd — zöld**

Run: `npm test -- ContactGraph`
Expected: PASS (1 teszt).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Cytoscape gráf panel (hub&spoke, kivilágítás, node-kattintás)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 21: Kontaktok modul összerakása (osztott nézet + sync UI)

**Files:**
- Create: `src/modules/contacts/ContactsModule.tsx`
- Create: `src/modules/contacts/ContactsModule.css`

**Cél:** az osztott nézet: bal lista + jobb gráf, közös kijelölt-állapottal (kölcsönös kivilágítás), felül a csatlakozás/sync sáv (Gmail csatlakoztatása, progress, Frissítés). Adat a Tauri-parancsokból, progress a `sync-progress` eventből.

- [ ] **Step 1: Bukó teszt (állapot-vezérelt megjelenítés, mockolt api)**

Create: `src/modules/contacts/ContactsModule.test.tsx`
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("./api", () => ({
  api: {
    isConnected: vi.fn().mockResolvedValue(false),
    connectGmail: vi.fn().mockResolvedValue(undefined),
    startSync: vi.fn().mockResolvedValue(undefined),
    getContacts: vi.fn().mockResolvedValue([]),
    getOrganizations: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));
// a gráfot mockoljuk (canvas)
vi.mock("./ContactGraph", () => ({ ContactGraph: () => <div data-testid="graph" /> }));

import { ContactsModule } from "./ContactsModule";

describe("ContactsModule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows connect button when not connected", async () => {
    render(<ContactsModule />);
    await waitFor(() => expect(screen.getByRole("button", { name: /gmail csatlakoztat/i })).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Futtasd — bukjon**

Run: `npm test -- ContactsModule`
Expected: FAIL — `ContactsModule` nincs.

- [ ] **Step 3: Implementáció**

`src/modules/contacts/ContactsModule.tsx`:
```tsx
import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { api } from "./api";
import type { Contact, Organization } from "./types";
import { ContactList } from "./ContactList";
import { ContactGraph } from "./ContactGraph";
import "./ContactsModule.css";

export function ContactsModule() {
  const [connected, setConnected] = useState<boolean>(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const loadData = useCallback(async () => {
    const [c, o] = await Promise.all([api.getContacts(), api.getOrganizations()]);
    setContacts(c);
    setOrgs(o);
  }, []);

  useEffect(() => {
    api.isConnected().then(setConnected);
    loadData();
  }, [loadData]);

  useEffect(() => {
    const un1 = listen<[number, number]>("sync-progress", (e) => {
      setProgress({ done: e.payload[0], total: e.payload[1] });
    });
    const un2 = listen("sync-done", async () => {
      setSyncing(false);
      setProgress(null);
      await loadData();
    });
    return () => {
      un1.then((f) => f());
      un2.then((f) => f());
    };
  }, [loadData]);

  const onConnect = async () => {
    await api.connectGmail();
    setConnected(true);
    await onSync();
  };

  const onSync = async () => {
    setSyncing(true);
    try {
      await api.startSync();
    } catch (err) {
      setSyncing(false);
      setProgress(null);
      alert(`Szinkron hiba: ${err}`);
    }
  };

  return (
    <div className="contacts-module">
      <header className="cm-bar">
        <strong>Kontaktok</strong>
        <div className="cm-bar-right">
          {progress && (
            <span className="cm-progress">
              {progress.done}/{progress.total} feldolgozva
            </span>
          )}
          {!connected ? (
            <button onClick={onConnect}>Gmail csatlakoztatása</button>
          ) : (
            <button onClick={onSync} disabled={syncing}>
              {syncing ? "Szinkronizálás…" : "Frissítés"}
            </button>
          )}
        </div>
      </header>
      <div className="cm-split">
        <div className="cm-list">
          <ContactList
            contacts={contacts}
            organizations={orgs}
            selectedEmail={selected}
            onSelect={setSelected}
          />
        </div>
        <div className="cm-graph">
          <ContactGraph
            contacts={contacts}
            organizations={orgs}
            selectedEmail={selected}
            onSelect={setSelected}
          />
        </div>
      </div>
    </div>
  );
}
```

`src/modules/contacts/ContactsModule.css`:
```css
.contacts-module { display: flex; flex-direction: column; height: 100%; }
.cm-bar { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid #e2e4ea; background: #f1f2f5; }
.cm-bar-right { display: flex; align-items: center; gap: 10px; }
.cm-progress { font-size: 12px; color: #667; }
.cm-split { display: flex; flex: 1; min-height: 0; }
.cm-list { width: 42%; min-width: 280px; max-width: 460px; }
.cm-graph { flex: 1; min-width: 0; background: #fbfbfd; }
```

- [ ] **Step 4: Futtasd — zöld**

Run: `npm test -- ContactsModule`
Expected: PASS (1 teszt).

- [ ] **Step 5: Teljes frontend teszt-suite**

Run: `npm test`
Expected: PASS — minden frontend teszt (graph, list, avatar, AppShell, ContactList, ContactGraph, ContactsModule, smoke).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Kontaktok modul osztott nézete + sync UI

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 22: Végpontok közötti kézi ellenőrzés és záró ellenőrzés

**Files:**
- Modify: `README.md` (futtatási útmutató)
- Create: `.env.example`

**Cél:** valódi Gmail-fiókkal manuális próba, és a setup dokumentálása.

- [ ] **Step 1: `.env.example` létrehozása**

```bash
GMAIL_CLIENT_ID=ide-jon-a-google-cloud-desktop-kliens-id
GMAIL_CLIENT_SECRET=ide-jon-a-client-secret
```

- [ ] **Step 2: README futtatási szakasz**

A `README.md`-be vedd fel:
```markdown
## Futtatás

1. Hozz létre egy Google Cloud projektet, engedélyezd a Gmail API-t, és készíts egy
   OAuth 2.0 "Desktop app" klienst. Vedd fel magad teszt-felhasználónak.
2. Másold a `.env.example`-t `.env`-re, és töltsd ki a `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` értékeket.
3. `npm install`
4. `npm run tauri dev`
5. Kattints a "Gmail csatlakoztatása" gombra, lépj be, engedélyezd a csak-olvasási hozzáférést.
6. A sync a háttérben lefut (haladásjelzővel), majd megjelenik a lista + gráf.
```

- [ ] **Step 3: Teljes teszt-suite (Rust + frontend)**

Run:
```bash
cd src-tauri && cargo test && cd ..
npm test
```
Expected: minden zöld.

- [ ] **Step 4: Kézi end-to-end (a felhasználóval)**

Run: `npm run tauri dev`
Ellenőrizd:
- Megjelenik a workspace-héj az ikon-sávval.
- "Gmail csatlakoztatása" → böngészős consent → sikeres belépés.
- Sync lefut, progress látszik.
- A lista szervezetenként csoportosít, a "Magánszemélyek" külön, alul.
- A gráfban a szervezet-hubok mérete a tagszámmal nő, a kontakt-pontok egyformák.
- Listában kijelölés → a gráf-node kivilágosodik (és fordítva).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: futtatási útmutató és .env.example

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Önellenőrzés (a terv írójának jegyzete)

- **Spec-lefedettség:** Tauri (T1) · Gmail OAuth/readonly (T11) · közvetlen API (T10) · beérkező+elküldött (T9 `to_parsed`) · teljes+inkrementális sync (T12) · publikus-domain → Magánszemélyek (T4, T6) · kontakt-mezők incl. gyakoriság/dátum (T6, T7) · SQLite (T7, T8) · hub&spoke, hub-méret=tagszám, fix kontakt-méret (T15, T20) · osztott nézet + kölcsönös kivilágítás (T19, T20, T21) · ikon-sávos héj (T18) · avatar (T17) · tesztstratégia (minden logikai task TDD). Lefedve.
- **Inkrementális sync finomítás:** az MVP-ben a "Frissítés" a teljes sync-et futtatja újra; a valódi `history.list`-alapú delta a jövőbeli bővítés (spec 8. pont), a `sync_state.last_history_id` mező már elő van készítve. Ezt a README/“Frissítés” gomb a teljes újraszinkronnal tölti ki — nincs néma korlátozás, a viselkedés dokumentált.
- **Típus-konzisztencia:** `ContactAgg`/`OrgAgg` (Rust) ↔ `Contact`/`Organization` (TS) mezőnevei egyeznek; `toGraph` a `size`/`kind` mezőket adja, amit a Cytoscape `style` használ; `PERSONAL_DOMAIN` mindkét oldalon `"__personal__"`.
- **Placeholder-ellenőrzés:** nincs "TBD"/"később kitöltöm" kódlépésben; a 8. spec-pont jövőbeli elemei explicit nem-MVP-ként jelölve.
