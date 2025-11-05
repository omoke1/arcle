# Node.js Version Configuration

## Current Setup: Node.js 16

The project is configured to use **Node.js 16.x**.

### Configuration Files:
- `.nvmrc` - For nvm (Node Version Manager)
- `.node-version` - For other version managers
- `package.json` - Engines field specifies Node 16

### Compatibility Note:

⚠️ **Next.js 14 requires Node.js 18+**

If you encounter compatibility issues with Next.js 14 on Node 16, you have two options:

1. **Downgrade Next.js to 13.x** (supports Node 16):
   ```bash
   npm install next@13.5.6 react@18 react-dom@18 --save
   ```

2. **Upgrade to Node.js 18+** (recommended for Next.js 14):
   - Update `.nvmrc` to `18` or `20`
   - Update `package.json` engines field

### Checking Your Node Version:

```bash
node --version
```

Should show: `v16.x.x`

### Using nvm (if installed):

```bash
nvm use 16
# or
nvm use
# (automatically uses .nvmrc)
```

---

**Current Status**: Configured for Node 16
**Note**: Test Next.js 14 compatibility, downgrade if needed

