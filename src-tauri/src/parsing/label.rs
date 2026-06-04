/// A domain második szintű részéből (SLD) emberbarát címke.
/// Pl. "acme.hu" -> "Acme", "ceg.co.uk" -> "Ceg".
pub fn org_label(domain: &str) -> String {
    let parts: Vec<&str> = domain.split('.').filter(|p| !p.is_empty()).collect();
    let sld = match parts.len() {
        0 => return "Ismeretlen".to_string(),
        1 => parts[0],
        _ => parts[0],
    };
    let mut chars = sld.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => "Ismeretlen".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capitalizes_sld() {
        assert_eq!(org_label("acme.hu"), "Acme");
        assert_eq!(org_label("webtown.hu"), "Webtown");
    }

    #[test]
    fn handles_multilevel_tld() {
        assert_eq!(org_label("nagyceg.co.uk"), "Nagyceg");
    }

    #[test]
    fn keeps_hyphenated() {
        assert_eq!(org_label("nagy-ceg.hu"), "Nagy-ceg");
    }

    #[test]
    fn fallback_for_empty() {
        assert_eq!(org_label(""), "Ismeretlen");
    }
}
