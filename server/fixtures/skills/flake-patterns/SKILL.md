---
name: flake-patterns
description: Flag test constructions that make a suite fail intermittently — sleeps, real clocks, shared fixtures and live network.
type: convention
---

# Flake patterns

A flaky test is worse than a missing one. A missing test is an honest gap; a
flaky test teaches the team to re-run CI until it is green, and that habit
discards the one real failure when it finally arrives.

Flag these constructions in test code.

## 1. Sleeping instead of waiting

`setTimeout`, `sleep(200)`, `await new Promise(r => setTimeout(r, 500))` used to
let something finish. The number is a guess: too small and it fails on a loaded
CI runner, too large and the suite crawls. Wait for the condition — a promise, an
event, a poll with a deadline, the framework's own `waitFor`.

## 2. The real clock

`Date.now()`, `new Date()`, `performance.now()` read inside a test or inside the
code under test with no way to inject time. Symptoms: a test that fails at
midnight, on the last day of a month, in February, or in a timezone other than
the author's. Also any assertion on a duration or a timestamp computed live.

Inject the clock, or freeze it with the runner's fake timers.

## 3. Order dependence

A test that passes alone and fails in the suite, or vice versa. Look for:

- module-level mutable state — a counter, a cache, an array appended to across
  tests
- a fixture created in `beforeAll` and mutated by an individual test
- a database row, file or env var written by one test and read by another
- reliance on the declaration order of tests, or on a previous test having run

Each test must be able to run alone, twice, and in any order.

## 4. Live network and real services

An actual HTTP call, DNS lookup, S3 bucket, or third-party API in a unit test.
It fails on a plane, in a locked-down CI network, and whenever the far side has a
bad minute. Stub the boundary.

## 5. Unseeded randomness

`Math.random()`, `crypto.randomUUID()`, a faker without a fixed seed, feeding a
value that the assertion depends on. Fine for a value nothing asserts on; a flake
the moment it reaches an expectation.

## 6. Unawaited work

A promise started and not awaited, a floating `.then()`, an assertion inside a
callback that may run after the test ends. These pass by accident and fail under
load — and when they fail they often blame the *next* test.

## Reporting

Cite the test's `file:line` and name the condition under which it fails —
"fails when the suite runs on a machine in UTC+13", "fails when the CI runner is
loaded and the callback takes over 200 ms". A finding that just says "flaky" is
not actionable.

Severity is WARNING by default. CRITICAL only when the flake is in a test that
gates deployment and its failure mode is a false *pass*.
