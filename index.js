
import { pump_geyser } from "./main.js";
import dotenv from "dotenv";
dotenv.config()

const privateKey = process.env.PRIVATE_KEY; // Use private key directly

if (!privateKey) {
  console.error("Error: PRIVATE_KEY is not set in environment variables.");
  process.exit(1);
}

(async () => {
  try {
    const { getBalance } = await import("./swap.js");
    const balance = await getBalance();
    if (balance < 0.001) {
      console.error("Error: Wallet balance is below 1 SOL. Current balance:", balance, "SOL");
      process.exit(1);
    }
  } catch (err) {
    console.error("Error checking wallet balance:", err.message);
    process.exit(1);
  }
})();

pump_geyser()

