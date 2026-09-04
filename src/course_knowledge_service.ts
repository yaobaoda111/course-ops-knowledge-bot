import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import { deadlineStatus } from "./deadline_status.ts";
import { InfraiError, InfraiKnowledge } from "./infrai_knowledge.ts";

const ingestSchema = z.object({
  collection: z.string().min(1),
  dimension: z.number().int().positive(),
  documents: z.array(z.object({
    id: z.string().min(1),
    text: z.string().min(1),
    courseId: z.string().min(1),
    kind: z.enum(["delivery", "deadline", "reporting"])
  })).min(1)
});

const askSchema = z.object({
  collection: z.string().min(1),
  courseId: z.string().min(1),
  learnerId: z.string().min(1),
  question: z.string().min(3),
  dueAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable()
});

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readBody(request: AsyncIterable<Uint8Array>): Promise<unknown> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
const knowledge = new InfraiKnowledge(apiKey);

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/courses/ingest") {
      const input = ingestSchema.parse(await readBody(request));
      await knowledge.createCollection(input.collection, input.dimension);
      await knowledge.upsert(input.collection, input.documents);
      return json(response, 201, { indexed: input.documents.length, collection: input.collection });
    }
    if (request.method === "POST" && request.url === "/courses/ask") {
      const input = askSchema.parse(await readBody(request));
      const status = deadlineStatus(input.dueAt, input.completedAt, new Date());
      const matches = await knowledge.query(input.collection, input.question, input.courseId);
      const evidence = await knowledge.rerank(input.question, matches);
      return json(response, 200, { learnerId: input.learnerId, deadlineStatus: status, evidence });
    }
    return json(response, 404, { error: "Route not found" });
  } catch (error) {
    if (error instanceof z.ZodError) return json(response, 400, { error: "Invalid request", details: error.issues });
    if (error instanceof InfraiError) return json(response, error.status >= 400 && error.status < 500 ? error.status : 502, { error: error.code, message: error.message });
    return json(response, 500, { error: error instanceof Error ? error.message : "Unexpected error" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Course knowledge service listening on http://localhost:${port}`));
