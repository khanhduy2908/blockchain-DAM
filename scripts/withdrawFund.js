const { ethers } = require("hardhat")

async function withdrawFund() {
    const digitalAssetContract = await ethers.getContract("DigitalAssetContract")
    const tx = await digitalAssetContract.withdrawFund()
    await tx.wait(1)
    console.log(tx)
    console.log("Withdrawed")
}

withdrawFund()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
