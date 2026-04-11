# Form 990 E-File Handoff Packet — {{LEGAL_NAME}} — Tax Year {{YYYY}}

**Prepared by:** /form990 skill  
**Prepared:** {{DATE}}  
**Status:** Ready for e-file provider ingestion (P8 gate review passed)

---

## What Is This Package?

This package contains everything a Form 990-authorized e-file provider needs to complete
your return submission. **These files do not constitute a filed return** — a human officer
must review and sign, and an authorized provider must transmit via IRS Modernized e-File (MeF).

---

## Files in This Package

| File | Purpose | Audience |
|---|---|---|
| `artifacts/form990-dataset.json` | All line-keyed answers (Parts I–XII + Schedules) | E-file provider data import |
| `artifacts/form990-reference-filled.pdf` | Visual reference of the filled return | Officer review + board sign-off |
| `artifacts/schedule-o-narratives.md` | Governance narratives to paste into provider UI | E-file provider + officer |
| `artifacts/cpa-review-report.md` | Quality gate results (18 checks) | Officer + CPA pre-signature review |
| `artifacts/schedule-b-public.md` | Redacted contributor list (public inspection copy) | Public + auditors |
| `artifacts/schedule-b-filing.md` | FULL contributor list with names + addresses | IRS ONLY — do not disclose publicly |

> **⚠ Schedule B Notice.** Under IRC §6104(d)(3)(A), the full Schedule B (with donor names
> and addresses) is disclosed to the IRS but is NOT subject to public inspection for most
> 501(c)(3) organizations. Do not include `schedule-b-filing.md` in the public inspection
> copy. The `schedule-b-public.md` file (with "Anonymous" substituted) is the correct
> public-inspection version.

---

## Next Steps for the Signing Officer

1. **Review the filled reference PDF.** Open `form990-reference-filled.pdf` and review
   every part. Compare key numbers to your budget and bank statements.
2. **Review the CPA gate report.** Open `cpa-review-report.md` and confirm all Gate-1
   items show PASS.
3. **Sign the return.** An officer of the organization must sign (printed name, title, date).
   Your e-file provider will capture this digitally.
4. **Submit to your e-file provider.** Share this entire package (excluding `schedule-b-filing.md`
   from any public channels) with your chosen provider.
5. **Keep a copy.** Retain the signed return and supporting documents for at least 7 years.

---

## E-File Provider Options

> **Note:** This list is provided for convenience. Verify current IRS-authorized status at
> the official IRS provider page before selecting a provider. IRS authorization can change.
> URL: https://www.irs.gov/e-file-providers/exempt-organizations-e-file-providers-for-forms-990-990-ez-990-pf-and-990-n

Common providers for Form 990:
- **TaxBandits** (taxbandits.com) — web-based, affordable for small nonprofits
- **Tax990** (tax990.com) — SPAN Enterprises product (same company as TaxBandits)
- **ExpressTaxExempt** (expresstaxexempt.com) — SPAN Enterprises product
  > Note: TaxBandits, Tax990, and ExpressTaxExempt are all products of SPAN Enterprises.
  > They are sibling products, not independent vendors.
- **Drake Tax** — full-service accounting software; used by CPA firms
- **Lacerte / ProConnect** (Intuit) — used by CPA firms
- **UltraTax CS** (Thomson Reuters) — used by CPA firms

If your CPA prepared the return or is reviewing it, ask them to transmit via their
licensed software — they will already have an ETIN (Electronic Transmitter ID Number).

---

## Import Guidance

Most web-based providers (TaxBandits, Tax990, ExpressTaxExempt) accept manual data entry.
Some offer JSON or XML import.

**Using `form990-dataset.json`:** The file is structured as:
```json
{
  "parts": { "I": {...}, "II": {...}, ... },
  "schedules": { "A": {...}, "O": {...}, ... },
  "reconciliation": { ... }
}
```
Each key maps to an IRS Part and line number. If your provider supports structured import,
share this file directly with their technical support for mapping assistance.

**If manual entry is required:** Use `form990-reference-filled.pdf` as the visual guide
and enter numbers line by line into the provider's web form.

---

## Signature Requirements

- **Who must sign:** An officer of the organization (President, Executive Director, Treasurer,
  CFO, or equivalent)
- **What to provide:** Printed name, title, date signed, phone number
- **Paid preparer:** If a CPA or accountant prepared this return, they must also sign
  (Paid Preparer Use Only section)
- **Electronic signature:** E-file providers collect this during submission via PIN or
  digital signature workflow — you do not need a wet signature on the PDF

---

## Filing Deadlines

| Organization | Due date | Extended due date |
|---|---|---|
| Calendar year (Jan 1 – Dec 31) | May 15 | November 15 (+6 months, Form 8868) |
| Non-calendar fiscal year | 4½ months after FY end | 10½ months after FY end |

**For {{LEGAL_NAME}} (FY {{FISCAL_YEAR_START}} – {{FISCAL_YEAR_END}}):**
- Original due date: {{ORIGINAL_DUE_DATE}}
- Extended due date: {{EXTENDED_DUE_DATE}}

**Form 8868 (Automatic Extension):** Available at https://www.irs.gov/forms-pubs/about-form-8868.
File before the original due date for an automatic 6-month extension. An officer must sign
Form 8868, but no IRS approval or explanation of cause is required — the extension is automatic
upon timely filing.

**Weekend/Holiday Shift (IRC §7503):** If the due date (original or extended) falls on a
Saturday, Sunday, or legal holiday, the deadline automatically shifts to the next business day.
Verify the actual due date for your specific tax year before filing.
