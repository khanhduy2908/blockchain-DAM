import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import Marketplace from "./contracts/DamMartketplace.json";
import DigitalAsset from "./contracts/DigitalAssetContract.json";
import addresses from "./contracts/contract-address.json";
import "./App.css";

const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

const ASSET = {
  name: "Bộ dữ liệu tài sản số",
  type: "Tài liệu / Dataset",
  price: "0.01",
  hash: "asset-access-hash-001",
  key: "encrypted-key-access-001",
  ipfs: "ipfs://digital-asset-file",
};

function shortAddress(address) {
  if (!address) return "Chưa có";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function txLink(txHash) {
  return `https://sepolia.etherscan.io/tx/${txHash}`;
}

function addressLink(address) {
  return `https://sepolia.etherscan.io/address/${address}`;
}

function loadText(key) {
  return localStorage.getItem(key) || "";
}

function saveText(key, value) {
  if (value) localStorage.setItem(key, value);
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export default function App() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [balance, setBalance] = useState("");

  const [owner, setOwner] = useState(loadText("flowOwner"));
  const [customer, setCustomer] = useState(loadText("flowCustomer"));
  const [assetAddress, setAssetAddress] = useState(loadText("flowAssetAddress"));

  const [txs, setTxs] = useState(
    loadJSON("flowTxs", {
      create: "",
      purchase: "",
      grant: "",
      open: "",
    })
  );

  const [openedData, setOpenedData] = useState(
    loadJSON("flowOpenedData", {
      uri: "",
      key: "",
    })
  );

  const [status, setStatus] = useState("Kết nối ví MetaMask để bắt đầu quy trình.");
  const [loading, setLoading] = useState(false);

  const isSepolia = Number(chainId) === SEPOLIA_CHAIN_ID;

  const role = useMemo(() => {
    if (!account) return "Chưa kết nối";
    if (owner && account.toLowerCase() === owner.toLowerCase()) return "Người bán";
    if (customer && account.toLowerCase() === customer.toLowerCase()) return "Người mua";
    return "Ví đang kết nối";
  }, [account, owner, customer]);

  const currentStep = useMemo(() => {
    if (!txs.create) return 1;
    if (!txs.purchase) return 2;
    if (!txs.grant) return 3;
    if (!txs.open) return 4;
    return 5;
  }, [txs]);

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

  function updateTxs(patch) {
    const next = { ...txs, ...patch };
    setTxs(next);
    saveJSON("flowTxs", next);
  }

  function updateOpenedData(next) {
    setOpenedData(next);
    saveJSON("flowOpenedData", next);
  }

  async function switchToSepolia() {
    if (!window.ethereum) {
      setStatus("Vui lòng cài MetaMask để sử dụng.");
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

  async function marketplaceContract() {
    const signer = await getSigner();
    return new ethers.Contract(addresses.marketplace, Marketplace.abi, signer);
  }

  async function assetContract() {
    if (!assetAddress) {
      throw new Error("Chưa có Asset Contract. Hãy đăng tài sản trước.");
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
    saveText("flowOwner", account);
    setStatus(`Đã chọn ${shortAddress(account)} làm Người bán.`);
  }

  function setCurrentAsCustomer() {
    if (!account) {
      setStatus("Hãy kết nối ví trước.");
      return;
    }

    setCustomer(account);
    saveText("flowCustomer", account);
    setStatus(`Đã chọn ${shortAddress(account)} làm Người mua.`);
  }

  async function createAsset() {
    try {
      setLoading(true);

      const signer = await getSigner();
      const current = await signer.getAddress();

      setOwner(current);
      saveText("flowOwner", current);

      const marketplace = await marketplaceContract();

      setStatus("Người bán đang gửi giao dịch đăng tài sản. Xác nhận trong MetaMask.");

      const tx = await marketplace.listAsset(
        ethers.utils.parseEther(ASSET.price),
        ethers.constants.AddressZero,
        0,
        { value: ethers.utils.parseEther("0.01") }
      );

      updateTxs({ create: tx.hash });
      setStatus("Đang chờ blockchain xác nhận giao dịch đăng tài sản...");

      const receipt = await tx.wait();
      const event = receipt.events?.find((e) => e.event === "ListAsset");
      const newAssetAddress = event?.args?.assetAddress;

      if (!newAssetAddress) {
        throw new Error("Giao dịch thành công nhưng chưa đọc được Asset Contract.");
      }

      setAssetAddress(newAssetAddress);
      saveText("flowAssetAddress", newAssetAddress);

      setStatus(`Tài sản đã được đăng thành công. Asset Contract: ${shortAddress(newAssetAddress)}.`);
      await refreshBalance(current);
    } catch (error) {
      setStatus(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function purchaseAccess() {
    try {
      setLoading(true);

      const signer = await getSigner();
      const current = await signer.getAddress();

      if (owner && current.toLowerCase() === owner.toLowerCase()) {
        throw new Error("Bạn đang dùng ví Người bán. Hãy chuyển sang ví Người mua.");
      }

      setCustomer(current);
      saveText("flowCustomer", current);

      const asset = await assetContract();
      const price = await asset.getPrice();

      setStatus("Người mua đang thanh toán quyền truy cập. Xác nhận trong MetaMask.");

      const tx = await asset.registerRequest({ value: price });

      updateTxs({ purchase: tx.hash });
      setStatus("Đang chờ blockchain xác nhận thanh toán...");

      await tx.wait();

      setStatus("Thanh toán thành công. Chuyển lại ví Người bán để cấp quyền.");
      await refreshBalance(current);
    } catch (error) {
      setStatus(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  async function grantAccess() {
    try {
      setLoading(true);

      const signer = await getSigner();
      const current = await signer.getAddress();

      if (owner && current.toLowerCase() !== owner.toLowerCase()) {
        throw new Error("Bạn đang không dùng ví Người bán. Hãy chuyển lại ví Người bán.");
      }

      if (!customer) {
        throw new Error("Chưa có ví Người mua. Hãy thực hiện bước thanh toán trước.");
      }

      const asset = await assetContract();

      setStatus("Người bán đang cấp quyền truy cập. Xác nhận trong MetaMask.");

      const tx = await asset.grantAccess(
        customer,
        ASSET.hash,
        ASSET.key,
        ASSET.ipfs
      );

      updateTxs({ grant: tx.hash });
      setStatus("Đang chờ blockchain xác nhận cấp quyền...");

      await tx.wait();

      setStatus("Đã cấp quyền truy cập. Chuyển sang ví Người mua để mở tài sản.");
      await refreshBalance(current);
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
      const current = await signer.getAddress();

      if (customer && current.toLowerCase() !== customer.toLowerCase()) {
        throw new Error("Bạn đang không dùng ví Người mua. Hãy chuyển sang ví Người mua.");
      }

      const asset = await assetContract();

      setStatus("Người mua đang xác minh quyền truy cập. Xác nhận trong MetaMask.");

      const tx = await asset.compareHashes(ASSET.hash);

      updateTxs({ open: tx.hash });
      setStatus("Đang chờ blockchain xác nhận quyền truy cập...");

      await tx.wait();

      const uri = await asset.getIpfsURI(current);
      const key = await asset.getEncryptedSymmetricKey();

      updateOpenedData({ uri, key });

      setStatus("Tài sản đã được mở thành công.");
      await refreshBalance(current);
    } catch (error) {
      setStatus(error.reason || error.message);
    } finally {
      setLoading(false);
    }
  }

  function resetFlow() {
    [
      "flowOwner",
      "flowCustomer",
      "flowAssetAddress",
      "flowTxs",
      "flowOpenedData",
    ].forEach((key) => localStorage.removeItem(key));

    setOwner("");
    setCustomer("");
    setAssetAddress("");
    setTxs({ create: "", purchase: "", grant: "", open: "" });
    setOpenedData({ uri: "", key: "" });
    setStatus("Đã làm sạch giao diện. Giao dịch blockchain cũ vẫn có trên Sepolia.");
  }

  const receipts = [
    { label: "Đăng tài sản", tx: txs.create },
    { label: "Thanh toán quyền truy cập", tx: txs.purchase },
    { label: "Cấp quyền truy cập", tx: txs.grant },
    { label: "Mở tài sản", tx: txs.open },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">DA</div>
          <div>
            <strong>Digital Asset Marketplace</strong>
            <span>Quy trình giao dịch tài sản số trên blockchain</span>
          </div>
        </div>

        <div className="top-actions">
          {!isSepolia && (
            <button className="btn secondary" onClick={switchToSepolia}>
              Chuyển Sepolia
            </button>
          )}
          <button className="btn primary" onClick={connectWallet} disabled={loading}>
            {account ? shortAddress(account) : "Kết nối ví"}
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="main-card">
          <div className="hero">
            <div>
              <span className="kicker">Blockchain transaction flow</span>
              <h1>Quy trình giao dịch tài sản số</h1>
              <p>
                Theo dõi từng bước từ đăng tài sản, thanh toán, cấp quyền đến mở tài sản.
                Mỗi bước đều có biên lai giao dịch trên Sepolia Etherscan.
              </p>
            </div>

            <div className="wallet-box">
              <div>
                <span>Network</span>
                <strong className={isSepolia ? "ok" : "bad"}>
                  {isSepolia ? "Sepolia" : chainId ? `Chain ${chainId}` : "Chưa kết nối"}
                </strong>
              </div>
              <div>
                <span>Ví hiện tại</span>
                <strong>{account ? shortAddress(account) : "Chưa kết nối"}</strong>
              </div>
              <div>
                <span>Vai trò hiện tại</span>
                <strong>{role}</strong>
              </div>
              <div>
                <span>Số dư</span>
                <strong>{balance ? `${balance} ETH` : "—"}</strong>
              </div>
            </div>
          </div>

          <section className="asset-summary">
            <div>
              <span className="kicker">Tài sản</span>
              <h2>{ASSET.name}</h2>
              <p>{ASSET.type} · Giá truy cập {ASSET.price} SepoliaETH</p>
            </div>

            <div className="asset-contract">
              <span>Asset Contract</span>
              {assetAddress ? (
                <a href={addressLink(assetAddress)} target="_blank" rel="noreferrer">
                  {shortAddress(assetAddress)}
                </a>
              ) : (
                <strong>Chưa tạo</strong>
              )}
            </div>
          </section>

          <section className="flow">
            <div className={currentStep === 1 ? "flow-step focus" : txs.create ? "flow-step done" : "flow-step"}>
              <div className="step-head">
                <span className="num">1</span>
                <div>
                  <h3>Người bán đăng tài sản</h3>
                  <p>Dùng ví Người bán để tạo tài sản trên blockchain.</p>
                </div>
              </div>

              <div className="roles">
                <span>Người bán: <b>{shortAddress(owner)}</b></span>
              </div>

              <div className="actions">
                <button className="btn secondary" onClick={setCurrentAsOwner} disabled={!account || loading}>
                  Chọn ví này làm Người bán
                </button>
                <button className="btn primary" onClick={createAsset} disabled={!account || !isSepolia || loading}>
                  Đăng tài sản
                </button>
              </div>

              {txs.create && (
                <a className="tx-link" href={txLink(txs.create)} target="_blank" rel="noreferrer">
                  Xem giao dịch đăng tài sản
                </a>
              )}
            </div>

            <div className={currentStep === 2 ? "flow-step focus" : txs.purchase ? "flow-step done" : "flow-step"}>
              <div className="step-head">
                <span className="num">2</span>
                <div>
                  <h3>Người mua thanh toán</h3>
                  <p>Chuyển sang ví Người mua để thanh toán quyền truy cập.</p>
                </div>
              </div>

              <div className="roles">
                <span>Người mua: <b>{shortAddress(customer)}</b></span>
              </div>

              <div className="actions">
                <button className="btn secondary" onClick={setCurrentAsCustomer} disabled={!account || loading}>
                  Chọn ví này làm Người mua
                </button>
                <button className="btn primary" onClick={purchaseAccess} disabled={!assetAddress || !account || !isSepolia || loading}>
                  Thanh toán quyền truy cập
                </button>
              </div>

              {txs.purchase && (
                <a className="tx-link" href={txLink(txs.purchase)} target="_blank" rel="noreferrer">
                  Xem giao dịch thanh toán
                </a>
              )}
            </div>

            <div className={currentStep === 3 ? "flow-step focus" : txs.grant ? "flow-step done" : "flow-step"}>
              <div className="step-head">
                <span className="num">3</span>
                <div>
                  <h3>Người bán cấp quyền</h3>
                  <p>Chuyển lại ví Người bán để cấp quyền truy cập cho Người mua.</p>
                </div>
              </div>

              <div className="roles">
                <span>Người bán: <b>{shortAddress(owner)}</b></span>
                <span>Người mua: <b>{shortAddress(customer)}</b></span>
              </div>

              <div className="actions">
                <button className="btn primary" onClick={grantAccess} disabled={!assetAddress || !customer || !account || !isSepolia || loading}>
                  Cấp quyền truy cập
                </button>
              </div>

              {txs.grant && (
                <a className="tx-link" href={txLink(txs.grant)} target="_blank" rel="noreferrer">
                  Xem giao dịch cấp quyền
                </a>
              )}
            </div>

            <div className={currentStep >= 4 ? "flow-step focus" : txs.open ? "flow-step done" : "flow-step"}>
              <div className="step-head">
                <span className="num">4</span>
                <div>
                  <h3>Người mua mở tài sản</h3>
                  <p>Chuyển lại ví Người mua để xác minh và lấy thông tin truy cập.</p>
                </div>
              </div>

              <div className="actions">
                <button className="btn primary" onClick={openAsset} disabled={!assetAddress || !customer || !account || !isSepolia || loading}>
                  Xác minh và mở tài sản
                </button>
              </div>

              {txs.open && (
                <a className="tx-link" href={txLink(txs.open)} target="_blank" rel="noreferrer">
                  Xem giao dịch mở tài sản
                </a>
              )}

              {(openedData.uri || openedData.key) && (
                <div className="access-result">
                  <div>
                    <span>Đường dẫn tài sản</span>
                    <strong>{openedData.uri}</strong>
                  </div>
                  <div>
                    <span>Khóa truy cập</span>
                    <strong>{openedData.key}</strong>
                  </div>
                </div>
              )}
            </div>
          </section>
        </section>

        <aside className="side-card">
          <h2>Biên lai blockchain</h2>
          <p>Mỗi giao dịch sau khi xác nhận sẽ có link Sepolia Etherscan riêng.</p>

          <div className="receipt-list">
            {receipts.map((item, index) => (
              <div className={item.tx ? "receipt done" : "receipt"} key={item.label}>
                <span>{index + 1}</span>
                <div>
                  <strong>{item.label}</strong>
                  {item.tx ? (
                    <a href={txLink(item.tx)} target="_blank" rel="noreferrer">
                      https://sepolia.etherscan.io/tx/{shortAddress(item.tx)}
                    </a>
                  ) : (
                    <p>Chưa có giao dịch</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="system-status">
            <span>Trạng thái</span>
            <strong>{loading ? "Đang xử lý giao dịch..." : status}</strong>
          </div>

          <button className="btn danger full" onClick={resetFlow} disabled={loading}>
            Làm lại quy trình
          </button>
        </aside>
      </main>
    </div>
  );
}
