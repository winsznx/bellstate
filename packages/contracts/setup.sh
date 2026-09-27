#!/usr/bin/env bash
# Installs pinned Foundry dependencies (not committed — see .gitignore).
# Pinned versions, recorded when first installed:
#   forge-std              (tracks foundry-rs/forge-std default branch)
#   openzeppelin-contracts  v5.1.0
#   v4-core                 1.0.2 (npm package version at install time)
#   v4-periphery            1.0.4 (npm package version at install time)
set -euo pipefail
cd "$(dirname "$0")"

forge install foundry-rs/forge-std --no-git
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-git
forge install Uniswap/v4-core --no-git
forge install Uniswap/v4-periphery --no-git

forge build
