import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
// import {Argv} from 'yargs/yargs';

import { BITBOX } from 'bitbox-sdk';
import { stringify } from '@bitauth/libauth';
import { Contract, SignatureTemplate, ElectrumNetworkProvider } from 'cashscript';
import { compileFile } from 'cashc';
import path from 'path';


// Initialise BITBOX
const bitbox = new BITBOX();

// Initialise a network provider for network operations on TESTNET
const provider = new ElectrumNetworkProvider('testnet');

// Initialise HD node
const rootSeed = bitbox.Mnemonic.toSeed('cc_covenant_v1_testnet');
const hdNode = bitbox.HDNode.fromSeed(rootSeed);

// receiver
const alice = bitbox.HDNode.toKeyPair(bitbox.HDNode.derive(hdNode, 0));
const alicePk = bitbox.ECPair.toPublicKey(alice);
const alicePkh = bitbox.Crypto.hash160(alicePk);
const aliceCashAddr = bitbox.ECPair.toCashAddress(alice);

// operators
const op0 = bitbox.HDNode.toKeyPair(bitbox.HDNode.derive(hdNode, 100));
const op1 = bitbox.HDNode.toKeyPair(bitbox.HDNode.derive(hdNode, 101));
const op2 = bitbox.HDNode.toKeyPair(bitbox.HDNode.derive(hdNode, 102));
const op0Pk = bitbox.ECPair.toPublicKey(op0);
const op1Pk = bitbox.ECPair.toPublicKey(op1);
const op2Pk = bitbox.ECPair.toPublicKey(op2);
const op0Pkh = bitbox.Crypto.hash160(op0Pk);
const op1Pkh = bitbox.Crypto.hash160(op1Pk);
const op2Pkh = bitbox.Crypto.hash160(op2Pk);

// miners
const miner0 = bitbox.HDNode.toKeyPair(bitbox.HDNode.derive(hdNode, 200));
const miner0Pk = bitbox.ECPair.toPublicKey(miner0);
const miner0Pkh = bitbox.Crypto.hash160(miner0Pk);
const miner0CashAddr = bitbox.ECPair.toCashAddress(miner0);

// Compile the ccCovenant contract to an artifact object
const artifact = compileFile(path.join(__dirname, 'cc_covenant_v1_testnet.cash'));


const txFee = 3000;

