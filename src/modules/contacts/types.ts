export interface Contact {
  email: string;
  display_name: string;
  organization_domain: string;
  message_count: number;
  sent_count: number;
  received_count: number;
  first_seen: string;
  last_seen: string;
}

export interface Organization {
  domain: string;
  label: string;
  is_personal: boolean;
  member_count: number;
}

export const PERSONAL_DOMAIN = "__personal__";
