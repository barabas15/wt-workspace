pub mod address;
pub use address::{parse_addresses, Address};

pub mod domain;
pub use domain::{domain_of, is_public_domain, sld_of};

pub mod label;
pub use label::org_label;

pub mod aggregate;
pub use aggregate::{
    aggregate, aggregate_with_merges, derive_organizations, Aggregated, ContactAgg, OrgAgg,
    ParsedMessage, PERSONAL_DOMAIN,
};
