import { Connection, PublicKey, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import chalk from "chalk";
import dotenv from "dotenv";
import bs58 from "bs58";
dotenv.config();
import { swap } from "./swap.js";
// import { buy_pumpfun, buy_pumpswap, sell_pumpfun, sell_pumpswap } from "./swapsdk_0slot.js";
// import { buy_raydium_CPMM, buy_raydium_launchpad, sell_raydium_CPMM, sell_raydium_launchpad } from "./swapRaydium.js";

const RPC_URL = process.env.RPC_URL;
const connection = new Connection(RPC_URL, "confirmed");

//============functions============//
export const token_buy = async (mint, sol_amount, pool_status,  context) => {
 
  if (!mint) {
    throw new Error("mint is required and was not provided.");
  }
  const currentUTC = new Date();
  const txid = await swap("BUY", mint, sol_amount * LAMPORTS_PER_SOL);
  // let txid = "";
  console.log(chalk.green(`🟢BUY tokenAmount:::${sol_amount} pool_status: ${pool_status} `));

  //============off chain sign ultra fast============//
  // if (pool_status == "pumpfun") {
  //   txid = await buy_pumpfun(mint, sol_amount * LAMPORTS_PER_SOL, context);//off chain sign ultra fast
  // } else if (pool_status == "pumpswap") {
   
  //   txid = await buy_pumpswap(mint, sol_amount * LAMPORTS_PER_SOL, context.pool);
  // } else if (pool_status == "raydium_launchlab") {
  //   txid = await buy_raydium_launchpad(mint, sol_amount * LAMPORTS_PER_SOL, context);
  // } else {
  //   txid = await buy_raydium_CPMM(mint, sol_amount * LAMPORTS_PER_SOL);
  // }
  const endUTC = new Date();
  const timeTaken = endUTC.getTime() - currentUTC.getTime();
  console.log(`⏱️ Total BUY time taken: ${timeTaken}ms (${(timeTaken / 1000).toFixed(2)}s)`);
  return txid;
};

export const token_sell = async (mint, tokenAmount, pool_status, isFull, context) => {
  try {
   
    if (!mint) {
      throw new Error("mint is required and was not provided.");
    }
    console.log(chalk.red(`🔴SELL tokenAmount:::${tokenAmount} pool_status: ${pool_status} `));

    const currentUTC = new Date();
    
  //============off chain sign ultra fast============//
    // let txid = "";
    // if (pool_status == "pumpfun") {
    //   txid = await sell_pumpfun(mint, tokenAmount, isFull, context);
    // } else if (pool_status == "pumpswap") {
    //   txid = await sell_pumpswap(mint, tokenAmount, context.pool, isFull);
    // } else if (pool_status == "raydium_launchlab") {
    //   txid = await sell_raydium_launchpad(mint, tokenAmount, isFull);
    // } else {
    //   txid = await sell_raydium_CPMM(mint, tokenAmount, isFull);
    // }
    const txid = await swap("SELL", mint, tokenAmount);
    const endUTC = new Date();
    const timeTaken = endUTC.getTime() - currentUTC.getTime();
    console.log(`⏱️ Total SELL time taken: ${timeTaken}ms (${(timeTaken / 1000).toFixed(2)}s)`);

    if (txid === "stop") {
      console.log(chalk.red(`[${new Date().toISOString()}] 🛑 Swap returned "stop" - no balance for ${mint}`));
      return "stop";
    }

    if (txid) {
      console.log(chalk.green(`Successfully sold ${tokenAmount} tokens : https://solscan.io/tx/${txid}`));
      return txid;
    }

    return null;
  } catch (error) {
    console.error("Error in token_sell:", error.message);
    if (error.response?.data) {
      console.error("API Error details:", error.response.data);
    }
    return null;
  }
};


export const getSplTokenBalance = async (mint) => {
  if (!mint) {
    console.log("🔄 Token balance error: Mint address is undefined or null.");
    throw new Error("Mint address is undefined or null.");
  }

  let mintPubkey;
  try {
    mintPubkey = new PublicKey(mint);
  } catch (err) {
    console.log("🔄 Token balance error: Invalid mint address provided.");
    throw err;
  }

  // const publicKey = getPublicKeyFromPrivateKey();
  const publicKey = getPublicKeyFromPrivateKey();
  const ata = await getAssociatedTokenAddress(mintPubkey, new PublicKey(publicKey));

  let account;
  try {
    account = await getAccount(connection, ata);
  } catch (err) {
    // Handle TokenAccountNotFoundError gracefully
    if (
      err.name === "TokenAccountNotFoundError" ||
      (err.message && (
        err.message.includes("Failed to find account") ||
        err.message.includes("Account does not exist") ||
        err.message.includes("could not find account")
      ))
    ) {
      // No account found, treat as zero balance
      console.log("🔄 Token balance: Account not found, returning 0.");
      return null;
    }
    // If the error is related to an invalid mint, log and throw error
    if (err.message && err.message.includes("Invalid param")) {
      console.log("🔄 Token balance error: Invalid mint param.");
      throw err;
    }
    // Other errors
    console.log("🔄 Token balance error:", err.message || err);
    throw err;
  }

  return Number(account.amount); // Convert BigInt to Number
};
export const checkWalletBalance = async () => {
  try {
    const pubkey = getPublicKeyFromPrivateKey();
    const balanceLamports = await connection.getBalance(pubkey);
    const balance = balanceLamports / LAMPORTS_PER_SOL;
    return { balance };
  } catch (err) {
    console.error("Error checking wallet balance:", err.message || err);
    throw err;
  }
};

export const getKeypairFromPrivateKey = (privateKeyString) => {
  try {
    // Try base58 first
    try {
      const decoded = bs58.decode(privateKeyString);
      return Keypair.fromSecretKey(decoded);
    } catch (e) {
      // Not base58, try base64
      try {
        const decoded = Buffer.from(privateKeyString, 'base64');
        return Keypair.fromSecretKey(decoded);
      } catch (e2) {
        // Not base64, try JSON array
        try {
          const arr = JSON.parse(privateKeyString);
          const uint8arr = new Uint8Array(arr);
          return Keypair.fromSecretKey(uint8arr);
        } catch (e3) {
          throw new Error('Invalid private key format. Supported formats: base58, base64, or JSON array');
        }
      }
    }
  } catch (err) {
    throw new Error('Failed to decode private key: ' + err.message);
  }
};
export const getPublicKeyFromPrivateKey = () => {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Private key is required and was not provided.");
  }
  const keypair = getKeypairFromPrivateKey(privateKey);
  return keypair.publicKey.toString();
};

