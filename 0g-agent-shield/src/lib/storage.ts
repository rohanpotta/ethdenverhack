/**
 * 0G Agent Shield — Storage Layer
 *
 * Wraps @0glabs/0g-ts-sdk to provide a simple string-in/string-out interface.
 * The SDK requires file paths, so we handle temp file lifecycle internally.
 *
 * IMPORTANT API notes (from the actual SDK docs):
 *   - indexer.upload(file, evmRpc, signer)  ← evmRpc is 2nd arg, NOT signer alone
 *   - file.merkleTree() returns [tree, err] ← destructure the tuple
 *   - indexer.download(rootHash, outPath, withProof)
 *   - file.close() must be called after merkleTree()
 */

import { Indexer, ZgFile } from "@0glabs/0g-ts-sdk";
import { ethers } from "ethers";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

export interface UploadResult {
  rootHash: string;
  txHash: string;
  size: number;
  timestamp: number;
}

export class StorageClient {
  private indexer: Indexer;
  private signer: ethers.Wallet;
  private provider: ethers.JsonRpcProvider;
  private evmRpc: string;

  constructor(privateKey: string, evmRpc: string, indexerRpc: string) {
    this.evmRpc = evmRpc;
    this.provider = new ethers.JsonRpcProvider(evmRpc);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    this.indexer = new Indexer(indexerRpc);
  }

  get address(): string {
    return this.signer.address;
  }

  async getBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.signer.address);
    return ethers.formatEther(balance);
  }

  /**
   * Upload a string to 0G Storage.
   *
   * Flow: write temp file → create ZgFile → get merkle tree for root hash
   *       → upload via indexer → cleanup temp file
   */
  async upload(data: string): Promise<UploadResult> {
    const tmpPath = path.join(
      os.tmpdir(),
      `0g-shield-${Date.now()}-${Math.random().toString(36).slice(2)}.dat`
    );
    const dataBytes = Buffer.from(data, "utf-8");
    await fs.writeFile(tmpPath, dataBytes);

    let file: ZgFile | null = null;
    try {
      file = await ZgFile.fromFilePath(tmpPath);

      // 0G TS SDK uses the old testnet ABI, but Galileo testnet upgraded to require a submitter address.
      // We wrap the signer in a Proxy to intercept and automatically upgrade the transaction payload.
      const newAbi = ['function submit(tuple(tuple(uint256 length, bytes tags, tuple(bytes32 root, uint256 height)[] nodes) data, address submitter) submission) payable'];
      const oldAbi = ['function submit(tuple(uint256 length, bytes tags, tuple(bytes32 root, uint256 height)[] nodes) submission) payable'];
      const newIface = new ethers.Interface(newAbi);
      const oldIface = new ethers.Interface(oldAbi);

      const proxySigner = new Proxy(this.signer, {
        get(target, prop) {
          if (prop === 'sendTransaction' || prop === 'estimateGas') {
            return async function (tx: any) {
              if (tx.data && tx.data.startsWith('0xef3e12dc')) {
                const decoded = oldIface.decodeFunctionData('submit', tx.data);
                tx.data = newIface.encodeFunctionData('submit', [[decoded[0], target.address]]);
              }
              return (target as any)[prop](tx);
            };
          }
          if (typeof (target as any)[prop] === 'function') {
            return (target as any)[prop].bind(target);
          }
          return (target as any)[prop];
        }
      });

      const [uploadResult, uploadErr] = await this.indexer.upload(
        file,
        this.evmRpc,
        proxySigner as any
      );
      if (uploadErr !== null) {
        throw new Error(`0G upload failed: ${uploadErr}`);
      }

      return {
        rootHash: uploadResult!.rootHash,
        txHash: uploadResult!.txHash,
        size: dataBytes.length,
        timestamp: Date.now(),
      };
    } finally {
      if (file) await file.close();
      await fs.unlink(tmpPath).catch(() => { });
    }
  }

  /**
   * Download a file from 0G Storage by its root hash.
   */
  async download(rootHash: string): Promise<string> {
    const tmpPath = path.join(
      os.tmpdir(),
      `0g-down-${Date.now()}-${Math.random().toString(36).slice(2)}.dat`
    );

    try {
      const err = await this.indexer.download(rootHash, tmpPath, true);
      if (err !== null) {
        throw new Error(`0G download failed: ${err}`);
      }
      return await fs.readFile(tmpPath, "utf-8");
    } finally {
      await fs.unlink(tmpPath).catch(() => { });
    }
  }
}
