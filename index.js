
import { pump_geyser } from "./main.js";
import { getBalance } from "./swap.js";
import dotenv from "dotenv";
dotenv.config()

const privateKey = process.env.PRIVATE_KEY; // Use private key directly
if (!privateKey) {
  console.error("Error: PRIVATE_KEY is not set in environment variables.");
  process.exit(1);
}

export const decodedPrivateKey = privateKey;
// console.log(decodedPrivateKey)
// getBalance()
pump_geyser()