yargs(hideBin(process.argv))
  .command('printOutpointOpRetData <txid> <vout>', 'print outpoint', (yargs: any) => {
    return yargs.positional('txid', {
      type: 'string',
      describe: 'hex txid',
    }).positional('vout', {
      type: 'number',
      describe: 'vout',
    });
  }, (argv: any) => {
    const txid = Buffer.from(argv.txid, 'hex');
    const vout = encodeUint32LE(argv.vout);
    // console.log(txid.toString('hex'));
    // console.log(vout.toString('hex'));
    console.log(Buffer.concat([txid.reverse(), vout]).toString('hex'));
  })
  .command('printCBTXinfo', 'print coinbase tx info', (yargs: any) => {
    return yargs;
  }, (argv: any) => {
    const buf = Buffer.from('010000000000000000000000000000000000000000000000000000000000000000ffffffff', 'hex');
    console.log(bitbox.Crypto.hash160(buf).toString('hex'));
  })
  .command('printAliceInfo', 'print alice info', (yargs: any) => {
    return yargs;
  }, (argv: any) => {
    printAliceInfo();
  })
  .command('printMinerInfo', 'print miner info', (yargs: any) => {
    return yargs;
  }, (argv: any) => {
    printMinerInfo();
  })
  .command('printCCDepositInfo', 'print contract info for depositing', (yargs: any) => {
    return yargs;
  }, async (argv: any) => {
    await printCCDepositInfo();
  })
  .command('printCCUnlockInfo <receiverPkHex>', 'print contract info for unlocking', (yargs: any) => {
    return yargs.positional('receiverPkHex', {
      describe: 'receiver\'s pubkey in hex format, or alice',
    });
  }, async (argv: any) => {
    let receiverPk;
    if (argv.receiverPkHex == 'alice') {
      receiverPk = alicePk;
    } else {
      receiverPk = Buffer.from(argv.receiverPkHex, 'hex');
    }
    await printCCUnlockInfo(receiverPk);
  })
  .command('printCCVoteInfo <receiverPkHex> <nYes> <nNo>', 'print contract info for voting', (yargs: any) => {
    return yargs.positional('receiverPkHex', {
      describe: 'receiver\'s pubkey in hex format, or alice',
    }).positional('nYes', {
      type: 'number',
      description: 'Yes vote count',
    }).positional('nNo', {
      type: 'number',
      description: 'No vote count',
    });
  }, async (argv: any) => {
    let receiverPk;
    if (argv.receiverPkHex == 'alice') {
      receiverPk = alicePk;
    } else {
      receiverPk = Buffer.from(argv.receiverPkHex, 'hex');
    }
    await printCCVoteInfo(receiverPk, argv.nYes, argv.nNo);
  })
  .command('initUnlock <receiverPkHex> <utxo>', 'init unlock', (yargs: any) => {
    return yargs.positional('receiverPkHex', {
      describe: 'receiver\'s pubkey in hex format, or alice',
    }).positional('utxo', {
      describe: 'txid:vout',
    });
  }, async (argv: any) => {
    let receiverPk;
    if (argv.receiverPkHex == 'alice') {
      receiverPk = alicePk;
    } else {
      receiverPk = Buffer.from(argv.receiverPkHex, 'hex');
    }
    await initUnlock(receiverPk, argv.utxo);
  })
  .command('vote', 'vote', (yargs: any) => {
    return yargs.option('receiverPkHex', {
      required: true,
      type: 'string',
      description: 'receiver\'s pubkey in hex format, or alice',
    }).option('oldYes', {
      required: true,
      type: 'number',
      description: 'old Yes vote count',
    }).option('oldNo', {
      required: true,
      type: 'number',
      description: 'old No vote count',
    }).option('agreed', {
      required: true,
      type: 'boolean',
      description: 'vote Yes or No',
    }).option('votingUtxo', {
      required: true,
      type: 'string',
      description: 'votingUtxo',
    }).option('coinbaseUtxo', {
      required: true,
      type: 'string',
      description: 'coinbaseUtxo',
    }).option('cbRawTx', {
      required: true,
      type: 'string',
      description: 'cbRawTx',
    }).option('cbVout', {
      required: true,
      type: 'number',
      description: 'cbVout',
    }).option('opRetPos', {
      required: true,
      type: 'number',
      description: 'opRetPos',
    });
  }, async (argv: any) => {
    let receiverPk;
    if (argv.receiverPkHex == 'alice') {
      receiverPk = alicePk;
    } else {
      receiverPk = Buffer.from(argv.receiverPkHex, 'hex');
    }

    await vote(
      receiverPk,
      argv.oldYes,
      argv.oldNo,
      argv.agreed,
      argv.votingUtxo,
      argv.coinbaseUtxo,
      argv.cbRawTx,
      argv.cbVout,
      argv.opRetPos);
  })
  .command('finishUnlock <keyPairWIF> <nYes> <nNo> <utxo>', 'finish unlock by alice', (yargs: any) => {
    return yargs.positional('keyPairWIF', {
      describe: 'receiver\'s key pair in WIF format, or alice',
    }).positional('nYes', {
      type: 'number',
      description: 'Yes vote count',
    }).positional('nNo', {
      type: 'number',
      description: 'No vote count',
    }).positional('utxo', {
      type: 'string',
      description: 'txid:vout',
    });
  }, async (argv: any) => {
    let keyPair;
    if (argv.keyPairWIF == 'alice') {
      keyPair = alice.toWIF();
    } else {
      keyPair = argv.keyPairWIF;
    }
    await finishUnlock(keyPair, argv.nYes, argv.nNo, argv.utxo);
  })
  // .option('verbose', {
  //   alias: 'v',
  //   type: 'boolean',
  //   description: 'Run with verbose logging'
  // })
  .strictCommands()
  .argv

