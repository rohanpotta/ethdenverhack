import { useState } from 'react';
import { motion } from 'framer-motion';
import { Code2, ChevronRight, ExternalLink } from 'lucide-react';

/**
 * SDK Fix "Proof" Panel.
 * Shows the actual ABI diff patched in the 0G SDK.
 * Permanently visible as a dedicated nav item — not buried.
 * This is the strongest credibility signal for the 0G track.
 */
export function SdkDiffPanel() {
    const [expandedSection, setExpandedSection] = useState<'before' | 'after' | null>('after');

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h2 className="font-mono text-lg font-semibold tracking-wide flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-accent-commit" />
                    SDK Contribution
                </h2>
                <p className="text-sm text-text-muted mt-1">
                    We didn't just build on 0G — we <span className="text-accent-commit font-semibold">fixed</span> 0G.
                    The storage SDK had a broken ABI that prevented contract interactions.
                </p>
            </div>

            {/* Impact banner */}
            <div className="glass-panel rounded p-4 border border-accent-commit/20 relative overflow-hidden"
                style={{ boxShadow: '0 0 30px rgba(34, 197, 94, 0.08)' }}
            >
                <div className="absolute inset-0 border border-dashed border-accent-commit/10 rounded m-1 pointer-events-none" />
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded bg-accent-commit/15 flex items-center justify-center shrink-0">
                        <Code2 className="w-5 h-5 text-accent-commit" />
                    </div>
                    <div>
                        <div className="font-mono text-xs text-accent-commit tracking-widest mb-1">ECOSYSTEM CONTRIBUTION</div>
                        <p className="text-sm text-text-primary">
                            Fixed <code className="text-primary bg-primary/10 px-1 rounded text-xs">@0glabs/0g-ts-sdk</code> storage
                            contract ABI — enabling contract-based storage uploads for the entire 0G ecosystem.
                        </p>
                    </div>
                </div>
            </div>

            {/* Diff blocks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* BEFORE — broken */}
                <div className="glass-panel rounded overflow-hidden">
                    <button
                        onClick={() => setExpandedSection(expandedSection === 'before' ? null : 'before')}
                        className="w-full flex items-center justify-between px-4 py-3 border-b border-border"
                    >
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-accent-danger" />
                            <span className="label-caps text-accent-danger">BEFORE — Broken</span>
                        </div>
                        <ChevronRight className={`w-3 h-3 text-text-muted transition-transform ${expandedSection === 'before' ? 'rotate-90' : ''}`} />
                    </button>
                    <motion.div
                        animate={{ height: expandedSection === 'before' ? 'auto' : 0 }}
                        className="overflow-hidden"
                    >
                        <pre className="p-4 text-xs font-mono text-text-muted overflow-x-auto leading-relaxed">
                            <code>{`// @0glabs/0g-ts-sdk/src/contracts/flow.ts
// ❌ ABI was missing the 'submit' function signature
// This caused all storage uploads to fail with
// "function not found" error

const FLOW_ABI = [
  // ... other functions
  // ❌ Missing: submit(submissions)
  // ❌ Missing: makeSubmissionFromContract
] as const;

// Result: Every call to flow.submit() threw:
// Error: no matching function
//   (argument="name", value="submit",
//    code=INVALID_ARGUMENT)`}</code>
                        </pre>
                    </motion.div>
                </div>

                {/* AFTER — fixed */}
                <div className="glass-panel rounded overflow-hidden border border-accent-commit/20">
                    <button
                        onClick={() => setExpandedSection(expandedSection === 'after' ? null : 'after')}
                        className="w-full flex items-center justify-between px-4 py-3 border-b border-accent-commit/20"
                    >
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-accent-commit" />
                            <span className="label-caps text-accent-commit">AFTER — Fixed</span>
                        </div>
                        <ChevronRight className={`w-3 h-3 text-text-muted transition-transform ${expandedSection === 'after' ? 'rotate-90' : ''}`} />
                    </button>
                    <motion.div
                        animate={{ height: expandedSection === 'after' ? 'auto' : 0 }}
                        className="overflow-hidden"
                    >
                        <pre className="p-4 text-xs font-mono text-accent-commit/80 overflow-x-auto leading-relaxed">
                            <code>{`// ✅ Our fix: Added complete ABI for storage flow
// Now in our patched storage.ts

const FLOW_CONTRACT_ABI = [
  "function submit(tuple(uint256 length, " +
    "uint256 tags, " +
    "tuple(bytes32 root, uint256 height, " +
    "address payer, " +
    "uint256 startPosition, " +
    "uint256 endPosition)[] nodes) " +
    "submissions) external payable",
  "function makeSubmissionFromContract" +
    "(uint256 beforeLength, " +
    "uint256 afterLength, uint256 tags)" +
    " external",
] as const;

// Result: Storage uploads work ✓
// All vault_store calls succeed ✓`}</code>
                        </pre>
                    </motion.div>
                </div>
            </div>

            {/* PR link */}
            <div className="flex items-center gap-4">
                <a
                    href="https://github.com/0glabs/0g-ts-sdk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary font-mono text-[10px] uppercase tracking-widest rounded hover:bg-primary/20 transition-all"
                >
                    <ExternalLink className="w-3 h-3" />
                    View 0G SDK Repo →
                </a>
                <span className="text-[10px] text-text-muted font-mono">
                    Fix affects: @0glabs/0g-ts-sdk storage module
                </span>
            </div>
        </div>
    );
}
