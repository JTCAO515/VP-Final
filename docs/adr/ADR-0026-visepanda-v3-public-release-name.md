# ADR-0026: VisePanda V3 Public Release Name

Date: 2026-08-21
Status: Accepted
Owner: operator / product / architecture
Issue: [#569](https://github.com/JTCAO515/VP-Final/issues/569)
Supersedes: the public-version naming clause in
[ADR-0025](ADR-0025-vp-v3-web-experience-layer.md)

## Context

ADR-0025 accepted `VP-V3` as an internal complete traveler-frontend rewrite program and required
public copy to continue using only `VisePanda`. Since then, the V3 Early Access Shell, shared Web
composition, shared Early Access route, and an independent Vercel Preview have been implemented and
verified. The repository README and GitHub description still identify the repository as VisePanda
V2, which no longer matches the operator's chosen public release version.

On 2026-08-21, the operator explicitly decided that this repository and its current development line
are the **VisePanda V3** version. This is a D3 public-label decision because repository copy is an
external product promise, even though the requested change does not alter runtime behavior.

## Decision

1. **VisePanda V3 is the current public release version name** for `JTCAO515/VP-Final`, its README,
   GitHub repository description, and current-version development documentation.
2. **The product name remains VisePanda.** V3 is a version label, not a second product, repository,
   backend, database, identity system, commercial offer, or domain.
3. New public repository copy SHOULD use `VisePanda V3`. Existing historical `V2` baselines,
   accepted ADRs, evidence records, commit messages, Issue titles, and deployment identifiers MUST
   remain historically accurate and MUST NOT be mass-renamed.
4. `VP-V3` remains a valid historical/internal program identifier in ADR-0025 and the #551–#563
   dependency graph. New reader-facing copy SHOULD prefer `VisePanda V3` unless it is referring to
   that exact historical identifier.
5. The V3 label MUST NOT be used as evidence that planned capabilities are implemented or live.
   README and release copy MUST distinguish `implemented`, `Preview`, `unavailable`, `planned`, and
   `Production` using current repository, deployment, and operating evidence.
6. This decision does not authorize a repository rename, homepage/domain change, Vercel production
   cutover, DNS change, secret configuration, database migration, public signup claim, or capability
   activation. Those actions retain their existing Issues, operator gates, and rollback requirements.

This ADR supersedes only ADR-0025's statement that `VP-V3` is not a new public release name and that
public copy must omit the version. Every architecture, shared-runtime, styling, route, cutover,
rollback, repository, data, identity, and commercial boundary in ADR-0025 remains accepted.

## Consequences

- `README.md`, the GitHub description, the document manifest, context, and overall-design authority
  identify the current repository version as VisePanda V3.
- The frozen V2 product baseline remains a historical and inherited architecture authority until a
  separate accepted decision replaces its substantive contracts; its filename and record are not
  rewritten to simulate a V3 baseline.
- Current maturity remains narrower than the V3 roadmap: the Early Access experience is deployed to
  an isolated Preview, while its durable signup/email configuration, Planner, Canvas, Today, and
  Production cutover retain separate evidence gates.
- Reviewers must reject public copy that treats a version label, route, mock, Preview, or merge as
  production capability evidence.

## Rejected Alternatives

1. **Keep V3 internal and leave the repository labelled V2.** Rejected by the operator because it
   makes the repository's primary public description stale.
2. **Rename every V2 artifact to V3.** Rejected because it would corrupt historical decisions and
   evidence without changing their substantive authority.
3. **Treat V3 naming as production cutover.** Rejected because naming does not satisfy runtime,
   domain, monitoring, rollback, or external-configuration gates.

## Rollback and Supersession

The GitHub description and README can be reverted without runtime impact. The accepted naming
decision itself is append-only; a future public version change requires another operator-approved
superseding ADR. Reverting copy does not roll back any application, deployment, database, or domain.
