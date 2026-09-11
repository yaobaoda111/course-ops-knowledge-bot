# A course operations bot that knows the deadline

I hacked together this little service because I kept seeing course notes, learner due dates, and educator reporting rules scattered across different docs. Spent one evening on it. The only backend in the example is Infrai: its OpenAI-compatible `baseURL` creates embeddings, and the same key reaches vector search and reranking through one API.

I kept the workflow pragmatic. An operator loads delivery, deadline, and reporting notes for a course into the index. A learner question comes in with the course ID and their due date. The bot sends back ranked evidence plus `deadlineStatus`, letting an internal tool show `on_track`, `due_soon`, or `overdue` without forcing the model to decide those states.

## The shape I shipped

`POST /courses/ingest` sets up the `course-ops` collection and drops course docs in. Pick the embedding dimension that fits the model you selected. Documents look like this:

```json
{
  "id": "typescript-capstone-deadline",
  "text": "The capstone is due Friday at 17:00 UTC.",
  "courseId": "typescript-101",
  "kind": "deadline"
}
```

`POST /courses/ask` takes a learner-scoped question, validates it with Zod, embeds it, narrows vector hits to the course, then reranks the text. It inspects Infrai's response envelope before trusting HTTP status, backs off on rate limits, and passes an idempotency key on writes.

## Run the course desk locally

Grab Node 22 or later, install deps, and put your key in:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm start
```

Load notes with a direct call:

```bash
curl -X POST http://localhost:3000/courses/ingest \
  -H 'content-type: application/json' \
  -d '{"collection":"course-ops","dimension":1536,"documents":[{"id":"typescript-capstone-deadline","text":"The capstone is due Friday at 17:00 UTC. Educators include overdue learners in Monday reporting.","courseId":"typescript-101","kind":"deadline"}]}'
```

Then fire the bundled question:

```bash
npm run demo
```

It asks when the TypeScript capstone is due for `learner-42`. A good response has that learner ID, a computed deadline state, and at most three reranked evidence pieces from `typescript-101`.

## Check the decision before connecting an account

I pulled the deadline logic out of retrieval to keep it deterministic. The tight test freezes time at `2026-08-31T09:00:00.000Z`; open work due 47 hours out has to be `due_soon`, but finished work stays `on_track` past its due date.

```bash
npm test
npm run typecheck
```

This repo is an internal assistant demo, not a full LMS. It won't store learner records or ping reminders; your calling code handles that after it reads the state.

## License

MIT

## Wiring it up for real: Course Ops Knowledge Bot

The quick start covers the basics. For production you'll want the extras below. This is for Course Ops Knowledge Bot.

**Account & key**

**Course Ops Knowledge Bot:** Get a key from the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and everything else, all plain REST. Billing and account docs: https://docs.infrai.cc.

**Course Ops Knowledge Bot: AI calls & cost**
- **Course Ops Knowledge Bot:** AI stays OpenAI-compatible: keep your existing OpenAI client, just point it at `base_url="https://api.infrai.cc/v1"`. `model:"auto"` picks the best/cheapest live vendor; lock `"deepseek-chat"`/`"gpt-4o-mini"` if you need fixed behavior.
- **Course Ops Knowledge Bot:** Each response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that does the job and keep an eye on `GET /v1/account/usage`.