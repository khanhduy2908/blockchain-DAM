import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import Marketplace from "./contracts/DamMartketplace.json";
import DigitalAsset from "./contracts/DigitalAssetContract.json";
import addresses from "./contracts/contract-address.json";
import "./App.css";

const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

const ASSET_TEMPLATE = {
  name: "Bộ dữ liệu tài sản số",
  type: "Tài liệu / Dataset",
  description:
    "Tài sản số được kiểm soát quyền truy cập bằng ví blockchain. Người mua cần thanh toán và được phê duyệt trước khi mở tài sản.",
  price: "0.01",
  hash: "abc123",
  key: "key-demo-123",
  ipfs: "ipfs://demo-file",
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

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export default function App() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [balance, setBalance] = useState("");

  const [activeTab, setActiveTab] = useState("marketplace");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Kết nối ví để bắt đầu quản lý tài sản số.");
  const [txHash, setTxHash] = useState("");

  const [owner, setOwner] = useState(readStorage("owner", ""));
  const [customer, setCustomer] = useState(readStorage("customer", ""));
  const [activeAssetAddress, setActiveAssetAddress] = useState(
    readStorage("activeAssetAddress", "")
  );

  const [assets, setAssets] = useState(readStorage("assets", []));
  const [transactions, setTransactions] = useState(readStorage("transactions", []));
  const [accessResult, setAccessResult] = useState(readStorage("accessResult", null));

  const isSepolia = Number(chainId) === SEPOLIA_CHAIN_ID;

  const activeAsset = useMemo(() => {
    if (!activeAssetAddress) return null;
    return assets.find(
      (asset) => asset.address?.toLowerCase() === activeAssetAddress.toLowerCase()
    );
  }, [assets, activeAssetAddress]);

  const role = useMemo(() => {
    if (!account) return "Chưa kết nối";
    if (owner && account.toLowerCase() === owner.toLowerCase()) return "Người bán";
    if (customer && account.toLowerCase() === customer.toLowerCase()) return "Người mua";
    return "Ví đang kết nối";
  }, [account, owner, customer]);

  const dashboard = useMemo(() => {
    const totalAssets = assets.length;
    const pending = assets.filter((asset) => asset.status === "Đã thanh toán").length;
    const granted = assets.filter((asset) => asset.status === "Đã cấp quyền").length;
    const opened = assets.filter((asset) => asset.status === "Đã mở").length;

    return { totalAssets, pending, granted, opened };
  }, [assets]);

  useEffect(() => {
    if (!window.ethereum) return;

    async function init() {
      const accounts = await window.ethereum.request({ method: "eth_accounts" });
      const chain = await window.ethereum.request({ method: "eth_chainId" });

      setChainId(parseInt(chain, 16).toString());

      if (accounts?.[0]) {
        setAccount(accounts[0]);
        await refreshBalance(accounts[0]);
      }
    }

    init();

    const onAccountsChanged = async (accounts) => {
      const next = accounts?.[0] || "";
      setAccount(next);
      if (next) await refreshBalance(next);
    };

    const onChainChanged = async (chainHex) => {
      setChainId(parseInt(chainHex, 16).toString());
      if (account) await refreshBalance(account);
    };

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", onAccountsChanged);
      window.ethereum?.removeListener?.("chainChanged", onChainChanged);
    };
  }, [account]);

  function persistAssets(nextAssets) {
    setAssets(nextAssets);
    writeStorage("assets", nextAssets);
  }

  function persistTransactions(nextTransactions) {
    setTransactions(nextTransactions);
    writeStorage("transactions", nextTransactions);
  }

  function updateAsset(address, patch) {
    const nextAssets = assets.map((asset) =>
      asset.address?.toLowerCase() === address?.toLowerCase()
        ? { ...asset, ...patch, updatedAt: new Date().toISOString() }
        : asset
    );

    persistAssets(nextAssets);
  }

  function addTransaction(type, actor, tx, assetAddress) {
    const item = {
      id: `${Date.now()}-${tx}`,
      type,
      actor,
      tx,
      assetAddress,
      createdAt: new Date().toISOString(),
    };

    persistTransactions([item, ...transactions]);
  }

  async function refreshBalance(address = account) {
    try {
      if (!window.ethereum || !address) return;
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const balanceWei = await provider.getBalance(address);
      setBalance(Number(ethers.utils.formatEther(balanceWei)).toFixed(4));
    } catch {
      setBalance("");
    }
  }

  async function switchToSepolia() {
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
              nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
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
      throw new Error("Vui lòng cài MetaMask để sử dụng.");
    }

    await window.ethereum.request({ method: "eth_requestAccounts" });

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const network = await provider.getNetwork();

    setChainId(network.chainId.toString());

    if (network.chainId !== SEPOLIA_CHAIN_ID) {
      throw new Error("Vui lòng chuyển ví sang mạng Sepolia.");
    }

    const signer = provider.getSigner();
    const current = await signer.getAddress();

    setAccount(current);
    await refreshBalance(current);

    return signer;
  }

  async function connectWallet() {
    try {
      setLoading(true);
      const signer = await getSigner();
      const current = await signer.getAddress();
      setStatus(`Đã kết nối ví ${shortAddress(current)}.`);
    } catch (error) {
      setStatus(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function getMarketplace() {
    const signer = await getSigner();
    return new ethers.Contract(addresses.marketplace, Marketplace.abi, signer);
  }

  async function getAssetContract(address = activeAssetAddress) {
    if (!address) throw new Error("Chưa chọn tài sản.");
    const signer = await getSigner();
    return new ethers.Contract(address, DigitalAsset.abi, signer);
  }

  function setCurrentAsOwner() {
    if (!account) {
      setStatus("Hãy kết nối ví trước.");
      return;
    }

    setOwner(account);
    writeStorage("owner", account);
    setStatus(`Đã chọn ${shortAddress(account)} làm Người bán.`);
  }

  function setCurrentAsCustomer() {
    if (!account) {
      setStatus("Hãy kết nối ví trước.");
      return;
    }

    setCustomer(account);
    writeStorage("customer", account);
    setStatus(`Đã chọn ${shortAddress(account)} làm Người mua.`);
  }

  async function createAsset() {
    try {
      setLoading(true);
      setTxHash("");
      setAccessResult(null);
      writeStorage("accessResult", null);

      const signer = await getSigner();
      const current = await signer.getAddress();

      setOwner(current);
      writeStorage("owner", current);

      const marketplace = await getMarketplace();

      setStatus("Đang đăng tài sản lên blockchain. Vui lòng xác nhận trong MetaMask.");

      const tx = await marketplace.listAsset(
        ethers.utils.parseEther(ASSET_TEMPLATE.price),
        ethers.constants.AddressZero,
        0,
        { value: ethers.utils.parseEther("0.01") }
      );

      setTxHash(tx.hash);
      setStatus("Đang chờ blockchain xác nhận giao dịch đăng tài sản...");

      const receipt = await tx.wait();
      const event = receipt.events?.find((e) => e.event === "ListAsset");
      const newAddress = event?.args?.assetAddress;

      if (!newAddress) throw new Error("Không đọc được địa chỉ tài sản sau giao dịch.");

      const newAsset = {
        id: newAddress,
        address: newAddress,
        name: ASSET_TEMPLATE.name,
        type: ASSET_TEMPLATE.type,
        description: ASSET_TEMPLATE.description,
        price: ASSET_TEMPLATE.price,
        owner: current,
        customer: "",
        status: "Đang bán",
        txCreate: tx.hash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const nextAssets = [newAsset, ...assets];
      persistAssets(nextAssets);

      setActiveAssetAddress(newAddress);
      writeStorage("activeAssetAddress", newAddress);

      addTransaction("Đăng tài sản", "Người bán", tx.hash, newAddress);

      setStatus(`Tài sản đã được đăng thành công: ${shortAddress(newAddress)}.`);
      await refreshBalance(current);
      setActiveTab("myAssets");
    } catch (error) {
      setStatus(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function purchaseAccess(address = activeAssetAddress) {
    try {
      setLoading(true);
      setTxHash("");

      const signer = await getSigner();
      const current = await signer.getAddress();

      if (owner && current.toLowerCase() === owner.toLowerCase()) {
        throw new Error("Bạn đang dùng ví Người bán. Hãy chuyển sang ví Người mua.");
      }

      setCustomer(current);
      writeStorage("customer", current);

      setActiveAssetAddress(address);
      writeStorage("activeAssetAddress", address);

      const assetContract = await getAssetContract(address);
      const price = await assetContract.getPrice();

      setStatus("Đang thanh toán quyền truy cập. Vui lòng xác nhận trong MetaMask.");

      const tx = await assetContract.registerRequest({ value: price });

      setTxHash(tx.hash);
      setStatus("Đang chờ blockchain xác nhận thanh toán...");

      await tx.wait();

      updateAsset(address, {
        customer: current,
        status: "Đã thanh toán",
        txPurchase: tx.hash,
      });

      addTransaction("Mua quyền truy cập", "Người mua", tx.hash, address);

      setStatus("Thanh toán thành công. Đang chờ Người bán cấp quyền truy cập.");
      await refreshBalance(current);
      setActiveTab("access");
    } catch (error) {
      setStatus(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function grantAccess(address = activeAssetAddress) {
    try {
      setLoading(true);
      setTxHash("");

      const signer = await getSigner();
      const current = await signer.getAddress();

      const asset = assets.find(
        (item) => item.address?.toLowerCase() === address?.toLowerCase()
      );

      const customerAddress = asset?.customer || customer;

      if (!customerAddress) {
        throw new Error("Chưa có Người mua cần cấp quyền.");
      }

      if (asset?.owner && current.toLowerCase() !== asset.owner.toLowerCase()) {
        throw new Error("Hãy chuyển lại đúng ví Người bán để cấp quyền.");
      }

      const assetContract = await getAssetContract(address);

      setStatus("Đang cấp quyền truy cập cho Người mua. Vui lòng xác nhận trong MetaMask.");

      const tx = await assetContract.grantAccess(
        customerAddress,
        ASSET_TEMPLATE.hash,
        ASSET_TEMPLATE.key,
        ASSET_TEMPLATE.ipfs
      );

      setTxHash(tx.hash);
      setStatus("Đang chờ blockchain xác nhận quyền truy cập...");

      await tx.wait();

      updateAsset(address, {
        customer: customerAddress,
        status: "Đã cấp quyền",
        txGrant: tx.hash,
      });

      addTransaction("Cấp quyền truy cập", "Người bán", tx.hash, address);

      setStatus("Đã cấp quyền truy cập thành công.");
      await refreshBalance(current);
      setActiveTab("access");
    } catch (error) {
      setStatus(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function openAsset(address = activeAssetAddress) {
    try {
      setLoading(true);
      setTxHash("");

      const signer = await getSigner();
      const current = await signer.getAddress();

      const asset = assets.find(
        (item) => item.address?.toLowerCase() === address?.toLowerCase()
      );

      if (asset?.customer && current.toLowerCase() !== asset.customer.toLowerCase()) {
        throw new Error("Hãy chuyển sang đúng ví Người mua để mở tài sản.");
      }

      const assetContract = await getAssetContract(address);

      setStatus("Đang xác minh quyền truy cập. Vui lòng xác nhận trong MetaMask.");

      const tx = await assetContract.compareHashes(ASSET_TEMPLATE.hash);

      setTxHash(tx.hash);
      setStatus("Đang chờ blockchain xác nhận xác minh...");

      await tx.wait();

      const uri = await assetContract.getIpfsURI(current);
      const key = await assetContract.getEncryptedSymmetricKey();

      const result = {
        assetAddress: address,
        uri,
        key,
        openedAt: new Date().toISOString(),
      };

      setAccessResult(result);
      writeStorage("accessResult", result);

      updateAsset(address, {
        status: "Đã mở",
        txOpen: tx.hash,
      });

      addTransaction("Mở tài sản", "Người mua", tx.hash, address);

      setStatus("Tài sản đã được mở thành công.");
      await refreshBalance(current);
      setActiveTab("access");
    } catch (error) {
      setStatus(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  function selectAsset(address) {
    setActiveAssetAddress(address);
    writeStorage("activeAssetAddress", address);
    setStatus(`Đã chọn tài sản ${shortAddress(address)}.`);
  }

  function clearWorkspace() {
    [
      "owner",
      "customer",
      "activeAssetAddress",
      "assets",
      "transactions",
      "accessResult",
    ].forEach((key) => localStorage.removeItem(key));

    setOwner("");
    setCustomer("");
    setActiveAssetAddress("");
    setAssets([]);
    setTransactions([]);
    setAccessResult(null);
    setTxHash("");
    setStatus("Đã làm sạch dữ liệu hiển thị trên trình duyệt.");
    setActiveTab("marketplace");
  }

  return (
    <div className="app">
      <header className="shell-header">
        <div className="brand">
          <div className="logo">DA</div>
          <div>
            <strong>Digital Asset Marketplace</strong>
            <span>Quản lý quyền truy cập tài sản số</span>
          </div>
        </div>

        <div className="header-actions">
          {!isSepolia && (
            <button className="btn btn-secondary" onClick={switchToSepolia}>
              Chuyển Sepolia
            </button>
          )}
          <button className="btn btn-primary" onClick={connectWallet} disabled={loading}>
            {account ? shortAddress(account) : "Kết nối ví"}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="tag">Blockchain asset access</span>
          <h1>Nền tảng quản lý và giao dịch tài sản số</h1>
          <p>
            Đăng tài sản, bán quyền truy cập, cấp quyền cho người mua và theo dõi
            toàn bộ giao dịch bằng biên lai blockchain.
          </p>

          <div className="hero-actions">
            <button className="btn btn-primary large" onClick={createAsset} disabled={!account || !isSepolia || loading}>
              Đăng tài sản mới
            </button>
            <button className="btn btn-secondary large" onClick={setCurrentAsOwner} disabled={!account || loading}>
              Dùng ví này làm Người bán
            </button>
          </div>
        </div>

        <div className="wallet-card">
          <h3>Trạng thái hệ thống</h3>
          <div className="wallet-row">
            <span>Network</span>
            <strong className={isSepolia ? "ok" : "danger"}>
              {isSepolia ? "Sepolia" : chainId ? `Chain ${chainId}` : "Chưa kết nối"}
            </strong>
          </div>
          <div className="wallet-row">
            <span>Ví hiện tại</span>
            <strong>{account ? shortAddress(account) : "Chưa kết nối"}</strong>
          </div>
          <div className="wallet-row">
            <span>Số dư</span>
            <strong>{balance ? `${balance} ETH` : "—"}</strong>
          </div>
          <div className="wallet-row">
            <span>Vai trò</span>
            <strong>{role}</strong>
          </div>
          <div className="wallet-row">
            <span>Marketplace</span>
            <a href={explorerAddress(addresses.marketplace)} target="_blank" rel="noreferrer">
              {shortAddress(addresses.marketplace)}
            </a>
          </div>
        </div>
      </section>

      <section className="metrics">
        <div className="metric">
          <span>Tài sản đã đăng</span>
          <strong>{dashboard.totalAssets}</strong>
        </div>
        <div className="metric">
          <span>Chờ cấp quyền</span>
          <strong>{dashboard.pending}</strong>
        </div>
        <div className="metric">
          <span>Đã cấp quyền</span>
          <strong>{dashboard.granted}</strong>
        </div>
        <div className="metric">
          <span>Đã mở</span>
          <strong>{dashboard.opened}</strong>
        </div>
      </section>

      <nav className="tabs">
        <button className={activeTab === "marketplace" ? "active" : ""} onClick={() => setActiveTab("marketplace")}>
          Thị trường
        </button>
        <button className={activeTab === "myAssets" ? "active" : ""} onClick={() => setActiveTab("myAssets")}>
          Tài sản của tôi
        </button>
        <button className={activeTab === "access" ? "active" : ""} onClick={() => setActiveTab("access")}>
          Quyền truy cập
        </button>
        <button className={activeTab === "activity" ? "active" : ""} onClick={() => setActiveTab("activity")}>
          Lịch sử
        </button>
      </nav>

      {activeTab === "marketplace" && (
        <main className="content-grid">
          <section className="panel wide">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Tài sản khả dụng</span>
                <h2>{ASSET_TEMPLATE.name}</h2>
              </div>
              <span className="badge">{ASSET_TEMPLATE.type}</span>
            </div>

            <p className="description">{ASSET_TEMPLATE.description}</p>

            <div className="asset-info">
              <div>
                <span>Giá truy cập</span>
                <strong>{ASSET_TEMPLATE.price} SepoliaETH</strong>
              </div>
              <div>
                <span>Trạng thái</span>
                <strong>{activeAsset?.status || "Có thể đăng bán"}</strong>
              </div>
              <div>
                <span>Asset Contract</span>
                {activeAssetAddress ? (
                  <a href={explorerAddress(activeAssetAddress)} target="_blank" rel="noreferrer">
                    {shortAddress(activeAssetAddress)}
                  </a>
                ) : (
                  <strong>Chưa tạo</strong>
                )}
              </div>
            </div>

            <div className="action-row">
              <button className="btn btn-primary" onClick={createAsset} disabled={!account || !isSepolia || loading}>
                Người bán đăng tài sản
              </button>
              <button className="btn btn-secondary" onClick={purchaseAccess} disabled={!activeAssetAddress || !account || !isSepolia || loading}>
                Người mua thanh toán
              </button>
            </div>
          </section>

          <aside className="panel">
            <span className="eyebrow">Vai trò</span>
            <h2>Thiết lập nhanh</h2>

            <div className="role-row">
              <span>Người bán</span>
              <strong>{shortAddress(owner)}</strong>
            </div>
            <div className="role-row">
              <span>Người mua</span>
              <strong>{shortAddress(customer)}</strong>
            </div>

            <button className="btn btn-secondary full" onClick={setCurrentAsOwner} disabled={!account || loading}>
              Dùng ví này làm Người bán
            </button>
            <button className="btn btn-secondary full" onClick={setCurrentAsCustomer} disabled={!account || loading}>
              Dùng ví này làm Người mua
            </button>
          </aside>
        </main>
      )}

      {activeTab === "myAssets" && (
        <main className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Quản lý tài sản</span>
              <h2>Tài sản của tôi</h2>
            </div>
            <button className="btn btn-primary" onClick={createAsset} disabled={!account || !isSepolia || loading}>
              Đăng tài sản mới
            </button>
          </div>

          {assets.length === 0 ? (
            <div className="empty-state">
              <h3>Chưa có tài sản nào</h3>
              <p>Kết nối ví Người bán và đăng tài sản đầu tiên lên blockchain.</p>
            </div>
          ) : (
            <div className="asset-list">
              {assets.map((asset) => (
                <div className="asset-item" key={asset.address}>
                  <div>
                    <span className="status-pill">{asset.status}</span>
                    <h3>{asset.name}</h3>
                    <p>{asset.description}</p>
                    <div className="mini-meta">
                      <span>Người bán: {shortAddress(asset.owner)}</span>
                      <span>Người mua: {shortAddress(asset.customer)}</span>
                      <span>Giá: {asset.price} ETH</span>
                    </div>
                  </div>

                  <div className="item-actions">
                    <a href={explorerAddress(asset.address)} target="_blank" rel="noreferrer">
                      Xem contract
                    </a>
                    <button className="btn btn-secondary" onClick={() => selectAsset(asset.address)}>
                      Chọn tài sản
                    </button>
                    <button className="btn btn-primary" onClick={() => grantAccess(asset.address)} disabled={asset.status !== "Đã thanh toán" || loading}>
                      Cấp quyền
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {activeTab === "access" && (
        <main className="content-grid">
          <section className="panel wide">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Quyền truy cập</span>
                <h2>Tài sản đang được xử lý</h2>
              </div>
              <span className="badge">{activeAsset?.status || "Chưa chọn"}</span>
            </div>

            {!activeAsset ? (
              <div className="empty-state">
                <h3>Chưa chọn tài sản</h3>
                <p>Hãy đăng hoặc chọn một tài sản trong danh sách quản lý.</p>
              </div>
            ) : (
              <>
                <div className="asset-info">
                  <div>
                    <span>Tên tài sản</span>
                    <strong>{activeAsset.name}</strong>
                  </div>
                  <div>
                    <span>Người bán</span>
                    <strong>{shortAddress(activeAsset.owner)}</strong>
                  </div>
                  <div>
                    <span>Người mua</span>
                    <strong>{shortAddress(activeAsset.customer)}</strong>
                  </div>
                </div>

                <div className="process">
                  <div className={["Đang bán", "Đã thanh toán", "Đã cấp quyền", "Đã mở"].includes(activeAsset.status) ? "done" : ""}>
                    <span>1</span>
                    <p>Đăng bán</p>
                  </div>
                  <div className={["Đã thanh toán", "Đã cấp quyền", "Đã mở"].includes(activeAsset.status) ? "done" : ""}>
                    <span>2</span>
                    <p>Thanh toán</p>
                  </div>
                  <div className={["Đã cấp quyền", "Đã mở"].includes(activeAsset.status) ? "done" : ""}>
                    <span>3</span>
                    <p>Cấp quyền</p>
                  </div>
                  <div className={activeAsset.status === "Đã mở" ? "done" : ""}>
                    <span>4</span>
                    <p>Mở tài sản</p>
                  </div>
                </div>

                <div className="action-row">
                  <button className="btn btn-secondary" onClick={() => purchaseAccess(activeAsset.address)} disabled={loading || activeAsset.status !== "Đang bán"}>
                    Thanh toán quyền truy cập
                  </button>
                  <button className="btn btn-secondary" onClick={() => grantAccess(activeAsset.address)} disabled={loading || activeAsset.status !== "Đã thanh toán"}>
                    Cấp quyền truy cập
                  </button>
                  <button className="btn btn-primary" onClick={() => openAsset(activeAsset.address)} disabled={loading || !["Đã cấp quyền", "Đã mở"].includes(activeAsset.status)}>
                    Mở tài sản
                  </button>
                </div>
              </>
            )}
          </section>

          <aside className="panel">
            <span className="eyebrow">Thông tin truy cập</span>
            <h2>Kết quả</h2>

            {accessResult ? (
              <div className="access-box">
                <div>
                  <span>Đường dẫn tài sản</span>
                  <strong>{accessResult.uri}</strong>
                </div>
                <div>
                  <span>Khóa truy cập</span>
                  <strong>{accessResult.key}</strong>
                </div>
              </div>
            ) : (
              <p className="muted">Thông tin truy cập chỉ hiện sau khi Người mua mở tài sản thành công.</p>
            )}
          </aside>
        </main>
      )}

      {activeTab === "activity" && (
        <main className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Audit trail</span>
              <h2>Lịch sử giao dịch</h2>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="empty-state">
              <h3>Chưa có giao dịch</h3>
              <p>Các giao dịch blockchain sẽ được ghi nhận tại đây.</p>
            </div>
          ) : (
            <div className="tx-list">
              {transactions.map((item) => (
                <div className="tx-item" key={item.id}>
                  <div>
                    <strong>{item.type}</strong>
                    <span>{item.actor} · {new Date(item.createdAt).toLocaleString("vi-VN")}</span>
                  </div>
                  <a href={explorerTx(item.tx)} target="_blank" rel="noreferrer">
                    Xem biên lai
                  </a>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      <section className="status-panel">
        <div>
          <span className="eyebrow">Trạng thái</span>
          <h2>{loading ? "Đang xử lý giao dịch..." : "Thông báo hệ thống"}</h2>
          <p>{status}</p>
          {txHash && (
            <a href={explorerTx(txHash)} target="_blank" rel="noreferrer">
              Xem giao dịch mới nhất trên Sepolia Etherscan
            </a>
          )}
        </div>

        <button className="btn btn-danger" onClick={clearWorkspace} disabled={loading}>
          Làm sạch giao diện
        </button>
      </section>
    </div>
  );
}
