/// Az e-mail `@` utáni része, kisbetűsítve. None, ha nincs `@`.
pub fn domain_of(email: &str) -> Option<String> {
    let at = email.rfind('@')?;
    let d = email[at + 1..].trim().to_lowercase();
    if d.is_empty() { None } else { Some(d) }
}

/// A domain második szintű neve (a márkanév-rész), kisbetűsítve — ez a szervezet
/// AZONOSÍTÓJA. TLD-független, így `a1.si` és `a1.at` ugyanazt adja ("a1"), tehát egy
/// csoportba kerülnek. Pl. "acme.hu" -> "acme", "a1.co.uk" -> "a1".
pub fn sld_of(domain: &str) -> String {
    domain
        .split('.')
        .find(|p| !p.is_empty())
        .unwrap_or("")
        .to_lowercase()
}

const PUBLIC_DOMAINS: &[&str] = &[
    "gmail.com", "googlemail.com", "outlook.com", "hotmail.com",
    "live.com", "msn.com", "icloud.com", "me.com", "aol.com",
    "proton.me", "protonmail.com", "gmx.com",
    "freemail.hu", "citromail.hu", "indamail.hu", "vipmail.hu",
];

const PUBLIC_PREFIXES: &[&str] = &["yahoo."];

/// Igaz, ha a domain szabad/publikus webmail (nem egy szervezet sajátja).
pub fn is_public_domain(domain: &str) -> bool {
    let d = domain.to_lowercase();
    if PUBLIC_DOMAINS.contains(&d.as_str()) {
        return true;
    }
    PUBLIC_PREFIXES.iter().any(|p| d.starts_with(p))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_domain() {
        assert_eq!(domain_of("anna@acme.hu"), Some("acme.hu".to_string()));
        assert_eq!(domain_of("ANNA@Acme.HU"), Some("acme.hu".to_string()));
    }

    #[test]
    fn returns_none_for_invalid() {
        assert_eq!(domain_of("notanemail"), None);
    }

    #[test]
    fn detects_public_domains() {
        assert!(is_public_domain("gmail.com"));
        assert!(is_public_domain("outlook.com"));
        assert!(is_public_domain("freemail.hu"));
        assert!(is_public_domain("yahoo.co.uk"));
    }

    #[test]
    fn company_domain_is_not_public() {
        assert!(!is_public_domain("acme.hu"));
        assert!(!is_public_domain("webtown.hu"));
    }

    #[test]
    fn sld_is_tld_independent() {
        assert_eq!(sld_of("a1.si"), "a1");
        assert_eq!(sld_of("a1.at"), "a1");
        assert_eq!(sld_of("acme.hu"), "acme");
        assert_eq!(sld_of("acme.co.uk"), "acme");
        assert_eq!(sld_of("WEBTOWN.HU"), "webtown");
    }
}
