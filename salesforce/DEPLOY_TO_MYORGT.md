# Deploy to your org (alias: `MyOrgT`)

This folder contains Salesforce DX source for the CarShary demo objects and permission set.

## 1) Verify Salesforce CLI can access your org

Run (in your own terminal, not inside Codex sandbox):

```bash
sf org display -o MyOrgT
```

If it says org not found, login:

```bash
sf org login web -a MyOrgT
```

## 2) Deploy metadata

From the repo root:

```bash
cd salesforce
sf project deploy start -o MyOrgT
```

## 3) Assign permission set to your integration user

```bash
sf org assign permset -o MyOrgT -n CarShary_Integration_Access
```

## 4) Next manual setup (required for JWT)

You still must create the Connected App and upload the certificate in Salesforce Setup.
Use the step-by-step guide you already have (Connected App → OAuth → Digital Signatures).

