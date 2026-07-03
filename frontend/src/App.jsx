import { useState } from "react";
import { ethers } from "ethers";
import Marketplace from "./contracts/DamMartketplace.json";
import DigitalAsset from "./contracts/DigitalAssetContract.json";
import addresses from "./contracts/contract-address.json";
import "./App.css";

function App() {
  const [account, setAccount] = useState("");
  const [assetPrice, setAssetPrice] = useState("0.01");
  const [assetAddress, setAssetAddress] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [encryptedFileHash, setEncryptedFileHash] = useState("");
  const [encryptedSymmetricKey, setEncryptedSymmetricKey] = useState("");
  const [ipfsURI, setIpfsURI] = useState("");
  const [customerHash, setCustomerHash] = useState("");
  const [result, setResult] = useState("");

  async function getSigner() {
    if (!window.ethereum) {
      throw new Error("Bạn cần cài MetaMask để tương tác với blockchain.");
    }

    await window.ethereum.request({ method: "eth_requestAccounts" });

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const currentAccount = await signer.getAddress();

    setAccount(currentAccount);
    return signer;
  }

  async function connectWallet() {
    try {
      const signer = await getSigner();
      const currentAccount = await signer.getAddress();
      setResult(`Đã kết nối ví: ${currentAccount}`);
    } catch (error) {
      setResult(error.message);
    }
  }

  async function getMarketplaceContract() {
    const signer = await getSigner();
    return new ethers.Contract(
      addresses.marketplace,
      Marketplace.abi,
      signer
    );
  }

  async function getDigitalAssetContract() {
    if (!assetAddress) {
      throw new Error("Vui lòng nhập địa chỉ DigitalAssetContract.");
    }

    const signer = await getSigner();
    return new ethers.Contract(
      assetAddress,
      DigitalAsset.abi,
      signer
    );
  }

  async function listAsset() {
    try {
      const marketplace = await getMarketplaceContract();

      const priceWei = ethers.utils.parseEther(assetPrice);
      const listingFee = ethers.utils.parseEther("0.01");

      const tx = await marketplace.listAsset(
        priceWei,
        ethers.constants.AddressZero,
        0,
        { value: listingFee }
      );

      const receipt = await tx.wait();

      const event = receipt.events?.find((e) => e.event === "ListAsset");
      const newAssetAddress = event?.args?.assetAddress;

      if (newAssetAddress) {
        setAssetAddress(newAssetAddress);
        setResult(`Đã list asset. Contract tài sản: ${newAssetAddress}`);
      } else {
        setResult("Đã list asset nhưng chưa đọc được địa chỉ asset từ event.");
      }
    } catch (error) {
      setResult(error.reason || error.message);
    }
  }

  async function registerRequest() {
    try {
      const asset = await getDigitalAssetContract();
      const price = await asset.getPrice();

      const tx = await asset.registerRequest({ value: price });
      await tx.wait();

      setResult("Đã gửi yêu cầu mua/quyền truy cập asset.");
    } catch (error) {
      setResult(error.reason || error.message);
    }
  }

  async function grantAccess() {
    try {
      const asset = await getDigitalAssetContract();

      const tx = await asset.grantAccess(
        customerAddress,
        encryptedFileHash,
        encryptedSymmetricKey,
        ipfsURI
      );

      await tx.wait();
      setResult("Đã cấp quyền truy cập cho customer.");
    } catch (error) {
      setResult(error.reason || error.message);
    }
  }

  async function compareHashes() {
    try {
      const asset = await getDigitalAssetContract();

      const tx = await asset.compareHashes(customerHash);
      await tx.wait();

      setResult("Đã đối chiếu hash. Nếu đúng, customer có thể lấy symmetric key.");
    } catch (error) {
      setResult(error.reason || error.message);
    }
  }

  async function getEncryptedSymmetricKey() {
    try {
      const asset = await getDigitalAssetContract();

      const key = await asset.getEncryptedSymmetricKey();
      setResult(`Encrypted symmetric key: ${key}`);
    } catch (error) {
      setResult(error.reason || error.message);
    }
  }

  async function getIpfsURI() {
    try {
      const asset = await getDigitalAssetContract();

      const signer = await getSigner();
      const currentAccount = await signer.getAddress();

      const uri = await asset.getIpfsURI(currentAccount);
      setResult(`IPFS URI: ${uri}`);
    } catch (error) {
      setResult(error.reason || error.message);
    }
  }

  async function withdrawFund() {
    try {
      const asset = await getDigitalAssetContract();

      const tx = await asset.withdrawFund();
      await tx.wait();

      setResult("Đã rút fund thành công.");
    } catch (error) {
      setResult(error.reason || error.message);
    }
  }

  return (
    <div className="container">
      <h1>Digital Asset Marketplace Demo</h1>

      <button onClick={connectWallet}>Connect MetaMask</button>
      <p><strong>Account:</strong> {account || "Chưa kết nối"}</p>
      <p><strong>Marketplace:</strong> {addresses.marketplace}</p>

      <hr />

      <h2>1. Owner list asset</h2>
      <input
        value={assetPrice}
        onChange={(e) => setAssetPrice(e.target.value)}
        placeholder="Asset price, ví dụ: 0.01"
      />
      <button onClick={listAsset}>List Asset</button>

      <hr />

      <h2>2. Asset contract</h2>
      <input
        value={assetAddress}
        onChange={(e) => setAssetAddress(e.target.value)}
        placeholder="DigitalAssetContract address"
      />

      <hr />

      <h2>3. Customer request access</h2>
      <button onClick={registerRequest}>Register Request / Pay</button>

      <hr />

      <h2>4. Owner grant access</h2>
      <input
        value={customerAddress}
        onChange={(e) => setCustomerAddress(e.target.value)}
        placeholder="Customer wallet address"
      />
      <input
        value={encryptedFileHash}
        onChange={(e) => setEncryptedFileHash(e.target.value)}
        placeholder="Encrypted file hash"
      />
      <input
        value={encryptedSymmetricKey}
        onChange={(e) => setEncryptedSymmetricKey(e.target.value)}
        placeholder="Encrypted symmetric key"
      />
      <input
        value={ipfsURI}
        onChange={(e) => setIpfsURI(e.target.value)}
        placeholder="IPFS URI"
      />
      <button onClick={grantAccess}>Grant Access</button>

      <hr />

      <h2>5. Customer compare hash</h2>
      <input
        value={customerHash}
        onChange={(e) => setCustomerHash(e.target.value)}
        placeholder="Customer hash"
      />
      <button onClick={compareHashes}>Compare Hash</button>

      <hr />

      <h2>6. Customer retrieve data</h2>
      <button onClick={getIpfsURI}>Get IPFS URI</button>
      <button onClick={getEncryptedSymmetricKey}>Get Encrypted Symmetric Key</button>

      <hr />

      <h2>7. Withdraw</h2>
      <button onClick={withdrawFund}>Withdraw Fund</button>

      <hr />

      <h2>Result</h2>
      <pre>{result}</pre>
    </div>
  );
}

export default App;