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
    if let Some(open) = s.find('<') {
        if let Some(close) = s[open + 1..].find('>') {
            let email = s[open + 1..open + 1 + close].trim().to_lowercase();
            let name = s[..open].trim().trim_matches('"').trim().to_string();
            if email.contains('@') {
                return Some(Address { name, email });
            }
        }
    }
    let email = s.trim().to_lowercase();
    if email.contains('@') {
        return Some(Address { name: String::new(), email });
    }
    None
}

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
