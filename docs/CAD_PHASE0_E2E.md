# CAD Phase 0 renderer smoke

The smoke test deliberately targets a real authenticated CAD document because the production route is protected by the engineering space permission.

Install a locally bundled browser once in the test environment:

```powershell
cd frontend
npx playwright install chromium
```

Run it against a started EQM environment with an engineering user token and an existing CAD document:

```powershell
$env:EQM_CAD_E2E_URL = "http://localhost:5173"
$env:EQM_CAD_E2E_TOKEN = "<bearer-token-without-Bearer-prefix>"
$env:EQM_CAD_E2E_DOCUMENT_ID = "<cad-document-id>"
npm run test:e2e:cad
```

It verifies Pixi canvas mount, viewport resize and route teardown. It skips explicitly when those three environment variables are absent.
