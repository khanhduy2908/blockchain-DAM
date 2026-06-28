const util = require("ethereumjs-util")
const secp256k1 = require("secp256k1")

const uint8ToBase64 = (arr) => Buffer.from(arr).toString("base64")

const privateKey = "9242159707b322822ee2164f2cf2bae054621a4658dd366ac28a214cfb7d7f95"
const pubkeyArr = util.privateToPublic(new Buffer(privateKey, "hex"))

const privateKeyBase64 = Buffer.from(privateKey, "hex").toString("base64")
const pubkeyBase64 = uint8ToBase64(pubkeyArr)

const pubkeyHex = Buffer.from(pubkeyBase64, "base64").toString("hex")

console.log(`privateKeyBase64: ${privateKeyBase64}`)
console.log(`pubkeyBase64: ${pubkeyBase64}`)
console.log(`pubkeyHex: ${pubkeyHex}`)

const msg = "TuanVu"

// const sigObj = secp256k1.ecdsaSign(msg, privateKey)
// console.log(`sigObj: ${sigObj}`)
