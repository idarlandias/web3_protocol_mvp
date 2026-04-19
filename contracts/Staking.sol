// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract Staking is AccessControl, ReentrancyGuard {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    uint256 public constant YEAR = 365 days;

    IERC20 public immutable stakingToken;
    AggregatorV3Interface public priceFeed;
    uint256 public annualBps;
    uint256 public rewardPool;

    struct Position {
        uint256 amount;
        uint256 rewardDebt;
        uint256 since;
    }

    mapping(address => Position) public positions;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount, uint256 reward);
    event RewardPoolFunded(address indexed from, uint256 amount);
    event AnnualBpsUpdated(uint256 newAnnualBps);

    constructor(address admin, address token_, address feed_, uint256 annualBps_) {
        require(token_ != address(0) && feed_ != address(0), "invalid address");
        require(annualBps_ > 0, "invalid apy");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
        stakingToken = IERC20(token_);
        priceFeed = AggregatorV3Interface(feed_);
        annualBps = annualBps_;
    }

    function fundRewards(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        rewardPool += amount;
        require(stakingToken.transferFrom(msg.sender, address(this), amount), "transfer failed");
        emit RewardPoolFunded(msg.sender, amount);
    }

    function setAnnualBps(uint256 newAnnualBps) external onlyRole(MANAGER_ROLE) {
        require(newAnnualBps > 0, "invalid apy");
        annualBps = newAnnualBps;
        emit AnnualBpsUpdated(newAnnualBps);
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        Position storage p = positions[msg.sender];
        uint256 pending = pendingReward(msg.sender);
        p.rewardDebt = pending;
        p.amount += amount;
        p.since = block.timestamp;
        require(stakingToken.transferFrom(msg.sender, address(this), amount), "transfer failed");
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant {
        Position storage p = positions[msg.sender];
        require(amount > 0 && p.amount >= amount, "invalid amount");
        uint256 reward = pendingReward(msg.sender);
        require(rewardPool >= reward, "insufficient reward pool");

        p.amount -= amount;
        p.rewardDebt = 0;
        p.since = block.timestamp;
        rewardPool -= reward;

        require(stakingToken.transfer(msg.sender, amount + reward), "transfer failed");
        emit Unstaked(msg.sender, amount, reward);
    }

    function pendingReward(address user) public view returns (uint256) {
        Position memory p = positions[user];
        if (p.amount == 0 || p.since == 0) return p.rewardDebt;

        (, int256 answer,,,) = priceFeed.latestRoundData();
        require(answer > 0, "invalid oracle");

        uint256 price = uint256(answer);
        uint256 multiplierBps = 10000;
        if (price >= 3000e8) {
            multiplierBps = 12000;
        } else if (price <= 1500e8) {
            multiplierBps = 8000;
        }

        uint256 elapsed = block.timestamp - p.since;
        uint256 baseReward = (p.amount * annualBps * elapsed) / YEAR / 10000;
        uint256 adjustedReward = (baseReward * multiplierBps) / 10000;
        return p.rewardDebt + adjustedReward;
    }
}
