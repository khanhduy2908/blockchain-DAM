const { expect } = require("chai")
const { BigNumber } = require("ethers")
const { ethers } = require("hardhat")

describe("DigitalAssetContract", function () {
    it("", async function () {
        const [owner, acc1] = await ethers.getSigners()

        const DigitalAssetContract = await ethers.getContractFactory("DigitalAssetContract")

        const digitalAssetContract = await DigitalAssetContract.deploy()
        await digitalAssetContract.initialize(
            100,
            ethers.constants.AddressZero,
            `${10 ** 16}`,
            owner.address
        )

        expect(await digitalAssetContract.getPrice()).to.equal(100)

        const userFund = ethers.utils.parseEther("1.0")
        await digitalAssetContract.connect(acc1).registerRequest({
            value: userFund,
        })

        await digitalAssetContract.connect(acc1).cancelRequest()

        await digitalAssetContract.connect(acc1).withdrawFund()

        await digitalAssetContract.connect(acc1).registerRequest({
            value: userFund,
        })
        await digitalAssetContract
            .connect(owner)
            .grantAccess(acc1.address, "testHash", "testSymKey", "testURI")
        await digitalAssetContract.connect(acc1).compareHashes("testHash")

        await digitalAssetContract.connect(acc1).registerRequest({
            value: ethers.utils.parseEther("2.0"),
        })
        await digitalAssetContract
            .connect(owner)
            .grantAccess(acc1.address, "testHash", "testSymKey", "testURI")
        await digitalAssetContract.connect(owner).updatePrice(200)
        await digitalAssetContract.connect(acc1).compareHashes("testHashfail")
    })
})
