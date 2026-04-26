# Project Plan: Payment and Ledger Service Refactor

## Objective
Refactor the transaction processing logic to ensure strict atomicity between the `PaymentService` and the `LedgerService`.

## Context
Currently, payments are processed and then ledgers are updated asynchronously. We want to move to a synchronous "Handshake" model to prevent race conditions during peak load.

## Implementation Steps
1. **PaymentService Update**:
   - Update `processPayment(paymentId)` to first initiate the transaction.
   - Call `LedgerService.reserveFunds(paymentId)`.
   - The `PaymentService` will then enter a `wait` state, listening for a `FundsReserved` event from the `LedgerService` before finalizing the external gateway call.
2. **LedgerService Update**:
   - Update `reserveFunds(paymentId)` to perform a balance check.
   - Before committing the reservation, the `LedgerService` must now call `PaymentService.getLockStatus(paymentId)` to ensure the payment hasn't been cancelled by another process (e.g., a timeout or user cancellation).
   - Only after receiving `LOCK_ACQUIRED` from the `PaymentService` will the `LedgerService` update the balance and emit the `FundsReserved` event.
3. **Synchronization**: Ensure both services use the same distributed lock key based on the `paymentId`.

## Success Criteria
- Payments and ledger updates are logically linked.
- The system prevents double-spending by checking lock status before any ledger modification.
