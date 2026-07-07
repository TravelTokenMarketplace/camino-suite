// Create + configure ONE CMAccount on Base Sepolia for the "Transio" demo partner,
// using a fresh deployer wallet, so the showroom "Camino Messenger" widget renders
// (Ping offered / AccommodationSearch wanted / native ETH + EURe / off-chain payment).
//
// It uses NO personal wallet and references NO personal account. The deployer key is
// read from a local file (default ~/Downloads/transio-deployer-wallet.txt) or
// $TRANSIO_DEPLOYER_PRIVATE_KEY. The widget config below is baked in as literals.
//
// Why no role grants: createCMAccount(admin, upgrader) auto-grants the admin
// SERVICE_ADMIN_ROLE in initialize, which is all the config writes require.
//
// Usage:
//   node scripts/setup-transio-cmaccount.mjs                 # create + configure
//   node scripts/setup-transio-cmaccount.mjs --account 0x..  # (re)configure an
//                                                            # already-created account
//   node scripts/setup-transio-cmaccount.mjs --dry-run       # print what it would do
//   node scripts/setup-transio-cmaccount.mjs --clone-from 0x # read config off another
//                                                            # account instead of literals
//
// Env overrides: TRANSIO_DEPLOYER_PRIVATE_KEY, TRANSIO_KEY_FILE, RPC_URL.

import { ethers } from 'ethers'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { homedir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))

// --- constants (Base Sepolia, chainId 84532) ------------------------------------
const RPC_URL = process.env.RPC_URL || 'https://sepolia.base.org'
const CHAIN_ID = 84532
const MANAGER = '0xEcf9b5ca23257969B4F9bb3Efca2d5bb850FAcE9'
const EURE = '0x29F37F6adCa168B79B8d9567eab9BE3fBF21db85' // Monerium sandbox EURe on Base Sepolia
const PREFUND_ETH = process.env.PREFUND_ETH || '0.005' // native ETH sent to the new CMAccount (optional)

// The exact widget config to reproduce (both service names are already registered in
// the manager's ServiceRegistry, so addService won't revert with ServiceNotRegistered).
const CONFIG = {
  offered: [
    { name: 'cmp.services.ping.v2.PingService', restrictedRate: true, capabilities: ['uptime probe for partner connectivity'] },
  ],
  wanted: ['cmp.services.accommodation.v5.AccommodationSearchService'],
  tokens: [ethers.ZeroAddress, EURE], // native ETH (zero address) + EURe
  offChainPaymentSupported: true,
}

// --- ABIs (from the suite's helpers) --------------------------------------------
const mgrJson = JSON.parse(readFileSync(join(__dirname, '../src/helpers/ManagerProxyModule#CMAccountManager.json'), 'utf8'))
const accJson = JSON.parse(readFileSync(join(__dirname, '../src/helpers/CMAccountManagerModule#CMAccount.json'), 'utf8'))
const MANAGER_ABI = Array.isArray(mgrJson) ? mgrJson : mgrJson.abi
const ACCOUNT_ABI = Array.isArray(accJson) ? accJson : accJson.abi

// --- args -----------------------------------------------------------------------
const argv = process.argv.slice(2)
const getFlag = (name) => { const i = argv.indexOf(name); return i >= 0 ? (argv[i + 1] ?? true) : undefined }
const existingAccount = getFlag('--account')
const cloneFrom = getFlag('--clone-from')
const dryRun = argv.includes('--dry-run')

// --- deployer key ---------------------------------------------------------------
function loadPrivateKey() {
  if (process.env.TRANSIO_DEPLOYER_PRIVATE_KEY) return process.env.TRANSIO_DEPLOYER_PRIVATE_KEY.trim()
  const keyFile = process.env.TRANSIO_KEY_FILE || join(homedir(), 'Downloads', 'transio-deployer-wallet.txt')
  let body
  try { body = readFileSync(keyFile, 'utf8') } catch {
    throw new Error(`No deployer key. Set TRANSIO_DEPLOYER_PRIVATE_KEY or keep the key file at ${keyFile}`)
  }
  const m = body.match(/PRIVATE_KEY:\s*(0x[0-9a-fA-F]{64})/)
  if (!m) throw new Error(`Could not find "PRIVATE_KEY: 0x..." in ${keyFile}`)
  return m[1]
}

