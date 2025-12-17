// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PaymentEscrow
 * @dev Escrow contract for claimable phone/email payments
 * 
 * Flow:
 * 1. Sender deposits funds to escrow with a claim code
 * 2. Recipient claims using the claim code
 * 3. Funds are automatically transferred to recipient's wallet
 * 
 * Security:
 * - Only owner (Arcle backend) can create deposits
 * - Claim codes are unique and can only be used once
 * - Expired payments can be refunded to sender
 */
contract PaymentEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // USDC token address (set on deployment)
    IERC20 public immutable usdcToken;

    // Payment struct
    struct Payment {
        address sender;
        address recipient;
        uint256 amount;
        bytes32 claimCodeHash; // Hash of claim code for security
        uint256 expiresAt;
        bool claimed;
        bool refunded;
    }

    // Mapping from payment ID to Payment
    mapping(bytes32 => Payment) public payments;

    // Mapping to track used claim codes (prevent replay)
    mapping(bytes32 => bool) public usedClaimCodes;

    // Events
    event PaymentDeposited(
        bytes32 indexed paymentId,
        address indexed sender,
        uint256 amount,
        bytes32 claimCodeHash,
        uint256 expiresAt
    );

    event PaymentClaimed(
        bytes32 indexed paymentId,
        address indexed recipient,
        uint256 amount
    );

    event PaymentRefunded(
        bytes32 indexed paymentId,
        address indexed sender,
        uint256 amount
    );

    /**
     * @dev Constructor
     * @param _usdcToken Address of USDC token contract
     */
    constructor(address _usdcToken) Ownable(msg.sender) {
        require(_usdcToken != address(0), "PaymentEscrow: invalid USDC address");
        usdcToken = IERC20(_usdcToken);
    }

    /**
     * @dev Deposit funds to escrow (only owner/backend can call)
     * @param paymentId Unique payment identifier
     * @param sender Address of sender
     * @param amount Amount to deposit (in smallest unit)
     * @param claimCodeHash Hash of the claim code
     * @param expiresAt Expiration timestamp
     */
    function depositPayment(
        bytes32 paymentId,
        address sender,
        uint256 amount,
        bytes32 claimCodeHash,
        uint256 expiresAt
    ) external onlyOwner nonReentrant {
        require(payments[paymentId].sender == address(0), "PaymentEscrow: payment already exists");
        require(amount > 0, "PaymentEscrow: amount must be greater than 0");
        require(expiresAt > block.timestamp, "PaymentEscrow: expiration must be in future");
        require(sender != address(0), "PaymentEscrow: invalid sender address");

        // Transfer USDC from sender to escrow
        usdcToken.safeTransferFrom(sender, address(this), amount);

        payments[paymentId] = Payment({
            sender: sender,
            recipient: address(0),
            amount: amount,
            claimCodeHash: claimCodeHash,
            expiresAt: expiresAt,
            claimed: false,
            refunded: false
        });

        emit PaymentDeposited(paymentId, sender, amount, claimCodeHash, expiresAt);
    }

    /**
     * @dev Claim payment using claim code
     * @param paymentId Payment identifier
     * @param claimCode The claim code (will be hashed and verified)
     * @param recipient Address to receive the funds
     */
    function claimPayment(
        bytes32 paymentId,
        string calldata claimCode,
        address recipient
    ) external nonReentrant {
        Payment storage payment = payments[paymentId];
        
        require(payment.sender != address(0), "PaymentEscrow: payment does not exist");
        require(!payment.claimed, "PaymentEscrow: payment already claimed");
        require(!payment.refunded, "PaymentEscrow: payment was refunded");
        require(block.timestamp < payment.expiresAt, "PaymentEscrow: payment expired");
        require(recipient != address(0), "PaymentEscrow: invalid recipient address");

        // Verify claim code
        bytes32 claimCodeHash = keccak256(abi.encodePacked(claimCode));
        require(claimCodeHash == payment.claimCodeHash, "PaymentEscrow: invalid claim code");

        // Prevent replay attacks
        require(!usedClaimCodes[claimCodeHash], "PaymentEscrow: claim code already used");
        usedClaimCodes[claimCodeHash] = true;

        // Mark as claimed
        payment.claimed = true;
        payment.recipient = recipient;

        // Transfer funds to recipient
        usdcToken.safeTransfer(recipient, payment.amount);

        emit PaymentClaimed(paymentId, recipient, payment.amount);
    }

    /**
     * @dev Refund expired payment to sender (only owner can call)
     * @param paymentId Payment identifier
     */
    function refundExpiredPayment(bytes32 paymentId) external onlyOwner nonReentrant {
        Payment storage payment = payments[paymentId];
        
        require(payment.sender != address(0), "PaymentEscrow: payment does not exist");
        require(!payment.claimed, "PaymentEscrow: payment already claimed");
        require(!payment.refunded, "PaymentEscrow: payment already refunded");
        require(block.timestamp >= payment.expiresAt, "PaymentEscrow: payment not expired yet");

        payment.refunded = true;

        // Refund to sender
        usdcToken.safeTransfer(payment.sender, payment.amount);

        emit PaymentRefunded(paymentId, payment.sender, payment.amount);
    }

    /**
     * @dev Get payment details
     * @param paymentId Payment identifier
     * @return payment Payment struct
     */
    function getPayment(bytes32 paymentId) external view returns (Payment memory payment) {
        return payments[paymentId];
    }

    /**
     * @dev Check if payment can be claimed
     * @param paymentId Payment identifier
     * @return canClaim Whether payment can be claimed
     */
    function canClaim(bytes32 paymentId) external view returns (bool) {
        Payment memory payment = payments[paymentId];
        return payment.sender != address(0) &&
               !payment.claimed &&
               !payment.refunded &&
               block.timestamp < payment.expiresAt;
    }
}

