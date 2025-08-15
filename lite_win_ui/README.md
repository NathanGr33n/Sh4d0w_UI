# eDEXlite (Windows prebuilt via @homebridge)

This revision uses **@homebridge/node-pty-prebuilt-multiarch** which publishes current prebuilt binaries.

## Fresh install
```powershell
rmdir /s /q node_modules 2>$null
del package-lock.json yarn.lock pnpm-lock.yaml 2>$null
npm install
npm start
```

If prebuilds don’t match your Node/Electron ABI, install **Node 20 LTS** and try again.
