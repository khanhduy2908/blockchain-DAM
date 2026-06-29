const { network } = require("hardhat")

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()

  const listingFee = "10000000000000000" // 0.01 ETH

  log("----------------------------------------------------")
  log(`Deploying to network: ${network.name}`)
  log(`Deployer: ${deployer}`)

  const marketplace = await deploy("DamMartketplace", {
    from: deployer,
    args: [listingFee],
    log: true,
    waitConfirmations: 1,
  })

  log(`DamMartketplace deployed at: ${marketplace.address}`)
  log("----------------------------------------------------")
}

module.exports.tags = ["marketplace"]
