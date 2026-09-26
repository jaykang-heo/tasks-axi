<!-- backlog-compact-preamble: skim view of the canonical request map. -->
# Backlog

## [/] 1. Request delivery reliability (repo: hp) <!--#request-delivery-->
  ## Destination
  Approved architecture verified end to end.

- [/] 1. Implement single-backlog request delivery reliability (repo: tracker-axi) (kind: ship) (since 2026-09-20) <!--#request-delivery-reliability-->
  Authorized architecture: tasks-axi owns execution; tracker-axi owns request capture and links.
- [/] 2. Enforce worker-owned reliable request delivery (repo: hp) (kind: ship) (hold: Captain decision pending on the lease wording) (hold-kind: captain) <!--#firstmate-delivery-enforcement-->
  Captain hold set: 2026-09-22T05:27:52Z
- [ ] 3. Verify and roll out the combined changes blocked-by: request-delivery-reliability blocked-by: firstmate-delivery-enforcement (repo: hp) (kind: ship) <!--#request-delivery-integrated-verification-->

## [/] 2. Wallet currency follow-up (repo: healingpaper) <!--#wallet-currency-->
- [x] 1. Ledger audit data/backlog-architecture-reframe/report.md (kind: scout) (reported 2026-09-21) <!--#wallet-currency-overpayment-followup-->
- [ ] 2. Captain decision four items (kind: captain) (hold: 보고서 미결 4건) (hold-kind: captain) <!--#wallet-currency-overpayment-decisions-->
  Captain hold set: 2026-09-21T07:09:44Z
- [x] 3. Decide reward processor rollout https://github.com/o/r/pull/12 (kind: captain) (merged 2026-09-22) <!--#reward-processor-production-rollout-->
  Captain decision:
  rollout proceeds behind the flag.

## [/] 3. Unfiled <!--#unfiled-->
- [ ] 1. Inspect unattended PRs discovered-from: request-delivery-reliability (repo: rune) (kind: scout) (priority: 0) <!--#unattended-pr-cleanup-->
- [x] 2. Old loose end (kind: ship) (done 2026-06-02) <!--#old-loose-end-->
