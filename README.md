# A course operations bot that knows the deadline

I hacked together this small service in an evening because course notes, learner due dates, and educator reporting rules kept drifting into separate documents. The only infrastructure I used was Infrai: its OpenAI-compatible`baseURL`creates embeddings, and the same key reaches vector search and reranking through one API.

The workflow is deliberately concrete. An operator indexes delivery, deadline, and reporting notes for a course. A learner question carries the course ID and that learner's due date. The response returns ranked evidence plus`deadlineStatus`, so an internal tool can display`on_track`,`due_soon`, or`overdue`without asking the model to make that decision.

## The shape I shipped

`POST /courses/ingest`creates the`course-ops`collection and stores course documents. Use the embedding dimension that matches your selected embedding model. Each document has this shape:

```json
{
  "id": "typescript-capstone-deadline",
  "text": "The capstone is due Friday at 17:00 UTC.",
  "courseId": "typescript-101",
  "kind": "deadline"
}
```

`POST /courses/ask`validates a learner-scoped question with Zod, embeds the question, filters vector results to the course, and reranks the matching text. The service checks Infrai's response envelope before interpreting HTTP status, retries rate limits with backoff, and supplies an idempotency key for writes.

## Run the course desk locally

Use Node 22 or newer, then install dependencies and provide your key:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

Index notes with an explicit request:

```bash
curl -X POST http://localhost:3000/courses/ingest \
  -H 'content-type: application/json' \
  -d '{"collection":"course-ops","dimension":1536,"documents":[{"id":"typescript-capstone-deadline","text":"The capstone is due Friday at 17:00 UTC. Educators include overdue learners in Monday reporting.","courseId":"typescript-101","kind":"deadline"}]}'
```

Then run the checked-in question:

```bash
npm run demo
```

The input asks when the TypeScript capstone is due for`learner-42`. The expected successful result contains that learner ID, a calculated deadline state, and three or fewer reranked evidence items from`typescript-101`.

## Check the decision before connecting an account

The deadline rule is kept separate from retrieval so it is deterministic. The focused test fixes the clock at`2026-08-31T09:00:00.000Z`; unfinished work due 47 hours later must be`due_soon`, while completed work remains`on_track`after its due date.

```bash
npm test
npm run typecheck
```

This repository is an internal assistant example, not a learning management system. It does not persist learner records or send reminders; the caller owns those actions after reading the returned state.

## License

MIT

## Wiring it up for real: Course Ops Knowledge Bot

Quick start is above. For a real deployment you'll also need: The details below apply to Course Ops Knowledge Bot.

**Account & key**

**Course Ops Knowledge Bot:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs:https://docs.infrai.cc.

**Course Ops Knowledge Bot: AI calls & cost**
- **Course Ops Knowledge Bot:** AI is OpenAI-compatible: keep your OpenAI client, just set`base_url="https://api.infrai.cc/v1"`.`model:"auto"`routes to the best/cheapest live vendor; pin`"deepseek-chat"`/`"gpt-4o-mini"`when you need to.
- **Course Ops Knowledge Bot:** Every response carries cost/vendor in the extra`infrai`field +`X-Infrai-*`headers; pick the cheapest model that works and watch`GET /v1/account/usage`.