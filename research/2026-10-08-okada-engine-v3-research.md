# OKADA ENGINE v3.0 — research specification

Updated: 2026-10-08
Status: research build; NOT a claim to reproduce Toshio Okada's actual cognition.

## Invariants
- Independent, opt-in thinking module. Never force it into a pipeline or run it automatically.
- Preserve: anomaly detection → change observation frame → decompose → strip proper nouns → extract relations → find isomorphisms → transplant → re-concretize.
- Preserve deep drilling: phenomenon, relation, mechanism, cause, function, cognition/emotion, information, force/resources.
- Human chooses whether to explore, stop, test, or combine modules.

## Three optional hypotheses (NOT verified as the author's named methods)
1. **Improvised hypothesis generation**: formulate a provisional explanation before full understanding, articulate it, revise it, and explicitly check for fabricated premises.
2. **Multi-problem unification**: search for a single causal structure explaining multiple otherwise separate problems; compare against separate explanations and test counterexamples.
3. **Historical premise disruption**: treat today's convention as contingent; reconstruct the problem under another era's constraints and identify which relationships survive.

Each operation is opt-in; none replaces the core sequence. Label the output as hypothesis until tested.

## Source research protocol: target 300 distinct items
Prioritize author-written essays, original books, official lecture recordings, and faithful transcripts. Proposed sampling: 80 thinking/writing; 80 media criticism; 60 society/history; 40 human behavior/advice; 40 discussions/improvisation. These are TARGET COUNTS, not completed counts. Deduplicate recordings and transcripts of the same lecture.

For every analyzed item record:
- Source ID, title, date, original URL, medium, access status, exact accessible passage/section.
- The question/problem; observations; comparisons; transformation steps; conclusion; alternative explanation and counterexample.
- Evidence tier: **A = explicitly stated by Okada**, **B = inferred from traceable examples**, **C = PRINCIPLE LOOP extension**.
- Confidence and limitations. Do not call B or C a direct statement by the author.

Initial research leads (not 300 analyzed items):
- https://blog.livedoor.jp/okada_toshio/archives/51519315.html — 戦闘思考力講座 (hypothesis: output-driven thinking).
- https://blog.livedoor.jp/okada_toshio/archives/51560970.html — ぼくたちの洗脳社会 (historical/social modeling).
- https://blog.livedoor.jp/okada_toshio/archives/51560982.html — 同書あとがき (hypothesis: integrating multiple problems).
- https://note.com/otaking — official transcript archive; check original access and dates.

## Comparison experiment
Use the SAME unseen observation for v2 and v3. Blindly evaluate structural explanation, testability, novelty, portability, and unsupported assertions. Preserve both outputs and human judgment; never treat more ideas as proof of higher accuracy. Require counterexamples and a falsification plan.

## Implementation notes
The UI's existing OKADA engine is defined in `src/engines/index.ts`, general optional operations in `src/engines/transform.ts`. This document is the authoritative research specification until empirical validation. The 300-item study has not been completed.
