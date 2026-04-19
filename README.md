<h1 align="center">
  🔗 Web3 Protocol MVP
</h1>

<p align="center">
  <strong>Protocolo descentralizado acadêmico com ERC-20, ERC-721, Staking, DAO e Oráculo Chainlink</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Solidity-0.8.24-363636?style=for-the-badge&logo=solidity&logoColor=white" />
  <img src="https://img.shields.io/badge/Hardhat-FFF100?style=for-the-badge&logo=hardhat&logoColor=black" />
  <img src="https://img.shields.io/badge/OpenZeppelin-4E5EE4?style=for-the-badge&logo=openzeppelin&logoColor=white" />
  <img src="https://img.shields.io/badge/Chainlink-375BD2?style=for-the-badge&logo=chainlink&logoColor=white" />
  <img src="https://img.shields.io/badge/ethers.js-6888FF?style=for-the-badge&logo=ethereum&logoColor=white" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Network-Sepolia_Testnet-purple?style=for-the-badge&logo=ethereum" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
  <img src="https://img.shields.io/github/last-commit/idarlandias/web3_protocol_mvp?style=for-the-badge&color=blue" />
</p>

---

## 📋 Sumário

- [Sobre o Projeto](#-sobre-o-projeto)
- [Arquitetura](#-arquitetura)
- [Tecnologias](#-tecnologias)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Como Executar](#-como-executar)
- [Deploy & Explorer](#-deploy--explorer)
- [Segurança & Auditoria](#-segurança--auditoria)
- [Autor](#-autor)

---

## 🚀 Sobre o Projeto

Este projeto é um **MVP de protocolo Web3 descentralizado**, desenvolvido com fins acadêmicos, que cobre os principais pilares do ecossistema Ethereum moderno:

| Componente | Padrão | Descrição |
|---|---|---|
| 🪙 GovToken | ERC-20 | Token de governança mintável |
| 🖼️ ProtocolNFT | ERC-721 | NFT com controle de permissão |
| 💰 Staking | Custom | Recompensa ajustada via preço ETH/USD |
| 🏛️ SimpleDAO | Custom | Governança on-chain simplificada |
| 📡 Chainlink | Data Feeds | Oráculo de preço em tempo real |

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (demo.js)                │
│              ethers.js · Node.js · Web3             │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │      Smart Contracts        │
        │   (Sepolia Testnet - EVM)   │
        └──┬─────┬──────┬────────┬───┘
           │     │      │        │
      GovToken  NFT  Staking  SimpleDAO
           │                    │
           └────────────────────┘
                     │
             Chainlink Oracle
              (ETH/USD Feed)
```

---

## 🛠️ Tecnologias

- **[Solidity ^0.8.24](https://soliditylang.org/)** — Linguagem de smart contracts
- **[Hardhat](https://hardhat.org/)** — Framework de desenvolvimento e testes
- **[OpenZeppelin](https://openzeppelin.com/)** — Contratos auditados e padronizados
- **[Chainlink Data Feeds](https://chain.link/)** — Oráculos descentralizados de preço
- **[ethers.js](https://ethers.org/)** — Biblioteca de interação com a blockchain

---

## 📁 Estrutura do Projeto

```
web3_protocol_mvp/
├── contracts/
│   ├── GovToken.sol        # Token ERC-20 de governança
│   ├── ProtocolNFT.sol     # NFT ERC-721 com controle de mint
│   ├── Staking.sol         # Staking com recompensa via ETH/USD
│   └── SimpleDAO.sol       # Governança on-chain básica
├── scripts/
│   └── deploy.js           # Deploy automatizado via Hardhat
├── frontend/
│   └── demo.js             # Demo: mint, stake e votação
├── test/                   # Testes unitários
├── docs/
│   ├── architecture.md     # Modelagem e fluxo do protocolo
│   ├── audit-report.md     # Relatório de auditoria
│   └── deployment.json     # Endereços pós-deploy
├── .env.example            # Variáveis de ambiente
├── hardhat.config.js       # Configuração da rede
└── package.json
```

---

## ⚡ Como Executar

### Pré-requisitos

- Node.js >= 18
- Carteira MetaMask com ETH Sepolia (faucet)
- Chave de API Alchemy ou Infura

### Passo a passo

```bash
# 1. Clone o repositório
git clone https://github.com/idarlandias/web3_protocol_mvp.git
cd web3_protocol_mvp

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com sua PRIVATE_KEY e RPC_URL

# 4. Compile os contratos
npm run compile

# 5. Faça o deploy na Sepolia
npm run deploy:sepolia

# 6. Execute a demonstração
npm run demo
```

---

## 🔍 Deploy & Explorer

Após o deploy, os endereços dos contratos são salvos automaticamente em `docs/deployment.json`.

Use os endereços gerados para verificar as transações no **[Sepolia Etherscan](https://sepolia.etherscan.io/)**.

> ⚠️ Certifique-se de que a carteira de deploy tem permissão de mint do NFT antes de rodar o `demo.js`.

---

## 🔐 Segurança & Auditoria

Antes da entrega final, recomenda-se executar as ferramentas de análise estática:

```bash
# Análise com Slither
slither .

# Análise com Mythril
myth analyze contracts/GovToken.sol
```

> O relatório de auditoria manual está disponível em [`docs/audit-report.md`](./docs/audit-report.md).

> A DAO implementa governança básica **para fins didáticos** — não recomendada para produção sem revisão completa.

---

## 👤 Autor

**Idarlan Dias**

[![GitHub](https://img.shields.io/badge/GitHub-idarlandias-181717?style=flat-square&logo=github)](https://github.com/idarlandias)

---

<p align="center">
  Feito com ❤️ e Solidity · Projeto Acadêmico Web3
</p>
