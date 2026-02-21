import { useState } from 'react';

function CopyBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <div className="relative group">
            <pre className={`glass-panel rounded p-4 text-xs font-mono text-text-primary overflow-x-auto leading-relaxed language-${lang}`}>
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
                    { label: 'DeFAI Guardrails', desc: 'Intent -> plan -> simulation -> user approval gate' },
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

            {/* Architecture Concepts */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <span className="label-caps">Core Architecture Concepts</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <div className="glass-panel rounded-lg p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-2 h-2 rounded-full bg-accent-store" />
                            <h4 className="text-sm font-semibold text-text-primary">Why Localhost?</h4>
                        </div>
                        <p className="text-xs text-text-muted leading-relaxed">
                            SILO is a developer tool. The "backend" running on <code>localhost</code> is actually your local <strong>Agent Node</strong>. Running it locally means your Claude Desktop or Cursor agent communicates directly with it, without sending your private key or raw data to a centralized server. The Vercel dashboard is simply a universal headless viewer that connects to your local node via ngrok.
                        </p>
                    </div>

                    <div className="glass-panel rounded-lg p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-2 h-2 rounded-full bg-accent-retrieve" />
                            <h4 className="text-sm font-semibold text-text-primary">Where's the Private Key from?</h4>
                        </div>
                        <p className="text-xs text-text-muted leading-relaxed">
                            It's a standard EVM wallet (like MetaMask). SILO uses it to sign transactions uploading data to 0G Storage, and also uses it to derive a secure AES-256 key. Your agent's memory is encrypted entirely client-side <em>before</em> it ever touches the decentralized storage network.
                        </p>
                    </div>

                    <div className="glass-panel rounded-lg p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-2 h-2 rounded-full bg-accent-commit" />
                            <h4 className="text-sm font-semibold text-text-primary">Session vs. Storage</h4>
                        </div>
                        <p className="text-xs text-text-muted leading-relaxed">
                            When you stop your local backend (Ctrl+C), the active "session" ends and local memory is cleared. However, any data you <code>store()</code>'d is permanently saved on the 0G Storage testnet as an encrypted blob. If you didn't commit the session first, you just lose the Merkle proof connecting the events.
                        </p>
                    </div>

                    <div className="glass-panel rounded-lg p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            <h4 className="text-sm font-semibold text-text-primary">Multi-Agent Privacy</h4>
                        </div>
                        <p className="text-xs text-text-muted leading-relaxed">
                            Agents securely collaborate by sharing a specific <code>rootHash</code> and decryption key via the <code>vault_share</code> tool. Because everything is encrypted before upload, no unauthorized party can read the shared memory—even if they find it on the public 0G network.
                        </p>
                    </div>
                </div>
            </div>

            {/* Universal Setup */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <span className="label-caps">Universal Setup Guide (For Humans & AI Agents)</span>
                </div>
                <p className="text-sm text-text-muted mb-6 leading-relaxed">
                    Follow these five steps to start your decentralized AI agent node, enable MCP tools for Claude/Cursor, and connect the hosted dashboard through ngrok.
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
                        <p className="text-[11px] text-accent-store mt-2">
                            Expected success output: project folder created with <code>package.json</code>, <code>.env</code>, and <code>demo-context.md</code>.
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
                            This gives your AI 21 tools out-of-the-box (like <code className="text-text-primary">vault_store</code>, <code className="text-text-primary">defai_plan</code>, and <code className="text-text-primary">memory_write</code>).
                        </p>
                        <p className="text-[11px] text-accent-store mt-2">
                            Expected success output: Claude/Cursor shows SILO MCP tools and no JSON parse errors.
                        </p>
                    </StepCard>

                    {/* STEP 3: V2 CONTEXT */}
                    <StepCard step={3} title="Provide V2 Context to Agents">
                        <p className="text-xs text-text-muted mb-3 leading-relaxed">
                            For SILO v2's Multi-Agent Shared Memory features to work correctly, your AI needs to understand the <b>Rules of Engagement</b>.
                        </p>
                        <p className="text-xs text-text-muted mb-3 leading-relaxed">
                            Copy everything inside the <code className="text-primary bg-primary/10 px-1 rounded">demo-context.md</code> file generated in your project root, and paste it to your Claude Desktop or Cursor chat <i>before</i> starting your work!
                        </p>
                        <p className="text-[11px] text-accent-store mt-2">
                            Expected success output: model acknowledges SILO v2 rules and avoids autonomous tools unless explicitly asked.
                        </p>
                    </StepCard>

                    {/* STEP 4: NODE & TUNNEL */}
                    <StepCard step={4} title="Start Node & Ngrok Tunnel">
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
                        <p className="text-[11px] text-accent-store mt-3">
                            Expected success output: terminal shows server listening on <code>:3000</code> and ngrok prints a public <code>https://...</code> URL.
                        </p>
                    </StepCard>

                    {/* STEP 5: DASHBOARD */}
                    <StepCard step={5} title="Connect the Universal Dashboard">
                        <p className="text-xs text-text-muted mb-3 leading-relaxed">
                            Because you are running the backend locally via ngrok, you can use the hosted web dashboard without downloading frontend code.
                        </p>
                        <ul className="text-xs text-text-muted space-y-2 leading-relaxed list-decimal list-inside marker:text-primary mb-4">
                            <li>Open the Vercel dashboard link (the site you are on right now).</li>
                            <li>Look at the top right of the navigation bar. Click the <strong className="text-text-primary">Offline / URL</strong> indicator.</li>
                            <li>Paste the <code className="text-primary bg-primary/10 px-1 rounded">https://xxxx.ngrok-free.app</code> URL you copied in Step 4.</li>
                            <li>Press <strong className="text-text-primary">Enter</strong> to connect. The dashboard will instantly sync with your local node.</li>
                        </ul>
                        <p className="text-[11px] text-accent-store mt-2">
                            Expected success output: connection indicator turns online and new vault events appear live.
                        </p>
                    </StepCard>
                </div>
            </div>

            <div className="glass-panel rounded-lg p-5 border border-primary/20">
                <div className="label-caps mb-3">Common Failures (Fast Fixes)</div>
                <ul className="text-xs text-text-muted space-y-2 leading-relaxed">
                    <li><code>EADDRINUSE :::3000</code> {'->'} run <code>lsof -i :3000</code>, then <code>kill -9 &lt;PID&gt;</code>, then restart.</li>
                    <li><code>ERR_NGROK_334</code> {'->'} previous tunnel still online. Run <code>pkill -f ngrok</code> and start ngrok again.</li>
                    <li><code>MCP ... is not valid JSON</code> {'->'} keep MCP as <code>npx silo-agent mcp</code>, avoid extra stdout logs, restart client.</li>
                    <li><code>0 balance</code> in doctor {'->'} fund the same wallet from <a href="https://faucet.0g.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">faucet.0g.ai</a> and re-run doctor.</li>
                </ul>
            </div>

            {/* Try it CTA */}
            <div className="glass-card rounded-lg p-6 text-center">
                <h3 className="font-semibold text-text-primary mb-2">Ready to try it?</h3>
                <p className="text-sm text-text-muted mb-4">
                    Start with DEFAI for safe execution planning, then open Vault for encrypted memory.
                </p>
                <div className="flex items-center justify-center gap-3">
                    <button
                        onClick={() => onNavigate('defai')}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-primary/10 border border-primary/30 text-primary font-mono text-xs uppercase tracking-widest rounded hover:bg-primary/20 transition-all"
                    >
                        Open DeFAI
                    </button>
                    <button
                        onClick={() => onNavigate('vault')}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-base border border-border text-text-primary font-mono text-xs uppercase tracking-widest rounded hover:border-primary/40 transition-all"
                    >
                        Open Vault
                    </button>
                </div>
            </div>
        </div>
    );
}
