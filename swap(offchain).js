// This module provides an offchain swap function using an IDL (Interface Definition Language) specification.
// It assumes you have a gRPC client generated from the IDL and a wallet/signer available.

let grpcClient = null; // Should be initialized with your gRPC client instance elsewhere

export async function offchainSwap({ fromToken, toToken, amount, walletAddress }) {
  if (!grpcClient) {
    throw new Error("gRPC client not initialized");
  }

  try {
    // Construct the swap request according to your IDL
    const swapRequest = {
      from_token: fromToken,
      to_token: toToken,
      amount: amount.toString(),
      user_address: walletAddress,
    };

    // Call the gRPC swap method (method name may vary based on your IDL)
    return await new Promise((resolve, reject) => {
      grpcClient.Swap(swapRequest, (err, response) => {
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    });
  } catch (error) {
    console.error("Offchain swap failed:", error);
    throw error;
  }
}

/**
 * Sets the gRPC client instance to be used for swaps.
 * @param {Object} client - The gRPC client instance generated from the IDL.
 */
export function setGrpcClient(client) {
  grpcClient = client;
}
