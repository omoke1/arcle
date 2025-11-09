/**
 * Check real USDC balance on Arc testnet for a wallet address
 */

const address = "0xebe39aaa1a5b781a1b91f11a27cf2aeadd27f4a6";
const usdcAddress = "0x3600000000000000000000000000000000000000"; // Arc testnet USDC
const rpcUrl = "https://rpc.testnet.arc.network";

console.log(`\n🔍 Checking balance for: ${address}`);
console.log(`📦 USDC Contract: ${usdcAddress}`);
console.log(`🌐 RPC: ${rpcUrl}\n`);

// ERC20 balanceOf function signature: 0x70a08231
// balanceOf(address) -> uint256
const functionSignature = "0x70a08231";
const paddedAddress = address.slice(2).padStart(64, "0");
const data = functionSignature + paddedAddress;

fetch(rpcUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "eth_call",
    params: [
      {
        to: usdcAddress,
        data: data,
      },
      "latest",
    ],
    id: 1,
  }),
})
  .then((res) => res.json())
  .then((data) => {
    if (data.error) {
      console.error("❌ RPC Error:", data.error);
      return;
    }
    
    if (data.result && data.result !== "0x") {
      const balance = BigInt(data.result);
      const formatted = Number(balance) / 1e6; // USDC has 6 decimals
      console.log(`✅ Real Balance: $${formatted.toFixed(2)} USDC`);
      console.log(`📊 Raw: ${balance.toString()}`);
      
      if (formatted > 0) {
        console.log(`\n💡 This wallet has real testnet tokens!`);
      } else {
        console.log(`\n💡 This wallet has 0 USDC (no testnet tokens)`);
      }
    } else {
      console.log(`\n❌ Balance: 0.00 USDC (or error)`);
    }
  })
  .catch((err) => {
    console.error("❌ Error:", err.message);
  });




