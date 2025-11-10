/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { ethers } from "ethers";
import axios from "axios";
import vaultabi from '../abi/Vault.json'
import usdc from '../abi/USDX.json'

declare global {
  interface Window {
    ethereum?: any;
  }
}

interface EventItem {
  type: "Deposit" | "Payment" | "BatchPayment";
  amount?: string;
  from?: string;
  paymentId?: string;
  recipients?: string[];
  timestamp: string;
}


const getProvider = () => {
  const rpc = import.meta.env.VITE_ARBITRUM_RPC;
  return new ethers.JsonRpcProvider(rpc, { name: "arbitrum-sepolia", chainId: 421614 });
};

const BACKEND_URL = "http://localhost:4000";
const VAULT_ADDRESS = import.meta.env.VITE_VAULT_ADDRESS;
const USDX_ADDRESS = import.meta.env.VITE_USDX_ADDRESS;
const VAULT_ABI = vaultabi;
const USDX_ABI = usdc;

export default function CorporateVaultDashboard() {
  const [account, setAccount] = useState<string>("");
  const [balance, setBalance] = useState("0");
  const [depositAmount, setDepositAmount] = useState("");
  const [recipients, setRecipients] = useState("");
  const [amounts, setAmounts] = useState("");
  //const [paymentId, setPaymentId] = useState("");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = async () => {
    if (!window.ethereum) return alert("Please install MetaMask!");
    try {
      setIsConnecting(true);
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);
      setIsConnecting(false);
    } catch (err: any) {
      alert(err.message);
      setIsConnecting(false);
    }
  };

  const fetchVaultBalance = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/vault-balance`);
      setBalance(res.data.balance);
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const handleDeposit = async () => {
    if (!account) return alert("Connect wallet first");
    if (!depositAmount || Number(depositAmount) <= 0) return alert("Enter a valid amount");

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const usdx = new ethers.Contract(USDX_ADDRESS, USDX_ABI, signer);
      const amountWei = ethers.parseUnits(depositAmount, 6);

      await usdx.approve(VAULT_ADDRESS, amountWei);
      await usdx.transfer(VAULT_ADDRESS, amountWei);

      alert(`Deposited ${depositAmount} USDx successfully`);
      const newEvent: EventItem = {
        type: "Deposit",
        amount: depositAmount,
        from: account,
        timestamp: new Date().toLocaleString(),
      };
          setEvents((prev) => [newEvent, ...prev]);

      setDepositAmount("");
      fetchVaultBalance();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBatchPayment = async () => {
    try {
      const addresses = recipients.split(",").map(a => a.trim());
      const amountList = amounts.split(",").map(a => a.trim());
      if (addresses.length !== amountList.length) return alert("Recipients and amounts count mismatch");

      const res = await axios.post(`${BACKEND_URL}/submit-batch-payment`, { recipients: addresses, amounts: amountList });
      alert(res.data.message);

      const newEvent: EventItem = {
        type: "BatchPayment",
        recipients: addresses,
        amount: amountList.join(", "),
        timestamp: new Date().toLocaleString(),
      };

      setEvents((prev) => [newEvent, ...prev]);
      setRecipients("");
      setAmounts("");
    } catch (err: any) {
      alert(err.response?.data?.error || err.message);
    }
  };

  // const handleApprovePayment = async () => {
  //   if (!paymentId) return alert("Enter a payment ID");
  //   try {
  //     const res = await axios.post(`${BACKEND_URL}/approve-payment`, { paymentId });
  //     alert(res.data.message);
  //     setPaymentId("");
  //   } catch (err: any) {
  //     alert(err.response?.data?.error || err.message);
  //   }
  // };

useEffect(() => {
  // Inner async function
  const init = async () => {
    fetchVaultBalance();

    const provider = getProvider();
    const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);

    vault.on("DepositUSDx", (from, amount) => {
      setEvents(prev => [
        {
          type: "Deposit",
          amount: ethers.formatUnits(amount, 6),
          from,
          timestamp: new Date().toLocaleString(),
        },
        ...prev,
      ]);
      fetchVaultBalance();
    });

    vault.on("PaymentExecuted", (id) => {
      setEvents(prev => [
        {
          type: "Payment",
          paymentId: id.toString(),
          timestamp: new Date().toLocaleString(),
        },
        ...prev,
      ]);
      fetchVaultBalance();
    });

    // Return a cleanup function
    return () => vault.removeAllListeners();
  };

  init(); // call async function
}, []);

    

  return (
    <div className="p-6 max-w-4xl mx-auto font-sans space-y-6">
      <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">💼 Corporate Vault Dashboard</h1>

      {/* Wallet Connect */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-2xl shadow-md flex justify-between items-center">
        {account ? (
          <p className="text-sm text-gray-700">
            Connected: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{account.slice(0,6)}...{account.slice(-4)}</span>
          </p>
        ) : (
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="bg-blue-600 hover:bg-blue-700 transition-colors text-white px-6 py-2 rounded-xl font-medium"
          >
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>

      {/* Vault Balance */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 text-center">
        <h2 className="text-xl font-semibold text-gray-700">Vault Balance</h2>
        <p className="text-4xl font-bold text-gray-900 mt-2">{balance} USDx</p>
      </div>

      {/* Deposit */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 space-y-4">
        <h3 className="text-lg font-semibold text-gray-700">Deposit USDx</h3>
        <input
          type="number"
          placeholder="Amount (e.g. 500)"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
          className="border p-3 w-full rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <button
          className="bg-green-600 hover:bg-green-700 transition-colors text-white px-6 py-3 rounded-xl w-full font-semibold"
          onClick={handleDeposit}
        >
          Deposit
        </button>
      </div>

      {/* Batch Payment */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 space-y-4">
        <h3 className="text-lg font-semibold text-gray-700">Submit Batch Payment</h3>
        <textarea
          placeholder="Recipient addresses (comma separated)"
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          className="border p-3 w-full rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
          rows={2}
        />
        <textarea
          placeholder="Amounts (comma separated)"
          value={amounts}
          onChange={(e) => setAmounts(e.target.value)}
          className="border p-3 w-full rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400"
          rows={2}
        />
        <button
          className="bg-yellow-600 hover:bg-yellow-700 transition-colors text-white px-6 py-3 rounded-xl w-full font-semibold"
          onClick={handleBatchPayment}
        >
          Submit Batch Payment
        </button>
      </div>

      {/* Approve Payment */}
      {/* <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 space-y-4">
        <h3 className="text-lg font-semibold text-gray-700">Approve Payment</h3>
        <input
          type="number"
          placeholder="Payment ID"
          value={paymentId}
          onChange={(e) => setPaymentId(e.target.value)}
          className="border p-3 w-full rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          className="bg-blue-700 hover:bg-blue-800 transition-colors text-white px-6 py-3 rounded-xl w-full font-semibold"
          onClick={handleApprovePayment}
        >
          Approve Payment
        </button>
      </div> */}

      {/* Event Log */}
     <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 max-h-72 overflow-auto">
  <h3 className="text-lg font-semibold text-gray-700 mb-4">Event Log</h3>
  <table className="w-full text-left border-collapse">
    <thead>
      <tr className="bg-gray-100">
        <th className="p-2 border-b">Type</th>
        <th className="p-2 border-b">Amount</th>
        <th className="p-2 border-b">From / Payment ID</th>
        <th className="p-2 border-b">Timestamp</th>
      </tr>
    </thead>
    <tbody>
      {events.map((ev, idx) => (
        <tr key={idx} className="hover:bg-gray-50 transition">
          <td className="p-2 border-b">{ev.type}</td>
          <td className="p-2 border-b">{ev.amount || "-"}</td>
          <td className="p-2 border-b">{ev.type === "Deposit" ? ev.from : ev.paymentId}</td>
          <td className="p-2 border-b">{ev.timestamp}</td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

    </div>
  );
}
