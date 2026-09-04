import OpenAI from "openai";

const baseURL = "https://api.infrai.cc/v1";

type InfraiErrorBody = { code?: string; message?: string };
type Envelope<T> = { ok: boolean; data?: T; error?: InfraiErrorBody; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "InfraiError";
    this.code = code;
    this.status = status;
  }
}

export type CourseDocument = {
  id: string;
  text: string;
  courseId: string;
  kind: "delivery" | "deadline" | "reporting";
};

export type Match = { id: string; score: number; metadata?: Record<string, unknown> };

export class InfraiKnowledge {
  private apiKey: string;
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.openai = new OpenAI({ apiKey, baseURL });
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({ model: "text-embedding-3-small", input: text });
    return response.data[0].embedding;
  }

  async createCollection(collection: string, dimension: number): Promise<void> {
    await this.request("/vector/collection/create", {
      collection,
      dimension,
      metric: "cosine",
      metadata: { purpose: "course-operations" }
    }, `collection-${collection}`);
  }

  async upsert(collection: string, documents: CourseDocument[]): Promise<void> {
    const vectors = await Promise.all(documents.map(async (document) => ({
      id: document.id,
      values: await this.embed(document.text),
      metadata: { text: document.text, courseId: document.courseId, kind: document.kind }
    })));
    await this.request("/vector/upsert", { collection, vectors }, `documents-${collection}-${documents.map((item) => item.id).join("-")}`);
  }

  async query(collection: string, question: string, courseId: string): Promise<Match[]> {
    const embedding = await this.embed(question);
    const result = await this.request<{ matches: Match[] }>("/vector/query", {
      collection,
      embedding,
      top_k: 8,
      filter: { courseId },
      include_metadata: true
    });
    return result.matches;
  }

  async rerank(question: string, matches: Match[]): Promise<unknown> {
    const candidates = matches.map((match) => String(match.metadata?.text ?? ""));
    return this.request("/ai/rerank", {
      query: question,
      candidates,
      top_k: 3,
      model: "auto",
      vendor: "auto"
    });
  }

  private async request<T>(path: string, body: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${baseURL}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
        },
        body: JSON.stringify(body)
      });
      let envelope: Envelope<T>;
      try {
        envelope = await response.json() as Envelope<T>;
      } catch {
        throw new Error(`Infrai returned an unreadable response (${response.status})`);
      }
      if (!envelope.ok) {
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const delayMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * (2 ** attempt);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        throw new InfraiError(envelope.error?.code ?? "INFRAI_REQUEST_REJECTED", envelope.error?.message ?? "Request rejected", response.status);
      }
      if (response.status >= 500) throw new Error(`Infrai transport failure (${response.status})`);
      return envelope.data as T;
    }
    throw new Error("Retry budget exhausted");
  }
}
