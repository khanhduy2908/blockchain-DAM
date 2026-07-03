import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import Marketplace from "./contracts/DamMartketplace.json";
import DigitalAsset from "./contracts/DigitalAssetContract.json";
import addresses from "./contracts/contract-address.json";
import "./App.css";

const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

const DEMO = {
  assetName: "Bộ dữ liệu tài sản số mẫu",
  assetType: "Tài liệu / Dataset",
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

function getSaved(key) {
  return localStorage.getItem(key) || "";
}

function save(key, value) {
  if (value) localStorage.setItem(key, value);
}

export default function App() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [balance, setBalance] = useState("");

  const [owner, setOwner] = useState(getSaved("owner"));
  const [customer, setCustomer] = useState(getSaved("customer"));
  const [assetAddress, setAssetAddress] = useState(getSaved("assetAddress"));

  const [status, setStatus] = useState("Kết nối ví để bắt đầu demo.");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [openedURI, setOpenedURI] = useState("");
  const [openedKey, setOpenedKey] = useState("");

  const isSepolia = Number(chainId) === SEPOLIA_CHAIN_ID;

  const role = useMemo(() => {
    if (!account) return "Chưa kết nối";
    if (owner && account.toLowerCase() === owner.toLowerCase()) return "Owner";
    if (customer && account.toLowerCase() === customer.toLowerCase()) return "Customer";
    return "Ví khác";
  }, [account, owner, customer]);

  const step = useMemo(() => {
    if (!assetAddress) return 1;
    if (assetAddress && !customer) return 2;
    if (assetAddress && customer && !openedURI) return 3;
    return 4;
  }, [assetAddress, customer, openedURI]);

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
      setStatus("Đã chuyển sang Sepolia.");
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

      setAccount(current);
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

  async function getAsset() {
    if (!assetAddress) {
      throw new Error("Chưa có tài sản. Hãy để Owner đăng tài sản trước.");
    }

    const signer = await getSigner();
    return new ethers.Contract(assetAddress, DigitalAsset.abi, signer);
  }

  function setCurrentAsOwner() {
    if (!account) {
      setStatus("Hãy kết nối ví trước.");
      return;
    }

    setOwner(account);
    save("owner", account);
    setStatus(`Đã chọn ${shortAddress(account)} làm Owner.`);
  }

  function setCurrentAsCustomer() {
    if (!account) {
      setStatus("Hãy kết nối ví trước.");
      return;
    }

    setCustomer(account);
    save("customer", account);
    setStatus(`Đã chọn ${shortAddress(account)} làm Customer.`);
  }

  async function ownerCreateAsset() {
    try {
      setLoading(true);
      setTxHash("");
      setOpenedURI("");
      setOpenedKey("");

      const signer = await getSigner();
      const current = await signer.getAddress();

      setOwner(current);
      save("owner", current);

      const marketplace = await getMarketplace();

      const tx = await marketplace.listAsset(
        ethers.utils.parseEther(DEMO.price),
        ethers.constants.AddressZero,
        0,
        { value: ethers.utils.parseEther("0.01") }
      );

      setTxHash(tx.hash);
      setStatus("Owner đang đăng tài sản. Vui lòng chờ blockchain xác nhận...");

      const receipt = await tx.wait();
      const event = receipt.events?.find((e) => e.event === "ListAsset");
      const newAssetAddress = event?.args?.assetAddress;

      if (!newAssetAddress) {
        throw new Error("Không đọc được địa chỉ tài sản sau giao dịch.");
      }

      setAssetAddress(newAssetAddress);
      save("assetAddress", newAssetAddress);

      setStatus(`Đăng tài sản thành công: ${shortAddress(newAssetAddress)}.`);
      await refreshBalance(current);
    } catch (error) {
      setStatus(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function customerBuyAccess() {
    try {
      setLoading(true);
      setTxHash("");

      const signer = await getSigner();
      const current = await signer.getAddress();

      if (owner && current.toLowerCase() === owner.toLowerCase()) {
        throw new Error("Bạn đang dùng ví Owner. Hãy chuyển sang ví Customer để mua.");
      }

      setCustomer(current);
      save("customer", current);

      const asset = await getAsset();
      const price = await asset.getPrice();

      const tx = await asset.registerRequest({ value: price });

      setTxHash(tx.hash);
      setStatus("Customer đang thanh toán quyền truy cập...");

      await tx.wait();

      setStatus("Customer đã thanh toán. Bây giờ chuyển lại ví Owner để cấp quyền.");
      await refreshBalance(current);
    } catch (error) {
      setStatus(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function ownerGrantAccess() {
    try {
      setLoading(true);
      setTxHash("");

      const signer = await getSigner();
      const current = await signer.getAddress();

      if (owner && current.toLowerCase() !== owner.toLowerCase()) {
        throw new Error("Bạn đang không dùng ví Owner. Hãy chuyển lại ví Owner để cấp quyền.");
      }

      if (!customer) {
        throw new Error("Chưa có Customer. Hãy để Customer mua quyền truy cập trước.");
      }

      const asset = await getAsset();

      const tx = await asset.grantAccess(
        customer,
        DEMO.hash,
        DEMO.key,
        DEMO.ipfs
      );

      setTxHash(tx.hash);
      setStatus("Owner đang cấp quyền truy cập cho Customer...");

      await tx.wait();

      setStatus("Owner đã cấp quyền. Bây giờ chuyển sang Customer để mở tài sản.");
      await refreshBalance(current);
    } catch (error) {
      setStatus(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function customerOpenAsset() {
    try {
      setLoading(true);
      setTxHash("");
      setOpenedURI("");
      setOpenedKey("");

      const signer = await getSigner();
      const current = await signer.getAddress();

      if (customer && current.toLowerCase() !== customer.toLowerCase()) {
        throw new Error("Bạn đang không dùng ví Customer. Hãy chuyển sang ví Customer để mở tài sản.");
      }

      const asset = await getAsset();

      const tx = await asset.compareHashes(DEMO.hash);

      setTxHash(tx.hash);
      setStatus("Customer đang xác minh quyền truy cập...");

      await tx.wait();

      const uri = await asset.getIpfsURI(current);
      const key = await asset.getEncryptedSymmetricKey();

      setOpenedURI(uri);
      setOpenedKey(key);
      setStatus("Customer đã mở tài sản thành công.");
      await refreshBalance(current);
    } catch (error) {
      setStatus(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  function resetDemo() {
    ["owner", "customer", "assetAddress"].forEach((key) =>
      localStorage.removeItem(key)
    );

    setOwner("");
    setCustomer("");
    setAssetAddress("");
    setOpenedURI("");
    setOpenedKey("");
    setTxHash("");
    setStatus("Đã reset demo trên giao diện. Dữ liệu blockchain cũ vẫn còn trên Sepolia.");
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="logo">DA</div>
          <div>
            <div className="brand-title">Digital Asset Marketplace</div>
            <div className="brand-subtitle">Demo giao dịch tài sản số</div>
          </div>
        </div>

        <div className="header-actions">
          {!isSepolia && (
            <button className="btn btn-light" onClick={switchToSepolia}>
              Chuyển Sepolia
            </button>
          )}
          <button className="btn btn-primary" onClick={connectWallet} disabled={loading}>
            {account ? shortAddress(account) : "Kết nối ví"}
          </button>
        </div>
      </header>

      <main className="main">
        <section className="intro">
          <div className="intro-text">
            <span className="tag">Web3 access control demo</span>
            <h1>Marketplace tài sản số với 2 vai trò rõ ràng</h1>
            <p>
              Demo này chỉ dùng 2 ví: <b>Owner</b> là người đăng tài sản và <b>Customer</b> là người mua quyền truy cập.
              Các thông tin kỹ thuật được tự điền sẵn để người dùng không phải thao tác phức tạp.
            </p>
          </div>

          <div className="connection-card">
            <h3>Trạng thái ví</h3>

            <div className="info-row">
              <span>Network</span>
              <strong className={isSepolia ? "ok" : "danger"}>
                {isSepolia ? "Sepolia" : chainId ? `Chain ${chainId}` : "Chưa kết nối"}
              </strong>
            </div>

            <div className="info-row">
              <span>Ví hiện tại</span>
              <strong>{account ? shortAddress(account) : "Chưa kết nối"}</strong>
            </div>

            <div className="info-row">
              <span>Vai trò</span>
              <strong>{role}</strong>
            </div>

            <div className="info-row">
              <span>Số dư</span>
              <strong>{balance ? `${balance} ETH` : "—"}</strong>
            </div>
          </div>
        </section>

        <section className="asset-panel">
          <div className="asset-main">
            <div className="asset-heading">
              <div>
                <span className="eyebrow">Tài sản demo</span>
                <h2>{DEMO.assetName}</h2>
              </div>
              <span className="badge">{DEMO.assetType}</span>
            </div>

            <p>
              Đây là tài sản mẫu để demo quy trình mua quyền truy cập bằng blockchain.
              Người dùng không cần nhập hash, key hay IPFS bằng tay.
            </p>

            <div className="asset-meta">
              <div>
                <span>Giá</span>
                <strong>{DEMO.price} SepoliaETH</strong>
              </div>
              <div>
                <span>Marketplace</span>
                <a href={explorerAddress(addresses.marketplace)} target="_blank" rel="noreferrer">
                  {shortAddress(addresses.marketplace)}
                </a>
              </div>
              <div>
                <span>Asset Contract</span>
                {assetAddress ? (
                  <a href={explorerAddress(assetAddress)} target="_blank" rel="noreferrer">
                    {shortAddress(assetAddress)}
                  </a>
                ) : (
                  <strong>Chưa tạo</strong>
                )}
              </div>
            </div>
          </div>

          <div className="role-box">
            <h3>Vai trò trong demo</h3>
            <div className="role-line">
              <span>Owner</span>
              <strong>{shortAddress(owner)}</strong>
            </div>
            <div className="role-line">
              <span>Customer</span>
              <strong>{shortAddress(customer)}</strong>
            </div>
          </div>
        </section>

        <section className="stepper">
          <div className={step >= 1 ? "step active" : "step"}>
            <span>1</span>
            <p>Owner đăng tài sản</p>
          </div>
          <div className={step >= 2 ? "step active" : "step"}>
            <span>2</span>
            <p>Customer mua quyền</p>
          </div>
          <div className={step >= 3 ? "step active" : "step"}>
            <span>3</span>
            <p>Owner cấp quyền</p>
          </div>
          <div className={step >= 4 ? "step active" : "step"}>
            <span>4</span>
            <p>Customer mở tài sản</p>
          </div>
        </section>

        <section className="actions-grid">
          <div className="action-card owner-card">
            <span className="card-label">Bước 1 · Owner</span>
            <h3>Đăng tài sản demo</h3>
            <p>Chọn ví hiện tại làm Owner, sau đó tạo tài sản trên blockchain.</p>
            <button className="btn btn-light full" onClick={setCurrentAsOwner} disabled={!account || loading}>
              Chọn ví này làm Owner
            </button>
            <button className="btn btn-primary full" onClick={ownerCreateAsset} disabled={!account || !isSepolia || loading}>
              Đăng tài sản
            </button>
          </div>

          <div className="action-card customer-card">
            <span className="card-label">Bước 2 · Customer</span>
            <h3>Mua quyền truy cập</h3>
            <p>Chuyển sang ví Customer trong MetaMask rồi bấm mua quyền truy cập.</p>
            <button className="btn btn-light full" onClick={setCurrentAsCustomer} disabled={!account || loading}>
              Chọn ví này làm Customer
            </button>
            <button className="btn btn-primary full" onClick={customerBuyAccess} disabled={!assetAddress || !account || !isSepolia || loading}>
              Mua quyền truy cập
            </button>
          </div>

          <div className="action-card owner-card">
            <span className="card-label">Bước 3 · Owner</span>
            <h3>Cấp quyền cho Customer</h3>
            <p>Chuyển lại ví Owner để phê duyệt quyền truy cập cho Customer.</p>
            <button className="btn btn-primary full" onClick={ownerGrantAccess} disabled={!assetAddress || !customer || !account || !isSepolia || loading}>
              Cấp quyền truy cập
            </button>
          </div>

          <div className="action-card customer-card">
            <span className="card-label">Bước 4 · Customer</span>
            <h3>Mở tài sản đã mua</h3>
            <p>Chuyển lại ví Customer để xác minh và lấy thông tin truy cập.</p>
            <button className="btn btn-primary full" onClick={customerOpenAsset} disabled={!assetAddress || !customer || !account || !isSepolia || loading}>
              Xác minh và mở tài sản
            </button>
          </div>
        </section>

        {(openedURI || openedKey) && (
          <section className="success-box">
            <h2>Đã mở tài sản thành công</h2>
            <div className="result-grid">
              <div>
                <span>Đường dẫn tài sản</span>
                <strong>{openedURI}</strong>
              </div>
              <div>
                <span>Khóa truy cập demo</span>
                <strong>{openedKey}</strong>
              </div>
            </div>
          </section>
        )}

        <section className="status-box">
          <div>
            <span className="eyebrow">Trạng thái</span>
            <h2>{loading ? "Đang xử lý giao dịch..." : "Thông báo hệ thống"}</h2>
            <p>{status}</p>

            {txHash && (
              <a href={explorerTx(txHash)} target="_blank" rel="noreferrer">
                Xem giao dịch trên Sepolia Etherscan
              </a>
            )}
          </div>

          <button className="btn btn-danger" onClick={resetDemo} disabled={loading}>
            Reset giao diện
          </button>
        </section>
      </main>
    </div>
  );
}
