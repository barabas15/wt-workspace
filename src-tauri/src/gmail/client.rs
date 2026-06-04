use crate::gmail::model::GmailMessage;

/// Egy üzenet-azonosító.
#[derive(Debug, Clone)]
pub struct MessageRef {
    pub id: String,
}

/// A Gmail API absztrakciója — mockolható a teszteléshez.
pub trait GmailApi {
    fn profile_email(&self) -> anyhow::Result<String>;
    fn list_message_ids(&self) -> anyhow::Result<Vec<MessageRef>>;
    fn get_message(&self, id: &str) -> anyhow::Result<GmailMessage>;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parsing::aggregate;
    use std::collections::HashMap;

    struct MockApi { email: String, ids: Vec<String>, messages: HashMap<String, GmailMessage> }

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
        GmailMessage { id: id.into(), label_ids: vec![label.into()],
            headers: vec![("From".into(), from.into()), ("To".into(), to.into()), ("Date".into(), date.into())] }
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
