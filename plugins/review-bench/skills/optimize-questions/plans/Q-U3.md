# Plan: Contact Form for Marketing Site

## Context

The marketing team wants a "Contact Us" form on the company website so potential
customers can submit inquiries. The form collects name, email, company, message, and
an optional phone number. Submissions go to `POST /api/contact` which writes to a
database and triggers an email notification to the sales team.

## Current State

- Static marketing site built with Next.js 14 (App Router)
- No existing contact form — current page has a mailto link
- API endpoint `POST /api/contact` is already deployed and tested
- Validation: name required, email required + valid format, message required (10+ chars)
- API can take 2-5 seconds under load due to email sending in the request path

## Approach

We will create a contact form component at `src/components/ContactForm.tsx` and embed it
in the existing contact page. The form will use controlled React state for all fields,
client-side validation before submission, and call the API endpoint via fetch. We keep
it simple — a clean form with a submit button.

## Files to Modify

- `src/components/ContactForm.tsx` (new) — form component
- `src/app/contact/page.tsx` — embed ContactForm component
- `src/types/contact.ts` (new) — form data types

## Implementation

### Phase 1: Types & Component Shell

1. Create `contact.ts` with `ContactFormData` interface:
   ```typescript
   interface ContactFormData {
     name: string;
     email: string;
     company: string;
     phone: string;
     message: string;
   }
   ```

2. Create `ContactForm.tsx` component skeleton with useState for each field
3. Render form with labeled inputs: Name, Email, Company, Phone (optional), Message textarea

### Phase 2: Validation

1. Add `validateForm(data: ContactFormData)` function that returns error map
2. Check name is non-empty, email matches regex, message is 10+ characters
3. Display inline error messages below each invalid field
4. Run validation on blur for each field (show errors as user tabs through)
5. Run full validation on submit attempt

### Phase 3: Submission

1. Wire the form's `onSubmit` handler to:
   - Call `validateForm()` — abort if errors
   - Call `fetch('POST', '/api/contact', body)` with form data
   - On success (200): reset form fields to empty
   - On failure (4xx/5xx): log the error to console
2. Add the submit button: `<button type="submit">Send Message</button>`

### Phase 4: Integration

1. Import `ContactForm` into `src/app/contact/page.tsx`
2. Replace the existing mailto link with the form component
3. Add a heading "Get in Touch" above the form
4. Style the form to match existing site typography and spacing

## Verification

1. Load the contact page — form renders with all 5 fields
2. Submit empty form — validation errors appear for name, email, message
3. Fill valid data and submit — verify POST request fires with correct JSON body
4. Verify form resets after successful submission
5. Test with invalid email format — error message appears
6. Test message under 10 characters — error message appears
7. Inspect network tab — confirm single POST request per submission
