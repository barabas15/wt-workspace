import { invoke } from "@tauri-apps/api/core";
import type { Contact, Organization } from "./types";

export const api = {
  isConnected: () => invoke<boolean>("is_connected"),
  connectGmail: () => invoke<void>("connect_gmail"),
  startSync: () => invoke<void>("start_sync"),
  getContacts: () => invoke<Contact[]>("get_contacts"),
  getOrganizations: () => invoke<Organization[]>("get_organizations"),
};
