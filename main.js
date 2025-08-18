import { newlunched_subscribeCommand, stopNewLaunch } from "./grpc.js";
import { token_buy, token_sell, getSplTokenBalance, getPublicKeyFromPrivateKey } from "./fuc.js";
import chalk from "chalk";
import dotenv from "dotenv";

dotenv.config();

// Trading configuration
const SNIPER_AMOUNT = parseFloat(process.env.SNIPERAMOUNT || "0.1"); // SOL amount to snipe with
const PROFIT_TARGET = parseFloat(process.env.PROFIT_TARGET || "2.0"); // 2x profit target
const STOP_LOSS = parseFloat(process.env.STOP_LOSS || "0.5"); // 50% stop loss
const MAX_HOLD_TIME = parseInt(process.env.MAX_HOLD_TIME || "300000"); // 5 minutes in ms

// Track active positions
const activePositions = new Map();

export const pump_geyser = async () => {
  try {
    const walletKey = getPublicKeyFromPrivateKey();
    // INSERT_YOUR_CODE
    console.log(chalk.magentaBright(`
   ██████╗██████╗ ██╗   ██╗██████╗ ████████╗ ██████╗ ██╗  ██╗██╗███╗   ██╗ ██████╗ 
  ██╔════╝██╔══██╗██║   ██║██╔══██╗╚══██╔══╝██╔═══██╗██║ ██╔╝██║████╗  ██║██╔════╝ 
  ██║     ██████╔╝ ██║ ██╔╝██████╔╝   ██║   ██║   ██║█████╔╝ ██║██╔██╗ ██║██║  ██╗ 
  ██║     ██╔══██╗   ██╔═╝ ██╔═══╝    ██║   ██║   ██║██╔═██╗ ██║██║╚██╗██║██║   ██║
  ╚██████╗██║  ██║   ██║   ██║        ██║   ╚██████╔╝██║  ██╗██║██║ ╚████║╚██████╔╝
   ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═╝        ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝ ╚═════╝ 
    `));
    console.log(chalk.blue.bold("🚀 Starting Solana Raydium Sniper Bot..."));
    console.log(chalk.blue(`🔑 Wallet Public Key: ${chalk.yellow(walletKey)}`));
    console.log(chalk.blue(`💰 Sniper Amount: ${chalk.green(SNIPER_AMOUNT)} SOL`));
    console.log(chalk.blue(`🎯 Profit Target: ${chalk.green(PROFIT_TARGET)}x`));
    console.log(chalk.blue(`🛑 Stop Loss: ${chalk.green(STOP_LOSS)}x`));
    console.log(chalk.blue(`⏱️ Max Hold Time: ${chalk.green(MAX_HOLD_TIME/1000)}s`));
    
    // Start monitoring for new token launches
    await newlunched_subscribeCommand();
    
    // Set up position monitoring
    setInterval(monitorPositions, 5000); // Check positions every 5 seconds
    
    // Set up graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow("\n🛑 Shutting down sniper bot..."));
      stopNewLaunch();
      
      // Close all positions before exit
      for (const [mint, position] of activePositions) {
        try {
          console.log(chalk.yellow(`🔄 Closing position for ${mint}...`));
          await closePosition(mint, position);
        } catch (error) {
          console.error(chalk.red(`Error closing position for ${mint}:`, error.message));
        }
      }
      
      process.exit(0);
    });
    
  } catch (error) {
    console.error(chalk.red("Error in pump_geyser:", error));
    throw error;
  }
};

