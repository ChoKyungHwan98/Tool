# AI Contract

AI is advisory and non-mutating.

## Provider Interface

```ts
interface AiProvider {
  proposeSchema(input): Promise<SchemaProposal>;
  reviewNormalization(input): Promise<SchemaProposal>;
  explainImpact(input): Promise<SchemaProposal>;
}
```

## Output Requirements

AI must return structured proposal data:

- summary
- assumptions
- clarification questions
- findings
- alternatives
- proposed operations
- migration plan
- risks
- affected entity IDs
- confidence

`proposedOperations` are not executed directly. They must be converted into Commands, validated, impact-reviewed, and approved.

## Phase 9 Completion

- `MockAiProvider` is connected to the AI Review panel.
- Mock AI review runs locally and includes deterministic validator findings.
- AI proposals are displayed as structured assumptions, operations, migration notes, risks, and confidence.
- A safe runtime-export coverage suggestion can be staged into Change Review.
- AI suggestions still cannot mutate the project directly.

Deferred:

- Parsing AI operations into the full Command set.
- Side-by-side schema diff for AI-generated changes.
- OpenRouter proposal execution beyond the guarded free/schema-only path.
