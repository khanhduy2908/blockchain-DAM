// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./DigitalAssetContract.sol";

// Declare errors
error NotEnoughListingFee();

// smart contract
contract DamMartketplace {
    // State variables
    uint256 public immutable listingFee;
    address contractOnwer;

    mapping(DigitalAssetContract => bool) public isAssetActive;
    mapping(DigitalAssetContract => mapping(address => uint8)) public rating;

    // Event declaration
    event ListAsset(DigitalAssetContract indexed assetAddress, uint256 indexed price);
    event Rating(DigitalAssetContract indexed asset, address indexed customerAddr, uint8 star);

    // Modifier declaration
    using Clones for address payable;
    address payable immutable template;

    // Constructor
    constructor(uint256 listingFeeInitialized) {
        listingFee = listingFeeInitialized;
        contractOnwer = msg.sender;
        template = payable(new DigitalAssetContract());
    }

    // Function definition
    function listAsset(
        uint256 _assetPrice,
        address payable _parentAsset,
        uint256 _commissionRate
    ) public payable returns (DigitalAssetContract) {
        if (msg.value < listingFee) {
            revert NotEnoughListingFee();
        }
        DigitalAssetContract digitalAssetContract = DigitalAssetContract(
            payable(template.clone())
        );

        digitalAssetContract.initialize(_assetPrice, _parentAsset, _commissionRate, msg.sender);
        isAssetActive[digitalAssetContract] = true;
        emit ListAsset(digitalAssetContract, _assetPrice);
        return digitalAssetContract;
    }

    function cancelListing(DigitalAssetContract digitalAssetContract) public {
        address assetOwner = digitalAssetContract.owner();
        require(msg.sender == assetOwner, "Unauthorized");
        isAssetActive[digitalAssetContract] = false;
    }

    function rateAsset(DigitalAssetContract asset, uint8 star) public returns (uint8) {
        bool isCustomer = asset.isCustomer(msg.sender);
        require(isCustomer, "Not a customer");
        require(star <= 5, "Invalid rating");

        rating[asset][msg.sender] = star;
        emit Rating(asset, msg.sender, star);
        return star;
    }

    function reportPlagiarism(DigitalAssetContract digitalAssetContract) public {
        require(msg.sender == contractOnwer, "Unauthorized");
        isAssetActive[digitalAssetContract] = false;
    }
}
