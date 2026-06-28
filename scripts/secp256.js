const { randomBytes } = require("crypto")
const secp256k1 = require("secp256k1")
const EthCrypto = require("eth-crypto")
const util = require("ethereumjs-util")

// Array to base64:
const uint8ToBase64 = (arr) => Buffer.from(arr).toString("base64")

const privateKeyHex = "9242159707b322822ee2164f2cf2bae054621a4658dd366ac28a214cfb7d7f95"
const publicKeyHex =
    "b834edfdb388102328e41a045569c27bcb61b3ee2e70d07ab54097a47850928fdf74eab6deb20309ab308c297011246ff648b70091cac2854e09bb946312a8e1"
const privateKeyBase64 = "kkIVlwezIoIu4hZPLPK64FRiGkZY3TZqwoohTPt9f5U="
const publicKeyBase64 =
    "uDTt/bOIECMo5BoEVWnCe8ths+4ucNB6tUCXpHhQko/fdOq23rIDCaswjClwESRv9ki3AJHKwoVOCbuUYxKo4Q=="

const privateKeyBuffer = new Buffer(privateKeyHex, "hex")
const pubkeyArr = util.privateToPublic(privateKeyBuffer)
const pubkeyBase64 = uint8ToBase64(pubkeyArr)

// Buffer to Array : x = Uint8Array.from(y)

const pirvKey = privateKeyBuffer

const pubKey = secp256k1.publicKeyCreate(pirvKey) // compressed

const pubKeyDecompressed = EthCrypto.publicKey.decompress(pubKey)

console.log(pubKeyDecompressed)
