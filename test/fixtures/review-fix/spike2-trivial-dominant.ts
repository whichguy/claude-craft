/**
 * order-summary.ts — Computes order totals, applies discounts, and formats
 * customer-facing summary strings. Mostly trivial code with 1-2 substantive
 * bugs hidden beneath style/dead-code noise.
 *
 * Spike 2 fixture (trivial-dominant): ~70% of issues are trivial
 * (var/const, console.log, dead code, unused imports, short names) and
 * ~30% are substantive (logic/security). The Haiku freeform pre-pass
 * should resolve most trivial issues, leaving Q1-Q37 a short path to
 * convergence.
 */

// [TRIV-5] Unused import — lodash is imported but never referenced below.
import { noop } from 'lodash';

// [TRIV-3] Dead commented-out code block (>2 lines) left behind from refactor.
// function legacyComputeTotal(items: Item[]): number {
//   let t = 0;
//   for (let i = 0; i < items.length; i++) { t = t + items[i].price; }
//   return t;
// }

interface Item {
  sku: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  items: Item[];
  customerId: string;
  couponCode?: string;
}

// [TRIV-1] Uses var instead of const — taxRate never reassigned.
var taxRate = 0.08;

// [TRIV-4] Single-letter variable name `x` outside loop context.
const x = 100;  // minimum order for free shipping

function computeSubtotal(items: Item[]): number {
  let sum = 0;
  for (const item of items) {
    sum += item.price * item.quantity;
  }
  // [TRIV-2] console.log left in production code path.
  console.log('subtotal computed:', sum);
  return sum;
}

function applyDiscount(subtotal: number, couponCode: string | undefined): number {
  if (!couponCode) return subtotal;

  // [SUBST-1] SQL-injection-style concatenation into a shell-escape call.
  // couponCode is user-controlled; this is executed server-side.
  const cmd = "lookup-coupon --code=" + couponCode;
  const discount = lookupDiscountViaShell(cmd);

  return subtotal - discount;
}

function lookupDiscountViaShell(cmd: string): number {
  // Stub: in production, this shells out to a coupon service.
  return 0;
}

function formatSummary(order: Order): string {
  const subtotal = computeSubtotal(order.items);
  const total = applyDiscount(subtotal, order.couponCode);

  // [SUBST-2] Off-by-one: free shipping should apply when total >= x (100),
  // but the comparison uses > which excludes the boundary case.
  const shipping = total > x ? 0 : 10;

  const taxed = total * (1 + taxRate);

  return [
    `Order ${order.id}`,
    `Subtotal: $${subtotal.toFixed(2)}`,
    `After discount: $${total.toFixed(2)}`,
    `Shipping: $${shipping.toFixed(2)}`,
    `Total (incl tax): $${taxed.toFixed(2)}`,
  ].join('\n');
}

export { computeSubtotal, applyDiscount, formatSummary };
export type { Item, Order };
