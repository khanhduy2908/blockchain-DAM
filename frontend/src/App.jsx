import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import Marketplace from "./contracts/DamMartketplace.json";
import DigitalAsset from "./contracts/DigitalAssetContract.json";
import addresses from "./contracts/contract-address.json";
import "./App.css";

const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";
const SEPOLIA_CHAIN_ID_DECIMAL = 11155111;

const DEMO_HASH = "abc123";
const DEMO_KEY = "key-demo-123";
const DEMO_IPFS = "ipfs://demo-file";

function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getExplorerTx(txHash) {
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}

function App() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [assetPrice, setAssetPrice] = useState("0.01");
  const [assetAddress, setAssetAddress] = useState(
    localStorage.getItem("latestAssetAddress") || ""
  );

  const [ownerAddress, setOwnerAddress] = useState(
    localStorage.getItem("ownerAddress") || ""
  );
  const [customerAddress, setCustomerAddress] = useState(
    localStorage.getItem("customerAddress") || ""
  );

  const [encryptedFileHash, setEncryptedFileHash] = useState(DEMO_HASH);
  const [encryptedSymmetricKey, setEncryptedSymmetricKey] = useState(DEMO_KEY);
  const [ipfsURI, setIpfsURI] = useState(DEMO_IPFS);
  const [customerHash, setCustomerHash] = useState(DEMO_HASH);

  const [result, setResult] = useState("Sẵn sàng kết nối MetaMask.");
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");

  const isSepolia = Number(chainId) === SEPOLIA_CHAIN_ID_DECIMAL;

  const roleLabel = useMemo(() => {
    if (!account) return "Chưa kết nối";
    if (ownerAddress && account.toLowerCase() === ownerAddress.toLowerCase()) {
      return "Owner / Người bán";
    }
    if (
      customerAddress &&
      account.toLowerCase() === customerAddress.toLowerCase()
    ) {
      return "Customer / Người mua";
    }
    return "Ví đang kết nối";
  }, [account, ownerAddress, customerAddress]);

  useEffect(() => {
    if (!window.ethereum) return;

    async function init() {
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });

      if (accounts?.[0]) {
        setAccount(accounts[0]);
      }

      const currentChain = await window.ethereum.request({
        method: "eth_chainId",
      });

      setChainId(parseInt(currentChain, 16).toString());
    }

    init();

    window.ethereum.on("accountsChanged", (accounts) => {
      setAccount(accounts?.[0] || "");
    });

    window.ethereum.on("chainChanged", (chainIdHex) => {
      setChainId(parseInt(chainIdHex, 16).toString());
    });
  }, []);

  async function switchToSepolia() {
    if (!window.ethereum) {
      setResult("Bạn cần cài MetaMask.");
      return;
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
      });
      setResult("Đã chuyển sang Sepolia.");
    } catch (error) {
      if (error.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: SEPOLIA_CHAIN_ID_HEX,
              chainName: "Sepolia",
              nativeCurrency: {
                name: "Sepolia ETH",
                symbol: "ETH",
                decimals: 18,
              },
              rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
              blockExplorerUrls: ["https://sepolia.etherscan.io"],
            },
          ],
        });
      } else {
        setResult(error.message);
      }
    }
  }

  async function getSigner() {
    if (!window.ethereum) {
      throw new Error("Bạn cần cài MetaMask để sử dụng ứng dụng.");
    }

    await window.ethereum.request({ method: "eth_requestAccounts" });

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const network = await provider.getNetwork();

    setChainId(network.chainId.toString());

    if (network.chainId !== SEPOLIA_CHAIN_ID_DECIMAL) {
      throw new Error("Vui lòng chuyển MetaMask sang mạng Sepolia.");
    }

    const signer = provider.getSigner();
    const currentAccount = await signer.getAddress();

    setAccount(currentAccount);
    return signer;
  }

  async function connectWallet() {
    try {
      setLoading(true);
      const signer = await getSigner();
      const currentAccount = await signer.getAddress();
      setAccount(currentAccount);
      setResult(`Đã kết nối ví: ${currentAccount}`);
    } catch (error) {
      setResult(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function getMarketplaceContract() {
    const signer = await getSigner();
    return new ethers.Contract(addresses.marketplace, Marketplace.abi, signer);
  }

  async function getDigitalAssetContract() {
    if (!assetAddress) {
      throw new Error("Chưa có địa chỉ Asset Contract. Hãy List Asset trước.");
    }

    const signer = await getSigner();
    return new ethers.Contract(assetAddress, DigitalAsset.abi, signer);
  }

  function useCurrentAsOwner() {
    if (!account) {
      setResult("Hãy kết nối MetaMask trước.");
      return;
    }

    setOwnerAddress(account);
    localStorage.setItem("ownerAddress", account);
    setResult(`Đã lưu ví Owner: ${account}`);
  }

  function useCurrentAsCustomer() {
    if (!account) {
      setResult("Hãy kết nối MetaMask trước.");
      return;
    }

    setCustomerAddress(account);
    localStorage.setItem("customerAddress", account);
    setResult(`Đã lưu ví Customer: ${account}`);
  }

  function fillDemoData() {
    setEncryptedFileHash(DEMO_HASH);
    setEncryptedSymmetricKey(DEMO_KEY);
    setIpfsURI(DEMO_IPFS);
    setCustomerHash(DEMO_HASH);
    setResult("Đã điền dữ liệu demo: abc123 / key-demo-123 / ipfs://demo-file");
  }

  async function listAsset() {
    try {
      setLoading(true);
      setTxHash("");

      const marketplace = await getMarketplaceContract();
      const signer = await getSigner();
      const currentAccount = await signer.getAddress();

      if (!ownerAddress) {
        setOwnerAddress(currentAccount);
        localStorage.setItem("ownerAddress", currentAccount);
      }

      const priceWei = ethers.utils.parseEther(assetPrice || "0.01");
      const listingFee = ethers.utils.parseEther("0.01");

      const tx = await marketplace.listAsset(
        priceWei,
        ethers.constants.AddressZero,
        0,
        { value: listingFee }
      );

      setResult("Đang gửi giao dịch List Asset...");
      setTxHash(tx.hash);

      const receipt = await tx.wait();

      const event = receipt.events?.find((e) => e.event === "ListAsset");
      const newAssetAddress = event?.args?.assetAddress;

      if (newAssetAddress) {
        setAssetAddress(newAssetAddress);
        localStorage.setItem("latestAssetAddress", newAssetAddress);
        setResult(`List Asset thành công. Asset Contract: ${newAssetAddress}`);
      } else {
        setResult("Giao dịch thành công nhưng chưa đọc được Asset Contract.");
      }
    } catch (error) {
      setResult(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function registerRequest() {
    try {
      setLoading(true);
      setTxHash("");

      const asset = await getDigitalAssetContract();
      const signer = await getSigner();
      const currentAccount = await signer.getAddress();

      if (!customerAddress) {
        setCustomerAddress(currentAccount);
        localStorage.setItem("customerAddress", currentAccount);
      }

      const price = await asset.getPrice();

      const tx = await asset.registerRequest({ value: price });

      setResult("Customer đang gửi giao dịch thanh toán / yêu cầu truy cập...");
      setTxHash(tx.hash);

      await tx.wait();

      setResult("Customer đã thanh toán / gửi yêu cầu truy cập thành công.");
    } catch (error) {
      setResult(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function grantAccess() {
    try {
      setLoading(true);
      setTxHash("");

      if (!customerAddress) {
        throw new Error("Chưa có địa chỉ Customer.");
      }

      const asset = await getDigitalAssetContract();

      const tx = await asset.grantAccess(
        customerAddress,
        encryptedFileHash,
        encryptedSymmetricKey,
        ipfsURI
      );

      setResult("Owner đang cấp quyền truy cập cho Customer...");
      setTxHash(tx.hash);

      await tx.wait();

      setResult("Owner đã cấp quyền truy cập thành công.");
    } catch (error) {
      setResult(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function compareHashes() {
    try {
      setLoading(true);
      setTxHash("");

      const asset = await getDigitalAssetContract();

      const tx = await asset.compareHashes(customerHash);

      setResult("Customer đang xác minh hash...");
      setTxHash(tx.hash);

      await tx.wait();

      setResult("Xác minh hash thành công. Customer có thể lấy dữ liệu.");
    } catch (error) {
      setResult(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function getIpfsURI() {
    try {
      setLoading(true);

      const asset = await getDigitalAssetContract();
      const signer = await getSigner();
      const currentAccount = await signer.getAddress();

      const uri = await asset.getIpfsURI(currentAccount);

      setResult(`IPFS URI: ${uri}`);
    } catch (error) {
      setResult(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function getEncryptedSymmetricKey() {
    try {
      setLoading(true);

      const asset = await getDigitalAssetContract();
      const key = await asset.getEncryptedSymmetricKey();

      setResult(`Encrypted symmetric key: ${key}`);
    } catch (error) {
      setResult(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  function resetDemo() {
    localStorage.removeItem("latestAssetAddress");
    localStorage.removeItem("ownerAddress");
    localStorage.removeItem("customerAddress");

    setAssetAddress("");
    setOwnerAddress("");
    setCustomerAddress("");
    setAssetPrice("0.01");
    fillDemoData();
    setTxHash("");
    setResult("Đã reset dữ liệu demo trên giao diện.");
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Digital Asset Marketplace</p>
          <h1>Demo giao dịch tài sản số trên Blockchain</h1>
          <p className="subtitle">
            Owner đăng tài sản, Customer thanh toán, Owner cấp quyền, Customer
            xác minh và nhận IPFS URI cùng khóa giải mã.
          </p>
        </div>

        <div className="wallet-card">
          <div className="wallet-line">
            <span>Network</span>
            <strong className={isSepolia ? "ok" : "bad"}>
              {isSepolia ? "Sepolia" : chainId ? `Chain ${chainId}` : "Chưa rõ"}
            </strong>
          </div>

          <div className="wallet-line">
            <span>Account</span>
            <strong>{account ? shortAddress(account) : "Chưa kết nối"}</strong>
          </div>

          <div className="wallet-line">
            <span>Vai trò</span>
            <strong>{roleLabel}</strong>
          </div>

          <button onClick={connectWallet} disabled={loading}>
            Connect MetaMask
          </button>

          {!isSepolia && (
            <button className="secondary" onClick={switchToSepolia}>
              Chuyển sang Sepolia
            </button>
          )}
        </div>
      </header>

      <section className="info-grid">
        <div className="info-card">
          <span>Marketplace Contract</span>
          <strong>{addresses.marketplace}</strong>
        </div>

        <div className="info-card">
          <span>Asset Contract hiện tại</span>
          <strong>{assetAddress || "Chưa tạo asset"}</strong>
        </div>
      </section>

      <main className="workflow">
        <section className="step-card">
          <div className="step-header">
            <div className="step-number">1</div>
            <div>
              <h2>Owner tạo tài sản</h2>
              <p>Dùng ví Owner để tạo một asset contract mới.</p>
            </div>
          </div>

          <label>Giá tài sản, SepoliaETH</label>
          <input
            value={assetPrice}
            onChange={(e) => setAssetPrice(e.target.value)}
          />

          <div className="button-row">
            <button onClick={useCurrentAsOwner} disabled={!account || loading}>
              Lấy ví hiện tại làm Owner
            </button>
            <button onClick={listAsset} disabled={loading}>
              List Asset
            </button>
          </div>

          {ownerAddress && (
            <p className="note">Owner: {shortAddress(ownerAddress)}</p>
          )}
        </section>

        <section className="step-card">
          <div className="step-header">
            <div className="step-number">2</div>
            <div>
              <h2>Customer thanh toán</h2>
              <p>Chuyển sang ví Customer rồi gửi yêu cầu truy cập.</p>
            </div>
          </div>

          <label>Asset Contract</label>
          <input
            value={assetAddress}
            onChange={(e) => {
              setAssetAddress(e.target.value);
              localStorage.setItem("latestAssetAddress", e.target.value);
            }}
            placeholder="Asset contract sẽ tự điền sau khi List Asset"
          />

          <div className="button-row">
            <button onClick={useCurrentAsCustomer} disabled={!account || loading}>
              Lấy ví hiện tại làm Customer
            </button>
            <button onClick={registerRequest} disabled={loading || !assetAddress}>
              Register Request / Pay
            </button>
          </div>

          {customerAddress && (
            <p className="note">Customer: {shortAddress(customerAddress)}</p>
          )}
        </section>

        <section className="step-card">
          <div className="step-header">
            <div className="step-number">3</div>
            <div>
              <h2>Owner cấp quyền</h2>
              <p>Thông tin demo đã được điền sẵn để dễ thao tác.</p>
            </div>
          </div>

          <label>Customer wallet address</label>
          <input
            value={customerAddress}
            onChange={(e) => {
              setCustomerAddress(e.target.value);
              localStorage.setItem("customerAddress", e.target.value);
            }}
          />

          <label>Encrypted file hash</label>
          <input
            value={encryptedFileHash}
            onChange={(e) => setEncryptedFileHash(e.target.value)}
          />

          <label>Encrypted symmetric key</label>
          <input
            value={encryptedSymmetricKey}
            onChange={(e) => setEncryptedSymmetricKey(e.target.value)}
          />

          <label>IPFS URI</label>
          <input value={ipfsURI} onChange={(e) => setIpfsURI(e.target.value)} />

          <div className="button-row">
            <button className="secondary" onClick={fillDemoData}>
              Điền dữ liệu demo
            </button>
            <button onClick={grantAccess} disabled={loading || !assetAddress}>
              Grant Access
            </button>
          </div>
        </section>

        <section className="step-card">
          <div className="step-header">
            <div className="step-number">4</div>
            <div>
              <h2>Customer lấy dữ liệu</h2>
              <p>Xác minh hash rồi lấy IPFS URI và khóa giải mã.</p>
            </div>
          </div>

          <label>Customer hash</label>
          <input
            value={customerHash}
            onChange={(e) => setCustomerHash(e.target.value)}
          />

          <div className="button-row">
            <button onClick={compareHashes} disabled={loading || !assetAddress}>
              Compare Hash
            </button>
            <button onClick={getIpfsURI} disabled={loading || !assetAddress}>
              Get IPFS URI
            </button>
            <button
              onClick={getEncryptedSymmetricKey}
              disabled={loading || !assetAddress}
            >
              Get Key
            </button>
          </div>
        </section>
      </main>

      <section className="result-card">
        <div className="result-header">
          <h2>Trạng thái giao dịch</h2>
          <button className="danger" onClick={resetDemo} disabled={loading}>
            Reset Demo
          </button>
        </div>

        {loading && <p className="loading">Đang xử lý giao dịch...</p>}

        <pre>{result}</pre>

        {txHash && (
          <a href={getExplorerTx(txHash)} target="_blank" rel="noreferrer">
            Xem giao dịch trên Sepolia Etherscan
          </a>
        )}
      </section>
    </div>
  );
}

export default App;