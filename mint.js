const axios = require('axios').default;
const { Connection, PublicKey, Transaction } = require('@solana/web3.js');
const bs58 = require('bs58');
const nacl = require('tweetnacl');
const readline = require('readline');
const { getKeypairFromPrivateKey } = require('./src/solanaUtils');
const { HEADERS } = require('./src/headers');

const DEVNET_URL = 'https://devnet.sonic.game/';
const connection = new Connection(DEVNET_URL, 'confirmed');

const ADDITIONAL_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

async function mintMysteryNFT(privateKey) {
  try {
    const keypair = getKeypairFromPrivateKey(privateKey);
    const publicKey = keypair.publicKey.toBase58();
    
    console.log(`Minting Mystery NFT for ${publicKey}`);

    const token = await getTokenWithRetry(privateKey);
    if (!token) {
      throw new Error('Failed to obtain authentication token after multiple attempts');
    }

    console.log('Token obtained successfully');

    const { data: buildTxData } = await axios({
      url: 'https://odyssey-api-beta.sonic.game/nft-campaign/mint/unlimited/build-tx',
      method: 'GET',
      headers: { ...HEADERS, ...ADDITIONAL_HEADERS, Authorization: `Bearer ${token}` },
    });

    console.log('Transaction built successfully');

    const txBuffer = Buffer.from(buildTxData.data.hash, 'base64');
    const tx = Transaction.from(txBuffer);
    tx.partialSign(keypair);
    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature);

    console.log(`Transaction sent and confirmed: ${signature}`);


  } catch (error) {
    console.error(`Error minting Mystery NFT: ${error.message}`);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

async function getTokenWithRetry(privateKey, maxRetries = 3, initialDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const token = await getToken(privateKey);
      if (token) return token;
    } catch (error) {
      console.error(`Attempt ${attempt} failed: ${error.message}`);
      if (attempt < maxRetries) {
        const delayTime = initialDelay * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${delayTime / 1000} seconds...`);
        await delay(delayTime);
      }
    }
  }
  return null;
}

async function getToken(privateKey) {
  try {
    const keypair = getKeypairFromPrivateKey(privateKey);
    const { data: challengeData } = await axios({
      url: 'https://odyssey-api-beta.sonic.game/auth/sonic/challenge',
      method: 'GET',
      params: { wallet: keypair.publicKey.toBase58() },
      headers: { ...HEADERS, ...ADDITIONAL_HEADERS },
    });

    console.log('Challenge obtained successfully');

    const message = challengeData.data;
    const signature = nacl.sign.detached(
      Buffer.from(message),
      keypair.secretKey
    );
    const encodedSignature = Buffer.from(signature).toString('base64');
    const encodedPublicKey = Buffer.from(keypair.publicKey.toBytes()).toString('base64');

    const response = await axios({
      url: 'https://odyssey-api-beta.sonic.game/auth/sonic/authorize',
      method: 'POST',
      headers: { ...HEADERS, ...ADDITIONAL_HEADERS },
      data: {
        address: keypair.publicKey.toBase58(),
        address_encoded: encodedPublicKey,
        signature: encodedSignature,
      },
    });

    console.log('Authorization successful');
    return response.data.data.token;
  } catch (error) {
    console.error(`Error fetching token: ${error.message}`);
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    throw error;
  }
}

(async () => {
    const timesToMint = await askQuestion('How many times do you want to mint? ');
    const delayInMilliseconds = 2000;
    const privateKey = 'isi privatekey disini';
    
    for (let i = 0; i < timesToMint; i++) {
        console.log(`\nMinting attempt ${i + 1}`);
        await mintMysteryNFT(privateKey);
        if (i < timesToMint - 1) { 
            console.log(`Waiting for 2 seconds before next mint...`);
            await delay(delayInMilliseconds);
        }
    }
})();
