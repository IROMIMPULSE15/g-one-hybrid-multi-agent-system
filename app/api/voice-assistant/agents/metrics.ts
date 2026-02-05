import fs from 'fs';
import path from 'path';

interface MetricEntry {
    timestamp: string;
    message: string;
    predictedLabel: string;
    confidence: number;
    handled: boolean;
    usedFallback: boolean;
    responseTime: number;
}

export class AgentMetrics {
    private metricsPath: string;
    private metrics: MetricEntry[] = [];
    private maxEntries: number = 1000; // Keep last 1000 entries

    constructor(agentName: string) {
        const dataDir = path.join(process.cwd(), 'app', 'api', 'voice-assistant', 'data');
        this.metricsPath = path.join(dataDir, `${agentName}_metrics.json`);
        this.load();
    }

    private load() {
        try {
            if (fs.existsSync(this.metricsPath)) {
                const data = fs.readFileSync(this.metricsPath, 'utf8');
                this.metrics = JSON.parse(data);
            }
        } catch (error) {
            console.warn('[Metrics] Failed to load metrics:', error);
            this.metrics = [];
        }
    }

    public log(entry: Omit<MetricEntry, 'timestamp'>) {
        const metricEntry: MetricEntry = {
            timestamp: new Date().toISOString(),
            ...entry
        };

        this.metrics.push(metricEntry);

        // Keep only last N entries
        if (this.metrics.length > this.maxEntries) {
            this.metrics = this.metrics.slice(-this.maxEntries);
        }

        // Save asynchronously (don't block)
        this.saveAsync();
    }

    private saveAsync() {
        // Non-blocking save
        setImmediate(() => {
            try {
                fs.writeFileSync(this.metricsPath, JSON.stringify(this.metrics, null, 2));
            } catch (error) {
                console.error('[Metrics] Failed to save:', error);
            }
        });
    }

    public getStats() {
        if (this.metrics.length === 0) return null;

        const total = this.metrics.length;
        const handled = this.metrics.filter(m => m.handled).length;
        const fallbackUsed = this.metrics.filter(m => m.usedFallback).length;
        const avgConfidence = this.metrics.reduce((sum, m) => sum + m.confidence, 0) / total;
        const avgResponseTime = this.metrics.reduce((sum, m) => sum + m.responseTime, 0) / total;

        const labelDistribution = this.metrics.reduce((acc: any, m) => {
            acc[m.predictedLabel] = (acc[m.predictedLabel] || 0) + 1;
            return acc;
        }, {});

        return {
            total,
            handled,
            handledPercentage: ((handled / total) * 100).toFixed(1),
            fallbackUsed,
            fallbackPercentage: ((fallbackUsed / total) * 100).toFixed(1),
            avgConfidence: avgConfidence.toFixed(3),
            avgResponseTime: avgResponseTime.toFixed(2),
            labelDistribution
        };
    }
}
