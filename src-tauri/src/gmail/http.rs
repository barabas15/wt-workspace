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
            // FONTOS: query URL-kódolva (szóköz=%20), különben reqwest URL-parse hiba.
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
