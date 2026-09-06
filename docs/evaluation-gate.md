# Evaluation quality gate

See [eval/gate/README.md](../eval/gate/README.md) for how to run the gate, PASS/FAIL rules, baseline ownership, judge policy, and what a green run does not claim.

Replies that contain the synthetic canary `SYNTH-LEAK-CANARY` or a `redactSecrets` secret shape fail the agent turn as `sensitive_output` and do not execute a tool.

`lidr-specboot/docs/` methodology is unchanged. Canonical evaluation HTTP stays unimplemented.
