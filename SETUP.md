# 🚀 Quick Setup Guide

## ⚡ 5-Minute Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# Copy the template
cp env.template .env

# Edit .env with your settings
# At minimum, you need:
PRIVATE_KEY=your_wallet_private_key
RPC_URL=https://your-rpc-endpoint.com
GRPC_ENDPOINT=https://your-grpc-endpoint.com
GRPCTOKEN=your_grpc_token
```

### 3. Test Configuration
```bash
npm run test-config
```

### 4. Run Demo (Optional)
```bash
npm run demo
```

### 5. Start Trading
```bash
npm start
```

## 🔑 Required Services

- **Solana Wallet**: Phantom, Solflare, or private key
- **RPC Endpoint**: [Helius](https://helius.xyz/), [QuickNode](https://quicknode.com/), or [Alchemy](https://alchemy.com/)
- **gRPC Access**: [Triton One](https://triton.one/) subscription

## 💰 Minimum Requirements

- **Wallet Balance**: At least 1 SOL
- **Sniper Amount**: 0.1 SOL (configurable)
- **Network**: Stable internet connection

## 🚨 First Time Setup

1. **Test with small amounts first**
2. **Use a dedicated trading wallet**
3. **Monitor the bot initially**
4. **Adjust parameters based on performance**

## 📱 Quick Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start the sniper bot |
| `npm run dev` | Start with auto-restart |
| `npm run test-config` | Verify configuration |
| `npm run demo` | Run demo mode |
| `start.bat` | Windows startup script |
| `start.sh` | Linux/Mac startup script |

## 🔧 Troubleshooting

### Common Issues:
- **"Private key invalid"** → Check key format (base58/base64/JSON)
- **"RPC connection failed"** → Verify RPC URL and network
- **"gRPC error"** → Check Triton One subscription
- **"No trades executing"** → Verify transaction filters

### Need Help?
1. Check the README.md
2. Run `npm run test-config`
3. Check console logs for errors
4. Verify all environment variables

---

**⚡ Ready to snipe? Run `npm start` and watch the magic happen!**
