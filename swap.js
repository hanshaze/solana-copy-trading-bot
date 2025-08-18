import axios from "axios";
import { Keypair, Connection, LAMPORTS_PER_SOL, VersionedTransaction, SystemProgram, PublicKey, TransactionMessage, sendAndConfirmRawTransaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { readFile } from "fs/promises";
import { Wallet } from "@project-serum/anchor";
import dotenv from "dotenv";
import chalk from "chalk";
import fs from "fs";
import path from "path";
import bs58 from "bs58";
import { getSplTokenBalance } from "./fuc.js";

dotenv.config();

// SWAP_METHOD: "0slot", "nozomi", "race", "solana"
const SWAP_METHOD = (process.env.SWAP_METHOD || "solana").toLowerCase();

const NOZOMI_URL = process.env.NOZOMI_URL;
const NOZOMI_UUID = process.env.NOZOMI_UUID;
const nozomiConnection = new Connection(`${NOZOMI_URL}?c=${NOZOMI_UUID}`);

const NOZOMI_TIP_LAMPORTS = Number(process.env.NOZOMI_TIP_LAMPORTS || 200000);
const JITO_TIP_LAMPORTS = Number(process.env.JITO_TIP || 100000);
const PRIORITIZATION_FEE_LAMPORTS = Number(process.env.PRIORITIZATION_FEE_LAMPORTS || 10000);

const NOZOMI_TIP_ADDRESS = new PublicKey("TEMPaMeCRFAS9EKF53Jd6KpHxgL47uWLcpFArU1Fanq");

export const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;

export const decodePrivateKey = (secretKeyString) =>{
  try {
    // Try base58 first
    return bs58.decode(secretKeyString);
  } catch (error) {
    try {
      // Try base64
      return Buffer.from(secretKeyString, 'base64');
    } catch (base64Error) {
      try {
        // Try JSON array (for array format)
        const jsonArray = JSON.parse(secretKeyString);
        return new Uint8Array(jsonArray);
      } catch (jsonError) {
        throw new Error('Invalid private key format. Supported formats: base58, base64, or JSON array');
      }
    }
  }
}

export const loadwallet = async () => {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("PRIVATE_KEY not found in environment variables");
  }
  try {
    const privateKeyBytes=decodePrivateKey(privateKey)
    const keypair = Keypair.fromSecretKey(privateKeyBytes);

    if (!keypair) {
      throw new Error("Failed to create Keypair from the provided private key");
    }

    const wallet = new Wallet(keypair);
    wallet.keypair = keypair;
    return wallet;
  } catch (error) {
    console.error("Error loading wallet:", error);
    throw error;
  }
};

export const rpc_connection = () => {
  return new Connection(process.env.RPC_URL, "confirmed");
};

export const getBalance = async () => {
  const connection = rpc_connection();
  const walletInstance = await loadwallet();
  const balance = await connection.getBalance(walletInstance.publicKey);
 
  console.log(`Balance =>`, balance / LAMPORTS_PER_SOL, "SOL");
  return balance / LAMPORTS_PER_SOL;
};

// const quoteResponse = await (
//   await fetch(
//       `https://lite-api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${this.mint.toString()}&amount=${this.buy_amount}&slippageBps=4000&restrictIntermediateTokens=true`
//   )
// ).json();
// const swapResponse = await (
//   await fetch('https://lite-api.jup.ag/swap/v1/swap', {
//       method: 'POST',
//       headers: {
//       'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//           quoteResponse,
//           userPublicKey: wallet.publicKey,
//           dynamicComputeUnitLimit: true,
//           dynamicSlippage: true,
//           prioritizationFeeLamports: {
//               priorityLevelWithMaxLamports: {
//                   maxLamports: 4000,
//                   priorityLevel: "high"
//               }
//           }
//       })
//   })
// ).json();
// const transactionBase64 = swapResponse.swapTransaction
// const transaction = VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'));
// transaction.sign([wallet]);
// await sendAndConfirmRawTransaction(
//   this.instantConnection,
//   Buffer.from(transaction.serialize()),
//   { skipPreflight: true, maxRetries: 5 }
// )



const getResponse = async (tokenA, tokenB, amount, slippageBps, anchorWallet) => {
  const quoteResponse = (
    await axios.get(
      `https://lite-api.jup.ag/swap/v1/quote?inputMint=${tokenA}&outputMint=${tokenB}&amount=${amount}&slippageBps=${slippageBps}`
    )
  ).data;

  // Build swap request body based on SWAP_METHOD
  let swapRequestBody = {
    quoteResponse,
    userPublicKey: anchorWallet.publicKey.toString(),
    wrapAndUnwrapSol: true,
    dynamicComputeUnitLimit: true,
   
  };

  // Map SWAP_METHOD string to behavior
  if (SWAP_METHOD === "solana" || SWAP_METHOD === "0slot") {
    // Standard prioritization fee
    swapRequestBody.prioritizationFeeLamports = PRIORITIZATION_FEE_LAMPORTS;
  } else if (SWAP_METHOD === "race") {
    // JITO tip
    swapRequestBody.prioritizationFeeLamports = { jitoTipLamports: JITO_TIP_LAMPORTS };
  }
  // "nozomi" handled in executeTransaction

  const swapResponse = await axios.post(`https://lite-api.jup.ag/swap/v1/swap`, swapRequestBody);
  return swapResponse;
};

