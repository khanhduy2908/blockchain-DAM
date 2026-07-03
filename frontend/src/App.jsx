import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import Marketplace from "./contracts/DamMartketplace.json";
import DigitalAsset from "./contracts/DigitalAssetContract.json";
import addresses from "./contracts/contract-address.json";
import "./App.css";

const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

const DEFAULT_ASSET = {
  name: "Bộ dữ liệu tài sản số mẫu",
  category: "Dataset / Tài liệu số",
  description:
    "Tài sản số được mã hóa, người mua cần thanh toán và được người bán phê duyệt trước khi truy cập.",
  price: "0.01",
  ipfsURI: "ipfs://demo-file",
  encryptedFileHash: "abc123",
  encryptedSymmetricKey: "key-demo-123",
  customerHash: "abc123",
};

function shortAddress(address) {
  if (!address) return "Chưa có";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function explorerTx(txHash) {
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}

function explorerAddress(address) {
  return `https://sepolia.etherscan.io/address/${address}`;
}

function loadLocal(key, fallback = "") {
  return localStorage.getItem(key) || fallback;
}

function saveLocal(key, value) {
  if (value) localStorage.setItem(key, value);
}

function App() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [balance, setBalance] = useState("");

  const [ownerAddress, setOwnerAddress] = useState(loadLocal("ownerAddress"));
  const [customerAddress, setCustomerAddress] = useState(
    loadLocal("customerAddress")
  );
  const [assetAddress, setAssetAddress] = useState(
    loadLocal("latestAssetAddress")
  );

  const [assetName, setAssetName] = useState(
    loadLocal("assetName", DEFAULT_ASSET.name)
  );
  const [assetCategory, setAssetCategory] = useState(
    loadLocal("assetCategory", DEFAULT_ASSET.category)
  );
  const [assetDescription, setAssetDescription] = useState(
    loadLocal("assetDescription", DEFAULT_ASSET.description)
  );
  const [assetPrice, setAssetPrice] = useState(
    loadLocal("assetPrice", DEFAULT_ASSET.price)
  );

  const [ipfsURI, setIpfsURI] = useState(
    loadLocal("ipfsURI", DEFAULT_ASSET.ipfsURI)
  );
  const [encryptedFileHash, setEncryptedFileHash] = useState(
    loadLocal("encryptedFileHash", DEFAULT_ASSET.encryptedFileHash)
  );
  const [encryptedSymmetricKey, setEncryptedSymmetricKey] = useState(
    loadLocal("encryptedSymmetricKey", DEFAULT_ASSET.encryptedSymmetricKey)
  );
  const [customerHash, setCustomerHash] = useState(
    loadLocal("customerHash", DEFAULT_ASSET.customerHash)
  );

  const [status, setStatus] = useState("Sẵn sàng kết nối ví.");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const [retrievedURI, setRetrievedURI] = useState("");
  const [retrievedKey, setRetrievedKey] = useState("");

  const isSepolia = Number(chainId) === SEPOLIA_CHAIN_ID;

  const currentRole = useMemo(() => {
    if (!account) return "Chưa kết nối ví";

    if (
      ownerAddress &&
      account.toLowerCase() === ownerAddress.toLowerCase()
    ) {
      return "Người bán";
    }

    if (
      customerAddress &&
      account.toLowerCase() === customerAddress.toLowerCase()
    ) {
      return "Người mua";
    }

    return "Ví đang kết nối";
  }, [account, ownerAddress, customerAddress]);

  const progress = useMemo(() => {
    if (!assetAddress) return 25;
    if (assetAddress && !customerAddress) return 45;
    if (assetAddress && customerAddress && !retrievedURI) return 70;
    return 100;
  }, [assetAddress, customerAddress, retrievedURI]);

  useEffect(() => {
    if (!window.ethereum) return;

    async function initWalletState() {
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });

      if (accounts?.[0]) {
        setAccount(accounts[0]);
        refreshBalance(accounts[0]);
      }

      const chainIdHex = await window.ethereum.request({
        method: "eth_chainId",
      });

      setChainId(parseInt(chainIdHex, 16).toString());
    }

    initWalletState();

    const handleAccountsChanged = (accounts) => {
      const nextAccount = accounts?.[0] || "";
      setAccount(nextAccount);
      if (nextAccount) refreshBalance(nextAccount);
    };

    const handleChainChanged = (nextChainId) => {
      setChainId(parseInt(nextChainId, 16).toString());
      if (account) refreshBalance(account);
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      if (!window.ethereum?.removeListener) return;
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [account]);

  async function refreshBalance(address = account) {
    if (!window.ethereum || !address) return;

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const balanceWei = await provider.getBalance(address);
      setBalance(Number(ethers.utils.formatEther(balanceWei)).toFixed(4));
    } catch {
      setBalance("");
    }
  }

  async function switchToSepolia() {
    if (!window.ethereum) {
      setStatus("Bạn cần cài MetaMask để sử dụng ứng dụng.");
      return;
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
      });

      setStatus("Đã chuyển sang mạng Sepolia.");
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
        setStatus(error.reason || error.message);
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

    if (network.chainId !== SEPOLIA_CHAIN_ID) {
      throw new Error("Vui lòng chuyển MetaMask sang mạng Sepolia.");
    }

    const signer = provider.getSigner();
    const currentAccount = await signer.getAddress();

    setAccount(currentAccount);
    await refreshBalance(currentAccount);

    return signer;
  }

  async function connectWallet() {
    try {
      setLoading(true);
      const signer = await getSigner();
      const currentAccount = await signer.getAddress();

      setAccount(currentAccount);
      await refreshBalance(currentAccount);

      setStatus(`Đã kết nối ví ${shortAddress(currentAccount)}.`);
    } catch (error) {
      setStatus(error.reason || error.message);
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
      throw new Error("Chưa có tài sản. Vui lòng đăng tài sản trước.");
    }

    const signer = await getSigner();
    return new ethers.Contract(assetAddress, DigitalAsset.abi, signer);
  }

  function setCurrentAsOwner() {
    if (!account) {
      setStatus("Vui lòng kết nối ví trước.");
      return;
    }

    setOwnerAddress(account);
    saveLocal("ownerAddress", account);
    setStatus(`Đã chọn ${shortAddress(account)} làm Người bán.`);
  }

  function setCurrentAsCustomer() {
    if (!account) {
      setStatus("Vui lòng kết nối ví trước.");
      return;
    }

    setCustomerAddress(account);
    saveLocal("customerAddress", account);
    setStatus(`Đã chọn ${shortAddress(account)} làm Người mua.`);
  }

  function saveAssetDraft() {
    saveLocal("assetName", assetName);
    saveLocal("assetCategory", assetCategory);
    saveLocal("assetDescription", assetDescription);
    saveLocal("assetPrice", assetPrice);
    saveLocal("ipfsURI", ipfsURI);
    saveLocal("encryptedFileHash", encryptedFileHash);
    saveLocal("encryptedSymmetricKey", encryptedSymmetricKey);
    saveLocal("customerHash", customerHash);
  }

  function fillDemoData() {
    setAssetName(DEFAULT_ASSET.name);
    setAssetCategory(DEFAULT_ASSET.category);
    setAssetDescription(DEFAULT_ASSET.description);
    setAssetPrice(DEFAULT_ASSET.price);
    setIpfsURI(DEFAULT_ASSET.ipfsURI);
    setEncryptedFileHash(DEFAULT_ASSET.encryptedFileHash);
    setEncryptedSymmetricKey(DEFAULT_ASSET.encryptedSymmetricKey);
    setCustomerHash(DEFAULT_ASSET.customerHash);

    Object.entries({
      assetName: DEFAULT_ASSET.name,
      assetCategory: DEFAULT_ASSET.category,
      assetDescription: DEFAULT_ASSET.description,
      assetPrice: DEFAULT_ASSET.price,
      ipfsURI: DEFAULT_ASSET.ipfsURI,
      encryptedFileHash: DEFAULT_ASSET.encryptedFileHash,
      encryptedSymmetricKey: DEFAULT_ASSET.encryptedSymmetricKey,
      customerHash: DEFAULT_ASSET.customerHash,
    }).forEach(([key, value]) => saveLocal(key, value));

    setStatus("Đã điền bộ dữ liệu demo.");
  }

  async function listAsset() {
    try {
      setLoading(true);
      setTxHash("");
      setRetrievedURI("");
      setRetrievedKey("");
      saveAssetDraft();

      const signer = await getSigner();
      const currentAccount = await signer.getAddress();

      if (!ownerAddress) {
        setOwnerAddress(currentAccount);
        saveLocal("ownerAddress", currentAccount);
      }

      const marketplace = await getMarketplaceContract();

      const priceWei = ethers.utils.parseEther(assetPrice || "0.01");
      const listingFee = ethers.utils.parseEther("0.01");

      setStatus("Đang tạo tài sản trên blockchain. Vui lòng xác nhận trong MetaMask.");

      const tx = await marketplace.listAsset(
        priceWei,
        ethers.constants.AddressZero,
        0,
        { value: listingFee }
      );

      setTxHash(tx.hash);
      setStatus("Đang chờ blockchain xác nhận giao dịch đăng tài sản...");

      const receipt = await tx.wait();

      const event = receipt.events?.find((e) => e.event === "ListAsset");
      const newAssetAddress = event?.args?.assetAddress;

      if (!newAssetAddress) {
        setStatus("Giao dịch thành công nhưng chưa đọc được địa chỉ tài sản.");
        return;
      }

      setAssetAddress(newAssetAddress);
      saveLocal("latestAssetAddress", newAssetAddress);

      setStatus(`Đăng tài sản thành công: ${shortAddress(newAssetAddress)}.`);
      await refreshBalance(currentAccount);
    } catch (error) {
      setStatus(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function requestAccess() {
    try {
      setLoading(true);
      setTxHash("");

      const signer = await getSigner();
      const currentAccount = await signer.getAddress();

      if (!customerAddress) {
        setCustomerAddress(currentAccount);
        saveLocal("customerAddress", currentAccount);
      }

      const asset = await getDigitalAssetContract();
      const price = await asset.getPrice();

      setStatus("Đang gửi yêu cầu mua quyền truy cập. Vui lòng xác nhận trong MetaMask.");

      const tx = await asset.registerRequest({ value: price });

      setTxHash(tx.hash);
      setStatus("Đang chờ blockchain xác nhận thanh toán...");

      await tx.wait();

      setStatus("Thanh toán thành công. Đang chờ Người bán phê duyệt quyền truy cập.");
      await refreshBalance(currentAccount);
    } catch (error) {
      setStatus(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function approveAccess() {
    try {
      setLoading(true);
      setTxHash("");
      saveAssetDraft();

      if (!customerAddress) {
        throw new Error("Chưa có địa chỉ Người mua.");
      }

      const asset = await getDigitalAssetContract();

      setStatus("Đang cấp quyền truy cập. Vui lòng xác nhận trong MetaMask.");

      const tx = await asset.grantAccess(
        customerAddress,
        encryptedFileHash,
        encryptedSymmetricKey,
        ipfsURI
      );

      setTxHash(tx.hash);
      setStatus("Đang chờ blockchain xác nhận phê duyệt...");

      await tx.wait();

      setStatus("Đã cấp quyền truy cập thành công cho Người mua.");
      await refreshBalance(account);
    } catch (error) {
      setStatus(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyAccess() {
    try {
      setLoading(true);
      setTxHash("");

      const asset = await getDigitalAssetContract();

      setStatus("Đang xác minh quyền truy cập. Vui lòng xác nhận trong MetaMask.");

      const tx = await asset.compareHashes(customerHash);

      setTxHash(tx.hash);
      setStatus("Đang chờ blockchain xác nhận xác minh...");

      await tx.wait();

      setStatus("Xác minh thành công. Bạn có thể mở tài sản.");
    } catch (error) {
      setStatus(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function openAsset() {
    try {
      setLoading(true);

      const signer = await getSigner();
      const currentAccount = await signer.getAddress();
      const asset = await getDigitalAssetContract();

      const uri = await asset.getIpfsURI(currentAccount);
      const key = await asset.getEncryptedSymmetricKey();

      setRetrievedURI(uri);
      setRetrievedKey(key);
      setStatus("Đã lấy thông tin truy cập tài sản thành công.");
    } catch (error) {
      setStatus(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  function resetDemo() {
    [
      "ownerAddress",
      "customerAddress",
      "latestAssetAddress",
      "assetName",
      "assetCategory",
      "assetDescription",
      "assetPrice",
      "ipfsURI",
      "encryptedFileHash",
      "encryptedSymmetricKey",
      "customerHash",
    ].forEach((key) => localStorage.removeItem(key));

    setOwnerAddress("");
    setCustomerAddress("");
    setAssetAddress("");
    setRetrievedURI("");
    setRetrievedKey("");
    setTxHash("");

    fillDemoData();
    setStatus("Đã reset dữ liệu demo trên giao diện.");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">DA</div>
          <div>
            <p>Digital Asset Marketplace</p>
            <strong>Secure Access Demo</strong>
          </div>
        </div>

        <div className="topbar-actions">
          {!isSepolia && (
            <button className="ghost-btn" onClick={switchToSepolia}>
              Chuyển sang Sepolia
            </button>
          )}
          <button className="primary-btn" onClick={connectWallet} disabled={loading}>
            {account ? shortAddress(account) : "Kết nối ví"}
          </button>
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <div className="pill">Blockchain-powered access control</div>
          <h1>Nền tảng giao dịch và cấp quyền tài sản số</h1>
          <p>
            Người bán đăng tài sản số, người mua thanh toán qua ví blockchain,
            quyền truy cập được phê duyệt và ghi nhận minh bạch trên Sepolia.
          </p>

          <div className="hero-actions">
            <button className="primary-btn large" onClick={listAsset} disabled={loading}>
              Đăng tài sản mẫu
            </button>
            <button className="ghost-btn large" onClick={fillDemoData}>
              Điền dữ liệu demo
            </button>
          </div>
        </div>

        <aside className="wallet-panel">
          <div className="panel-title">Trạng thái kết nối</div>

          <div className="wallet-row">
            <span>Network</span>
            <strong className={isSepolia ? "positive" : "negative"}>
              {isSepolia ? "Sepolia" : chainId ? `Chain ${chainId}` : "Chưa rõ"}
            </strong>
          </div>

          <div className="wallet-row">
            <span>Ví</span>
            <strong>{account ? shortAddress(account) : "Chưa kết nối"}</strong>
          </div>

          <div className="wallet-row">
            <span>Số dư</span>
            <strong>{balance ? `${balance} ETH` : "—"}</strong>
          </div>

          <div className="wallet-row">
            <span>Vai trò</span>
            <strong>{currentRole}</strong>
          </div>

          <div className="wallet-row">
            <span>Marketplace</span>
            <a href={explorerAddress(addresses.marketplace)} target="_blank" rel="noreferrer">
              {shortAddress(addresses.marketplace)}
            </a>
          </div>
        </aside>
      </section>

      <section className="status-section">
        <div>
          <span>Tiến độ demo</span>
          <strong>{progress}%</strong>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </section>

      <main className="layout-grid">
        <section className="asset-card main-card">
          <div className="card-heading">
            <div>
              <span className="section-kicker">Tài sản đang giao dịch</span>
              <h2>{assetName}</h2>
            </div>
            <span className="asset-badge">{assetCategory}</span>
          </div>

          <p className="asset-description">{assetDescription}</p>

          <div className="asset-stats">
            <div>
              <span>Giá bán</span>
              <strong>{assetPrice} SepoliaETH</strong>
            </div>
            <div>
              <span>Trạng thái</span>
              <strong>{assetAddress ? "Đã đăng blockchain" : "Bản nháp"}</strong>
            </div>
            <div>
              <span>Asset Contract</span>
              <strong>
                {assetAddress ? (
                  <a href={explorerAddress(assetAddress)} target="_blank" rel="noreferrer">
                    {shortAddress(assetAddress)}
                  </a>
                ) : (
                  "Chưa tạo"
                )}
              </strong>
            </div>
          </div>

          <div className="form-grid">
            <label>
              Tên tài sản
              <input value={assetName} onChange={(e) => setAssetName(e.target.value)} />
            </label>

            <label>
              Loại tài sản
              <input
                value={assetCategory}
                onChange={(e) => setAssetCategory(e.target.value)}
              />
            </label>

            <label>
              Giá bán
              <input value={assetPrice} onChange={(e) => setAssetPrice(e.target.value)} />
            </label>
          </div>

          <label className="full-label">
            Mô tả ngắn
            <textarea
              value={assetDescription}
              onChange={(e) => setAssetDescription(e.target.value)}
            />
          </label>

          <div className="action-row">
            <button className="ghost-btn" onClick={setCurrentAsOwner} disabled={loading || !account}>
              Tôi là Người bán
            </button>
            <button className="primary-btn" onClick={listAsset} disabled={loading}>
              Đăng tài sản
            </button>
          </div>
        </section>

        <section className="side-stack">
          <div className="mini-card">
            <span className="section-kicker">Bước 1</span>
            <h3>Người bán đăng tài sản</h3>
            <p>
              Giao dịch tạo asset contract riêng cho tài sản. Người dùng phổ thông
              không cần thao tác với contract thủ công.
            </p>
            <button className="ghost-btn full" onClick={setCurrentAsOwner} disabled={!account}>
              Dùng ví hiện tại làm Người bán
            </button>
          </div>

          <div className="mini-card">
            <span className="section-kicker">Bước 2</span>
            <h3>Người mua thanh toán</h3>
            <p>
              Chuyển sang ví Người mua, sau đó bấm mua quyền truy cập. Giá được
              lấy trực tiếp từ smart contract.
            </p>
            <button className="ghost-btn full" onClick={setCurrentAsCustomer} disabled={!account}>
              Dùng ví hiện tại làm Người mua
            </button>
            <button className="primary-btn full" onClick={requestAccess} disabled={loading || !assetAddress}>
              Mua quyền truy cập
            </button>
          </div>
        </section>

        <section className="workflow-card">
          <div className="card-heading">
            <div>
              <span className="section-kicker">Phê duyệt</span>
              <h2>Cấp quyền truy cập cho Người mua</h2>
            </div>
          </div>

          <div className="approval-box">
            <div>
              <span>Người bán</span>
              <strong>{shortAddress(ownerAddress)}</strong>
            </div>
            <div>
              <span>Người mua</span>
              <strong>{shortAddress(customerAddress)}</strong>
            </div>
            <div>
              <span>Tài sản</span>
              <strong>{assetAddress ? shortAddress(assetAddress) : "Chưa có"}</strong>
            </div>
          </div>

          <label>
            Địa chỉ ví Người mua
            <input
              value={customerAddress}
              onChange={(e) => {
                setCustomerAddress(e.target.value);
                saveLocal("customerAddress", e.target.value);
              }}
              placeholder="Ví người mua sẽ được tự lưu sau khi chọn"
            />
          </label>

          <details className="technical-box" open={technicalOpen}>
            <summary onClick={(e) => {
              e.preventDefault();
              setTechnicalOpen(!technicalOpen);
            }}>
              Chi tiết kỹ thuật bảo mật
            </summary>

            <p>
              Bản demo dùng dữ liệu mẫu để mô phỏng IPFS và khóa mã hóa. Với sản
              phẩm thật, file và khóa phải được mã hóa ngoài blockchain.
            </p>

            <label>
              Mã hash xác minh
              <input
                value={encryptedFileHash}
                onChange={(e) => setEncryptedFileHash(e.target.value)}
              />
            </label>

            <label>
              Khóa giải mã đã mã hóa
              <input
                value={encryptedSymmetricKey}
                onChange={(e) => setEncryptedSymmetricKey(e.target.value)}
              />
            </label>

            <label>
              Đường dẫn lưu trữ tài sản
              <input value={ipfsURI} onChange={(e) => setIpfsURI(e.target.value)} />
            </label>
          </details>

          <div className="action-row">
            <button className="ghost-btn" onClick={fillDemoData}>
              Dùng dữ liệu mẫu
            </button>
            <button className="primary-btn" onClick={approveAccess} disabled={loading || !assetAddress}>
              Phê duyệt quyền truy cập
            </button>
          </div>
        </section>

        <section className="workflow-card">
          <div className="card-heading">
            <div>
              <span className="section-kicker">Truy cập</span>
              <h2>Mở tài sản đã mua</h2>
            </div>
          </div>

          <p className="asset-description">
            Người mua xác minh quyền truy cập, sau đó hệ thống trả về đường dẫn
            tài sản và khóa giải mã tương ứng.
          </p>

          <label>
            Mã xác minh của Người mua
            <input
              value={customerHash}
              onChange={(e) => setCustomerHash(e.target.value)}
            />
          </label>

          <div className="action-row">
            <button className="ghost-btn" onClick={verifyAccess} disabled={loading || !assetAddress}>
              Xác minh quyền
            </button>
            <button className="primary-btn" onClick={openAsset} disabled={loading || !assetAddress}>
              Mở tài sản
            </button>
          </div>

          {(retrievedURI || retrievedKey) && (
            <div className="access-result">
              <h3>Thông tin truy cập</h3>
              {retrievedURI && (
                <div>
                  <span>Đường dẫn tài sản</span>
                  <strong>{retrievedURI}</strong>
                </div>
              )}
              {retrievedKey && (
                <div>
                  <span>Khóa giải mã</span>
                  <strong>{retrievedKey}</strong>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <section className="transaction-panel">
        <div>
          <span className="section-kicker">Trạng thái hệ thống</span>
          <h2>{loading ? "Đang xử lý giao dịch..." : "Thông báo"}</h2>
          <p>{status}</p>

          {txHash && (
            <a href={explorerTx(txHash)} target="_blank" rel="noreferrer">
              Xem giao dịch trên Sepolia Etherscan
            </a>
          )}
        </div>

        <button className="danger-btn" onClick={resetDemo} disabled={loading}>
          Reset demo
        </button>
      </section>
    </div>
  );
}

export default App;
