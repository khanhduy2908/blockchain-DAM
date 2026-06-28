const { ethers, network } = require("hardhat")
const { moveBlocks } = require("../utils/move-blocks")
const EthUtil = require("ethereumjs-util")

const uint8ToBase64 = (arr) => Buffer.from(arr).toString("base64")

async function registerRequest() {
    //   const { deployer } = await getNamedAccounts();
    //   console.log(deployer);
    const assetPrice = "10000000000000000" // 0.01 ETH
    const digitalAssetContract = await ethers.getContract("DigitalAssetContract")
    const tx = await digitalAssetContract.registerRequest({ value: assetPrice })
    // const tx = await digitalAssetContract.cancelRequest()
    await tx.wait(1)
    console.log(tx)
    console.log("Requested for access")
}

registerRequest()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
