export class ResearchJobNotFoundException extends Error {
  constructor(jobId: string) {
    super(`Research job not found with id: ${jobId}`);
    this.name = 'ResearchJobNotFoundException';
    Error.captureStackTrace(this, this.constructor);
  }
}
