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
import { Shield, Lock, Users, ScrollText, GitBranch, Code2, BookOpen, GitCommitHorizontal, Activity, WifiOff } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

type View = 'vault' | 'agents' | 'merkle' | 'log' | 'sdk' | 'guide';

interface VaultEvent {
  id: number;
  type: 'store' | 'retrieve' | 'session_commit';
  timestamp: number;
  source: 'api' | 'mcp';
  data: Record<string, any>;
}

const API_URL = 'http://localhost:3000';

const NAV_ITEMS: { id: View; icon: typeof Lock; label: string }[] = [
  { id: 'guide', icon: BookOpen, label: 'GUIDE' },
  { id: 'vault', icon: Lock, label: 'VAULT' },
  { id: 'merkle', icon: GitBranch, label: 'MERKLE' },
  { id: 'agents', icon: Users, label: 'AGENTS' },
  { id: 'log', icon: ScrollText, label: 'LOG' },
  { id: 'sdk', icon: Code2, label: 'SDK FIX' },
];

/* 20 floating particles for ambient atmosphere */
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
  const [activeView, setActiveView] = useState<View>('vault');
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

  const [stats, setStats] = useState({ stores: 0, retrieves: 0, bytes: 0, avgCommitMs: 0 });

  // WebSocket connection
  useEffect(() => {
    const s = io(API_URL, {
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
        setCommitData({
          merkleRoot: event.data?.merkleRoot || '0x000…',
          sessionId: event.data?.sessionId || '',
          eventCount: event.data?.eventCount || 0,
          traceRootHash: event.data?.traceRootHash || '',
          traceTxHash: event.data?.traceTxHash || '',
        });
      }
    });

    socketRef.current = s;
    fetch(`${API_URL}/api/events`)
      .then(r => r.json())
      .then((data: VaultEvent[]) => setEvents(data.reverse()))
      .catch(() => { });

    return () => { s.disconnect(); };
  }, []);

  useEffect(() => {
    const stores = events.filter(e => e.type === 'store').length;
    const retrieves = events.filter(e => e.type === 'retrieve').length;
    const bytes = events.reduce((sum, e) => sum + (e.data?.size || 0), 0);
    const commits = events.filter(e => e.type === 'session_commit');
    const avgCommitMs = commits.length > 0
      ? Math.round(commits.reduce((s, c) => s + (c.data?.durationMs || 340), 0) / commits.length)
      : 0;
    setStats({ stores, retrieves, bytes, avgCommitMs });
  }, [events]);

  const handleSplashComplete = useCallback(() => setShowSplash(false), []);

  if (showSplash) {
    return <ColdOpen onComplete={handleSplashComplete} />;
  }

  return (
    <div className="h-screen flex flex-col bg-base text-text-primary font-sans grain-overlay overflow-hidden">
      {/* ── Animated Gradient Mesh Background ── */}
      <div className="gradient-mesh" />

      {/* ── Floating Particle Field ── */}
      {PARTICLES.map(p => (
        <div
          key={p.id}
          className="fixed rounded-full pointer-events-none z-0"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            background: 'rgba(124, 58, 237, 0.4)',
            animation: `float-particle ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* ── Commit Ceremony Overlay ── */}
      {commitData && (
        <CommitCeremony commitData={commitData} onDismiss={() => setCommitData(null)} />
      )}

      {/* ── Top Status Bar ── */}
      <header className="h-12 flex items-center justify-between px-5 glass-panel border-b border-border z-30 relative">
        <div className="flex items-center gap-3">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold tracking-widest">
            <span className="gradient-text">SILO</span>
          </span>
          <span className="text-[10px] text-text-muted font-mono hidden sm:inline">Encrypted Agent Memory on 0G</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 label-caps">
            <span>{stats.stores} <span className="text-accent-store">stores</span></span>
            <span className="text-text-muted/30">·</span>
            <span>{stats.retrieves} <span className="text-accent-retrieve">retrieves</span></span>
            <span className="text-text-muted/30">·</span>
            <span>{stats.bytes > 1024 ? (stats.bytes / 1024).toFixed(1) + 'K' : stats.bytes} <span className="text-text-muted">bytes</span></span>
          </div>

          <div className="flex items-center gap-2">
            {reconnecting ? (
              <>
                <WifiOff className="w-3 h-3 text-accent-gold animate-pulse" />
                <span className="label-caps text-accent-gold">Reconnecting…</span>
              </>
            ) : (
              <>
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-primary glow-ring-primary' : 'bg-accent-danger'}`} />
                <span className="label-caps">{connected ? 'Live' : 'Offline'}</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <nav className="w-14 flex flex-col items-center pt-4 pb-4 gap-2 glass-panel border-r border-border z-20 relative">
          {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`
                group relative w-10 h-10 flex items-center justify-center rounded-md transition-all duration-200
                ${activeView === id
                  ? 'bg-primary/15 text-primary'
                  : 'text-text-muted hover:text-text-primary hover:bg-base-elevated/50'
                }
              `}
              title={label}
            >
              <Icon className="w-4.5 h-4.5" />
              {activeView === id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r" />
              )}
              <div className="absolute left-12 px-2 py-1 bg-base-elevated border border-border rounded text-[10px] font-mono uppercase tracking-widest text-text-primary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                {label}
              </div>
            </button>
          ))}

          <div className="flex-1" />

          {/* Sidebar stats */}
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
              <div className="font-mono text-xs text-text-primary">{stats.avgCommitMs || '—'}</div>
            </div>
          </div>

          <button
            onClick={async () => {
              try {
                const res = await fetch(`${API_URL}/api/attest`, { method: 'POST' });
                if (!res.ok) {
                  const err = await res.json();
                  console.error('Commit failed:', err.error);
                }
              } catch (e) {
                console.error('Commit failed:', e);
              }
            }}
            className="w-10 h-10 flex items-center justify-center rounded-md text-text-muted hover:text-accent-commit hover:bg-accent-commit/10 transition-all duration-200"
            title="COMMIT SESSION"
          >
            <GitCommitHorizontal className="w-4.5 h-4.5" />
          </button>
        </nav>

        {/* Main Viewport */}
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
                  <VaultPanel events={events} />
                </motion.div>
              )}
              {activeView === 'merkle' && (
                <motion.div key="merkle" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="h-full">
                  <div className="max-w-5xl mx-auto">
                    <h2 className="font-sans text-lg font-semibold tracking-wide flex items-center gap-2 mb-4">
                      <GitBranch className="w-4 h-4 text-primary" />
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

          {/* Bottom live stream */}
          <div className="h-10 flex items-center gap-4 px-4 glass-panel border-t border-border overflow-hidden">
            <Activity className="w-3 h-3 text-primary flex-shrink-0 animate-glow-pulse" />
            <div className="flex-1 overflow-hidden">
              {events.length > 0 ? (
                <div className="flex items-center gap-4 animate-fade-in">
                  <span className="label-caps text-accent-store">[{events[0].type}]</span>
                  <span className="mono-hash text-text-muted truncate">
                    {events[0].data?.rootHash || events[0].data?.merkleRoot || '—'}
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
