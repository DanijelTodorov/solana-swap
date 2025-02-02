"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const web3_js_1 = require("@solana/web3.js");
const sender_1 = require("./lib/sender");
class SolanaTracker {
    constructor(keypair, rpc) {
        this.baseUrl = "https://swap-api.solanatracker.io";
        this.connection = new web3_js_1.Connection(rpc);
        this.keypair = keypair;
    }
    async getRate(from, to, amount, slippage) {
        const params = new URLSearchParams({
            from,
            to,
            amount: amount.toString(),
            slippage: slippage.toString(),
        });
        const url = `${this.baseUrl}/rate?${params}`;
        try {
            const response = await axios_1.default.get(url);
            return response.data;
        }
        catch (error) {
            console.error("Error fetching rate:", error);
            throw error;
        }
    }
    async getSwapInstructions(from, to, fromAmount, slippage, payer, priorityFee, forceLegacy) {
        const params = new URLSearchParams({
            from,
            to,
            fromAmount: fromAmount.toString(),
            slippage: slippage.toString(),
            payer,
            forceLegacy: forceLegacy ? "true" : "false",
        });
        if (priorityFee) {
            params.append("priorityFee", priorityFee.toString());
        }
        const url = `${this.baseUrl}/swap?${params}`;
        try {
            const response = await axios_1.default.get(url);
            response.data.forceLegacy = forceLegacy;
            return response.data;
        }
        catch (error) {
            console.error("Error fetching swap instructions:", error);
            throw error;
        }
    }
    async performSwap(swapResponse, options = {
        sendOptions: { skipPreflight: true },
        confirmationRetries: 30,
        confirmationRetryTimeout: 1000,
        lastValidBlockHeightBuffer: 150,
        resendInterval: 1000,
        confirmationCheckInterval: 1000,
        skipConfirmationCheck: false,
    }) {
        let serializedTransactionBuffer;
        try {
            serializedTransactionBuffer = Buffer.from(swapResponse.txn, "base64");
        }
        catch (error) {
            const base64Str = swapResponse.txn;
            const binaryStr = atob(base64Str);
            const buffer = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                buffer[i] = binaryStr.charCodeAt(i);
            }
            serializedTransactionBuffer = buffer;
        }
        let txn;
        if (swapResponse.isJupiter && !swapResponse.forceLegacy) {
            txn = web3_js_1.VersionedTransaction.deserialize(serializedTransactionBuffer);
            txn.sign([this.keypair]);
        }
        else {
            txn = web3_js_1.Transaction.from(serializedTransactionBuffer);
            txn.sign(this.keypair);
        }
        const blockhash = await this.connection.getLatestBlockhash();
        const blockhashWithExpiryBlockHeight = {
            blockhash: blockhash.blockhash,
            lastValidBlockHeight: blockhash.lastValidBlockHeight,
        };
        const txid = await (0, sender_1.transactionSenderAndConfirmationWaiter)({
            connection: this.connection,
            serializedTransaction: txn.serialize(),
            blockhashWithExpiryBlockHeight,
            options: options,
        });
        return txid.toString();
    }
}
exports.default = SolanaTracker;