// Monitor active positions for profit taking or stop loss
async function monitorPositions() {
  for (const [mint, position] of activePositions) {
    try {
      const currentBalance = await getSplTokenBalance(mint);
      if (!currentBalance || currentBalance <= 0) {
        console.log(chalk.yellow(`⚠️ No balance for ${mint}, removing from active positions`));
        activePositions.delete(mint);
        continue;
      }

      const currentValue = currentBalance * position.currentPrice;
      const profitRatio = currentValue / position.entryValue;
      const holdTime = Date.now() - position.entryTime;

      // Check profit target
      if (profitRatio >= PROFIT_TARGET) {
        console.log(chalk.green(`🎯 Profit target reached for ${mint}: ${profitRatio.toFixed(2)}x`));
        await closePosition(mint, position);
        continue;
      }

      // Check stop loss
      if (profitRatio <= STOP_LOSS) {
        console.log(chalk.red(`🛑 Stop loss triggered for ${mint}: ${profitRatio.toFixed(2)}x`));
        await closePosition(mint, position);
        continue;
      }

      // Check max hold time
      if (holdTime >= MAX_HOLD_TIME) {
        console.log(chalk.yellow(`⏰ Max hold time reached for ${mint}, closing position`));
        await closePosition(mint, position);
        continue;
      }

      // Update current price (you might want to implement price fetching here)
      // For now, we'll use a simple approach
      position.currentPrice = position.entryPrice; // Placeholder

    } catch (error) {
      console.error(chalk.red(`Error monitoring position for ${mint}:`, error.message));
    }
  }
}

// Close a position by selling tokens
async function closePosition(mint, position) {
  try {
    const currentBalance = await getSplTokenBalance(mint);
    if (!currentBalance || currentBalance <= 0) {
      console.log(chalk.yellow(`No balance to sell for ${mint}`));
      activePositions.delete(mint);
      return;
    }

    console.log(chalk.blue(`🔄 Closing position for ${mint}, selling ${currentBalance} tokens`));
    
    const txid = await token_sell(mint, currentBalance, position.poolStatus, true, position.context);
    
    if (txid && txid !== "stop") {
      console.log(chalk.green(`✅ Position closed for ${mint}: ${txid}`));
      
      // Calculate final PnL
      const finalValue = currentBalance * position.currentPrice;
      const pnl = finalValue - position.entryValue;
      const pnlRatio = (pnl / position.entryValue) * 100;
      
      console.log(chalk.cyan(`📊 Final PnL for ${mint}: ${pnl.toFixed(4)} SOL (${pnlRatio.toFixed(2)}%)`));
    } else {
      console.log(chalk.red(`❌ Failed to close position for ${mint}`));
    }
    
    activePositions.delete(mint);
    
  } catch (error) {
    console.error(chalk.red(`Error closing position for ${mint}:`, error.message));
  }
}

// Function to handle new token launches (called from grpc.js)
export const handleNewTokenLaunch = async (tokenMint, poolStatus, context) => {
  try {
    console.log(chalk.green(`🎯 New token launch detected: ${tokenMint}`));
    console.log(chalk.blue(`🏊 Pool type: ${poolStatus}`));
    
    // Check if we already have a position in this token
    if (activePositions.has(tokenMint)) {
      console.log(chalk.yellow(`⚠️ Already have position in ${tokenMint}, skipping`));
      return;
    }

   

    // Execute snipe
    console.log(chalk.blue(`🚀 Sniping ${tokenMint} with ${SNIPER_AMOUNT} SOL...`));
    
    const txid = await token_buy(tokenMint, SNIPER_AMOUNT, poolStatus, context);
    
    if (txid) {
      console.log(chalk.green(`✅ Snipe successful! TX: ${txid}`));
      
      // Add to active positions
      activePositions.set(tokenMint, {
        entryTime: Date.now(),
        entryValue: SNIPER_AMOUNT,
        entryPrice: 1, // Placeholder - you might want to calculate actual price
        currentPrice: 1,
        poolStatus: poolStatus,
        context: context,
        txid: txid
      });
      
      console.log(chalk.cyan(`📊 Position opened for ${tokenMint}`));
      console.log(chalk.cyan(`💰 Entry Value: ${SNIPER_AMOUNT} SOL`));
      console.log(chalk.cyan(`🎯 Profit Target: ${PROFIT_TARGET}x`));
      console.log(chalk.cyan(`🛑 Stop Loss: ${STOP_LOSS}x`));
      
    } else {
      console.log(chalk.red(`❌ Snipe failed for ${tokenMint}`));
    }
    
  } catch (error) {
    console.error(chalk.red(`Error handling new token launch for ${tokenMint}:`, error.message));
  }
};

// // Export for external use
// export { activePositions, handleNewTokenLaunch }; 