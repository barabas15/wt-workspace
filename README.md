# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Futtatás

1. Hozz létre egy Google Cloud projektet, engedélyezd a Gmail API-t, és készíts egy
   OAuth 2.0 "Desktop app" klienst. Vedd fel magad teszt-felhasználónak.
2. Másold a `.env.example`-t `.env`-re, és töltsd ki a `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` értékeket.
3. `npm install`
4. `npm run tauri dev`
5. Kattints a "Gmail csatlakoztatása" gombra, lépj be, engedélyezd a csak-olvasási hozzáférést.
6. A sync a háttérben lefut (haladásjelzővel), majd megjelenik a lista + gráf.

### Tesztek

- Frontend: `npm test`
- Rust mag: `cd src-tauri && cargo test`
