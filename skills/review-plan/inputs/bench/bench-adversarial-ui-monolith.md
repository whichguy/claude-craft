# Project Plan: Global Feedback Widget Implementation

## Context
Our platform currently lacks a centralized way for users to provide feedback on specific pages. We need to implement a "Feedback Widget" that can be easily dropped into any page to capture user sentiment, comments, and screenshots. This widget should be a self-contained React component to minimize integration overhead for other teams.

## Git Setup
- Branch: `feat/feedback-widget`
- Base: `main`
- Scope: Frontend

## Implementation Steps

### 1. Create Monolithic Component
We will implement the entire widget in a single file `src/components/Feedback.jsx`. This file will contain approximately 400 lines of code to ensure all logic, styles, and markup are in one place for easy portability.
- Include all CSS using template literals and a basic `style` tag injector.
- Implement the form markup (Input, Textarea, Select, Submit).
- Handle all validation logic within the main component function.
- Integrate the submission API call directly in the `handleSubmit` function.

### 2. Layout and Styling
- The widget will be fixed to the bottom-right corner of the viewport.
- We will use a fixed width of `500px` and a height of `650px` to maintain a consistent design regardless of the container.
- Implement a `window.addEventListener('resize', ...)` handler to recalculate the widget's position relative to the viewport height to prevent it from overlapping with the footer.

### 3. User Interaction
- Use a `<div>` with an `onClick` handler for the "Close" and "Submit" buttons to keep the styling simple and avoid default browser button behaviors.
- Implement input fields for "Name", "Email", and "Feedback" using standard `<input>` and `<textarea>` tags.
- The `onSubmit` handler will trigger the `POST` request to `/api/v1/feedback`.

## Verification
- Verify the widget appears on the page.
- Test that clicking the submit `div` triggers a network request.
- Confirm the widget stays in the bottom-right corner when the window is resized.

## Risks
- The submission API might be slow.
- The widget might cover some content on the page.
- CSS might conflict with global styles if not scoped correctly.
