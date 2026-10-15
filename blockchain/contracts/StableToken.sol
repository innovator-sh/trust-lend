// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StableToken
 * @notice Mock stablecoin (USDC-like) used across TrustLend for all transfers.
 * Deployer receives the initial supply and can mint more for testing.
 */
contract StableToken is ERC20, Ownable {
    constructor() ERC20("TrustLend Dollar", "TLD") Ownable(msg.sender) {
        // Mint 1,000,000 TLD to deployer
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    /// @notice Owner can mint additional tokens (for seeding test accounts)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
