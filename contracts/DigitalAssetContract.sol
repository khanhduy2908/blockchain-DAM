// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DigitalAssetContract {
    struct CustomerAssetData {
        string encryptedSymmetricKey;
        string encryptedFileHash;
        string ipfsURI;
    }

    mapping(address => CustomerAssetData) private customerAddrToData;
    mapping(address => uint256) private userFund;
    mapping(address => uint256) private userFundWithdrawable;
    mapping(address => bool) private userComparedHashes;
    uint256 public digitalAssetPrice;
    address public owner;
    DigitalAssetContract public parentAsset;
    uint256 public commissionRate;

    event CustomerFunded(address indexed customerAddr, uint256 indexed fundAmount);
    event AccessGranted(string indexed ipfsURI, address indexed customerAddr);
    event Refund(address indexed customerAddr, uint256 indexed fundAmount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not the owner");
        _;
    }

    function initialize(
        uint256 assetPrice,
        address payable _parentAsset,
        uint256 _commissionRate,
        address _owner
    ) public {
        owner = _owner;
        digitalAssetPrice = assetPrice;
        parentAsset = DigitalAssetContract(_parentAsset);
        commissionRate = _commissionRate;
    }

    function updatePrice(uint256 newPrice) public onlyOwner {
        digitalAssetPrice = newPrice;
    }

    function registerRequest() public payable {
        require(msg.sender != owner, "Caller is the owner");
        require(msg.value >= digitalAssetPrice, "Price not met");
        require(userFund[msg.sender] < digitalAssetPrice, "Already requested");

        delete customerAddrToData[msg.sender];
        userComparedHashes[msg.sender] = false;

        userFund[msg.sender] += msg.value;

        emit CustomerFunded(msg.sender, msg.value);
    }

    function grantAccess(
        address customerAddr,
        string memory encryptedFileHash,
        string memory encryptedSymmetricKey,
        string memory ipfsURI
    ) external onlyOwner {
        require(
            bytes(customerAddrToData[customerAddr].ipfsURI).length == 0,
            "Access already granted"
        );
        require(userFund[customerAddr] >= digitalAssetPrice, "Not registered");

        customerAddrToData[customerAddr] = CustomerAssetData(
            encryptedSymmetricKey,
            encryptedFileHash,
            ipfsURI
        );

        emit AccessGranted(ipfsURI, customerAddr);
    }

    function compareHashes(string memory customerHash) external {
        require(bytes(customerAddrToData[msg.sender].ipfsURI).length != 0, "Access not granted");

        if (!compareStrings(customerHash, customerAddrToData[msg.sender].encryptedFileHash)) {
            uint256 fundAmount = userFund[msg.sender];
            userFund[msg.sender] = 0;
            userFundWithdrawable[msg.sender] += fundAmount;

            delete customerAddrToData[msg.sender];

            emit Refund(msg.sender, fundAmount);
            return;
        }

        require(userFund[msg.sender] >= digitalAssetPrice, "Not enough funds");

        uint256 commissionFee = (commissionRate * digitalAssetPrice) / 10**18;
        userFund[msg.sender] = 0;
        userFundWithdrawable[msg.sender] = 0;

        userFundWithdrawable[owner] += digitalAssetPrice - commissionFee;
        userComparedHashes[msg.sender] = true;

        (bool success, ) = address(parentAsset).call{value: commissionFee}("");
        require(success, "Transfer to parentAsset failed");
    }

    receive() external payable {
        userFundWithdrawable[owner] += msg.value;
    }

    function getEncryptedSymmetricKey() public view returns (string memory) {
        require(userComparedHashes[msg.sender], "Hashes not compared");
        return customerAddrToData[msg.sender].encryptedSymmetricKey;
    }

    function isCustomer(address sender) public view returns (bool) {
        if (userComparedHashes[sender]) {
            return true;
        }
        return false;
    }

    function getIpfsURI(address customerAddr) public view returns (string memory) {
        require(bytes(customerAddrToData[customerAddr].ipfsURI).length != 0, "Access not granted");
        return customerAddrToData[customerAddr].ipfsURI;
    }

    function withdrawFund() public {
        uint256 amountToWithdraw = userFundWithdrawable[msg.sender];
        require(amountToWithdraw > 0, "No funds to withdraw");

        userFundWithdrawable[msg.sender] = 0;
        payable(msg.sender).transfer(amountToWithdraw);
    }

    function cancelRequest() public {
        require(
            bytes(customerAddrToData[msg.sender].ipfsURI).length == 0,
            "Access already granted"
        );
        require(userFund[msg.sender] > 0, "Not registered");

        userFundWithdrawable[msg.sender] += userFund[msg.sender];
        userFund[msg.sender] = 0;

        delete customerAddrToData[msg.sender];
    }

    function getPrice() public view returns (uint256) {
        return digitalAssetPrice;
    }

    function getWithdrawableFund() public view returns (uint256) {
        return userFundWithdrawable[msg.sender];
    }

    function compareStrings(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }
}
