// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
pub mod parsing;
pub mod db;
pub mod gmail;
pub mod sync;
pub mod commands;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // A .env betöltése a projekt gyökeréből (a GMAIL_CLIENT_ID/SECRET ott van).
    // dotenvy a cwd-ből felfelé keres, így `npm run tauri dev` (cwd=src-tauri)
    // esetén is megtalálja a repo-gyökér .env-jét. Hiánya nem hiba.
    dotenvy::dotenv().ok();

    let data_dir = dirs::data_dir().unwrap().join("ceges-workspace");
    std::fs::create_dir_all(&data_dir).expect("adat-könyvtár létrehozása");
    let conn = rusqlite::Connection::open(data_dir.join("workspace.sqlite")).expect("DB megnyitás");
    crate::db::init_schema(&conn).expect("séma inicializálás");

    tauri::Builder::default()
        .manage(commands::AppState { db: std::sync::Mutex::new(conn) })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            commands::is_connected,
            commands::connect_gmail,
            commands::start_sync,
            commands::get_contacts,
            commands::get_organizations,
            commands::delete_organization,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
