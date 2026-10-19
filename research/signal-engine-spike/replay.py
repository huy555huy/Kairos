"""Real ONA process + small host-policy probe. No model/screen/Agent integration claimed."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import platform
import re
import statistics
import subprocess
import time

ROOT = Path(__file__).resolve().parent
LOCK = json.loads((ROOT / "engine-lock.json").read_text())
parser = argparse.ArgumentParser()
parser.add_argument("--ona", type=Path, default=ROOT / ".cache/ona/NAR")
args = parser.parse_args()
binary = args.ona.resolve()
logs = ROOT / "logs"
logs.mkdir(exist_ok=True)
checks, runs = [], []


def check(name, condition, detail):
    checks.append({"name": name, "passed": bool(condition), "detail": detail})


def evidence(root, term, frequency=1.0, confidence=0.3, at=0):
    return {"id": root, "term": term, "f": frequency, "c": confidence, "at": at}


def evaluate(name, facts, query, *, cycles=100, raw_duplicates=False):
    # Stable replay order; same root may only have one current assertion.
    distinct = {}
    for fact in facts:
        if fact["id"] in distinct and distinct[fact["id"]] != fact:
            raise ValueError("Conflicting root revision: supersede before inference")
        distinct[fact["id"]] = fact
    if len(distinct) > LOCK["maxInputRoots"]:
        raise ValueError("root capacity exceeded")
    ordered = sorted(facts if raw_duplicates else distinct.values(), key=lambda f: (f["at"], f["id"]))
    # Facts in this probe are controlled Narsese fixtures, NOT free-form model output.
    atoms = set(re.findall(r"[A-Za-z][A-Za-z0-9_]*", " ".join(f["term"] for f in ordered) + query))
    if len(atoms) > LOCK["maxAtoms"]:
        raise ValueError("atom capacity exceeded")
    lines = ["*volume=0", "*motorbabbling=false"]
    for fact in ordered:
        lines += [f'*stampimport=[{fact["id"]}]', f'{fact["term"]}. {{{fact["f"]:.9f} {fact["c"]:.9f}}}']
        # Fixed inference budget after each pair makes relational learning reproducible.
        if len(ordered) > 3 and fact["id"] % 2 == 0:
            lines.append("50")
    lines += [str(cycles), query + "?"]
    nal = "\n".join(lines) + "\n"
    started = time.perf_counter()
    result = subprocess.run([str(binary), "shell"], input=nal, text=True, capture_output=True, timeout=15)
    elapsed = (time.perf_counter() - started) * 1000
    (logs / f"{name}.nal").write_text(nal)
    (logs / f"{name}.log").write_text(result.stdout + result.stderr)
    if result.returncode:
        raise RuntimeError(f"{name}: ONA exit {result.returncode}: {result.stderr[-500:]}")
    if " executed with args " in result.stdout:
        raise RuntimeError("Unexpected operation execution")
    answers = [line for line in result.stdout.splitlines() if line.startswith("Answer:") and "Truth:" in line]
    if not answers:
        raise RuntimeError(f"{name}: no answer")
    line = answers[-1]
    match = re.search(r"frequency=([0-9.]+), confidence=([0-9.]+)", line)
    f, c = map(float, match.groups())
    stamp = [int(n) for n in re.search(r"Stamp=\[(.*?)\]", line)[1].split(",") if n]
    assert set(stamp) <= set(distinct), (name, stamp)
    answer = {"f": f, "c": c, "expectation": c * (f - 0.5) + 0.5, "stamp": stamp}
    runs.append({"name": name, "inputRoots": len(distinct), "elapsedMs": round(elapsed, 3), "answer": answer})
    return answer


def aged(fact, hours, half_life=24):
    # Decay evidence WEIGHT for current-focus inference; historical observations are unchanged.
    w = fact["c"] / (1 - fact["c"])
    wt = w * 2 ** (-hours / half_life)
    return {**fact, "c": wt / (1 + wt)}


def review_eligible(answer, *, anchor=True, pending=False, expressed=False, same_decision=False):
    # Eligibility to ask a semantic participation reviewer, NOT a decision to speak.
    return (answer["c"] >= 0.5 and answer["expectation"] >= 0.75 and anchor
            and not pending and not expressed and not same_decision)


term = "<p_kairos --> t_tls>"
weak = [evidence(i, term) for i in range(1, 4)]
one = evaluate("one_weak", weak[:1], term)
three = evaluate("three_independent", weak, term)
repeat = evaluate("same_root_100_times", weak[:1] * 100, term, raw_duplicates=True)
counter = evaluate("counterevidence", weak[:2] + [evidence(3, term, 0, 0.9)], term)
check("weak_evidence_accumulates", abs(three["c"] - 0.5625) < 1e-6 and three["c"] > one["c"], three)
check("same_source_does_not_accumulate", repeat["c"] == one["c"] and repeat["stamp"] == [1], repeat)
check("counter_changes_belief_before_agent", counter["f"] < 0.1 and not review_eligible(counter), counter)

# Only observed shared attributes are supplied; no <kairos --> tls> conclusion/rule is input.
related, unrelated = [], []
for i in range(3):
    related += [evidence(i * 2 + 1, f"<r{i} --> p_kairos>", confidence=0.9),
                evidence(i * 2 + 2, f"<r{i} --> t_tls>", confidence=0.6)]
    project, topic = [("p_kairos", "t_tls"), ("p_shopping", "t_shoes"), ("p_travel", "t_flights")][i]
    unrelated += [evidence(i * 2 + 1, f"<r{i} --> {project}>", confidence=0.9),
                  evidence(i * 2 + 2, f"<r{i} --> {topic}>", confidence=0.6)]
association = evaluate("association_induction", related, term)
control = evaluate("unrelated_same_count", unrelated, term)
check("relation_is_induced", association["c"] > 0.6 and len(association["stamp"]) == 6, association)
check("content_not_count_changes_result", review_eligible(association) and not review_eligible(control), {"related": association, "control": control})
dedup = evaluate("duplicated_channels", related * 10, term)
check("host_collapses_duplicate_facts", dedup == association, dedup)
after_day = evaluate("one_day_decay", [aged(f, 24) for f in weak], term)
check("wall_time_changes_eligibility", abs(after_day["c"] - 0.391304) < 1e-6 and not review_eligible(after_day), after_day)
retracted = evaluate("retracted_root", [weak[0], weak[2]], term)
check("retraction_rebuilds_without_old_support", set(retracted["stamp"]) == {1, 3} and retracted["c"] < three["c"], retracted)
reloaded = evaluate("restart_and_arrival_order", json.loads(json.dumps(list(reversed(related)))), term)
check("snapshot_replay_is_reproducible", reloaded == association, reloaded)
check("current_context_required", not review_eligible(association, anchor=False), "Host selector only")
check("correction_invalidates_immediately", not review_eligible(association, pending=True), "Host selector only")
check("expressed_claim_not_reoffered", not review_eligible(association, expressed=True), "Host selector only")
check("same_context_hold_not_retried", not review_eligible(association, same_decision=True), "Host selector only")
check("first_supported_relevant_claim_is_eligible", review_eligible(association), "Eligibility, not live LLM offer")
capacity = evaluate("sixty_four_independent_roots", [evidence(i, term) for i in range(1, 65)], term)
check("stamp_covers_entire_bounded_pack", len(set(capacity["stamp"])) == 64 and abs(capacity["c"] - (192 / 199)) < 1e-6, capacity)
try:
    evaluate("over_capacity", [evidence(i, term) for i in range(1, 66)], term)
except ValueError:
    check("over_capacity_rejected_before_engine", True, "65 roots rejected")
else:
    check("over_capacity_rejected_before_engine", False, "65 roots accepted")

# Replay upstream's labelled-example diagnostic: useful as a check, not evidence of cold-start intent inference.
example = binary.parent / "examples/nal/diagnostic.nal"
if example.exists():
    result = subprocess.run([str(binary), "shell"], input=example.read_text(), text=True, capture_output=True, timeout=15)
    (logs / "upstream-diagnostic.log").write_text(result.stdout + result.stderr)
    answer_lines = [line for line in result.stdout.splitlines() if line.startswith("Answer:")]
    check("upstream_diagnostic_example", result.returncode == 0 and any("<{patientC} --> [(ill * 1)]>" in line for line in answer_lines) and any("<{patientC} --> [(ill * 2)]>" in line for line in answer_lines),
          "Upstream labelled-example analogy; not a personal-assistant quality test")

report = {
    "engine": LOCK, "platform": platform.platform(),
    "binarySha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
    "scope": "Synthetic structured facts -> real ONA. Wall time, dedup, retraction and review eligibility use the host probe. No live perception, language bridge, participation model or pi execution.",
    "checks": checks, "runs": runs,
    "medianProcessMs": round(statistics.median(r["elapsedMs"] for r in runs), 3),
}
(ROOT / "results.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
for c in checks:
    print(("PASS" if c["passed"] else "FAIL") + " " + c["name"])
print(f'{sum(c["passed"] for c in checks)}/{len(checks)}; median process {report["medianProcessMs"]} ms')
raise SystemExit(0 if all(c["passed"] for c in checks) else 1)