const executeTransaction = async (connection, swapTransaction, anchorWallet) => {
  try {
    if (!anchorWallet?.keypair) {
      throw new Error("Invalid anchorWallet: keypair is undefined");
    }
 

    const transaction = VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));
    transaction.sign([anchorWallet.keypair]);

    let newMessage, newTransaction, rawTransaction, txid, timestart;
    
    if (SWAP_METHOD === "nozomi") {
      console.log("Nozomi response: send via nozomi connection");
      let blockhash = await connection.getLatestBlockhash();
      let message = transaction.message;
      let addressLookupTableAccounts = await loadAddressLookupTablesFromMessage(message, connection);
      let txMessage = TransactionMessage.decompile(message, { addressLookupTableAccounts });
      // Add Nozomi tip instruction
      let nozomiTipIx = SystemProgram.transfer({
        fromPubkey: anchorWallet.publicKey,
        toPubkey: NOZOMI_TIP_ADDRESS,
        lamports: NOZOMI_TIP_LAMPORTS,
      });
      txMessage.instructions.push(nozomiTipIx);

      newMessage = txMessage.compileToV0Message(addressLookupTableAccounts);
      newMessage.recentBlockhash = blockhash.blockhash;

      newTransaction = new VersionedTransaction(newMessage);
      newTransaction.sign([anchorWallet.keypair]);

      rawTransaction = newTransaction.serialize();
      timestart = Date.now();
      txid = await nozomiConnection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        maxRetries: 2,
      });

      console.log("Nozomi response: txid: %s", txid);
    } else {
      console.log("Standard/JITO/0slot/solana/race: send via normal connection");
      // Standard/JITO/0slot/solana/race: send via normal connection
      const currentUTC = new Date();
      rawTransaction = transaction.serialize();
      timestart = Date.now();
      txid = await sendAndConfirmRawTransaction(connection, Buffer.from(rawTransaction), {
        skipPreflight: true,
        maxRetries: 1,
      });
      

      console.log("Standard/JITO/0slot/solana/race response: txid: %s", txid);
      const endUTC = new Date();
      const timeTaken = endUTC.getTime() - currentUTC.getTime();
      console.log(`⏱️ confirm time taken: ${timeTaken}ms (${(timeTaken / 1000).toFixed(2)}s)`);
      return txid;
    }

  } catch (error) {
    console.error("Transaction execution error:", error);
    console.log(chalk.red("Transaction reconfirm after 1s!"));
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};

async function loadAddressLookupTablesFromMessage(message, connection) {
  let addressLookupTableAccounts = [];
  for (let lookup of message.addressTableLookups) {
    let lutAccounts = await connection.getAddressLookupTable(lookup.accountKey);
    addressLookupTableAccounts.push(lutAccounts.value);
  }
  return addressLookupTableAccounts;
}


export const swap = async (action, mint, amount) => {
  const SOL_ADDRESS = "So11111111111111111111111111111111111111112";
  const RETRY_DELAY = Number(process.env.RETRY_DELAY) || 1000; // fallback to 1s if not set

  try {
    const connection = rpc_connection();
    const wallet = await loadwallet();

    // Determine tokenA and tokenB based on action and mint
    let tokenA, tokenB;
    if (action === "BUY") {
      tokenA = SOL_ADDRESS;
      tokenB = mint;
    } else if (action === "SELL") {
      tokenA = mint;
      tokenB = SOL_ADDRESS;
    } else {
      throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Swapping ${amount} of ${tokenA} for ${tokenB}...`);
    let retryCount = 0;
    while (retryCount <= MAX_RETRIES) {
      try {
        console.log(`Attempt ${retryCount + 1}/${MAX_RETRIES + 1}`);
        // If this is a sell (tokenA is not SOL and tokenB is SOL), and retryCount > 1, check tokenA balance before proceeding
        if (
          retryCount > 1 &&
          tokenA !== SOL_ADDRESS &&
          tokenB === SOL_ADDRESS
        ) {
          const balance = await getSplTokenBalance(tokenA);
          console.log(`(Retry #${retryCount}) Current tokenA (${tokenA}) balance:`, balance, "Requested amount:", amount);
          if (balance <= 0) {
            console.log(`No balance for tokenA (${tokenA}) to sell. Aborting swap.`);
            return "stop";
          }
          if (amount > balance) {
            console.log(`Requested amount (${amount}) exceeds available balance (${balance}) for tokenA (${tokenA}). Adjusting amount to available balance.`);
            amount = balance;
          }
        }

      
        const quoteData = await getResponse(tokenA, tokenB, amount, process.env.SLIPPAGE_BPS || "5000", wallet);
       
        if (!quoteData?.swapTransaction) {
          throw new Error("Failed to get swap transaction data");
        }
     
        const txid = await executeTransaction(connection, quoteData.swapTransaction, wallet);
       
        if (!txid) {
          throw new Error("Transaction was not confirmed");
        }

        console.log(`--------------------------------------------------------\n
✌✌✌Swap successful! ${tokenA} for ${tokenB}`);
        console.log(`https://solscan.io/tx/${txid}\n`);
       
        return txid;
      } catch (error) {
        console.error(`Attempt ${retryCount + 1} failed:`, error.message);
        retryCount++;

        if (retryCount > MAX_RETRIES) {
          console.error(`Transaction failed after ${MAX_RETRIES + 1} attempts.`);
          throw error;
        }

        console.warn(`Retrying in ${RETRY_DELAY / 1000} seconds (${retryCount}/${MAX_RETRIES})...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
  } catch (error) {
    console.error("Swap failed:", error.message);
    return null;
  }

  return null;
};
