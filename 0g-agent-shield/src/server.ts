import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { AgentVault } from './lib/vault.js';
import { SharedMemoryBus } from './lib/shared-memory.js';
import { MemoryCoordinator } from './lib/memory-coordinator.js';
import { HeartbeatDaemon } from './lib/heartbeat.js';
import { AgentRouter } from './lib/agent-router.js';
import { AutonomyEngine } from './lib/autonomy.js';
import dotenv from 'dotenv';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config();

const app = express();
const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// --- In-memory event log (last 100 events) ---
interface VaultEvent {
    id: number;
    type: string;
    timestamp: number;
    source: 'api' | 'mcp' | 'heartbeat' | 'autonomy';
    data: Record<string, any>;
}
const eventLog: VaultEvent[] = [];
let eventCounter = 0;

function pushEvent(type: VaultEvent['type'], source: VaultEvent['source'], data: Record<string, any>) {
    const event: VaultEvent = {
        id: ++eventCounter,
        type,
        timestamp: Date.now(),
        source,
        data,
    };
    eventLog.push(event);
    if (eventLog.length > 100) eventLog.shift();
    io.emit('vault:event', event);
    console.log(`[WS] Emitted vault:event #${event.id} (${type})`);
}

// --- Initialize Vault + Subsystems ---
const privateKey = process.env.PRIVATE_KEY!;
const evmRpc = process.env.EVM_RPC!;
const indexerRpc = process.env.INDEXER_RPC!;

if (!privateKey || !evmRpc || !indexerRpc) {
    console.error('Missing required environment variables (.env)');
    process.exit(1);
}

const vault = new AgentVault({ privateKey, evmRpc, indexerRpc });
const coordinator = new MemoryCoordinator({
    onForkDetected: (fork) => {
        pushEvent('memory_fork', 'api', { channel: fork.channel, branchA: fork.branchA.rootHash, branchB: fork.branchB.rootHash });
        io.emit('memory:fork', fork);
    },
    onHeadUpdated: (receipt) => {
        io.emit('memory:head_updated', receipt);
    },
});
const sharedMemory = new SharedMemoryBus(vault);
sharedMemory.attachCoordinator(coordinator);
const heartbeat = new HeartbeatDaemon(vault, sharedMemory, {
    autonomousMode: process.env.AUTONOMY_MODE === 'true',
    onBeat: (record) => {
        pushEvent('heartbeat', 'heartbeat', {
            seq: record.sequenceNumber,
            uptime: record.uptime,
            autonomous: record.autonomousMode,
        });
    },
    onTaskComplete: (result) => {
        pushEvent('task_complete', 'heartbeat', {
            task: result.taskName,
            success: result.success,
            duration: result.duration,
        });
    },
});
const agentRouter = new AgentRouter(vault, sharedMemory);
const autonomyEngine = new AutonomyEngine(vault, sharedMemory, heartbeat, agentRouter, {
    level: (process.env.AUTONOMY_LEVEL as any) ?? 'monitor',
    onDecision: (decision) => {
        pushEvent('autonomy_decision', 'autonomy', {
            id: decision.id,
            action: decision.action,
            trigger: decision.trigger,
            severity: decision.diagnostic.severity,
        });
        io.emit('autonomy:decision', decision);
    },
    onFixPushed: (fix) => {
        pushEvent('autonomy_fix', 'autonomy', {
            id: fix.id,
            handler: fix.handler,
            applied: fix.result.applied,
        });
        io.emit('autonomy:fix', fix);
    },
});

sharedMemory.setBroadcastHandler((channel, entry) => {
    pushEvent('shared_memory', 'api', { channel, entryId: entry.id, rootHash: entry.rootHash });
    io.emit('memory:entry', { channel, entry });
});

agentRouter.setEventHandlers({
    onSpawn: (desc) => {
        pushEvent('agent_spawned', 'api', { id: desc.id, role: desc.role, channel: desc.channelName });
        io.emit('agent:spawned', desc);
    },
    onMessage: (ch, msg) => {
        io.emit('agent:message', { channel: ch, message: msg });
    },
});

// --- REST Endpoints ---

