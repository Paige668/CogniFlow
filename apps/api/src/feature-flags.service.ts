import { Injectable } from '@nestjs/common';

export type FlagName = 'use_gpt4o' | 'streaming_enabled' | 'rag_enabled';

export interface Flag {
    name: FlagName;
    enabled: boolean;
    description: string;
}

@Injectable()
export class FeatureFlagsService {
    private flags: Map<FlagName, Flag> = new Map([
        ['use_gpt4o', { name: 'use_gpt4o', enabled: true, description: 'Use GPT-4o (vs GPT-3.5-turbo) for chat' }],
        ['streaming_enabled', { name: 'streaming_enabled', enabled: true, description: 'Enable streaming responses' }],
        ['rag_enabled', { name: 'rag_enabled', enabled: true, description: 'Enable RAG knowledge base search tool' }],
    ]);

    getAll(): Flag[] {
        return Array.from(this.flags.values());
    }

    get(name: FlagName): boolean {
        return this.flags.get(name)?.enabled ?? false;
    }

    toggle(name: FlagName): Flag | null {
        const flag = this.flags.get(name);
        if (!flag) return null;
        flag.enabled = !flag.enabled;
        return flag;
    }
}
