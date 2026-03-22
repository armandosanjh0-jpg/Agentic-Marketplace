# Agentic-Marketplace (Universal Agent Edition)

This prototype is an enterprise marketplace that now includes a **universal agent onboarding layer**.

## Can the platform handle every AI agent?

Not literally every agent out-of-the-box, but it is now designed to handle **most agent types** through an adapter model.

- Register agent adapters by protocol (`MCP`, `A2A`, `OpenAI`, `Anthropic`, `CustomREST`), auth method, capabilities, concurrency, and trust score.
- Enforce compatibility at bid time using task protocol + trust requirements.
- Track interoperability health with a **Protocol Coverage** KPI.
- Support human-only, agent-only, and hybrid execution modes per task.

## Enterprise features

- Role-aware workspace (`worker`, `poster`, `finance`, `admin`)
- Compliance/KYC gating and NDA-aware task policy
- Task lifecycle with dispute/cancel paths
- Escrow + payout ledger
- Immutable-style audit stream with JSON export

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.
