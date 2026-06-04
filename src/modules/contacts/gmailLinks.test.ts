import { describe, it, expect } from "vitest";
import { composeUrl, searchUrl } from "./gmailLinks";

describe("gmailLinks", () => {
  it("composeUrl prefills the recipient (URL-encoded)", () => {
    expect(composeUrl("anna@acme.hu")).toBe(
      "https://mail.google.com/mail/?view=cm&fs=1&to=anna%40acme.hu",
    );
  });

  it("searchUrl puts the email into the Gmail search", () => {
    expect(searchUrl("anna@acme.hu")).toBe(
      "https://mail.google.com/mail/#search/anna%40acme.hu",
    );
  });
});
