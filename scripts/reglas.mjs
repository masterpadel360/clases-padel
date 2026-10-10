// Publica firestore.rules en Firebase. Lo corre GitHub cada vez que cambian las reglas.
import admin from "firebase-admin";
import { readFileSync } from "node:fs";
if (!process.env.FIREBASE_SA) { console.log("Falta el secreto FIREBASE_SA."); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
const r = await admin.securityRules().releaseFirestoreRulesetFromSource(readFileSync("../firestore.rules", "utf8"));
console.log("Reglas publicadas:", r.name);
