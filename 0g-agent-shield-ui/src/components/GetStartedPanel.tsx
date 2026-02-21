import { useState } from 'react';
import { BookOpen, Copy, Check, Terminal, Shield, Key, Zap, Users, ArrowRight } from 'lucide-react';

function CopyBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="relative group">
            <pre className="glass-panel rounded p-4 text-xs font-mono text-text-primary overflow-x-auto leading-relaxed">
                <code>{code}</code>
            </pre>
            <button
                onClick={() => {
                    navigator.clipboard.writeText(code);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                }}
                className="absolute top-2 right-2 p-1.5 rounded bg-base-elevated/80 border border-border text-text-muted hover:text-primary hover:border-primary/30 transition-all opacity-0 group-hover:opacity-100"
            >
                {copied ? <Check className="w-3 h-3 text-accent-commit" /> : <Copy className="w-3 h-3" />}
            </button>
        </div>
    );
}

function StepCard({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
    return (
        <div className="glass-panel rounded-lg p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-8 h-8 bg-primary/10 flex items-center justify-center rounded-br-lg">
                <span className="font-mono text-xs text-primary font-bold">{step}</span>
            </div>
            <div className="ml-6">
                <h3 className="font-semibold text-sm text-text-primary mb-3">{title}</h3>
                {children}
            </div>
        </div>
    );
}

export function GetStartedPanel({ onNavigate }: { onNavigate: (view: string) => void }) {
    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            {/* Hero */}
            <div>
                <h2 className="font-sans text-lg font-semibold tracking-wide flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    Get Started with SILO
                </h2>
                <p className="text-sm text-text-muted mt-2 max-w-2xl leading-relaxed">
                    SILO gives AI agents encrypted, decentralized memory on 0G with cryptographic proof of every action.
                    Install the MCP server, connect your agent, and every <code className="text-primary bg-primary/10 px-1 rounded text-xs">vault_store</code> call
                    is encrypted with AES-256-GCM and uploaded to 0G Storage — with a Merkle attestation trail.
                </p>
            </div>

            {/* What you get */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                    { icon: Shield, label: 'Encrypted Storage', desc: 'AES-256-GCM + 0G decentralized storage' },
                    { icon: Key, label: 'Merkle Attestation', desc: 'Verifiable proof of agent behavior' },
                    { icon: Users, label: 'Multi-Agent Sharing', desc: 'Cross-agent encrypted memory transfer' },
                ].map(({ icon: Icon, label, desc }) => (
                    <div key={label} className="glass-panel rounded p-3 flex items-start gap-3">
                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-text-primary">{label}</div>
                            <div className="text-[11px] text-text-muted mt-0.5">{desc}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Prerequisites */}
            <div className="glass-panel rounded-lg p-5 border border-accent-gold/15">
                <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-accent-gold" />
                    <span className="label-caps text-accent-gold">Prerequisites</span>
                </div>
                <ul className="text-sm text-text-muted space-y-1.5">
                    <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-gold/50" />
                        Node.js 18+ installed
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-gold/50" />
                        0G testnet tokens — get from <a href="https://faucet.0g.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">faucet.0g.ai</a>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-gold/50" />
                        An MCP-compatible client (Claude Desktop, Cursor, or use the REST API)
                    </li>
                </ul>
            </div>

            {/* Step-by-step */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Terminal className="w-4 h-4 text-primary" />
                    <span className="label-caps">Setup in 3 Steps</span>
                </div>

                <div className="space-y-4">
                    <StepCard step={1} title="Clone & Install">
                        <CopyBlock code={`git clone https://github.com/rohanpotta/ethdenverhack.git
cd ethdenverhack/0g-agent-shield
npm install
cp .env.example .env`} />
                        <p className="text-xs text-text-muted mt-2">
                            Edit <code className="text-primary bg-primary/10 px-1 rounded">.env</code> and
                            add your private key (no 0x prefix). The key is used for encryption and 0G transactions.
                        </p>
                    </StepCard>

                    <StepCard step={2} title="Build & Validate">
                        <CopyBlock code={`npm run build
npm run doctor`} />
                        <p className="text-xs text-text-muted mt-2">
                            Doctor checks: private key, RPC connectivity, wallet balance, and encryption round-trip.
                            All 5 checks should pass before proceeding.
                        </p>
                    </StepCard>

                    <StepCard step={3} title="Connect Your Agent">
                        <p className="text-xs text-text-muted mb-3">
                            Add this to your Claude Desktop config (<code className="text-primary bg-primary/10 px-1 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code>) or Cursor MCP settings:
                        </p>
                        <CopyBlock lang="json" code={`{
  "mcpServers": {
    "silo": {
      "command": "node",
      "args": ["/path/to/0g-agent-shield/build/mcp.js"],
      "env": {
        "PRIVATE_KEY": "your_private_key",
        "EVM_RPC": "https://evmrpc-testnet.0g.ai",
        "INDEXER_RPC": "https://indexer-storage-testnet-turbo.0g.ai"
      }
    }
  }
}`} />
                        <p className="text-xs text-text-muted mt-2">
                            Replace <code className="text-primary bg-primary/10 px-1 rounded">/path/to/</code> with the absolute path to your install.
                        </p>
                    </StepCard>
                </div>
            </div>

            {/* MCP Tools Reference */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Terminal className="w-4 h-4 text-primary" />
                    <span className="label-caps">8 MCP Tools Available</span>
                </div>
                <div className="glass-panel rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left px-4 py-2 label-caps">Tool</th>
                                <th className="text-left px-4 py-2 label-caps">Description</th>
                            </tr>
                        </thead>
                        <tbody className="font-mono">
                            {[
                                ['vault_store', 'Encrypt data and upload to 0G Storage'],
                                ['vault_retrieve', 'Download from 0G and decrypt'],
                                ['vault_session_log', 'View the current attestation session'],
                                ['session_commit', 'Finalize session with Merkle root'],
                                ['vault_balance', 'Check wallet balance'],
                                ['vault_status', 'Show agent address, session, network'],
                                ['vault_share', 'Store and generate a share descriptor'],
                                ['vault_import', 'Import shared memory from another agent'],
                            ].map(([tool, desc]) => (
                                <tr key={tool} className="border-b border-border/50 hover:bg-base-elevated/30 transition-colors">
                                    <td className="px-4 py-2 text-primary">{tool}</td>
                                    <td className="px-4 py-2 text-text-muted font-sans">{desc}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Multi-agent sharing */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="label-caps">Multi-Agent Sharing</span>
                </div>
                <div className="glass-panel rounded-lg p-5">
                    <p className="text-sm text-text-muted mb-4 leading-relaxed">
                        Agents sharing the same <code className="text-primary bg-primary/10 px-1 rounded text-xs">VAULT_SECRET</code> can
                        pass encrypted memories to each other. Agent A stores data and generates a share descriptor.
                        Agent B imports it using the root hash — and both actions are attested in their respective Merkle trees.
                    </p>
                    <div className="glass-panel rounded p-4 font-mono text-xs text-text-muted space-y-1">
                        <div><span className="text-accent-store">Agent A:</span> vault_share("patient vitals: HR 72, BP 120/80")</div>
                        <div className="text-text-muted/40 pl-8">{"→"} rootHash: 0xabc123...</div>
                        <div className="text-text-muted/40 pl-8">{"→"} share descriptor sent to Agent B</div>
                        <div className="mt-2"><span className="text-accent-retrieve">Agent B:</span> vault_import("0xabc123...")</div>
                        <div className="text-text-muted/40 pl-8">{"→"} decrypted: "patient vitals: HR 72, BP 120/80"</div>
                        <div className="text-text-muted/40 pl-8">{"→"} both actions recorded in attestation</div>
                    </div>
                </div>
            </div>

            {/* Dashboard */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-4 h-4 text-accent-commit" />
                    <span className="label-caps">Start the Dashboard</span>
                </div>
                <div className="glass-panel rounded-lg p-5">
                    <p className="text-sm text-text-muted mb-3 leading-relaxed">
                        The dashboard connects to the API server via WebSocket and shows every vault operation in real-time.
                        Run both the backend and frontend:
                    </p>
                    <CopyBlock code={`# Terminal 1: API server
cd 0g-agent-shield && npm start

# Terminal 2: Dashboard
cd 0g-agent-shield-ui && npm run dev`} />
                </div>
            </div>

            {/* Try it CTA */}
            <div className="glass-card rounded-lg p-6 text-center">
                <h3 className="font-semibold text-text-primary mb-2">Ready to try it?</h3>
                <p className="text-sm text-text-muted mb-4">
                    Head to the Vault tab to store and retrieve encrypted data.
                </p>
                <button
                    onClick={() => onNavigate('vault')}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-primary/15 border border-primary/30 text-primary font-mono text-xs uppercase tracking-widest rounded hover:bg-primary/25 transition-all"
                >
                    Open Vault
                    <ArrowRight className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
}