// --- helpers --------------------------------------------------------------------
async function sendTx(label, fnPromise) {
  process.stdout.write(`  → ${label} … `)
  try {
    const tx = await fnPromise
    const receipt = await tx.wait()
    console.log(`ok (block ${receipt.blockNumber})`)
    return receipt
  } catch (err) {
    // Decode revert reason without letting parseError(null) mask it (WORKLOG gotcha).
    let reason = err?.shortMessage || err?.message || String(err)
    try {
      const iface = new ethers.Interface(ACCOUNT_ABI)
      const parsed = iface.parseError(err?.data || err?.info?.error?.data || '0x')
      if (parsed) reason = `${parsed.name}(${parsed.args.map(String).join(', ')})`
    } catch { /* keep reason */ }
    console.log('FAILED')
    throw new Error(`${label} reverted: ${reason}`)
  }
}

/** Optionally read the widget config off another account instead of the baked-in literals. */
async function readConfigFrom(addr, provider) {
  const src = new ethers.Contract(addr, ACCOUNT_ABI, provider)
  const [svcNames, svcCfgs] = await src.getSupportedServices()
  return {
    offered: svcNames.map((name, i) => ({ name, restrictedRate: Boolean(svcCfgs[i][0]), capabilities: Array.from(svcCfgs[i][1]).map(String) })),
    wanted: Array.from(await src.getWantedServices()).map(String),
    tokens: Array.from(await src.getSupportedTokens()).map((a) => ethers.getAddress(a)),
    offChainPaymentSupported: await src.offChainPaymentSupported(),
  }
}

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID, { batchMaxCount: 1 })
  const wallet = new ethers.Wallet(loadPrivateKey(), provider)
  console.log(`Deployer:  ${wallet.address}`)
  console.log(`Manager:   ${MANAGER}\n`)

  const cfg = cloneFrom && typeof cloneFrom === 'string' ? await readConfigFrom(ethers.getAddress(cloneFrom), provider) : CONFIG
  console.log(`Config to apply${cloneFrom ? ` (cloned from ${cloneFrom})` : ' (baked-in literals)'}:`)
  cfg.offered.forEach((s) => console.log(`  offered: ${s.name}  restrictedRate=${s.restrictedRate}  caps=[${s.capabilities.join(', ')}]`))
  console.log(`  wanted:  ${cfg.wanted.join(', ') || '(none)'}`)
  console.log(`  tokens:  ${cfg.tokens.map((t) => (t === ethers.ZeroAddress ? 'ETH(0x0)' : t)).join(', ')}`)
  console.log(`  offChain: ${cfg.offChainPaymentSupported}\n`)

  if (dryRun) { console.log('--dry-run: not writing anything.'); return }

  // Balance sanity check.
  const bal = await provider.getBalance(wallet.address)
  const needed = ethers.parseEther(PREFUND_ETH) + ethers.parseEther('0.0008') // prefund + gas buffer (Base Sepolia gas is tiny)
  if (!existingAccount && bal < needed) {
    throw new Error(
      `Deployer balance ${ethers.formatEther(bal)} ETH is too low. Fund ${wallet.address} with ` +
      `~0.02 Base Sepolia ETH (need ~${ethers.formatEther(needed)}) from a faucet, then re-run.`,
    )
  }

  // Create the CMAccount (or reuse one passed via --account).
  let accountAddr
  if (existingAccount && typeof existingAccount === 'string') {
    accountAddr = ethers.getAddress(existingAccount)
    console.log(`Reusing existing account ${accountAddr} (skipping createCMAccount)\n`)
  } else {
    const manager = new ethers.Contract(MANAGER, MANAGER_ABI, wallet)
    console.log(`Creating CMAccount (prefund ${PREFUND_ETH} ETH)…`)
    const receipt = await sendTx('createCMAccount(deployer, deployer)',
      manager.createCMAccount(wallet.address, wallet.address, { value: ethers.parseEther(PREFUND_ETH) }))
    for (const log of receipt.logs) {
      try {
        const parsed = manager.interface.parseLog(log)
        if (parsed && parsed.name === 'CMAccountCreated') { accountAddr = ethers.getAddress(parsed.args.account); break }
      } catch { /* not a manager event */ }
    }
    if (!accountAddr) throw new Error('createCMAccount succeeded but no CMAccountCreated event found')
    console.log(`  new CMAccount: ${accountAddr}\n`)
  }

  const account = new ethers.Contract(accountAddr, ACCOUNT_ABI, wallet)

  // Apply config, skipping anything already present (safe on re-runs / defaults).
  const [curNames] = await account.getSupportedServices()
  const haveOffered = new Set(curNames.map(String))
  for (const s of cfg.offered) {
    if (haveOffered.has(s.name)) { console.log(`  = offered ${s.name} already present, skipping`); continue }
    await sendTx(`addService(${s.name})`, account.addService(s.name, s.restrictedRate, s.capabilities))
  }

  const haveWanted = new Set(Array.from(await account.getWantedServices()).map(String))
  const wantedToAdd = cfg.wanted.filter((w) => !haveWanted.has(w))
  if (wantedToAdd.length) await sendTx(`addWantedServices([${wantedToAdd.join(', ')}])`, account.addWantedServices(wantedToAdd))
  else console.log('  = wanted services already present, skipping')

  const haveTokens = new Set(Array.from(await account.getSupportedTokens()).map((a) => ethers.getAddress(a)))
  for (const t of cfg.tokens) {
    const tok = ethers.getAddress(t)
    if (haveTokens.has(tok)) { console.log(`  = token ${tok === ethers.ZeroAddress ? 'ETH(0x0)' : tok} already supported, skipping`); continue }
    await sendTx(`addSupportedToken(${tok === ethers.ZeroAddress ? 'ETH(0x0)' : tok})`, account.addSupportedToken(tok))
  }

  if (cfg.offChainPaymentSupported && !(await account.offChainPaymentSupported())) {
    await sendTx('setOffChainPaymentSupported(true)', account.setOffChainPaymentSupported(true))
  } else {
    console.log('  = offChainPaymentSupported already set, skipping')
  }

  // Verify + report.
  const [vNames] = await account.getSupportedServices()
  const vWanted = Array.from(await account.getWantedServices()).map(String)
  const vTokens = Array.from(await account.getSupportedTokens()).map((a) => ethers.getAddress(a))
  const vOff = await account.offChainPaymentSupported()
  console.log('\nVerified on new account:')
  console.log(`  offered:  ${Array.from(vNames).join(', ')}`)
  console.log(`  wanted:   ${vWanted.join(', ')}`)
  console.log(`  tokens:   ${vTokens.map((t) => (t === ethers.ZeroAddress ? 'ETH(0x0)' : t)).join(', ')}`)
  console.log(`  offChain: ${vOff}`)

  const outFile = join(homedir(), 'Downloads', 'transio-cmaccount.txt')
  writeFileSync(outFile, `Transio deployer:  ${wallet.address}\nTransio CMAccount: ${accountAddr}\nchainId:           ${CHAIN_ID} (Base Sepolia)\n`)
  console.log(`\n✅ Done. Wrote ${outFile}`)
  console.log(`\nSEED cChainAddresses value → { Network: "base-sepolia", cAddress: "${wallet.address}" }`)
  console.log(`(the showroom maps the deployer/creator wallet → CMAccount ${accountAddr})`)
  console.log(`\nTRANSIO_DEPLOYER=${wallet.address}`)
  console.log(`TRANSIO_CMACCOUNT=${accountAddr}`)
}

main().catch((e) => { console.error('\n❌ ' + (e?.message || e)); process.exit(1) })
