// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ISessionKeyModule
 * @dev Interface for Session Key Module - Enables pre-approved transaction execution
 * 
 * This module allows users to create session keys with spending limits,
 * time windows, and action scopes. Transactions signed by valid session keys
 * can execute automatically without requiring the owner's signature.
 */
interface ISessionKeyModule {
    /**
     * @dev Emitted when a session key is created
     */
    event SessionKeyCreated(
        address indexed sessionKey,
        address indexed owner,
        uint256 spendingLimit,
        uint256 expiryTime,
        bytes32 allowedActions
    );

    /**
     * @dev Emitted when a session key is revoked
     */
    event SessionKeyRevoked(address indexed sessionKey, address indexed owner);

    /**
     * @dev Emitted when a session key is used
     */
    event SessionKeyUsed(
        address indexed sessionKey,
        uint256 amount,
        bytes32 actionHash
    );

    /**
     * @dev Session key configuration
     */
    struct SessionKeyConfig {
        address sessionKey;        // The session key address (EOA or contract)
        uint256 spendingLimit;     // Maximum amount that can be spent (in USDC smallest unit)
        uint256 spendingUsed;      // Amount already spent
        uint256 expiryTime;        // Unix timestamp when session expires
        bytes32 allowedActions;    // Bitmap of allowed actions
        bool isActive;             // Whether the session key is active
    }

    /**
     * @dev Create a new session key
     * @param sessionKey The address of the session key
     * @param spendingLimit Maximum amount that can be spent
     * @param expiryTime Unix timestamp when session expires
     * @param allowedActions Bitmap of allowed actions (see ActionTypes)
     */
    function createSessionKey(
        address sessionKey,
        uint256 spendingLimit,
        uint256 expiryTime,
        bytes32 allowedActions
    ) external;

    /**
     * @dev Revoke a session key
     * @param sessionKey The address of the session key to revoke
     */
    function revokeSessionKey(address sessionKey) external;

    /**
     * @dev Check if a session key is valid for a transaction
     * @param sessionKey The session key address
     * @param amount The transaction amount
     * @param actionHash Hash of the action being performed
     * @return isValid Whether the session key is valid
     */
    function validateSessionKey(
        address sessionKey,
        uint256 amount,
        bytes32 actionHash
    ) external view returns (bool isValid);

    /**
     * @dev Get session key configuration
     * @param sessionKey The session key address
     * @return config The session key configuration
     */
    function getSessionKeyConfig(
        address sessionKey
    ) external view returns (SessionKeyConfig memory config);

    /**
     * @dev Check if a session key is active
     * @param sessionKey The session key address
     * @return isActive Whether the session key is active
     */
    function isSessionKeyActive(address sessionKey) external view returns (bool isActive);
}

