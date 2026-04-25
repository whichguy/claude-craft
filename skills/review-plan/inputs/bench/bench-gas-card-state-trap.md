# Implementation Plan: Multi-step Setup Wizard
## Context
Adding a setup wizard to the Gmail Add-on to guide users through initial configuration.

## Steps
1. Define a global `WizardState` object at the top of `Wizard.gs`.
2. Implement `buildWizardCard(step)` which renders different UI based on `WizardState.currentStep`.
3. Add an action handler `onNextStep` that increments `WizardState.currentStep` and returns a `Navigation.updateCard()`.
4. Register `onNextStep` in `__events__`.

## Verification
- Open the Add-on, click "Next" on Step 1, and verify that Step 2 is displayed.
