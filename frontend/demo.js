const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "docs", "deployment.json"), "utf8"));

const tokenAbi = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)"
];
const nftAbi = ["function mint(address to, string memory tokenURI_) external returns (uint256)"];
const stakingAbi = [
  "function stake(uint256 amount) external",
  "function fundRewards(uint256 amount) external"
];
const daoAbi = [
  "function createProposal(string calldata description) external returns (uint256)",
  "function vote(uint256 proposalId, bool support) external"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const token = new ethers.Contract(deployment.contracts.GovToken, tokenAbi, wallet);
  const nft = new ethers.Contract(deployment.contracts.ProtocolNFT, nftAbi, wallet);
  const staking = new ethers.Contract(deployment.contracts.Staking, stakingAbi, wallet);
  const dao = new ethers.Contract(deployment.contracts.SimpleDAO, daoAbi, wallet);

  const rewardAmount = ethers.parseUnits("1000", 18);
  const stakeAmount = ethers.parseUnits("100", 18);

  await (await token.approve(deployment.contracts.Staking, rewardAmount)).wait();
  await (await staking.fundRewards(rewardAmount)).wait();

  await (await token.approve(deployment.contracts.Staking, stakeAmount)).wait();
  await (await staking.stake(stakeAmount)).wait();

  await (await nft.mint(wallet.address, "ipfs://example-metadata.json")).wait();

  const tx = await dao.createProposal("Atualizar APY base do staking");
  await tx.wait();
  await (await dao.vote(1, true)).wait();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
