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

            {/* Universal 4-Step Setup */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <span className="label-caps">Universal Setup Guide (For Humans & AI Agents)</span>
                </div>
                <p className="text-sm text-text-muted mb-6 leading-relaxed">
                    Follow these four steps to start your decentralized AI agent node, enable the MCP server for Claude/Cursor, and connect to the live dashboard.
                </p>

                <div className="space-y-4">
                    {/* STEP 1: DOWNLOAD */}
                    <StepCard step={1} title="Download & Configure">
                        <p className="text-xs text-text-muted mb-3 leading-relaxed">
                            Scaffold a fresh SILO agent project. This downloads the <code className="text-primary bg-primary/10 px-1 rounded">silo-agent</code> npm package.
                        </p>
                        <CopyBlock code={`npx create-silo-app my-agent
cd my-agent`} />
                        <p className="text-xs text-text-muted mt-3 leading-relaxed">
                            Edit the generated <code className="text-primary bg-primary/10 px-1 rounded">.env</code> file
                            and add your 0G/EVM testnet private key (64-char hex, no 0x prefix).
                            Need a wallet? Export from MetaMask or run <code className="text-primary bg-primary/10 px-1 rounded">node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"</code>
                            and fund it at <a href="https://faucet.0g.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">faucet.0g.ai</a>.
                        </p>
                    </StepCard>

                    {/* STEP 2: MCP */}
                    <StepCard step={2} title="Start Context Server (MCP Integration)">
                        <p className="text-xs text-text-muted mb-3">
                            Give Claude Desktop or Cursor direct access to the AgentVault by putting this in your
                            <code className="text-primary bg-primary/10 px-1 rounded">claude_desktop_config.json</code>:
                        </p>
                        <CopyBlock lang="json" code={`{
  "mcpServers": {
    "silo": {
      "command": "npx",
      "args": ["silo-agent", "mcp"],
      "env": {
        "PRIVATE_KEY": "your_64_char_hex_key_here",
        "EVM_RPC": "https://evmrpc-testnet.0g.ai",
        "INDEXER_RPC": "https://indexer-storage-testnet-turbo.0g.ai"
      }
    }
  }
}`} />
                        <p className="text-xs text-text-muted mt-2 leading-relaxed">
                            This gives your AI 17 powerful tools out-of-the-box (like <code className="text-text-primary">vault_store</code>, <code className="text-text-primary">session_commit</code>, etc.).
                        </p>
                    </StepCard>

                    {/* STEP 3: NODE & TUNNEL */}
                    <StepCard step={3} title="Start Node & Ngrok Tunnel">
                        <p className="text-xs text-text-muted mb-3 leading-relaxed">
                            Open two terminals inside your <code className="text-primary bg-primary/10 px-1 rounded">my-agent</code> folder.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <div className="text-[10px] text-text-muted mb-1 font-mono uppercase tracking-wider">Terminal 1: Node & API Server</div>
                                <CopyBlock code={`npm run build
npm run doctor
npm start`} />
                                <p className="text-[10px] text-text-muted mt-2 leading-relaxed">
                                    <code className="text-primary px-1">doctor</code> checks your keys/balance. <code className="text-primary px-1">start</code> boots the API on port 3000.
                                </p>
                            </div>
                            <div>
                                <div className="text-[10px] text-text-muted mb-1 font-mono uppercase tracking-wider">Terminal 2: Ngrok Tunnel</div>
                                <CopyBlock code={`ngrok http 3000`} />
                                <p className="text-[10px] text-text-muted mt-2 leading-relaxed">
                                    Copy the <code className="text-primary px-1">https://xxx.ngrok-free.app</code> URL. This securely exposes your local node to the internet.
                                </p>
                            </div>
                        </div>
                    </StepCard>

                    {/* STEP 4: DASHBOARD */}
                    <StepCard step={4} title="Connect the Universal Dashboard">
                        <p className="text-xs text-text-muted mb-3 leading-relaxed">
                            Because you are running the backend locally via ngrok, you can use the hosted web dashboard without downloading frontend code.
                        </p>
                        <ul className="text-xs text-text-muted space-y-2 leading-relaxed list-decimal list-inside marker:text-primary mb-4">
                            <li>Open the Vercel dashboard link (the site you are on right now).</li>
                            <li>Look at the top right of the navigation bar. Click the <strong className="text-text-primary">Offline / URL</strong> indicator.</li>
                            <li>Paste the <code className="text-primary bg-primary/10 px-1 rounded">https://xxxx.ngrok-free.app</code> URL you copied in Step 3.</li>
                            <li>Press <strong className="text-text-primary">Enter</strong> to connect. The dashboard will instantly sync with your local node.</li>
                        </ul>
                    </StepCard>
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
