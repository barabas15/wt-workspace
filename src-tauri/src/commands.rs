use std::sync::Mutex;
use rusqlite::Connection;
use tauri::{State, Emitter, AppHandle, Manager};

use crate::db::{read_contacts, read_organizations};
use crate::gmail::auth::{run_oauth_flow, valid_access_token, KeyringTokenStore, OAuthConfig, TokenStore};
use crate::gmail::HttpGmailApi;
use crate::parsing::{ContactAgg, OrgAgg};
use crate::sync::run_full_sync;

pub struct AppState {
    pub db: Mutex<Connection>,
}

fn oauth_config() -> Result<OAuthConfig, String> {
    let client_id = std::env::var("GMAIL_CLIENT_ID").map_err(|_| {
        "Hiányzó GMAIL_CLIENT_ID. Hozd létre a projekt gyökerében a .env fájlt a \
         GMAIL_CLIENT_ID és GMAIL_CLIENT_SECRET kulcsokkal (lásd .env.example), majd \
         indítsd újra az appot."
            .to_string()
    })?;
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
pub fn start_sync(app: AppHandle) -> Result<(), String> {
    // Env-ellenőrzés a fő szálon (gyors), hogy hiányzó kulcsoknál azonnal hibázzunk.
    let cfg = oauth_config()?;

    // A tényleges sync HOSSZÚ és blokkoló (sok szekvenciális HTTP-hívás). Háttérszálon
    // futtatjuk: a szinkron Tauri-parancs a FŐ szálon fut, így ott a sync lefagyasztaná
    // az UI-t ("nem válaszol"). A haladást/eredményt event-eken keresztül jelezzük.
    std::thread::spawn(move || {
        let result: anyhow::Result<()> = (|| {
            let store = KeyringTokenStore;
            let token = valid_access_token(&cfg, &store)?;
            let api = HttpGmailApi::new(token);
            let state = app.state::<AppState>();
            let conn = state
                .db
                .lock()
                .map_err(|e| anyhow::anyhow!("DB zár hiba: {e}"))?;
            run_full_sync(&api, &conn, &mut |done, total| {
                let _ = app.emit("sync-progress", (done, total));
            })
        })();

        match result {
            Ok(()) => {
                let _ = app.emit("sync-done", ());
            }
            Err(e) => {
                let _ = app.emit("sync-error", e.to_string());
            }
        }
    });

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

/// Csoport (szervezet) törlése: tagjai az "Egyéb" alá kerülnek, és re-sync után is törölt marad.
#[tauri::command]
pub fn delete_organization(domain: String, state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    crate::db::delete_organization(&conn, &domain).map_err(|e| e.to_string())
}
