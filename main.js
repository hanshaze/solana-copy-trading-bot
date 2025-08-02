import { getBalance } from "./swap.js";

export const pump_geyser = async () => {
  try {
    console.log("Please contact @hanshazee for any questions or support.");
    
    // Get wallet balance
    await getBalance();
    
    console.log("pump_geyser function completed.");
  } catch (error) {
    console.error("Error in pump_geyser:", error);
  }
}; 