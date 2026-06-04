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
pub fn run_oauth_flow(cfg: &OAuthConfig, store: &dyn TokenStore) -> anyhow::Result<()> {
    let client = BasicClient::new(
        ClientId::new(cfg.client_id.clone()),
        Some(ClientSecret::new(cfg.client_secret.clone())),
        AuthUrl::new("https://accounts.google.com/o/oauth2/v2/auth".into())?,
        Some(TokenUrl::new("https://oauth2.googleapis.com/token".into())?),
    );

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

    let _ = open::that(auth_url.to_string());

    let request = server.recv()?;
    let url = format!("http://localhost{}", request.url());
    let parsed = url::Url::parse(&url)?;
    let code = parsed.query_pairs().find(|(k, _)| k == "code").map(|(_, v)| v.to_string())
        .ok_or_else(|| anyhow::anyhow!("Nincs authorization code a redirectben"))?;

    let response = tiny_http::Response::from_string("Bejelentkezés kész. Visszatérhetsz az alkalmazásba.");
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_roundtrip_in_memory() {
        let store = InMemoryTokenStore::default();
        assert!(store.load().unwrap().is_none());
        let tok = StoredToken { access_token: "at".into(), refresh_token: "rt".into(), expires_at_unix: 123 };
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
