const networkConfig = {
  default: {
    name: "hardhat",
  },
  31337: {
    name: "localhost",
  },
  4: {
    name: "rinkeby",
  },
  1: {
    name: "mainnet",
    keepersUpdateInterval: "30",
  },
};

const developmentChains = ["hardhat", "localhost"];
const VERIFICATION_BLOCK_CONFIRMATIONS = 6;
const frontEndContractsFile =
  "../nextjs-nft-marketplace-moralis-fcc/constants/networkMapping.json";
const frontEndAbiLocation = "../nextjs-nft-marketplace-moralis-fcc/constants/";

module.exports = {
  networkConfig,
  developmentChains,
  VERIFICATION_BLOCK_CONFIRMATIONS,
  frontEndContractsFile,
  frontEndAbiLocation,
};