async function printAliceInfo(): Promise<void> {
  console.log("cash addr:", aliceCashAddr);
  const utxos = await provider.getUtxos(aliceCashAddr);
  console.log("utxos:", utxos);
}
async function printMinerInfo(): Promise<void> {
  console.log("cash addr:", miner0CashAddr);
  const utxos = await provider.getUtxos(miner0CashAddr);
  console.log("utxos:", utxos);
}
async function printCCDepositInfo(): Promise<void> {
  console.log('op0Pkh:', op0Pkh.toString('hex'));
  console.log('op1Pkh:', op1Pkh.toString('hex'));
  console.log('op2Pkh:', op2Pkh.toString('hex'));

  const contract = initCovenantForDeposit();
  console.log('contract address:', contract.address);
  console.log('contract balance:', await contract.getBalance());
  console.log('contract UTXOs  :', await contract.getUtxos());
}
async function printCCUnlockInfo(receiverPk: Buffer): Promise<void> {
  const contract = initCovenantForUnlock(receiverPk);
  console.log('contract address:', contract.address);
  console.log('contract balance:', await contract.getBalance());
  console.log('contract UTXOs  :', await contract.getUtxos());
}
async function printCCVoteInfo(receiverPk: Buffer, nYes: number, nNo: number): Promise<void> {
  const contract = initCovenantForVote(receiverPk, nYes, nNo);
  console.log('contract address:', contract.address);
  console.log('contract balance:', await contract.getBalance());
  console.log('contract UTXOs  :', await contract.getUtxos());
}

/* call cc_covenant functions */

async function initUnlock(receiverPk: Buffer, utxoIdVout: string): Promise<void> {
  const fromContract = initCovenantForDeposit();
  console.log('fromContract address:', fromContract.address);
  console.log('fromContract balance:', await fromContract.getBalance());

  const toContract = initCovenantForUnlock(receiverPk);
  console.log('toContract address  :', toContract.address);
  console.log('toContract balance  :', await toContract.getBalance());

  let utxos = await fromContract.getUtxos();
  console.log('fromContract UTXOs  :', utxos);
  if (utxos.length == 0) {
    console.log("no UTXOs !");
    return;
  }

  utxos = utxos.filter(x => x.txid + ':' + x.vout == utxoIdVout);
  if (utxos.length == 0) {
    console.log("UTXO not found !");
    return;
  }

  const utxo = utxos[0];
  const amt = utxo.satoshis - txFee;
  const tx = await fromContract.functions
    .run(
      new SignatureTemplate(op0), op0Pk, 
      bitbox.Crypto.hash160(receiverPk), 
      op0Pkh, op1Pkh, op2Pkh, 
      Buffer.of(),     // coinbaseTx
      Buffer.alloc(4), // coinbaseVout
      0,               // position
      false,           // agree?
      false,           // finish?
    )
    .from([utxo])
    .to(toContract.address, amt)
    .withHardcodedFee(txFee)
    .send();
  console.log('transaction details:', stringify(tx));
}

async function vote(receiverPk: Buffer, 
                    oldYes: number, 
                    oldNo: number,
                    agreed: boolean,
                    votingUtxo: string, 
                    coinbaseUtxo: string,
                    cbRawTx: string,
                    cbVout: number,
                    opRetPos: number): Promise<void> {

  console.log("vote...");
  console.log('receiverPk  :', receiverPk.toString('hex'));
  console.log('oldYes      :', oldYes);
  console.log('oldNo       :', oldNo);
  console.log('agreed      :', agreed);
  console.log('votingUtxo:', votingUtxo);
  console.log('coinbaseUtxo:', coinbaseUtxo);
  console.log('cbRawTx     :', cbRawTx);
  console.log('cbVout      :', cbVout);
  console.log('opRetPos    :', opRetPos);

  const newYes = agreed ? oldYes + 1 : oldYes;
  const newNo =  agreed ? oldNo : oldNo + 1

  const fromContract = initCovenantForVote(receiverPk, oldYes, oldNo);
  const toContract   = initCovenantForVote(receiverPk, newYes, newNo);

  let ccUtxos = await fromContract.getUtxos();
  console.log('fromContract UTXOs  :', ccUtxos);
  if (ccUtxos.length == 0) {
    console.log("fromContract have no UTXOs !");
    return;
  }

  ccUtxos = ccUtxos.filter(x => x.txid + ':' + x.vout == votingUtxo);
  if (ccUtxos.length == 0) {
    console.log("fromContract UTXO not found !");
    return;
  }

  let minerUtxos = await provider.getUtxos(miner0CashAddr);
  console.log('miner UTXOs  :', minerUtxos);
  if (minerUtxos.length == 0) {
    console.log("miner have no UTXOs !");
    return;
  }

  minerUtxos = minerUtxos.filter(x => x.txid + ':' + x.vout == coinbaseUtxo);
  if (minerUtxos.length == 0) {
    console.log("miner UTXO not found !");
    return;
  }

  const utxo0 = ccUtxos[0];
  const utxo1 = minerUtxos[0];
  const tx = await fromContract.functions
    .run(
      new SignatureTemplate(miner0), miner0Pk, 
      bitbox.Crypto.hash160(receiverPk), 
      op0Pkh, op1Pkh, op2Pkh, 
      Buffer.from(cbRawTx, 'hex'), // coinbaseTx
      encodeUint32LE(cbVout),      // coinbaseVout
      opRetPos,                    // position
      agreed,                      // agree?
      false,                       // finish?
    )
    .from([utxo0])
    .experimentalFromP2PKH(utxo1, new SignatureTemplate(miner0))
    .to(toContract.address, utxo0.satoshis - txFee)
    .withHardcodedFee(utxo1.satoshis + txFee)
    .send();
  console.log('transaction details:', stringify(tx));
}

