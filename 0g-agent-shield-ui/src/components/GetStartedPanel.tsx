import { useState } from 'react';

function CopyBlock({ code, lang: _lang = 'bash' }: { code: string; lang?: string }) {
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
                className="absolute top-2 right-2 p-1.5 rounded bg-base-elevated/80 border border-border text-text-muted hover:text-primary hover:border-primary/30 transition-all opacity-0 group-hover:opacity-100 text-[10px] font-mono"
            >
                {copied ? 'Copied' : 'Copy'}
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
                <h2 className="font-sans text-lg font-semibold tracking-wide">
                    Get Started with SILO
                </h2>
                <p className="text-sm text-text-muted mt-2 max-w-2xl leading-relaxed">
                    SILO gives AI agents encrypted, decentralized memory on 0G with cryptographic proof of every action.
                    Install the MCP server, connect your agent, and every <code className="text-primary bg-primary/10 px-1 rounded text-xs">vault_store</code> call
                    is encrypted with AES-256-GCM and uploaded to 0G Storage with a Merkle attestation trail.
                </p>
            </div>

            {/* What you get */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                    { label: 'Encrypted Storage', desc: 'AES-256-GCM + 0G decentralized storage' },
                    { label: 'Merkle Attestation', desc: 'Verifiable proof of agent behavior' },
                    { label: 'Multi-Agent Sharing', desc: 'Cross-agent encrypted memory transfer' },
                ].map(({ label, desc }) => (
                    <div key={label} className="glass-panel rounded p-4">
                        <div className="text-xs font-semibold text-text-primary">{label}</div>
                        <div className="text-[11px] text-text-muted mt-1">{desc}</div>
                    </div>
                ))}
            </div>

            {/* Prerequisites */}
            <div className="glass-panel rounded-lg p-5 border border-accent-gold/15">
                <div className="flex items-center gap-2 mb-3">
                    <span className="label-caps text-accent-gold">Prerequisites</span>
                </div>
                <ul className="text-sm text-text-muted space-y-1.5">
                    <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-gold/50" />
                        Node.js 18+ installed
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-gold/50" />
                        0G testnet tokens, get from <a href="https://faucet.0g.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">faucet.0g.ai</a>
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-gold/50" />
                        An MCP-compatible client (Claude Desktop, Cursor, or use the REST API)
                    </li>
                </ul>
            </div>

            {/* Hackathon Demo Flow */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <span className="label-caps">For the Hackathon Demo</span>
                </div>
                <div className="space-y-4">
                    <StepCard step={1} title="Start the Services">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <div className="text-[10px] text-text-muted mb-1 font-mono uppercase tracking-wider">Terminal 1: Backend</div>
                                <CopyBlock code={`cd 0g-agent-shield
npm run build
npm run doctor
npm start`} />
                            </div>
                            <div>
                                <div className="text-[10px] text-text-muted mb-1 font-mono uppercase tracking-wider">Terminal 2: Dashboard</div>
                                <CopyBlock code={`cd 0g-agent-shield-ui
npm run dev`} />
                            </div>
                        </div>
                    </StepCard>

                    <StepCard step={2} title="(Optional) Ngrok tunnel for Vercel">
                        <p className="text-xs text-text-muted mb-3 leading-relaxed">
                            Run this to make your local backend accessible to the world:
                        </p>
                        <CopyBlock code={`ngrok http 3000`} />
                        <p className="text-xs text-text-muted mt-3 leading-relaxed">
                            Copy the <code className="text-primary bg-primary/10 px-1 rounded">https://xxxx.ngrok-free.app</code> URL.
                            If you deploy the dashboard to Vercel, paste this URL into the <strong className="text-text-primary">Live/Offline</strong> indicator
                            in the top-right corner to connect.
                        </p>
                    </StepCard>

                    <StepCard step={3} title="Run the Demo">
                        <ul className="text-xs text-text-muted space-y-2 leading-relaxed list-disc list-inside marker:text-primary">
                            <li>Open <code className="text-primary bg-primary/10 px-1 rounded">http://localhost:5173</code> (or Vercel URL with tunnel)</li>
                            <li><strong>GUIDE</strong> tab walks you through everything</li>
                            <li>Go to <strong>VAULT</strong> tab → type sensitive data → click "Encrypt & Store on 0G"</li>
                            <li>Watch <strong className="text-text-primary">HexCascade</strong> animation as data encrypts</li>
                            <li>Copy the root hash → switch to <strong className="text-text-primary">Retrieve</strong> tab → paste → click Decrypt</li>
                            <li>Click <strong className="text-text-primary">ATT</strong> button in sidebar → triggers CommitCeremony animation</li>
                            <li><strong>MERKLE</strong> tab shows live D3 tree visualization</li>
                            <li><strong>AGENTS</strong> tab shows sub-agent spawning</li>
                            <li><strong>LOG</strong> tab shows full real-time event stream</li>
                        </ul>
                    </StepCard>
                </div>
            </div>

            {/* Step-by-step for Devs */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <span className="label-caps mt-8">For Real Developers Using Your Tool</span>
                </div>

                <div className="space-y-4">
                    <StepCard step={1} title="Option A — Scaffold a new project (recommended)">
                        <CopyBlock code={`npx create-silo-app my-agent
cd my-agent
# Edit .env with your 0G private key
npm run build && npm run doctor && npm run demo`} />
                        <p className="text-xs text-text-muted mt-3 leading-relaxed">
                            Need a wallet? Export from MetaMask, or generate one: <code className="text-primary bg-primary/10 px-1 rounded">node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"</code>.
                            Fund it with testnet tokens at <a href="https://faucet.0g.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">faucet.0g.ai</a>.
                        </p>
                    </StepCard>

                    <StepCard step={2} title="Option B — Add to existing project">
                        <CopyBlock code={`npm install silo-agent`} />
                        <div className="mt-3">
                            <CopyBlock lang="typescript" code={`import { AgentVault } from "silo-agent";

const vault = new AgentVault({
  privateKey: process.env.PRIVATE_KEY!,
  evmRpc: "https://evmrpc-testnet.0g.ai",
  indexerRpc: "https://indexer-storage-testnet-turbo.0g.ai",
});
await vault.init();

// Store encrypted memory
const { rootHash } = await vault.store("sensitive patient data");

// Retrieve and decrypt
const decrypted = await vault.retrieve(rootHash);

// Commit attestation (Merkle proof of all actions)
const { merkleRoot } = await vault.commitSession();`} />
                        </div>
                    </StepCard>

                    <StepCard step={3} title="Option C — MCP Server (Claude Desktop / Cursor)">
                        <p className="text-xs text-text-muted mb-3">
                            Add this to your Claude Desktop config (<code className="text-primary bg-primary/10 px-1 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code>) or Cursor MCP settings:
                        </p>
                        <CopyBlock lang="json" code={`{
  "mcpServers": {
    "silo": {
      "command": "npx",
      "args": ["silo-agent", "mcp"],
      "env": {
        "PRIVATE_KEY": "your_64_char_hex_key",
        "EVM_RPC": "https://evmrpc-testnet.0g.ai",
        "INDEXER_RPC": "https://indexer-storage-testnet-turbo.0g.ai"
      }
    }
  }
}`} />
                        <p className="text-xs text-text-muted mt-2 leading-relaxed">
                            No absolute paths needed — <code className="text-primary bg-primary/10 px-1 rounded">npx</code> resolves the package from npm automatically.
                        </p>
                    </StepCard>
                </div>
            </div>

            {/* MCP Tools Reference */}
            <div>
                <div className="flex items-center gap-2 mb-4">
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
                    <span className="label-caps">Multi-Agent Sharing</span>
                </div>
                <div className="glass-panel rounded-lg p-5">
                    <p className="text-sm text-text-muted mb-4 leading-relaxed">
                        Agents sharing the same <code className="text-primary bg-primary/10 px-1 rounded text-xs">VAULT_SECRET</code> can
                        pass encrypted memories to each other. Agent A stores data and generates a share descriptor.
                        Agent B imports it using the root hash and both actions are attested in their respective Merkle trees.
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

                    <div className="mt-6 pt-5 border-t border-border/50">
                        <h4 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent-gold animate-pulse" />
                            Using the Hosted Dashboard?
                        </h4>
                        <p className="text-xs text-text-muted mb-3 leading-relaxed">
                            If you're viewing this on Vercel instead of localhost, the dashboard can't reach your local background server directly.
                            You need to expose it using <code className="text-primary bg-primary/10 px-1 rounded">ngrok</code>:
                        </p>
                        <CopyBlock code={`ngrok http 3000`} />
                        <p className="text-xs text-text-muted mt-3 leading-relaxed">
                            Copy the generated `https://` ngrok URL, click on the <strong className="text-text-primary">Offline / URL</strong> indicator in the top right of this dashboard, paste the URL, and press Enter to connect.
                        </p>
                    </div>
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
                    className="inline-flex items-center gap-2 px-5 py-2 bg-primary/10 border border-primary/30 text-primary font-mono text-xs uppercase tracking-widest rounded hover:bg-primary/20 transition-all"
                >
                    Open Vault
                </button>
            </div>
        </div>
    );
}
