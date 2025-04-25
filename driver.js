"use strict";
// required npm install blind-signatures
const blindSignatures = require('blind-signatures');

const { Coin, COIN_RIS_LENGTH, IDENT_STR, BANK_STR } = require('./coin.js');
const utils = require('./utils.js');

// Details about the bank's key.
const BANK_KEY = blindSignatures.keyGeneration({ b: 2048 });
const N = BANK_KEY.keyPair.n.toString();
const E = BANK_KEY.keyPair.e.toString();

/**
 * Function signing the coin on behalf of the bank.
 * 
 * @param blindedCoinHash - the blinded hash of the coin.
 * 
 * @returns the signature of the bank for this coin.
 */
function signCoin(blindedCoinHash) {
  // عرض القيم المتداولة للمتغيرات
  /**
   * String representation of the blinded coin hash.
   * @type {string}
   */
  const blindedCoinHashStr = blindedCoinHash.toString();
  console.log("blindedCoinHash:", blindedCoinHash);  // عرض الـ blindedCoinHash
  console.log("BANK_KEY:", BANK_KEY);  // عرض الـ BANK_KEY
  console.log("N:", BANK_KEY.keyPair.n.toString());
  console.log("E:", BANK_KEY.keyPair.e.toString());
  
  return blindSignatures.sign({
      blinded: blindedCoinHash,
      key: BANK_KEY,
  });
}

/**
 * Parses a string representing a coin, and returns the left/right identity string hashes.
 *
 * @param {string} s - string representation of a coin.
 * 
 * @returns {[[string]]} - two arrays of strings of hashes, commiting the owner's identity.
 */
function parseCoin(s) {
  let [cnst,amt,guid,leftHashes,rightHashes] = s.split('-');
  if (cnst !== BANK_STR) {
    throw new Error(`Invalid identity string: ${cnst} received, but ${BANK_STR} expected`);
  }
  //console.log(`Parsing ${guid}, valued at ${amt} coins.`);
  let lh = leftHashes.split(',');
  let rh = rightHashes.split(',');
  return [lh,rh];
}

/**
 * Procedure for a merchant accepting a token. The merchant randomly selects
 * the left or right halves of the identity string.
 * 
 * @param {Coin} - the coin that a purchaser wants to use.
 * 
 * @returns {[String]} - an array of strings, each holding half of the user's identity.
 */
function acceptCoin(coin) {
  //
  // 1) التحقق من أن التوقيع صحيح
  const isValid = blindSignatures.verify({
    unblinded: coin.signature,
    message: coin.hash.toString(),  // تحويل coin.hash إلى String
    key: {
      n: coin.n,
      e: coin.e,
    }
  });

  if (!isValid) {
    throw new Error('Invalid coin signature.');
  }

  // 2) جمع العناصر من RIS والتحقق من الهاشات
  const [leftHashes, rightHashes] = parseCoin(coin.toString());

  const ris = [];
  for (let i = 0; i < COIN_RIS_LENGTH; i++) {
    const useLeft = Math.random() < 0.5;
    const val = useLeft ? coin.identityBits[i][0] : coin.identityBits[i][1];
    const expectedHash = useLeft ? leftHashes[i] : rightHashes[i];

    // تحقق من أن الهاش متطابق
    const actualHash = utils.hash(val);
    console.log(`Comparing hash for value: ${val}`);
    console.log(`Expected hash: ${expectedHash}`);
    console.log(`Actual hash: ${actualHash}`);
    
    if (actualHash !== expectedHash) {
      throw new Error('Invalid identity string: hash mismatch.');
    }

    ris.push(val);
  }

  // 3) إرجاع الـ RIS
  return ris;
  // ***YOUR CODE HERE***
  //
  // 1) Verify that the signature is valid.
  // 2) Gather the elements of the RIS, verifying the hashes.
  // 3) Return the RIS.


}

/**
 * If a token has been double-spent, determine who is the cheater
 * and print the result to the screen.
 * 
 * If the coin purchaser double-spent their coin, their anonymity
 * will be broken, and their idenityt will be revealed.
 * 
 * @param guid - Globablly unique identifier for coin.
 * @param ris1 - Identity string reported by first merchant.
 * @param ris2 - Identity string reported by second merchant.
 */
function determineCheater(guid, ris1, ris2) {
  //
  console.log(`Checking double-spending for coin ${guid}...`);
  
  for (let i = 0; i < ris1.length; i++) {
    if (ris1[i] !== ris2[i]) {
      // نعمل XOR بين القيمتين
      const xorResult = utils.xorHexStrings(ris1[i], ris2[i]);

      if (xorResult.startsWith(IDENT_STR)) {
        const userId = xorResult.slice(IDENT_STR.length);
        console.log(`Double-spender detected! Coin created by: ${userId}`);
        return;
      } else {
        console.log("Merchant attempted fraud. RIS values tampered.");
        return;
      }
    }
  }

  console.log("Same RIS values. Merchant reused RIS — Merchant is the cheater.");
  // ***YOUR CODE HERE***
  //
  // Go through the RIS strings one pair at a time.
  // If the pair XORed begins with IDENT, extract coin creator ID.
  // Otherwise, declare the merchant as the cheater.


}

let coin = new Coin('alice', 20, N, E);

coin.signature = signCoin(coin.blinded);

coin.unblind();


// Merchant 1 accepts the coin.
let ris1 = acceptCoin(coin);


// Merchant 2 accepts the same coin.
let ris2 = acceptCoin(coin);


// The bank realizes that there is an issue and
// identifies Alice as the cheater.
determineCheater(coin.guid, ris1, ris2);

console.log();
// On the other hand, if the RIS strings are the same,
// the merchant is marked as the cheater.
determineCheater(coin.guid, ris1, ris1);
