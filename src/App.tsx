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
