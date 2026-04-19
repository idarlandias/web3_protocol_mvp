// scripts/deploy.js
// Deploy all contracts to Sepolia (or any configured network).
// Usage: npm run deploy:sepolia
//
// Requires .env with:
//   SEPOLIA_RPC_URL   – Alchemy / Infura endpoint
//   PRIVATE_KEY       – deployer wallet private key (no 0x prefix needed)
//   ETH_USD_FEED      – Chainlink ETH/USD feed address (default: Sepolia official)

const hre  = require("hardhat");
const fs   = require("fs");
const path = require("path");
require("dotenv").config();

// ANSI colours for readability
const G = (s) => `\x1b[32m${s}\x1b[0m`;
const B = (s) => `\x1b[34m${s}\x1b[0m`;
const Y = (s) => `\x1b[33m${s}\x1b[0m`;

async function deployContract(factory, args, label) {
  process.stdout.write(`  Deploying ${label}... `);
  const contract = await factory.deploy(...args);
  const receipt  = await contract.deploymentTransaction().wait(1);
  const addr     = await contract.getAddress();
  console.log(G("✔") + `  ${addr}  (block ${receipt.blockNumber})`);
  return { contract, receipt, address: addr };
}

async function main() {
  const network  = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();
  const balance  = await hre.ethers.provider.getBalance(deployer.address);
  const feed     = process.env.ETH_USD_FEED || "0x694AA1769357215DE4FAC081bf1f309aDC325306";

  console.log("\n" + Y("═".repeat(60)));
  console.log(Y("  Web3 Protocol MVP – Deploy"));
  console.log(Y("═".repeat(60)));
  console.log(`  Network   : ${B(network)}`);
  console.log(`  Deployer  : ${B(deployer.address)}`);
  console.log(`  Balance   : ${B(hre.ethers.formatEther(balance))} ETH`);
  console.log(`  ETH/USD   : ${B(feed)}`);
  console.log(Y("─".repeat(60)) + "\n");

  if (balance < hre.ethers.parseEther("0.01")) {
    throw new Error("Insufficient ETH balance. Get Sepolia ETH from https://sepoliafaucet.com/");
  }

  // ── 1. GovToken ──────────────────────────────────────────────────────────
  const GovToken   = await hre.ethers.getContractFactory("GovToken");
  const govResult  = await deployContract(GovToken, [deployer.address], "GovToken");

  // ── 2. ProtocolNFT ───────────────────────────────────────────────────────
  const ProtocolNFT = await hre.ethers.getContractFactory("ProtocolNFT");
  const nftResult   = await deployContract(ProtocolNFT, [deployer.address], "ProtocolNFT");

  // ── 3. Staking ───────────────────────────────────────────────────────────
  //   annualBps = 1200 → 12% base APY
  const Staking      = await hre.ethers.getContractFactory("Staking");
  const stakingResult = await deployContract(
    Staking,
    [deployer.address, govResult.address, feed, 1200],
    "Staking"
  );

  // ── 4. SimpleDAO ─────────────────────────────────────────────────────────
  //   quorum = 1000 RGT
  const SimpleDAO  = await hre.ethers.getContractFactory("SimpleDAO");
  const daoResult  = await deployContract(
    SimpleDAO,
    [deployer.address, govResult.address, hre.ethers.parseEther("1000")],
    "SimpleDAO"
  );

  // ── 5. Post-deploy setup ──────────────────────────────────────────────────
  console.log("\n  Post-deploy: granting MANAGER_ROLE to DAO...");
  const managerRole = await stakingResult.contract.MANAGER_ROLE();
  const grantTx     = await stakingResult.contract.grantRole(managerRole, daoResult.address);
  await grantTx.wait(1);
  console.log(G("  ✔") + "  MANAGER_ROLE granted to DAO\n");

  // ── 6. Build output ───────────────────────────────────────────────────────
  const isSepolia = network === "sepolia";
  const explorerBase = isSepolia ? "https://sepolia.etherscan.io" : "https://etherscan.io";

  const out = {
    network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    chainlinkFeed: feed,
    contracts: {
      GovToken: {
        address:     govResult.address,
        txHash:      govResult.receipt.hash,
        blockNumber: govResult.receipt.blockNumber,
        etherscan:   `${explorerBase}/address/${govResult.address}`,
      },
      ProtocolNFT: {
        address:     nftResult.address,
        txHash:      nftResult.receipt.hash,
        blockNumber: nftResult.receipt.blockNumber,
        etherscan:   `${explorerBase}/address/${nftResult.address}`,
      },
      Staking: {
        address:     stakingResult.address,
        txHash:      stakingResult.receipt.hash,
        blockNumber: stakingResult.receipt.blockNumber,
        etherscan:   `${explorerBase}/address/${stakingResult.address}`,
        annualBps:   1200,
      },
      SimpleDAO: {
        address:     daoResult.address,
        txHash:      daoResult.receipt.hash,
        blockNumber: daoResult.receipt.blockNumber,
        etherscan:   `${explorerBase}/address/${daoResult.address}`,
        quorumRGT:   "1000",
        votingPeriodDays: 3,
      },
    },
  };

  const outPath = path.join(__dirname, "..", "docs", "deployment.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  // ── 7. Summary ────────────────────────────────────────────────────────────
  console.log(Y("═".repeat(60)));
  console.log(Y("  Deploy Summary"));
  console.log(Y("═".repeat(60)));
  for (const [name, c] of Object.entries(out.contracts)) {
    console.log(`  ${name.padEnd(14)} ${B(c.address)}`);
    console.log(`  ${"".padEnd(14)} ${explorerBase}/address/${c.address}`);
  }
  console.log(Y("─".repeat(60)));
  console.log(`  Manifest saved → ${G("docs/deployment.json")}\n`);

  if (isSepolia) {
    console.log("  Verify contracts with:\n");
    console.log(`  npx hardhat verify --network sepolia ${G(govResult.address)} ${deployer.address}`);
    console.log(`  npx hardhat verify --network sepolia ${G(nftResult.address)} ${deployer.address}`);
    console.log(`  npx hardhat verify --network sepolia ${G(stakingResult.address)} ${deployer.address} ${govResult.address} ${feed} 1200`);
    console.log(`  npx hardhat verify --network sepolia ${G(daoResult.address)} ${deployer.address} ${govResult.address} ${hre.ethers.parseEther("1000").toString()}\n`);
  }
}

main().catch((err) => {
  console.error("\n\x1b[31mDeploy failed:\x1b[0m", err.message);
  process.exitCode = 1;
});
