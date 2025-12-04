// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IERC6900Module
 * @dev ERC-6900 Module Interface for Circle MSCA Integration
 * 
 * This interface defines the standard for modules that can be installed
 * on Circle's Modular Smart Contract Accounts (MSCA).
 * 
 * Reference: https://eips.ethereum.org/EIPS/eip-6900
 */
interface IERC6900Module {
    /**
     * @dev Validates a user operation according to the module's logic
     * @param userOp The user operation to validate
     * @param userOpHash The hash of the user operation
     * @return validationData Validation data (see ERC-4337)
     */
    function validateUserOp(
        bytes calldata userOp,
        bytes32 userOpHash
    ) external view returns (uint256 validationData);

    /**
     * @dev Executes the module's logic for a user operation
     * @param userOp The user operation to execute
     * @param userOpHash The hash of the user operation
     */
    function executeUserOp(
        bytes calldata userOp,
        bytes32 userOpHash
    ) external;
}

