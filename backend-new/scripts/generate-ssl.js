/**
 * Generate self-signed SSL certificate for local development.
 * Hasilkan cert.pem + key.pem di folder ssl/
 *
 * Usage: node scripts/generate-ssl.js
 */
const forge = require("node-forge");
const fs = require("fs");
const path = require("path");

const pki = forge.pki;
const keys = pki.rsa.generateKeyPair(2048);
const cert = pki.createCertificate();

cert.publicKey = keys.publicKey;
cert.serialNumber = "01" + Date.now().toString(16);
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 5);

const attrs = [
  { name: "commonName", value: "192.168.13.199" },
  { name: "organizationName", value: "WHS App Local" },
  { name: "countryName", value: "ID" },
];

cert.setSubject(attrs);
cert.setIssuer(attrs);

cert.setExtensions([
  { name: "basicConstraints", cA: true },
  { name: "keyUsage", keyCertSign: true, digitalSignature: true, keyEncipherment: true },
  {
    name: "subjectAltName",
    altNames: [
      { type: 7, ip: "192.168.13.199" },
      { type: 2, value: "192.168.13.199" },
      { type: 2, value: "localhost" },
    ],
  },
]);

cert.sign(keys.privateKey, forge.md.sha256.create());

const certPem = pki.certificateToPem(cert);
const keyPem = pki.privateKeyToPem(keys.privateKey);

const sslDir = path.join(__dirname, "..", "ssl");
if (!fs.existsSync(sslDir)) fs.mkdirSync(sslDir, { recursive: true });

fs.writeFileSync(path.join(sslDir, "cert.pem"), certPem);
fs.writeFileSync(path.join(sslDir, "key.pem"), keyPem);

console.log(" SSL certificate generated:");
console.log("  cert.pem  →", path.join(sslDir, "cert.pem"));
console.log("  key.pem   →", path.join(sslDir, "key.pem"));
console.log("  CN        : 192.168.13.199");
console.log("  SAN       : 192.168.13.199, localhost");
console.log("  Expires   :", cert.validity.notAfter.toISOString());
console.log("");
console.log(" Jalankan script ini SETIAP KALI setelah git pull / clone");
