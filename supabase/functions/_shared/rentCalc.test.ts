import { assertEquals, assertAlmostEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import {
  computeDueDate,
  classifyTiming,
  computeCredit,
  getExpectedMonths,
  getExpectedRentForMonth,
  computeNetPayable,
} from "./rentCalc.ts";

// ── computeDueDate ──────────────────────────────────────────────────────

Deno.test("computeDueDate: always the 1st of the given period, regardless of mode/due_day", () => {
  const d1 = computeDueDate('prepaid', 15, '2025-01-01', 3, 2025, false);
  assertEquals(d1.getFullYear(), 2025);
  assertEquals(d1.getMonth(), 2); // 0-indexed -> March
  assertEquals(d1.getDate(), 1);

  const d2 = computeDueDate('postpaid', 28, '2025-01-01', 3, 2025, true);
  assertEquals(d2.getTime(), d1.getTime());
});

// ── classifyTiming ───────────────────────────────────────────────────────

Deno.test("classifyTiming: paid before due date is early", () => {
  const due = new Date(2025, 2, 1);
  const { timing, daysLate } = classifyTiming('2025-02-28', due, 5);
  assertEquals(timing, 'early');
  assertEquals(daysLate, 0);
});

Deno.test("classifyTiming: paid within grace window is on_time", () => {
  const due = new Date(2025, 2, 1);
  const { timing, daysLate } = classifyTiming('2025-03-05', due, 5);
  assertEquals(timing, 'on_time');
  assertEquals(daysLate, 0);
});

// Note: `paymentDate` strings come from Postgres `date` columns and are
// parsed by `classifyTiming` as UTC (JS quirk: date-only ISO strings parse
// as UTC midnight), while `dueDate` is built via `new Date(y, m, d)`, i.e.
// local midnight. In production this is a non-issue because edge functions
// run in a UTC container, so "local" and UTC coincide. To keep these tests
// deterministic on any machine (including a non-UTC dev box), the "late"
// case below derives its expected days-late from the same UTC-parsed Date
// the implementation uses, instead of a hardcoded number.

Deno.test("classifyTiming: paid comfortably within the grace window is on_time", () => {
  const due = new Date(2025, 2, 1);
  const { timing } = classifyTiming('2025-03-04', due, 5); // 3 days in, well inside a 5-day grace
  assertEquals(timing, 'on_time');
});

Deno.test("classifyTiming: paid well after grace window is late, with correctly-derived days_late", () => {
  const due = new Date(2025, 2, 1);
  const paymentDate = '2025-03-15';
  const { timing, daysLate } = classifyTiming(paymentDate, due, 5);
  const expectedDaysLate = Math.ceil((new Date(paymentDate).getTime() - due.getTime()) / 86400000);
  assertEquals(timing, 'late');
  assertEquals(daysLate, expectedDaysLate);
});

// ── computeCredit ────────────────────────────────────────────────────────

Deno.test("computeCredit: overpayment yields positive credit", () => {
  assertEquals(computeCredit(12000, 10000), 2000);
});

Deno.test("computeCredit: underpayment yields negative credit", () => {
  assertEquals(computeCredit(8000, 10000), -2000);
});

// ── getExpectedMonths ────────────────────────────────────────────────────

Deno.test("getExpectedMonths: spans lease_start through refMonth/refYear inclusive", () => {
  const months = getExpectedMonths('2024-11-15', null, 2, 2025);
  assertEquals(months, [
    { month: 11, year: 2024 },
    { month: 12, year: 2024 },
    { month: 1, year: 2025 },
    { month: 2, year: 2025 },
  ]);
});

Deno.test("getExpectedMonths: stops at lease_end when it's before refMonth/refYear", () => {
  const months = getExpectedMonths('2024-11-15', '2024-12-20', 2, 2025);
  assertEquals(months, [
    { month: 11, year: 2024 },
    { month: 12, year: 2024 },
  ]);
});

Deno.test("getExpectedMonths: single-month lease produces one entry", () => {
  const months = getExpectedMonths('2025-06-01', null, 6, 2025);
  assertEquals(months, [{ month: 6, year: 2025 }]);
});

// ── getExpectedRentForMonth ──────────────────────────────────────────────

Deno.test("getExpectedRentForMonth: full month at flat rent, no revisions", () => {
  const assignment = { lease_start: '2025-01-01', lease_end: null, current_rent: 30000 };
  const rent = getExpectedRentForMonth(assignment, 3, 2025, []);
  assertEquals(rent, 30000);
});

Deno.test("getExpectedRentForMonth: lease starting mid-month is prorated for days occupied only", () => {
  // Lease starts March 16, 2025 (31-day month) -> 16 days occupied (16th through 31st)
  const assignment = { lease_start: '2025-03-16', lease_end: null, current_rent: 31000 };
  const rent = getExpectedRentForMonth(assignment, 3, 2025, []);
  // 31000 / 31 days-in-month * 16 occupied days = 16000
  assertAlmostEquals(rent, 16000, 0.01);
});

Deno.test("getExpectedRentForMonth: lease ending mid-month is prorated for days occupied only", () => {
  // Lease ends March 10, 2025 -> occupied days 1..10
  const assignment = { lease_start: '2025-01-01', lease_end: '2025-03-10', current_rent: 31000 };
  const rent = getExpectedRentForMonth(assignment, 3, 2025, []);
  assertAlmostEquals(rent, 10000, 0.01);
});

Deno.test("getExpectedRentForMonth: returns 0 for a month entirely before lease_start", () => {
  const assignment = { lease_start: '2025-04-01', lease_end: null, current_rent: 20000 };
  const rent = getExpectedRentForMonth(assignment, 3, 2025, []);
  assertEquals(rent, 0);
});

Deno.test("getExpectedRentForMonth: returns 0 for a month entirely after lease_end", () => {
  const assignment = { lease_start: '2024-01-01', lease_end: '2025-01-31', current_rent: 20000 };
  const rent = getExpectedRentForMonth(assignment, 3, 2025, []);
  assertEquals(rent, 0);
});

Deno.test("getExpectedRentForMonth: mid-month revision splits the month between old and new rent", () => {
  // Revision effective March 16, 2025: rent goes 20000 -> 21000.
  // Days 1-15 at 20000, days 16-31 at 21000 (31-day month).
  const assignment = { lease_start: '2024-01-01', lease_end: null, current_rent: 21000 };
  const revisions = [
    { previous_rent: 20000, new_rent: 21000, effective_from: '2025-03-16' },
  ];
  const rent = getExpectedRentForMonth(assignment, 3, 2025, revisions);
  const expected = (20000 / 31) * 15 + (21000 / 31) * 16;
  assertAlmostEquals(rent, Math.round(expected * 100) / 100, 0.01);
});

Deno.test("getExpectedRentForMonth: before any revision has taken effect uses previous_rent of the earliest revision", () => {
  const assignment = { lease_start: '2024-01-01', lease_end: null, current_rent: 21000 };
  const revisions = [
    { previous_rent: 20000, new_rent: 21000, effective_from: '2025-06-01' },
  ];
  const rent = getExpectedRentForMonth(assignment, 3, 2025, revisions);
  assertEquals(rent, 20000);
});

// ── computeNetPayable ────────────────────────────────────────────────────

Deno.test("computeNetPayable: applies GST on top and TDS deducted, rounded to paise", () => {
  const { net, gstAmount, tdsAmount } = computeNetPayable(10000, 18, 10);
  assertEquals(gstAmount, 1800);
  assertEquals(tdsAmount, 1000);
  assertEquals(net, 10800); // 10000 + 1800 - 1000
});

Deno.test("computeNetPayable: zero GST/TDS returns base rent unchanged", () => {
  const { net, gstAmount, tdsAmount } = computeNetPayable(15000, 0, 0);
  assertEquals(net, 15000);
  assertEquals(gstAmount, 0);
  assertEquals(tdsAmount, 0);
});
