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
        self.headers.iter().find(|(k, _)| k.eq_ignore_ascii_case(name)).map(|(_, v)| v.as_str())
    }

    /// A felhasználó saját címe alapján ParsedMessage-é alakít.
    /// None, ha nincs használható fél vagy dátum.
    pub fn to_parsed(&self, self_email: &str) -> Option<ParsedMessage> {
        let self_lc = self_email.to_lowercase();
        let received = self.label_ids.iter().any(|l| l == "INBOX")
            || !self.label_ids.iter().any(|l| l == "SENT");
        let raw = if received {
            self.header("From").unwrap_or("").to_string()
        } else {
            let to = self.header("To").unwrap_or("");
            let cc = self.header("Cc").unwrap_or("");
            format!("{to},{cc}")
        };
        let counterparts: Vec<_> = parse_addresses(&raw).into_iter().filter(|a| a.email != self_lc).collect();
        if counterparts.is_empty() { return None; }
        let date = parse_date(self.header("Date")?)?;
        Some(ParsedMessage { counterparts, received, date })
    }
}

/// RFC2822 dátum -> "YYYY-MM-DD".
/// A `parse_from_rfc2822` validates the day-of-week, which may be wrong in
/// real-world email headers. We strip the optional "Www, " prefix so that
/// chrono can parse the remaining date+time without strict DoW validation.
/// We also strip an optional trailing timezone comment, e.g. "+0100 (UTC)".
fn parse_date(raw: &str) -> Option<String> {
    let s = raw.trim();
    // Strip optional weekday prefix "Mon, " / "Wed, " etc.
    let mut s = if s.len() > 5 && s.as_bytes().get(3) == Some(&b',') {
        s[5..].trim_start().to_string()
    } else {
        s.to_string()
    };
    // Strip trailing "(...)" comment, e.g. "+0100 (UTC)" -> "+0100".
    if let Some(idx) = s.find('(') {
        s = s[..idx].trim_end().to_string();
    }
    let dt = DateTime::parse_from_str(&s, "%d %b %Y %H:%M:%S %z").ok()?;
    Some(dt.format("%Y-%m-%d").to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_date_with_trailing_tz_comment() {
        let msg = GmailMessage {
            id: "m4".into(), label_ids: vec!["INBOX".into()],
            headers: vec![
                ("From".into(), "x@acme.hu".into()),
                ("Date".into(), "Wed, 10 Jan 2026 09:00:00 +0100 (UTC)".into()),
            ],
        };
        assert_eq!(msg.to_parsed("me@firma.hu").unwrap().date, "2026-01-10");
    }

    #[test]
    fn converts_received_message() {
        let msg = GmailMessage {
            id: "m1".into(), label_ids: vec!["INBOX".into()],
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
            id: "m2".into(), label_ids: vec!["SENT".into()],
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
            id: "m3".into(), label_ids: vec!["SENT".into()],
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
