/** Shared Redis keys for API + worker (in-memory / no-Postgres dev). */
export const redisKeys = {
  extractions: (sessionId: string) => `extractions:session:${sessionId}`,
  chunks: (sessionId: string) => `chunks:session:${sessionId}`,
  sessionRecord: (sessionId: string) => `session:record:${sessionId}`,
  attachmentStatusHash: (sessionId: string) =>
    `session:attachment_status:${sessionId}`,
};