// Get event history (for initial dashboard load)
app.get('/api/events', (_req, res) => {
    res.json(eventLog);
});

// Allow MCP server (separate process) to push events into the WebSocket feed
app.post('/api/push-event', (req, res) => {
    const { type, data } = req.body;
    if (!type || !data) {
        return res.status(400).json({ error: 'Missing type or data' });
    }
    pushEvent(type, 'mcp', data);
    res.json({ ok: true });
});

app.post('/api/store', async (req, res) => {
    try {
        const { data, label } = req.body;
        if (!data) {
            return res.status(400).json({ error: 'Missing data field' });
        }
        console.log(`[API] Received request to store: ${data.substring(0, 50)}...`);
        const result = await vault.store(data, label);

        pushEvent('store', 'api', {
            rootHash: result.rootHash,
            txHash: result.txHash,
            contentHash: result.contentHash,
            size: result.size,
            sessionEvent: result.sessionEvent,
            label,
        });

        res.json(result);
    } catch (error: any) {
        console.error('[API] Store error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/retrieve', async (req, res) => {
    try {
        const { rootHash } = req.body;
        if (!rootHash) {
            return res.status(400).json({ error: 'Missing rootHash field' });
        }
        console.log(`[API] Received request to retrieve: ${rootHash.substring(0, 20)}...`);
        const decrypted = await vault.retrieve(rootHash);

        pushEvent('retrieve', 'api', {
            rootHash,
            decryptedLength: decrypted.length,
        });

        res.json({ rootHash, decrypted });
    } catch (error: any) {
        console.error('[API] Retrieve error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/attest', async (req, res) => {
    try {
        console.log('[API] Received request to commit attestation session');
        const result = await vault.commitSession();

        pushEvent('session_commit', 'api', {
            merkleRoot: result.merkleRoot,
            sessionId: result.sessionId,
            eventCount: result.eventCount,
            traceRootHash: result.traceRootHash,
            traceTxHash: result.traceTxHash,
            durationMs: result.durationMs,
        });

        res.json(result);
    } catch (error: any) {
        console.error('[API] Attest error:', error);
        res.status(500).json({ error: error.message });
    }
});

// =========================================================================
// SHARED MEMORY ENDPOINTS
// =========================================================================

app.post('/api/memory/write', async (req, res) => {
    try {
        const { channel, data, metadata } = req.body;
        if (!channel || !data) {
            return res.status(400).json({ error: 'Missing channel or data' });
        }
        const entry = await sharedMemory.write(channel, data, metadata);
        res.json(entry);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/memory/read/:channel', (req, res) => {
    const limit = parseInt(req.query.limit as string ?? '50', 10);
    const entries = sharedMemory.read(req.params.channel, limit);
    res.json(entries);
});

app.get('/api/memory/channels', (_req, res) => {
    res.json(sharedMemory.listChannels());
});

// =========================================================================
// AUTONOMY ENDPOINTS
// =========================================================================

app.get('/api/autonomy/status', (_req, res) => {
    res.json(autonomyEngine.status());
});

app.post('/api/autonomy/level', (req, res) => {
    const { level } = req.body;
    if (!['off', 'monitor', 'suggest', 'autonomous'].includes(level)) {
        return res.status(400).json({ error: 'Invalid level' });
    }
    autonomyEngine.setLevel(level);
    if (level !== 'off' && !autonomyEngine.isRunning) {
        autonomyEngine.start();
    } else if (level === 'off' && autonomyEngine.isRunning) {
        autonomyEngine.stop();
    }
    pushEvent('autonomy_level_changed', 'api', { level });
    res.json({ level, running: autonomyEngine.isRunning });
});

app.get('/api/heartbeat/status', (_req, res) => {
    res.json(heartbeat.status());
});

// =========================================================================
// AGENT ROUTER ENDPOINTS
// =========================================================================

app.post('/api/agents/spawn', async (req, res) => {
    try {
        const { role, context, contextRootHashes, autonomy } = req.body;
        if (!role) {
            return res.status(400).json({ error: 'Missing role' });
        }
        const descriptor = await agentRouter.spawn({
            role,
            contextData: context,
            contextRootHashes: contextRootHashes ?? [],
            autonomy: autonomy ?? 'supervised',
        });
        res.json(descriptor);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/agents', (_req, res) => {
    res.json(agentRouter.status());
});

app.post('/api/agents/:id/message', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Missing message' });
        }
        const entry = await agentRouter.instruct(req.params.id, message);
        res.json(entry);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// =========================================================================
// COORDINATION ENDPOINTS
// =========================================================================

app.post('/api/memory/lock', (req, res) => {
    const { channel, agentId, ttlMs } = req.body;
    if (!channel || !agentId) {
        return res.status(400).json({ error: 'Missing channel or agentId' });
    }
    const result = coordinator.acquireLock(channel, agentId, ttlMs);
    if ('code' in result) {
        return res.status(409).json(result);
    }
    res.json(result);
});

app.post('/api/memory/unlock', (req, res) => {
    const { channel, tokenOrAgentId } = req.body;
    if (!channel || !tokenOrAgentId) {
        return res.status(400).json({ error: 'Missing channel or tokenOrAgentId' });
    }
    const released = coordinator.releaseLock(channel, tokenOrAgentId);
    res.json({ released });
});

app.get('/api/memory/head/:channel', (req, res) => {
    res.json(coordinator.getHead(req.params.channel));
});

app.post('/api/memory/commit', (req, res) => {
    const { channel, newRootHash, prevRootHash, expectedVersion, writerId, lockToken } = req.body;
    if (!channel || !newRootHash || expectedVersion === undefined || !writerId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    const result = coordinator.commitWrite(channel, newRootHash, prevRootHash, expectedVersion, writerId, lockToken);
    if ('code' in result) {
        return res.status(409).json(result);
    }
    res.json(result);
});

app.get('/api/memory/forks', (req, res) => {
    const channel = req.query.channel as string | undefined;
    res.json(coordinator.getForks(channel));
});

app.get('/api/memory/coordination', (_req, res) => {
    res.json(coordinator.listChannels());
});

// =========================================================================
// MEMORY INDEX ENDPOINTS
// =========================================================================

app.get('/api/memory/search', (req, res) => {
    const query = {
        label: req.query.label as string | undefined,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        channel: req.query.channel as string | undefined,
        contentType: req.query.contentType as any,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    };
    res.json(sharedMemory.getIndex().search(query));
});

app.get('/api/memory/lookup/:rootHash', (req, res) => {
    const entry = sharedMemory.lookupRootHash(req.params.rootHash);
    if (!entry) {
        return res.status(404).json({ error: 'Root hash not found in index' });
    }
    res.json(entry);
});

app.get('/api/memory/index/stats', (_req, res) => {
    res.json(sharedMemory.getIndex().stats());
});

// --- Socket.IO connection handler ---
io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    socket.on('memory:subscribe', (channel: string) => {
        socket.join(`memory:${channel}`);
        console.log(`[WS] ${socket.id} subscribed to memory:${channel}`);
    });

    socket.on('memory:unsubscribe', (channel: string) => {
        socket.leave(`memory:${channel}`);
    });

    socket.on('disconnect', () => {
        console.log(`[WS] Client disconnected: ${socket.id}`);
    });
});

// --- Launch ---
const PORT = 3000;
vault.init().then(() => {
    if (process.env.AUTONOMY_MODE === 'true') {
        autonomyEngine.start();
        console.log(`🤖 Autonomy engine started (level: ${autonomyEngine.level})`);
    }

    httpServer.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`🛡️  SILO API v2.0 running on http://localhost:${PORT}`);
        console.log(`🔌 WebSocket live feed enabled`);
        console.log(`🧠 Shared memory bus ready`);
        console.log(`💓 Heartbeat daemon: ${heartbeat.isRunning ? 'active' : 'standby'}`);
        console.log(`🤖 Autonomy engine: ${autonomyEngine.level}`);
        console.log(`Agent Address: ${vault.address}`);
        console.log(`====================================================`);
    });
}).catch(err => {
    console.error("Failed to initialize vault", err);
    process.exit(1);
});
