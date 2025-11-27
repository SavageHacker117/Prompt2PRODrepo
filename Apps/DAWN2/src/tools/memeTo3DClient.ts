// src/tools/memeTo3DClient.ts

export interface MemeJobSummary {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error';
  model: string;
  max_assets: number;
  created_at: string;
}

export interface MemeJobManifestAsset {
  name: string;
  path: string;      // filesystem path or URL
  type: string;      // e.g. "placeholder-json" or "glb"
}

export interface MemeJobDetail {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error';
  model: string;
  max_assets: number;
  created_at: string;
  error_message?: string | null;
  image_path?: string | null;
  manifest?: {
    version: number;
    job_id: string;
    model: string;
    created_at: string;
    completed_at?: string;
    assets: MemeJobManifestAsset[];
    [key: string]: unknown;
  };
}

export interface MemeBackendConfig {
  baseUrl: string;
}

/**
 * Very small client for the BackendMemeTo3D FastAPI service.
 * DAWN2 uses this to discover jobs + manifests.
 */
export class MemeTo3DClient {
  private baseUrl: string;

  constructor(config: MemeBackendConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Backend ${this.baseUrl}${path} responded ${res.status}: ${text}`,
      );
    }
    return (await res.json()) as T;
  }

  /** GET /api/jobs → list of summaries */
  async listJobs(): Promise<MemeJobSummary[]> {
    const data = await this.getJson<{ jobs: MemeJobSummary[] }>('/api/jobs');
    return data.jobs ?? [];
  }

  /** GET /api/jobs/{id} → detail + manifest */
  async getJob(jobId: string): Promise<MemeJobDetail> {
    return this.getJson<MemeJobDetail>(`/api/jobs/${jobId}`);
  }

  /**
   * Convenience: fetch most recent job by created_at.
   * Returns null if no jobs exist.
   */
  async getLatestJob(): Promise<MemeJobDetail | null> {
    const jobs = await this.listJobs();
    if (!jobs.length) return null;

    const latest = jobs.reduce((a, b) =>
      new Date(a.created_at) > new Date(b.created_at) ? a : b,
    );
    return this.getJob(latest.id);
  }
}