async function finishUnlock(receiverWIF: string, 
                            nYes: number, 
                            nNo: number,
                            utxoIdVout: string): Promise<void> {

  const receiverPair = bitbox.ECPair.fromWIF(receiverWIF);
  const receiverPk = bitbox.ECPair.toPublicKey(receiverPair);
  const receiverAddr = bitbox.ECPair.toCashAddress(alice);

  const fromContract = initCovenantPk(receiverPk, nYes, nNo);
  console.log('fromContract address:', fromContract.address);
  // console.log('fromContract balance:', await fromContract.getBalance());

  const utxos = await fromContract.getUtxos();
  console.log('fromContract UTXOs  :', utxos);
  if (utxos.length == 0) {
    console.log("no UTXOs !");
    return;
  }

  const utxo = utxos[0];
  const amt = utxo.satoshis - txFee;
  const tx = await fromContract.functions
    .run(
      new SignatureTemplate(receiverPair), receiverPk,
      bitbox.Crypto.hash160(receiverPk), 
      op0Pkh, op1Pkh, op2Pkh, 
      Buffer.of(),     // coinbaseTx
      Buffer.alloc(4), // coinbaseVout
      0,               // position
      false,           // agree?
      true,            // finish?
    )
    .from([utxo])
    .to(receiverAddr, amt)
    .withHardcodedFee(txFee)
    .send();
  console.log('transaction details:', stringify(tx));
}

/* init cc_covenant */

function initCovenantForDeposit(): Contract {
  const receiverPkh = Buffer.alloc(20);
  return initCovenantPkh(receiverPkh, 0, 0);
}
function initCovenantForUnlock(receiverPk: Buffer): Contract {
  return initCovenantPk(receiverPk, 0, 0);
}
function initCovenantForVote(receiverPk: Buffer, nYes: number, nNo: number): Contract {
  return initCovenantPk(receiverPk, nYes, nNo);
}

function initCovenantPk(receiverPk: Buffer, nYes: number, nNo: number): Contract {
  const receiverPkh = bitbox.Crypto.hash160(receiverPk);
  return initCovenantPkh(receiverPkh, nYes, nNo);
}
function initCovenantPkh(receiverPkh: Buffer, nYes: number, nNo: number): Contract {
  const opAddrs = Buffer.concat([op0Pkh, op1Pkh, op2Pkh]);
  const opAddrsHash = bitbox.Crypto.hash160(opAddrs);
  const yesNoBytes = encodeUint32LE(nYes * 30000 + nNo);

  console.log('>> init cc_covenant, args:');
  console.log('0) opAddrsHash:', opAddrsHash.toString('hex'));
  console.log('1) receiverPkh:', receiverPkh.toString('hex'));
  console.log('2) yesNoBytes :', yesNoBytes.toString('hex'));

  const cArgs    = [opAddrsHash, receiverPkh, yesNoBytes];
  const contract = new Contract(artifact, cArgs, provider);
  // console.log("redeemScriptHex:", contract.getRedeemScriptHex());
  return contract;
}

function encodeUint32LE(n: number): Buffer {
  // little endian
  return Buffer.of(
     n        & 0xff,
    (n >>  8) & 0xff,
    (n >> 16) & 0xff,
    (n >> 24) & 0xff,
  );
}
