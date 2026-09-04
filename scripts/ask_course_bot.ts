export {};

const origin = process.env.SERVICE_URL ?? "http://localhost:3000";

const response = await fetch(`${origin}/courses/ask`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    collection: "course-ops",
    courseId: "typescript-101",
    learnerId: "learner-42",
    question: "When is the capstone due and what should the educator report?",
    dueAt: "2026-09-02T09:00:00.000Z",
    completedAt: null
  })
});

const result = await response.json();
console.log(JSON.stringify(result, null, 2));
