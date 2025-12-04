// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ActionTypes
 * @dev Utility library for encoding/decoding action types in session keys
 * 
 * Actions are encoded as bits in a bytes32 value:
 * - Bit 0: TRANSFER
 * - Bit 1: APPROVE
 * - Bit 2: SWAP
 * - Bit 3: BRIDGE
 * - Bit 4: CCTP
 * - Bit 5: GATEWAY
 */
library ActionTypes {
    uint8 public constant TRANSFER = 0;
    uint8 public constant APPROVE = 1;
    uint8 public constant SWAP = 2;
    uint8 public constant BRIDGE = 3;
    uint8 public constant CCTP = 4;
    uint8 public constant GATEWAY = 5;

    /**
     * @dev Encode multiple actions into a bytes32 bitmap
     * @param actions Array of action types to encode
     * @return encoded The encoded actions bitmap
     */
    function encodeActions(uint8[] memory actions) internal pure returns (bytes32 encoded) {
        uint256 bitmap = 0;
        for (uint256 i = 0; i < actions.length; i++) {
            bitmap |= (1 << actions[i]);
        }
        return bytes32(bitmap);
    }

    /**
     * @dev Check if an action is allowed in the encoded bitmap
     * @param encoded The encoded actions bitmap
     * @param action The action type to check
     * @return isAllowed Whether the action is allowed
     */
    function isActionAllowed(bytes32 encoded, uint8 action) internal pure returns (bool isAllowed) {
        return (uint256(encoded) >> action) & 1 == 1;
    }

    /**
     * @dev Decode actions from a bytes32 bitmap
     * @param encoded The encoded actions bitmap
     * @return actions Array of allowed action types
     */
    function decodeActions(bytes32 encoded) internal pure returns (uint8[] memory actions) {
        uint8[] memory temp = new uint8[](6);
        uint256 count = 0;
        
        for (uint8 i = 0; i < 6; i++) {
            if (isActionAllowed(encoded, i)) {
                temp[count] = i;
                count++;
            }
        }

        actions = new uint8[](count);
        for (uint256 i = 0; i < count; i++) {
            actions[i] = temp[i];
        }
    }
}

