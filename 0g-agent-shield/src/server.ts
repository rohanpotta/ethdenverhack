import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import { AgentVault } from './index.js';
import dotenv from 'dotenv';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const app = express();
const httpServer = createServer(app);

// Socket.IO with permissive CORS for local dev
const io = new SocketServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// --- In-memory event log (last 100 events) ---
interface VaultEvent {
    id: number;
    type: 'store' | 'retrieve' | 'session_commit';
    timestamp: number;
    source: 'api' | 'mcp';
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

// --- Initialize Vault ---
const privateKey = process.env.PRIVATE_KEY!;
const evmRpc = process.env.EVM_RPC!;
const indexerRpc = process.env.INDEXER_RPC!;

if (!privateKey || !evmRpc || !indexerRpc) {
    console.error('Missing required environment variables (.env)');
    process.exit(1);
}

const vault = new AgentVault({ privateKey, evmRpc, indexerRpc });

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
        const { data } = req.body;
        if (!data) {
            return res.status(400).json({ error: 'Missing data field' });
        }
        console.log(`[API] Received request to store: ${data.substring(0, 50)}...`);
        const result = await vault.store(data);

        pushEvent('store', 'api', {
            rootHash: result.rootHash,
            txHash: result.txHash,
            contentHash: result.contentHash,
            size: result.size,
            sessionEvent: result.sessionEvent,
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
        });

        res.json(result);
    } catch (error: any) {
        console.error('[API] Attest error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Socket.IO connection handler ---
io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`[WS] Client disconnected: ${socket.id}`);
    });
});

// --- Launch ---
const PORT = 3000;
vault.init().then(() => {
    httpServer.listen(PORT, () => {
        console.log(`====================================================`);
        console.log(`🛡️  SILO API running on http://localhost:${PORT}`);
        console.log(`🔌 WebSocket live feed enabled`);
        console.log(`Agent Address: ${vault.address}`);
        console.log(`====================================================`);
    });
}).catch(err => {
    console.error("Failed to initialize vault", err);
    process.exit(1);
});
