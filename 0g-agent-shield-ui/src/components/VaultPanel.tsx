import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HexCascade } from './effects/HexCascade';

const API_URL = 'http://localhost:3000';

interface VaultEvent {
    id: number;
    type: 'store' | 'retrieve' | 'session_commit';
    timestamp: number;
    source: 'api' | 'mcp';
    data: Record<string, any>;
}

type Tab = 'store' | 'retrieve';

export function VaultPanel({ events }: { events: VaultEvent[] }) {
    const [activeTab, setActiveTab] = useState<Tab>('store');
    const [payload, setPayload] = useState('');
    const [rootHashInput, setRootHashInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<any | null>(null);
    const [error, setError] = useState('');
    const [decryptedData, setDecryptedData] = useState('');
    const [showCascade, setShowCascade] = useState(false);
    const [cascadeData, setCascadeData] = useState({ ciphertext: '', rootHash: '' });
    const [copiedHash, setCopiedHash] = useState('');

    const handleStore = async () => {
        if (!payload.trim()) return;
        setIsLoading(true);
        setError('');
        setResult(null);

        try {
            const res = await fetch(`${API_URL}/api/store`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: payload }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Store failed');

            setCascadeData({
                ciphertext: data.encryptedPayload || data.contentHash || '',
                rootHash: data.rootHash,
            });
            setShowCascade(true);

            setResult(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRetrieve = async () => {
        if (!rootHashInput.trim()) return;
        setIsLoading(true);
        setError('');
        setDecryptedData('');

        try {
            const res = await fetch(`${API_URL}/api/retrieve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rootHash: rootHashInput }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Retrieve failed');
            setDecryptedData(data.decrypted);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const copyHash = (hash: string) => {
        navigator.clipboard.writeText(hash);
        setCopiedHash(hash);
        setTimeout(() => setCopiedHash(''), 1500);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h2 className="font-mono text-lg font-semibold tracking-wide">
                    Agent Memory Vault
                </h2>
                <p className="text-sm text-text-muted mt-1">Encrypt, store, and retrieve agent memories on 0G decentralized storage.</p>
            </div>

            <div className="flex gap-px bg-border/50 p-px rounded w-fit">
                <button
                    onClick={() => { setActiveTab('store'); setError(''); }}
                    className={`px-4 py-2 text-xs font-mono uppercase tracking-widest transition-all duration-200 rounded-l ${activeTab === 'store'
                        ? 'bg-accent-store/10 text-accent-store border border-accent-store/30'
                        : 'bg-base-card text-text-muted hover:text-text-primary border border-transparent'
                        }`}
                >
                    Store
                </button>
                <button
                    onClick={() => { setActiveTab('retrieve'); setError(''); }}
                    className={`px-4 py-2 text-xs font-mono uppercase tracking-widest transition-all duration-200 rounded-r ${activeTab === 'retrieve'
                        ? 'bg-accent-retrieve/10 text-accent-retrieve border border-accent-retrieve/30'
                        : 'bg-base-card text-text-muted hover:text-text-primary border border-transparent'
                        }`}
                >
                    Retrieve
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 space-y-4">
                    {activeTab === 'store' ? (
                        <>
                            <div className="glass-panel-gradient rounded p-px">
                                <div className="bg-base-card rounded p-4 relative overflow-hidden">
                                    <label className="label-caps block mb-2">Agent Memory Payload</label>
                                    <textarea
                                        value={payload}
                                        onChange={(e) => setPayload(e.target.value)}
                                        placeholder="e.g., User prefers dark mode. API Key: sk_test_123..."
                                        rows={5}
                                        className="w-full bg-base border border-border rounded p-3 font-mono text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-store/50 resize-none transition-colors"
                                    />

                                    <AnimatePresence>
                                        {showCascade && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                            >
                                                <HexCascade
                                                    ciphertext={cascadeData.ciphertext}
                                                    rootHash={cascadeData.rootHash}
                                                    onComplete={() => setShowCascade(false)}
                                                />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            <button
                                onClick={handleStore}
                                disabled={isLoading || !payload.trim()}
                                className="flex items-center gap-2 px-5 py-2.5 bg-accent-store/10 border border-accent-store/30 text-accent-store font-mono text-xs uppercase tracking-widest rounded hover:bg-accent-store/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                {isLoading ? 'Processing...' : 'Encrypt & Store on 0G'}
                            </button>

                            <AnimatePresence>
                                {result && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="glass-panel rounded p-4 space-y-3"
                                    >
                                        <div className="label-caps text-accent-commit">
                                            Stored on 0G
                                        </div>
                                        <div className="space-y-2">
                                            {[
                                                { label: 'ROOT HASH', value: result.rootHash },
                                                { label: 'TX HASH', value: result.txHash },
                                                { label: 'SIZE', value: `${result.size} bytes` },
                                            ].map(({ label, value }) => (
                                                <div key={label} className="flex items-center justify-between">
                                                    <span className="label-caps">{label}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="mono-hash text-text-primary truncate max-w-[300px]">{value}</span>
                                                        {value.startsWith('0x') && (
                                                            <button
                                                                onClick={() => copyHash(value)}
                                                                className="text-text-muted hover:text-primary transition-colors text-[10px] font-mono"
                                                            >
                                                                {copiedHash === value ? 'Copied' : 'Copy'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </>
                    ) : (
                        <>
                            <div className="glass-panel-gradient rounded p-px">
                                <div className="bg-base-card rounded p-4">
                                    <label className="label-caps block mb-2">Root Hash</label>
                                    <div className="flex gap-2">
                                        <input
                                            value={rootHashInput}
                                            onChange={(e) => setRootHashInput(e.target.value)}
                                            placeholder="0x..."
                                            className="flex-1 bg-base border border-border rounded px-3 py-2 font-mono text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-retrieve/50 transition-colors"
                                        />
                                        <button
                                            onClick={handleRetrieve}
                                            disabled={isLoading || !rootHashInput.trim()}
                                            className="flex items-center gap-2 px-4 py-2 bg-accent-retrieve/10 border border-accent-retrieve/30 text-accent-retrieve font-mono text-xs uppercase tracking-widest rounded hover:bg-accent-retrieve/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                        >
                                            {isLoading ? 'Processing...' : 'Decrypt'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <AnimatePresence>
                                {decryptedData && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="glass-panel rounded p-4 space-y-3"
                                    >
                                        <div className="label-caps text-accent-commit">
                                            Decrypted
                                        </div>
                                        <div className="font-mono text-sm text-text-primary bg-base rounded p-3 border border-border">
                                            {decryptedData}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </>
                    )}

                    {error && (
                        <div className="glass-panel rounded p-3 border-accent-danger/30 border">
                            <span className="label-caps text-accent-danger">Error:</span>
                            <span className="text-sm text-text-muted ml-2">{error}</span>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-2">
                    <div className="glass-panel rounded p-4 space-y-4 sticky top-6">
                        <div className="flex items-center justify-between">
                            <span className="label-caps">Attestation Trace</span>
                            <span className="flex items-center gap-1.5 label-caps text-primary">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-glow-pulse" />
                                Live
                            </span>
                        </div>

                        <div className="bg-base rounded p-3 border border-primary/20">
                            <div className="label-caps mb-1">Session Root</div>
                            <div className="mono-hash text-primary">
                                {(() => {
                                    const root = events.find(e => e.type === 'session_commit')?.data?.merkleRoot;
                                    return root ? root.slice(0, 24) + '...' : 'Awaiting first commit...';
                                })()}
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {events.length === 0 ? (
                                <div className="text-center py-8">
                                    <span className="label-caps">Waiting for agent actions...</span>
                                </div>
                            ) : (
                                events.slice(0, 15).map((event, i) => (
                                    <motion.div
                                        key={event.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="flex items-start gap-3 group"
                                    >
                                        <div className="mt-1.5 flex flex-col items-center">
                                            <div className={`w-2 h-2 rounded-full ${event.type === 'store' ? 'bg-accent-store' :
                                                event.type === 'retrieve' ? 'bg-accent-retrieve' :
                                                    'bg-accent-commit'
                                                }`} />
                                            {i < events.length - 1 && <div className="w-px h-8 bg-border mt-1" />}
                                        </div>

                                        <div className="flex-1 pb-3">
                                            <div className="flex items-center justify-between">
                                                <span className={`font-mono text-[11px] uppercase tracking-widest ${event.type === 'store' ? 'text-accent-store' :
                                                    event.type === 'retrieve' ? 'text-accent-retrieve' :
                                                        'text-accent-commit'
                                                    }`}>
                                                    [{event.type}]
                                                </span>
                                                <span className="text-[10px] text-text-muted font-mono">
                                                    {event.source.toUpperCase()} · {new Date(event.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <div className="mono-hash text-text-muted mt-1 truncate">
                                                {event.data?.rootHash || event.data?.merkleRoot || '-'}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
