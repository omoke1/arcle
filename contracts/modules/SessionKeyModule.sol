// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IERC6900Module.sol";
import "../interfaces/ISessionKeyModule.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SessionKeyModule
 * @dev ERC-6900 Module for Circle MSCA that enables session key functionality
 * 
 * This module integrates with Circle's MSCA infrastructure to allow:
 * - Pre-approved spending limits
 * - Time-bound session expiry
 * - Action scope restrictions
 * - Automatic transaction execution without owner signature
 * 
 * Integration with Circle MSCA:
 * - Implements IERC6900Module for standard module interface
 * - Validates UserOps signed by session keys
 * - Enforces spending limits and time windows on-chain
 */
contract SessionKeyModule is IERC6900Module, ISessionKeyModule, Ownable, ReentrancyGuard {
    // Mapping from session key address to configuration
    mapping(address => SessionKeyConfig) private _sessionKeys;
    
    // Mapping from owner to list of session keys
    mapping(address => address[]) private _ownerSessionKeys;
    
    // Action type constants (bitmap positions)
    uint8 public constant ACTION_TRANSFER = 0;
    uint8 public constant ACTION_APPROVE = 1;
    uint8 public constant ACTION_SWAP = 2;
    uint8 public constant ACTION_BRIDGE = 3;
    uint8 public constant ACTION_CCTP = 4;
    uint8 public constant ACTION_GATEWAY = 5;

    /**
     * @dev Constructor - Sets the owner (MSCA wallet address)
     */
    constructor(address _owner) Ownable(_owner) {}

    /**
     * @dev Create a new session key
     * @param sessionKey The address of the session key (EOA or contract)
     * @param spendingLimit Maximum amount that can be spent (in USDC smallest unit)
     * @param expiryTime Unix timestamp when session expires
     * @param allowedActions Bitmap of allowed actions
     * 
     * Requirements:
     * - Only owner can create session keys
     * - Session key address must not already exist
     * - Expiry time must be in the future
     */
    function createSessionKey(
        address sessionKey,
        uint256 spendingLimit,
        uint256 expiryTime,
        bytes32 allowedActions
    ) external onlyOwner {
        require(sessionKey != address(0), "SessionKeyModule: invalid session key address");
        require(_sessionKeys[sessionKey].sessionKey == address(0), "SessionKeyModule: session key already exists");
        require(expiryTime > block.timestamp, "SessionKeyModule: expiry time must be in the future");
        require(spendingLimit > 0, "SessionKeyModule: spending limit must be greater than 0");

        _sessionKeys[sessionKey] = SessionKeyConfig({
            sessionKey: sessionKey,
            spendingLimit: spendingLimit,
            spendingUsed: 0,
            expiryTime: expiryTime,
            allowedActions: allowedActions,
            isActive: true
        });

        _ownerSessionKeys[owner()].push(sessionKey);

        emit SessionKeyCreated(sessionKey, owner(), spendingLimit, expiryTime, allowedActions);
    }

    /**
     * @dev Revoke a session key
     * @param sessionKey The address of the session key to revoke
     * 
     * Requirements:
     * - Only owner can revoke session keys
     * - Session key must exist
     */
    function revokeSessionKey(address sessionKey) external onlyOwner {
        require(_sessionKeys[sessionKey].sessionKey != address(0), "SessionKeyModule: session key does not exist");
        
        _sessionKeys[sessionKey].isActive = false;

        emit SessionKeyRevoked(sessionKey, owner());
    }

    /**
     * @dev Validate a user operation according to ERC-6900
     * This is called by the MSCA wallet to validate transactions
     * 
     * @param userOp The user operation data (encoded)
     * @return validationData Validation result (0 = valid, non-zero = invalid)
     */
    function validateUserOp(
        bytes calldata userOp,
        bytes32 /* userOpHash */
    ) external view override returns (uint256 validationData) {
        // Decode user operation to extract session key and transaction details
        // This is a simplified version - actual implementation would decode ERC-4337 UserOp
        (address sessionKey, uint256 amount, bytes32 actionHash) = _decodeUserOp(userOp);

        // Validate the session key
        if (!validateSessionKey(sessionKey, amount, actionHash)) {
            return 1; // Invalid
        }

        return 0; // Valid
    }

    /**
     * @dev Execute user operation (called after validation)
     * @param userOp The user operation data
     */
    function executeUserOp(
        bytes calldata userOp,
        bytes32 /* userOpHash */
    ) external override nonReentrant {
        (address sessionKey, uint256 amount, bytes32 actionHash) = _decodeUserOp(userOp);

        // Update spending used
        _sessionKeys[sessionKey].spendingUsed += amount;

        emit SessionKeyUsed(sessionKey, amount, actionHash);
    }

    /**
     * @dev Validate if a session key is valid for a transaction
     * @param sessionKey The session key address
     * @param amount The transaction amount
     * @param actionHash Hash of the action being performed
     * @return isValid Whether the session key is valid
     */
    function validateSessionKey(
        address sessionKey,
        uint256 amount,
        bytes32 actionHash
    ) public view override returns (bool isValid) {
        SessionKeyConfig memory config = _sessionKeys[sessionKey];

        // Check if session key exists
        if (config.sessionKey == address(0)) {
            return false;
        }

        // Check if session key is active
        if (!config.isActive) {
            return false;
        }

        // Check if session has expired
        if (block.timestamp >= config.expiryTime) {
            return false;
        }

        // Check spending limit
        if (config.spendingUsed + amount > config.spendingLimit) {
            return false;
        }

        // Check if action is allowed
        // Extract action type from actionHash (first byte)
        uint8 actionType = uint8(actionHash[0]);
        if (!_isActionAllowed(config.allowedActions, actionType)) {
            return false;
        }

        return true;
    }

    /**
     * @dev Get session key configuration
     * @param sessionKey The session key address
     * @return config The session key configuration
     */
    function getSessionKeyConfig(
        address sessionKey
    ) external view override returns (SessionKeyConfig memory config) {
        return _sessionKeys[sessionKey];
    }

    /**
     * @dev Check if a session key is active
     * @param sessionKey The session key address
     * @return isActive Whether the session key is active
     */
    function isSessionKeyActive(address sessionKey) external view override returns (bool isActive) {
        SessionKeyConfig memory config = _sessionKeys[sessionKey];
        return config.isActive && 
               config.sessionKey != address(0) && 
               block.timestamp < config.expiryTime;
    }

    /**
     * @dev Get all session keys for an owner
     * @param owner The owner address
     * @return sessionKeys Array of session key addresses
     */
    function getOwnerSessionKeys(address owner) external view returns (address[] memory sessionKeys) {
        return _ownerSessionKeys[owner];
    }

    /**
     * @dev Check if an action is allowed in the allowedActions bitmap
     * @param allowedActions The bitmap of allowed actions
     * @param actionType The action type to check
     * @return isAllowed Whether the action is allowed
     */
    function _isActionAllowed(bytes32 allowedActions, uint8 actionType) internal pure returns (bool isAllowed) {
        // Check if the bit at position actionType is set
        return (uint256(allowedActions) >> actionType) & 1 == 1;
    }

    /**
     * @dev Decode user operation to extract session key and transaction details
     * This is a simplified version - actual implementation would decode ERC-4337 UserOp
     * 
     * @param userOp The encoded user operation
     * @return sessionKey The session key address
     * @return amount The transaction amount
     * @return actionHash The hash of the action
     */
    function _decodeUserOp(
        bytes calldata userOp
    ) internal pure returns (address sessionKey, uint256 amount, bytes32 actionHash) {
        // Simplified decoding - in production, this would decode full ERC-4337 UserOp
        // For now, we assume the first 20 bytes are the session key address,
        // next 32 bytes are the amount, and the rest is the action hash
        require(userOp.length >= 84, "SessionKeyModule: invalid userOp length");

        assembly {
            sessionKey := calldataload(userOp.offset)
            amount := calldataload(add(userOp.offset, 20))
            actionHash := calldataload(add(userOp.offset, 52))
        }

        // Clear upper bits of address (convert uint256 to address)
        sessionKey = address(uint160(bytes20(sessionKey)));
    }
}

