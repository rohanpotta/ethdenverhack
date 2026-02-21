import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ColdOpen } from './components/ColdOpen';
import { InteractiveDotGrid } from './components/effects/InteractiveDotGrid';
import { VaultPanel } from './components/VaultPanel';
import { AgentsPanel } from './components/AgentsPanel';
import { EventLog } from './components/EventLog';
import { MerkleTree } from './components/MerkleTree';
import { SdkDiffPanel } from './components/SdkDiffPanel';
import { GetStartedPanel } from './components/GetStartedPanel';
import { CommitCeremony } from './components/CommitCeremony';
import { AutonomyDashboard } from './components/AutonomyDashboard';
import { SharedMemoryPanel } from './components/SharedMemoryPanel';
import { DefaiPanel } from './components/DefaiPanel';
import { io, Socket } from 'socket.io-client';

type View = 'vault' | 'agents' | 'merkle' | 'log' | 'sdk' | 'guide' | 'autonomy' | 'memory' | 'defai';

export interface VaultEvent {
  id: number;
  type: string;
  timestamp: number;
  source: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

const DEFAULT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const NAV_ITEMS: { id: View; label: string }[] = [
  { id: 'guide', label: 'GUIDE' },
  { id: 'defai', label: 'DEFAI' },
  { id: 'vault', label: 'VAULT' },
  { id: 'memory', label: 'MEMORY' },
  { id: 'agents', label: 'AGENTS' },
  { id: 'autonomy', label: 'AUTONOMY' },
  { id: 'merkle', label: 'MERKLE' },
  { id: 'log', label: 'LOG' },
  { id: 'sdk', label: 'SDK FIX' },
];

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  size: 2 + Math.random() * 3,
  delay: Math.random() * 8,
  duration: 6 + Math.random() * 6,
}));

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeView, setActiveView] = useState<View>('guide');
  const [events, setEvents] = useState<VaultEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [commitData, setCommitData] = useState<{
    merkleRoot: string;
    sessionId: string;
    eventCount: number;
    traceRootHash: string;
    traceTxHash: string;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' } | null>(null);
  const [attesting, setAttesting] = useState(false);

  const [stats, setStats] = useState({ stores: 0, retrieves: 0, bytes: 0, avgCommitMs: 0 });
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('silo_api_url') || DEFAULT_API_URL);
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [tempUrl, setTempUrl] = useState('');

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // WebSocket Connection
  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    setConnected(false);
    setReconnecting(true);

    const s = io(apiUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    s.on('connect', () => { setConnected(true); setReconnecting(false); });
    s.on('disconnect', () => { setConnected(false); setReconnecting(true); });
    s.on('reconnect_attempt', () => setReconnecting(true));
    s.on('reconnect_failed', () => setReconnecting(false));
    s.on('vault:event', (event: VaultEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      if (event.type === 'session_commit') {
        const data = event.data as Record<string, unknown>;
        setCommitData({
          merkleRoot: data?.merkleRoot as string || '0x000...0000',
          sessionId: data?.sessionId as string || '',
          eventCount: data?.eventCount as number || 0,
          traceRootHash: data?.traceRootHash as string || '',
          traceTxHash: data?.traceTxHash as string || '',
        });
      }
    });

    socketRef.current = s;

    // Fetch initial history
    fetch(`${apiUrl}/api/events`)
      .then(r => r.json())
      .then((data: VaultEvent[]) => setEvents(data.reverse()))
      .catch(() => { });

    return () => { s.disconnect(); };
  }, [apiUrl]);

  useEffect(() => {
    const stores = events.filter(e => e.type === 'store').length;
    const retrieves = events.filter(e => e.type === 'retrieve').length;
    const bytes = events.reduce((sum, e) => sum + ((e.data as Record<string, unknown>)?.size as number || 0), 0);
    const commits = events.filter(e => e.type === 'session_commit');
    const avgCommitMs = commits.length > 0
      ? Math.round(commits.reduce((s, c) => s + ((c.data as Record<string, unknown>)?.durationMs as number || 340), 0) / commits.length)
      : 0;
    setStats({ stores, retrieves, bytes, avgCommitMs });
  }, [events]);

  const handleSplashComplete = useCallback(() => setShowSplash(false), []);

  if (showSplash) {
    return <ColdOpen onComplete={handleSplashComplete} />;
  }

  return (
    <div className="h-screen flex flex-col bg-base text-text-primary font-sans grain-overlay overflow-hidden">
      <div className="gradient-mesh" />

      {PARTICLES.map(p => (
        <div
          key={p.id}
          className="fixed rounded-full pointer-events-none z-0"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            background: 'rgba(0, 102, 255, 0.25)',
            animation: `float-particle ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {commitData && (
        <CommitCeremony commitData={commitData} onDismiss={() => setCommitData(null)} />
      )}

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: 0 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 left-20 z-50 max-w-sm"
          >
            <div className={`glass-panel border rounded-lg px-4 py-3 flex items-start gap-3 shadow-lg ${toast.type === 'error' ? 'border-accent-danger/40' : 'border-primary/40'
              }`}>
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${toast.type === 'error' ? 'bg-accent-danger' : 'bg-primary'
                }`} />
              <span className="text-xs text-text-primary leading-relaxed">{toast.message}</span>
              <button
                onClick={() => setToast(null)}
                className="text-text-muted hover:text-text-primary text-xs ml-2 flex-shrink-0"
              >✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="h-12 flex items-center justify-between px-5 glass-panel border-b border-border z-30 relative">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-widest">
            <span className="gradient-text">SILO</span>
          </span>
          <span className="text-[10px] text-text-muted font-mono hidden sm:inline">Encrypted Agent Memory on 0G</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 label-caps hidden md:flex">
            <span>{stats.stores} <span className="text-accent-store">stores</span></span>
            <span className="text-text-muted/30">·</span>
            <span>{stats.retrieves} <span className="text-accent-retrieve">retrieves</span></span>
            <span className="text-text-muted/30">·</span>
            <span>{stats.bytes > 1024 ? (stats.bytes / 1024).toFixed(1) + 'K' : stats.bytes} <span className="text-text-muted">bytes</span></span>
          </div>

          <div className="h-4 w-px bg-border hidden md:block" />

          <div className="flex items-center gap-3 bg-base-elevated/50 px-3 py-1.5 rounded border border-border/50">
            {isEditingUrl ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={tempUrl}
                  onChange={e => setTempUrl(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      let finalUrl = tempUrl.trim().replace(/\/$/, '');
                      if (!finalUrl.startsWith('http')) finalUrl = `https://${finalUrl}`;
                      setApiUrl(finalUrl);
                      localStorage.setItem('silo_api_url', finalUrl);
                      setIsEditingUrl(false);
                      setToast({ message: `Connecting to ${finalUrl}...`, type: 'info' });
                    }
                    if (e.key === 'Escape') setIsEditingUrl(false);
                  }}
                  autoFocus
                  onBlur={() => setIsEditingUrl(false)}
                  className="bg-base border border-primary/50 text-xs font-mono px-2 py-0.5 rounded w-48 text-text-primary focus:outline-none focus:border-primary"
                  placeholder="https://your-ngrok-url.app"
                />
                <span className="text-[9px] text-text-muted uppercase tracking-wider">Press Enter</span>
              </div>
            ) : (
              <button
                onClick={() => { setTempUrl(apiUrl); setIsEditingUrl(true); }}
                className="flex items-center gap-2 group cursor-pointer"
                title="Click to change backend URL (use ngrok if dashboard is deployed)"
              >
                <div className="flex items-center gap-2">
                  {reconnecting ? (
                    <span className="w-2 h-2 rounded-full bg-text-muted/70 animate-pulse" />
                  ) : (
                    <div className={`w-2 h-2 rounded-full ${connected ? 'bg-primary glow-ring-primary' : 'bg-text-muted/70'}`} />
                  )}
                  <span className="text-[10px] font-mono text-text-muted group-hover:text-text-primary transition-colors truncate max-w-[120px] sm:max-w-[200px]">
                    {apiUrl.replace(/^https?:\/\//, '')}
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <nav className="w-14 flex flex-col items-center pt-4 pb-4 gap-2 glass-panel border-r border-border z-20 relative">
          {NAV_ITEMS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`
                group relative w-10 h-10 flex items-center justify-center rounded-md transition-all duration-200
                ${activeView === id
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-muted hover:text-text-primary hover:bg-base-elevated/50'
                }
              `}
              title={label}
            >
              <span className="text-[9px] font-semibold tracking-wider">{label.slice(0, 3)}</span>
              {activeView === id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
              )}
              <div className="absolute left-12 px-2 py-1 bg-base-elevated border border-border rounded text-[10px] font-mono uppercase tracking-widest text-text-primary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {label}
              </div>
            </button>
          ))}

          <div className="flex-1" />

          <div className="w-full px-1.5 space-y-2 mb-3">
            <div className="text-center">
              <div className="font-mono text-[10px] text-text-muted">ATTEST</div>
              <div className="font-mono text-xs text-primary-soft">{events.filter(e => e.type === 'session_commit').length}</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-[10px] text-text-muted">BYTES</div>
              <div className="font-mono text-xs text-text-primary">{stats.bytes > 1024 ? (stats.bytes / 1024).toFixed(1) + 'K' : stats.bytes}</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-[10px] text-text-muted">AVG ms</div>
              <div className="font-mono text-xs text-text-primary">{stats.avgCommitMs || '-'}</div>
            </div>
          </div>

          <button
            onClick={async () => {
              if (!connected) {
                setToast({ message: 'Backend offline — run the Silo server locally on :3000 to commit sessions', type: 'info' });
                return;
              }
              if (attesting) return;
              setAttesting(true);
              try {
                const res = await fetch(`${apiUrl}/api/attest`, { method: 'POST' });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({ error: 'Commit failed' }));
                  setToast({ message: `Commit failed: ${err.error || 'Unknown error'}`, type: 'error' });
                }
              } catch {
                setToast({ message: 'Backend not reachable — is the Silo server running on localhost:3000?', type: 'error' });
              } finally {
                setAttesting(false);
              }
            }}
            disabled={attesting}
            className={`w-10 h-10 flex items-center justify-center rounded-md transition-all duration-200 ${attesting
              ? 'text-accent-commit animate-pulse cursor-wait'
              : connected
                ? 'text-text-muted hover:text-accent-commit hover:bg-accent-commit/10'
                : 'text-text-muted/30 cursor-not-allowed opacity-50'
              }`}
            title={attesting ? 'Committing session on-chain...' : connected ? 'Commit session — attest Merkle root on-chain' : 'Backend offline — run Silo server locally to enable commits'}
          >
            <span className="text-[9px] font-semibold tracking-wider">{attesting ? '...' : 'ATT'}</span>
          </button>
        </nav>

        <main className="flex-1 overflow-hidden flex flex-col relative z-10">
          <InteractiveDotGrid />

          <div className="flex-1 overflow-y-auto p-6 relative">
            <AnimatePresence mode="wait">
              {activeView === 'guide' && (
                <motion.div key="guide" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                  <GetStartedPanel onNavigate={(v) => setActiveView(v as View)} />
                </motion.div>
              )}
              {activeView === 'vault' && (
                <motion.div key="vault" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                  <VaultPanel apiUrl={apiUrl} events={events} />
                </motion.div>
              )}
              {activeView === 'defai' && (
                <motion.div key="defai" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                  <DefaiPanel apiUrl={apiUrl} />
                </motion.div>
              )}
              {activeView === 'merkle' && (
                <motion.div key="merkle" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="h-full">
                  <div className="max-w-5xl mx-auto">
                    <h2 className="font-sans text-lg font-semibold tracking-wide flex items-center gap-2 mb-4">
                      Attestation Tree
                    </h2>
                    <p className="text-sm text-text-muted mb-4">Live Merkle proof. Leaves spawn on each vault_store.</p>
                    <div className="glass-card rounded-lg p-2 min-h-[500px]">
                      <MerkleTree events={events} />
                    </div>
                  </div>
                </motion.div>
              )}
              {activeView === 'agents' && (
                <motion.div key="agents" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                  <AgentsPanel events={events} />
                </motion.div>
              )}
              {activeView === 'autonomy' && (
                <motion.div key="autonomy" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                  <AutonomyDashboard events={events} />
                </motion.div>
              )}
              {activeView === 'memory' && (
                <motion.div key="memory" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="h-full">
                  <SharedMemoryPanel events={events} />
                </motion.div>
              )}
              {activeView === 'log' && (
                <motion.div key="log" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                  <EventLog events={events} />
                </motion.div>
              )}
              {activeView === 'sdk' && (
                <motion.div key="sdk" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
                  <SdkDiffPanel />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-10 flex items-center gap-4 px-4 glass-panel border-t border-border overflow-hidden">
            <div className="w-2 h-2 rounded-full bg-primary animate-glow-pulse flex-shrink-0" />
            <div className="flex-1 overflow-hidden">
              {events.length > 0 ? (
                <div className="flex items-center gap-4 animate-fade-in">
                  <span className="label-caps text-accent-store">[{events[0].type}]</span>
                  <span className="mono-hash text-text-muted truncate">
                    {(events[0].data as Record<string, unknown>)?.rootHash as string || (events[0].data as Record<string, unknown>)?.merkleRoot as string || '-'}
                  </span>
                  <span className="text-[10px] text-text-muted ml-auto flex-shrink-0">
                    {new Date(events[0].timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ) : (
                <span className="label-caps">Awaiting first action...</span>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
