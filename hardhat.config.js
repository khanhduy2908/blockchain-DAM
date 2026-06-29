require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()

const MAINNET_RPC_URL =
  process.env.MAINNET_RPC_URL ||
  process.env.ALCHEMY_MAINNET_RPC_URL ||
  "https://eth-mainnet.alchemyapi.io/v2/your-api-key"

const RINKEBY_RPC_URL =
  process.env.RINKEBY_RPC_URL ||
  "https://eth-rinkeby.alchemyapi.io/v2/your-api-key"

const KOVAN_RPC_URL =
  process.env.KOVAN_RPC_URL ||
  "https://eth-kovan.alchemyapi.io/v2/your-api-key"

const POLYGON_MAINNET_RPC_URL =
  process.env.POLYGON_MAINNET_RPC_URL ||
  "https://polygon-mainnet.alchemyapi.io/v2/your-api-key"

const PRIVATE_KEY = process.env.PRIVATE_KEY

const accounts =
  PRIVATE_KEY && PRIVATE_KEY.startsWith("0x") && PRIVATE_KEY.length === 66
    ? [PRIVATE_KEY]
    : []

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ""
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || ""
const REPORT_GAS = process.env.REPORT_GAS || false

module.exports = {
  defaultNetwork: "hardhat",

  networks: {
    hardhat: {
      chainId: 31337,
    },

    localhost: {
      chainId: 31337,
    },

    kovan: {
      url: KOVAN_RPC_URL,
      accounts,
      saveDeployments: true,
      chainId: 42,
    },

    rinkeby: {
      url: RINKEBY_RPC_URL,
      accounts,
      saveDeployments: true,
      chainId: 4,
    },

    mainnet: {
      url: MAINNET_RPC_URL,
      accounts,
      saveDeployments: true,
      chainId: 1,
    },

    polygon: {
      url: POLYGON_MAINNET_RPC_URL,
      accounts,
      saveDeployments: true,
      chainId: 137,
    },
  },

  etherscan: {
    apiKey: {
      rinkeby: ETHERSCAN_API_KEY,
      kovan: ETHERSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY,
    },
  },

  gasReporter: {
    enabled: REPORT_GAS,
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
    coinmarketcap: "7247988d-8003-4894-b315-cb5b5f002c79",
    gasPrice: 10,
  },

  contractSizer: {
    runOnCompile: false,
  },

  namedAccounts: {
    deployer: {
      default: 0,
      1: 0,
    },
    player: {
      default: 1,
    },
  },

  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  mocha: {
    timeout: 200000,
  },
}
