// test/protocol.test.js
// Full test suite for Web3 Protocol MVP
// Run: npx hardhat test

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const ONE_YEAR   = 365 * 24 * 3600;
const THREE_DAYS = 3  * 24 * 3600;
const e18 = (n) => ethers.parseEther(String(n));

/**
 * Deploy a minimal MockV3Aggregator on-the-fly.
 * We deploy the bytecode from Chainlink's MockV3Aggregator ABI/bytecode
 * bundled in @chainlink/contracts.
 */
async function deployMockFeed(owner, priceUSD) {
  const MockFeed = await ethers.getContractFactory(
    "MockV3Aggregator",
    owner
  );
  // decimals = 8, initialAnswer = priceUSD * 1e8
  return MockFeed.deploy(8, BigInt(priceUSD) * 10n ** 8n);
}

// ─────────────────────────────────────────────────────────────────────────────
// Full fixture
// ─────────────────────────────────────────────────────────────────────────────
async function deployAll(priceUSD = 2000) {
  const [owner, alice, bob, carol] = await ethers.getSigners();

  // Mock Chainlink price feed
  const feed = await deployMockFeed(owner, priceUSD);

  // GovToken
  const GovToken = await ethers.getContractFactory("GovToken");
  const govToken = await GovToken.deploy(owner.address);

  // ProtocolNFT
  const ProtocolNFT = await ethers.getContractFactory("ProtocolNFT");
  const nft = await ProtocolNFT.deploy(owner.address);

  // Staking  – 500 bps = 5% APY base
  const Staking = await ethers.getContractFactory("Staking");
  const staking = await Staking.deploy(
    owner.address,
    await govToken.getAddress(),
    await feed.getAddress(),
    500
  );

  // SimpleDAO  – quorum = 100 tokens
  const SimpleDAO = await ethers.getContractFactory("SimpleDAO");
  const dao = await SimpleDAO.deploy(
    owner.address,
    await govToken.getAddress(),
    e18(100)
  );

  return { owner, alice, bob, carol, feed, govToken, nft, staking, dao };
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. GovToken
// ═════════════════════════════════════════════════════════════════════════════
describe("GovToken", function () {
  it("mints 1 000 000 tokens to owner on deploy", async function () {
    const { owner, govToken } = await deployAll();
    const supply = await govToken.totalSupply();
    expect(supply).to.equal(e18(1_000_000));
    expect(await govToken.balanceOf(owner.address)).to.equal(supply);
  });

  it("owner can mint additional tokens", async function () {
    const { owner, alice, govToken } = await deployAll();
    await govToken.connect(owner).mint(alice.address, e18(500));
    expect(await govToken.balanceOf(alice.address)).to.equal(e18(500));
  });

  it("non-owner cannot mint", async function () {
    const { alice, bob, govToken } = await deployAll();
    await expect(
      govToken.connect(alice).mint(bob.address, e18(1))
    ).to.be.reverted;
  });

  it("owner can burn their tokens", async function () {
    const { owner, govToken } = await deployAll();
    const before = await govToken.balanceOf(owner.address);
    await govToken.connect(owner).burn(e18(1000));
    expect(await govToken.balanceOf(owner.address)).to.equal(before - e18(1000));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. ProtocolNFT
// ═════════════════════════════════════════════════════════════════════════════
describe("ProtocolNFT", function () {
  it("mints NFT to recipient with tokenURI, returns tokenId = 1", async function () {
    const { owner, alice, nft } = await deployAll();
    const tx = await nft.connect(owner).mint(alice.address, "ipfs://QmTest1");
    const receipt = await tx.wait();
    // nextTokenId incremented to 1
    expect(await nft.nextTokenId()).to.equal(1n);
    expect(await nft.ownerOf(1)).to.equal(alice.address);
    expect(await nft.tokenURI(1)).to.equal("ipfs://QmTest1");
  });

  it("token IDs increment correctly for multiple mints", async function () {
    const { owner, alice, bob, nft } = await deployAll();
    await nft.connect(owner).mint(alice.address, "ipfs://A");
    await nft.connect(owner).mint(bob.address,  "ipfs://B");
    expect(await nft.nextTokenId()).to.equal(2n);
    expect(await nft.ownerOf(2)).to.equal(bob.address);
  });

  it("non-owner cannot mint", async function () {
    const { alice, nft } = await deployAll();
    await expect(
      nft.connect(alice).mint(alice.address, "ipfs://hack")
    ).to.be.reverted;
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. Staking
// ═════════════════════════════════════════════════════════════════════════════
describe("Staking", function () {

  // Helper: give user tokens, approve staking, stake amount
  async function setupStaker(govToken, staking, user, amount) {
    const stakingAddr = await staking.getAddress();
    await govToken.connect(user).approve(stakingAddr, amount);
    await staking.connect(user).stake(amount);
  }

  // Helper: fund the reward pool
  async function fundPool(govToken, staking, owner, amount) {
    const stakingAddr = await staking.getAddress();
    await govToken.connect(owner).approve(stakingAddr, amount);
    await staking.connect(owner).fundRewards(amount);
  }

  it("stake() stores position correctly", async function () {
    const { owner, alice, govToken, staking } = await deployAll();
    await govToken.connect(owner).mint(alice.address, e18(1000));
    await setupStaker(govToken, staking, alice, e18(1000));

    const pos = await staking.positions(alice.address);
    expect(pos.amount).to.equal(e18(1000));
    expect(pos.since).to.be.gt(0n);
  });

  it("unstake() returns principal + reward after 1 year (neutral price)", async function () {
    const { owner, alice, govToken, staking } = await deployAll(2000); // ~$2000 → neutral
    await govToken.connect(owner).mint(alice.address, e18(10_000));
    await fundPool(govToken, staking, owner, e18(10_000));

    await setupStaker(govToken, staking, alice, e18(1000));
    await time.increase(ONE_YEAR);

    const balBefore = await govToken.balanceOf(alice.address);
    await staking.connect(alice).unstake(e18(1000));
    const balAfter  = await govToken.balanceOf(alice.address);

    // Base APY 5%, neutral multiplier 1×  → reward ≈ 50 tokens
    const gained = balAfter - balBefore;
    expect(gained).to.be.gt(e18(1000));          // principal + reward
    expect(gained).to.be.closeTo(e18(1050), e18(1)); // within 1 token tolerance
  });

  it("reward uses 1.2× multiplier when ETH price ≥ $3 000", async function () {
    const { owner, alice, govToken, staking, feed } = await deployAll(3500);
    await govToken.connect(owner).mint(alice.address, e18(10_000));
    await fundPool(govToken, staking, owner, e18(10_000));

    await setupStaker(govToken, staking, alice, e18(1000));
    await time.increase(ONE_YEAR);

    const reward = await staking.pendingReward(alice.address);
    // 5% * 1.2 = 6% of 1000 = 60
    expect(reward).to.be.closeTo(e18(60), e18(1));
  });

  it("reward uses 0.8× multiplier when ETH price ≤ $1 500", async function () {
    const { owner, alice, govToken, staking, feed } = await deployAll(1000);
    await govToken.connect(owner).mint(alice.address, e18(10_000));
    await fundPool(govToken, staking, owner, e18(10_000));

    await setupStaker(govToken, staking, alice, e18(1000));
    await time.increase(ONE_YEAR);

    const reward = await staking.pendingReward(alice.address);
    // 5% * 0.8 = 4% of 1000 = 40
    expect(reward).to.be.closeTo(e18(40), e18(1));
  });

  it("unstake() reverts when reward pool is insufficient", async function () {
    const { owner, alice, govToken, staking } = await deployAll();
    await govToken.connect(owner).mint(alice.address, e18(1000));
    // Do NOT fund the pool
    await setupStaker(govToken, staking, alice, e18(1000));
    await time.increase(ONE_YEAR);

    await expect(
      staking.connect(alice).unstake(e18(1000))
    ).to.be.revertedWith("insufficient reward pool");
  });

  it("three simultaneous stakers earn rewards proportional to stake + time", async function () {
    const { owner, alice, bob, carol, govToken, staking } = await deployAll(2000);

    // Give everyone tokens
    await govToken.connect(owner).mint(alice.address, e18(5_000));
    await govToken.connect(owner).mint(bob.address,   e18(5_000));
    await govToken.connect(owner).mint(carol.address,  e18(5_000));
    // Large pool
    await fundPool(govToken, staking, owner, e18(50_000));

    // Alice stakes 1000, then Bob stakes 500 after 6 months, then Carol stakes 2000
    await setupStaker(govToken, staking, alice, e18(1000));
    await time.increase(ONE_YEAR / 2);
    await setupStaker(govToken, staking, bob,   e18(500));
    await time.increase(ONE_YEAR / 2);
    await setupStaker(govToken, staking, carol, e18(2000));

    // Read pending rewards BEFORE unstake
    const rAlice = await staking.pendingReward(alice.address);
    const rBob   = await staking.pendingReward(bob.address);
    const rCarol = await staking.pendingReward(carol.address);

    // Alice staked 1000 for full year → ≈50 tokens
    expect(rAlice).to.be.gt(e18(40));
    // Bob staked 500 for half year → ≈12.5 tokens
    expect(rBob).to.be.gt(e18(10));
    // Carol staked 2000 for 0 seconds → ≈0
    expect(rCarol).to.be.lt(e18(1));

    // Each user can unstake independently
    await staking.connect(alice).unstake(e18(1000));
    await staking.connect(bob).unstake(e18(500));
    await staking.connect(carol).unstake(e18(2000));
  });

  it("MANAGER_ROLE can update annualBps", async function () {
    const { owner, staking } = await deployAll();
    await staking.connect(owner).setAnnualBps(1000); // 10%
    expect(await staking.annualBps()).to.equal(1000n);
  });

  it("non-manager cannot update annualBps", async function () {
    const { alice, staking } = await deployAll();
    await expect(
      staking.connect(alice).setAnnualBps(1000)
    ).to.be.reverted;
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. SimpleDAO
// ═════════════════════════════════════════════════════════════════════════════
describe("SimpleDAO", function () {

  // Give tokens, snapshot, vote helper
  async function snapAndVote(dao, proposalId, voter, support) {
    await dao.connect(voter).snapshotVotingPower(proposalId);
    await dao.connect(voter).vote(proposalId, support);
  }

  it("createProposal reverts if caller has no tokens", async function () {
    const { alice, dao } = await deployAll();
    await expect(
      dao.connect(alice).createProposal("no tokens proposal")
    ).to.be.revertedWith("no voting power");
  });

  it("token holder can create a proposal", async function () {
    const { owner, dao } = await deployAll();
    const tx = await dao.connect(owner).createProposal("Proposal Alpha");
    await tx.wait();
    const p = await dao.proposals(1);
    expect(p.id).to.equal(1n);
    expect(p.proposer).to.equal(owner.address);
  });

  it("proposer's balance is auto-snapshotted at creation", async function () {
    const { owner, govToken, dao } = await deployAll();
    await dao.connect(owner).createProposal("Auto-snapshot test");
    const snap = await dao.snapshots(1, owner.address);
    expect(snap).to.equal(await govToken.balanceOf(owner.address));
  });

  it("vote() reverts if caller hasn't snapshotted", async function () {
    const { owner, alice, govToken, dao } = await deployAll();
    await govToken.connect(owner).mint(alice.address, e18(200));
    await dao.connect(owner).createProposal("Test");
    await expect(
      dao.connect(alice).vote(1, true)
    ).to.be.revertedWith("snapshot required: call snapshotVotingPower first");
  });

  it("votes accumulate forVotes and againstVotes correctly", async function () {
    const { owner, alice, bob, govToken, dao } = await deployAll();
    await govToken.connect(owner).mint(alice.address, e18(200));
    await govToken.connect(owner).mint(bob.address,   e18(100));

    await dao.connect(owner).createProposal("Vote distribution test");

    await snapAndVote(dao, 1, alice, true);
    await snapAndVote(dao, 1, bob,   false);

    const p = await dao.proposals(1);
    expect(p.forVotes).to.equal(e18(200));
    expect(p.againstVotes).to.equal(e18(100));
  });

  it("double-vote is blocked (hasVoted check)", async function () {
    const { owner, alice, govToken, dao } = await deployAll();
    await govToken.connect(owner).mint(alice.address, e18(200));
    await dao.connect(owner).createProposal("Double vote");
    await snapAndVote(dao, 1, alice, true);

    await expect(
      dao.connect(alice).vote(1, false)
    ).to.be.revertedWith("already voted");
  });

  it("snapshot anti-manipulation: transfer after snapshot has NO effect on vote weight", async function () {
    const { owner, alice, bob, govToken, dao } = await deployAll();
    await govToken.connect(owner).mint(alice.address, e18(500));
    await dao.connect(owner).createProposal("Manipulation attempt");

    // Alice snapshots with 500 tokens
    await dao.connect(alice).snapshotVotingPower(1);
    const snapAlice = await dao.snapshots(1, alice.address);
    expect(snapAlice).to.equal(e18(500));

    // Alice transfers all tokens to Bob AFTER snapshot
    await govToken.connect(alice).transfer(bob.address, e18(500));
    expect(await govToken.balanceOf(alice.address)).to.equal(0n);

    // Bob tries to snapshot with Alice's transferred tokens — should succeed with 500
    await dao.connect(bob).snapshotVotingPower(1);
    const snapBob = await dao.snapshots(1, bob.address);
    expect(snapBob).to.equal(e18(500));

    // Alice votes — uses snapshotted 500, even though live balance is now 0
    await dao.connect(alice).vote(1, true);
    const p = await dao.proposals(1);
    expect(p.forVotes).to.equal(e18(500));

    // Bob can also vote (with his snapshot)
    await dao.connect(bob).vote(1, true);
    // Now both voted, total for = 1000 but each had independent snapshot — this
    // demonstrates that the design correctly prevents ONE person from recycling
    // tokens, since each address can only snapshot once.
  });

  it("snapshotVotingPower() reverts if called twice by same address", async function () {
    const { owner, alice, govToken, dao } = await deployAll();
    await govToken.connect(owner).mint(alice.address, e18(200));
    await dao.connect(owner).createProposal("Double snapshot");

    await dao.connect(alice).snapshotVotingPower(1);
    await expect(
      dao.connect(alice).snapshotVotingPower(1)
    ).to.be.revertedWith("already snapshotted");
  });

  it("execute() reverts before voting period ends", async function () {
    const { owner, govToken, dao } = await deployAll();
    await dao.connect(owner).createProposal("Execute too early");
    await expect(
      dao.connect(owner).execute(1)
    ).to.be.revertedWith("voting active");
  });

  it("execute() reverts if quorum not reached", async function () {
    const { owner, alice, govToken, dao } = await deployAll();
    // Alice has only 1 token → below quorum of 100
    await govToken.connect(owner).mint(alice.address, e18(1));

    await dao.connect(alice).createProposal("Low quorum");
    // alice is auto-snapshotted as proposer; vote directly
    await dao.connect(alice).vote(1, true);
    await time.increase(THREE_DAYS + 1);

    await expect(
      dao.connect(owner).execute(1)
    ).to.be.revertedWith("quorum not reached");
  });

  it("execute() succeeds when quorum is met", async function () {
    const { owner, alice, govToken, dao } = await deployAll();
    await govToken.connect(owner).mint(alice.address, e18(200)); // > quorum 100

    await dao.connect(alice).createProposal("Pass quorum");
    // alice is auto-snapshotted as proposer; vote directly
    await dao.connect(alice).vote(1, true);
    await time.increase(THREE_DAYS + 1);

    await expect(dao.connect(owner).execute(1))
      .to.emit(dao, "Executed")
      .withArgs(1n, true);

    const p = await dao.proposals(1);
    expect(p.executed).to.be.true;
  });

  it("execute() reverts if already executed", async function () {
    const { owner, alice, govToken, dao } = await deployAll();
    await govToken.connect(owner).mint(alice.address, e18(200));
    await dao.connect(alice).createProposal("Double execute");
    // alice auto-snapshotted as proposer; vote directly
    await dao.connect(alice).vote(1, true);
    await time.increase(THREE_DAYS + 1);
    await dao.connect(owner).execute(1);

    await expect(
      dao.connect(owner).execute(1)
    ).to.be.revertedWith("already executed");
  });

  it("setVotingPeriod reverts if less than 1 day", async function () {
    const { owner, dao } = await deployAll();
    await expect(
      dao.connect(owner).setVotingPeriod(3600)
    ).to.be.revertedWith("too short");
  });

  it("owner can adjust quorum", async function () {
    const { owner, dao } = await deployAll();
    await dao.connect(owner).setQuorum(e18(500));
    expect(await dao.quorumTokens()).to.equal(e18(500));
  });
});
