// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SimpleDAO
 * @notice Governance DAO with snapshot-based voting power to prevent
 *         vote manipulation via token transfers mid-proposal.
 *
 * Flow:
 *   1. createProposal()         – any token holder opens a proposal.
 *   2. snapshotVotingPower(id)  – each voter locks their balance ONCE
 *                                  before casting their vote.
 *   3. vote(id, support)        – uses the snapshotted weight; reverts
 *                                  if the caller never snapshotted.
 *   4. execute(id)              – after voting period, if quorum met.
 */
contract SimpleDAO is Ownable {
    IERC20 public immutable governanceToken;
    uint256 public proposalCount;
    uint256 public votingPeriod = 3 days;
    uint256 public quorumTokens;

    struct Proposal {
        uint256 id;
        string description;
        address proposer;
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /// @notice Stores the token balance snapshot for each (proposal, voter) pair.
    ///         Set once by snapshotVotingPower(); zero means not yet snapshotted.
    mapping(uint256 => mapping(address => uint256)) public snapshots;

    event ProposalCreated(uint256 indexed id, address indexed proposer, string description);
    event VotingPowerSnapshotted(uint256 indexed proposalId, address indexed voter, uint256 weight);
    event Voted(uint256 indexed id, address indexed voter, bool support, uint256 weight);
    event Executed(uint256 indexed id, bool approved);

    constructor(address initialOwner, address token_, uint256 quorumTokens_) Ownable(initialOwner) {
        governanceToken = IERC20(token_);
        quorumTokens = quorumTokens_;
    }

    /// @notice Creates a new proposal. Caller must hold at least 1 token.
    function createProposal(string calldata description) external returns (uint256) {
        require(governanceToken.balanceOf(msg.sender) > 0, "no voting power");
        proposalCount++;
        proposals[proposalCount] = Proposal({
            id: proposalCount,
            description: description,
            proposer: msg.sender,
            startTime: block.timestamp,
            endTime: block.timestamp + votingPeriod,
            forVotes: 0,
            againstVotes: 0,
            executed: false
        });
        // Auto-snapshot the proposer's balance at creation time.
        snapshots[proposalCount][msg.sender] = governanceToken.balanceOf(msg.sender);
        emit ProposalCreated(proposalCount, msg.sender, description);
        emit VotingPowerSnapshotted(proposalCount, msg.sender, snapshots[proposalCount][msg.sender]);
        return proposalCount;
    }

    /**
     * @notice Locks the caller's current token balance as their voting weight
     *         for `proposalId`. Must be called while voting is still active
     *         and before calling vote(). Can only be called once per address
     *         per proposal.
     */
    function snapshotVotingPower(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.endTime > 0, "proposal does not exist");
        require(block.timestamp < p.endTime, "voting ended");
        require(!hasVoted[proposalId][msg.sender], "already voted");
        require(snapshots[proposalId][msg.sender] == 0, "already snapshotted");

        uint256 weight = governanceToken.balanceOf(msg.sender);
        require(weight > 0, "no voting power");
        snapshots[proposalId][msg.sender] = weight;
        emit VotingPowerSnapshotted(proposalId, msg.sender, weight);
    }

    /**
     * @notice Cast a vote on `proposalId`. The voting weight is taken from
     *         the snapshot recorded by snapshotVotingPower(); live balance
     *         changes after the snapshot have no effect.
     */
    function vote(uint256 proposalId, bool support) external {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp < p.endTime, "voting ended");
        require(!hasVoted[proposalId][msg.sender], "already voted");

        uint256 weight = snapshots[proposalId][msg.sender];
        require(weight > 0, "snapshot required: call snapshotVotingPower first");

        hasVoted[proposalId][msg.sender] = true;
        if (support) p.forVotes += weight;
        else p.againstVotes += weight;

        emit Voted(proposalId, msg.sender, support, weight);
    }

    /// @notice Executes the proposal outcome after the voting period ends.
    function execute(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp >= p.endTime, "voting active");
        require(!p.executed, "already executed");
        require(p.forVotes + p.againstVotes >= quorumTokens, "quorum not reached");
        p.executed = true;
        emit Executed(proposalId, p.forVotes > p.againstVotes);
    }

    function setVotingPeriod(uint256 newPeriod) external onlyOwner {
        require(newPeriod >= 1 days, "too short");
        votingPeriod = newPeriod;
    }

    function setQuorum(uint256 newQuorum) external onlyOwner {
        quorumTokens = newQuorum;
    }
}
