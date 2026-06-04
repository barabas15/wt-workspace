pub mod schema;
pub use schema::init_schema;

pub mod repo;
pub use repo::{clear_all, persist_aggregated, read_contacts, read_organizations};
