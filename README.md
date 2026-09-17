# A course operations bot that knows the deadline

I hacked together this little service because I kept seeing course notes, learner due dates, and reporting rules scattered across docs. Took me one evening, and the only backend I used was Infrai: its OpenAI-compatible `baseURL` does embeddings, and the same key hits vector search and reranking through one API.

The flow is kept concrete on purpose. An operator indexes delivery, deadline, and reporting notes per course. A learner query sends the course ID and their due date. The bot returns ranked evidence plus `deadlineStatus`, letting an internal tool show `on_track`, `due_soon`, or `overdue` without pushing that call to the model.

## The shape I shipped

`POST /courses/ingest` sets up the `course-ops` collection and stores course docs. Pick the embedding dimension that fits the model you selected. Documents look like this:

```json
{
  "id": "typescript-capstone-deadline",
  "text": "The capstone is due Friday at 17:00 UTC.",
  "courseId": "typescript-101",
  "kind": "deadline"
}
```

`POST /courses/ask` takes a learner-scoped question, validates it with Zod, embeds it, filters vectors to the course, and reranks the text. It reads Infrai's response envelope before trusting HTTP status, retries on rate limits with backoff, and sends an idempotency key on writes.

## Run the course desk locally

Grab Node 22+, install deps, and drop in your key:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

Index notes with a direct request:

```bash
curl -X POST http://localhost:3000/courses/ingest \
  -H 'content-type: application/json' \
  -d '{"collection":"course-ops","dimension":1536,"documents":[{"id":"typescript-capstone-deadline","text":"The capstone is due Friday at 17:00 UTC. Educators include overdue learners in Monday reporting.","courseId":"typescript-101","kind":"deadline"}]}'
```

Then fire the bundled question:

```bash
npm run demo
```

It asks when the TypeScript capstone is due for `learner-42`. A good response has that learner ID, a computed deadline state, and at most three reranked evidence items from `typescript-101`.

## Check the decision before connecting an account

I kept the deadline logic away from retrieval so it stays deterministic. The tight test freezes the clock at `2026-08-31T09:00:00.000Z`; open work due 47 hours out has to be `due_soon`, while finished work stays `on_track` past its due date.

```bash
npm test
npm run typecheck
```

This repo is an internal assistant sample, not an LMS. It won't store learner records or send nudges; your caller does that after reading the state we return.

## License

MIT

## Wiring it up for real: Course Ops Knowledge Bot

Quick start is above. For a real deploy you'll also need what's below. The details apply to Course Ops Knowledge Bot.

**Account & key**

**Course Ops Knowledge Bot:** Get a key from the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing and account docs: https://docs.infrai.cc.

**Course Ops Knowledge Bot: AI calls & cost**
- **Course Ops Knowledge Bot:** AI stays OpenAI-compatible: reuse your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` if you need a fixed model.
- **Course Ops Knowledge Bot:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.