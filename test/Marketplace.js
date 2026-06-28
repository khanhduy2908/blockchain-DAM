const { expect } = require("chai")
const { BigNumber } = require("ethers")
const { ethers } = require("hardhat")

describe("DamMartketplace", function () {
    it("", async function () {
        const [owner, acc1, acc2] = await ethers.getSigners()

        const DamMartketplace = await ethers.getContractFactory("DamMartketplace")
        const DigitalAssetContract = await ethers.getContractFactory("DigitalAssetContract")

        const dam = await DamMartketplace.deploy(100)
        const userFund = ethers.utils.parseEther("1.0")
        const listAssetTx = await dam
            .connect(acc1)
            .listAsset(100, ethers.constants.AddressZero, `${10 ** 16}`, {
                value: userFund,
            })

        const receipt = await listAssetTx.wait()
        const assetAddr = receipt.events[0].args.assetAddress

        const digitalAssetContract = DigitalAssetContract.attach(assetAddr)
        const assetOwner = await digitalAssetContract.owner()
        expect(assetOwner).to.equal(acc1.address)
        expect(await digitalAssetContract.getPrice()).to.equal(100)

        await digitalAssetContract.connect(acc2).registerRequest({
            value: userFund,
        })
        await digitalAssetContract
            .connect(acc1)
            .grantAccess(acc2.address, "testHash", "testSymKey", "testURI")
        await digitalAssetContract.connect(acc2).compareHashes("testHash")

        await dam.connect(acc2).rateAsset(assetAddr, 4)

        await dam.connect(owner).reportPlagiarism(assetAddr)

        const listAssetTx1 = await dam
            .connect(acc1)
            .listAsset(100, ethers.constants.AddressZero, `${10 ** 16}`, {
                value: userFund,
            })

        const receipt1 = await listAssetTx1.wait()
        const assetAddr1 = receipt1.events[0].args.assetAddress
        await dam.connect(acc1).cancelListing(assetAddr1)
    })
})
