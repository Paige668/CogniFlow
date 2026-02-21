import { Injectable } from '@nestjs/common';

interface RequestMetric {
    count: number;
    totalDuration: number;
}

@Injectable()
export class MetricsService {
    private readonly startTime = Date.now();
    private readonly requestCounts: Map<string, RequestMetric> = new Map();
    private chatRequests = 0;
    private documentsUploaded = 0;
    private errors = 0;

    incrementRequest(path: string, durationMs: number) {
        const key = path.split('/').slice(0, 3).join('/') || '/';
        const existing = this.requestCounts.get(key) ?? { count: 0, totalDuration: 0 };
        this.requestCounts.set(key, {
            count: existing.count + 1,
            totalDuration: existing.totalDuration + durationMs,
        });
        if (path.includes('/documents/chat')) this.chatRequests++;
        if (path.includes('/documents') && !path.includes('/chat')) {
            // Count POST to /documents as upload
        }
    }

    incrementDocumentUpload() {
        this.documentsUploaded++;
    }

    incrementError() {
        this.errors++;
    }

    getSnapshot() {
        const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        const endpointStats: Record<string, { requests: number; avg_duration_ms: number }> = {};

        for (const [path, metric] of this.requestCounts.entries()) {
            endpointStats[path] = {
                requests: metric.count,
                avg_duration_ms: Math.round(metric.totalDuration / metric.count),
            };
        }

        return {
            uptime_seconds: uptimeSeconds,
            started_at: new Date(this.startTime).toISOString(),
            total_requests: Array.from(this.requestCounts.values()).reduce((s, m) => s + m.count, 0),
            chat_requests: this.chatRequests,
            documents_uploaded: this.documentsUploaded,
            errors_total: this.errors,
            endpoints: endpointStats,
        };
    }
}
