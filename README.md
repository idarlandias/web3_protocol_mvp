# Web3 Protocol MVP

Projeto acadêmico de MVP de protocolo descentralizado com deploy em testnet, cobrindo ERC-20, ERC-721, staking, governança simples, integração com oráculo Chainlink e backend Web3 com ethers.js.

## Tecnologias
- Solidity ^0.8.24
- Hardhat
- OpenZeppelin
- Chainlink Data Feeds
- ethers.js

## Estrutura
- `contracts/GovToken.sol`: token ERC-20.
- `contracts/ProtocolNFT.sol`: NFT ERC-721.
- `contracts/Staking.sol`: staking com ajuste de recompensa via ETH/USD.
- `contracts/SimpleDAO.sol`: governança simplificada.
- `scripts/deploy.js`: deploy automatizado.
- `frontend/demo.js`: demonstra mint, stake e votação.
- `docs/architecture.md`: modelagem e fluxo.
- `docs/audit-report.md`: relatório simples de auditoria.

## Como executar
1. Instale dependências:
   ```bash
   npm install
   ```
2. Copie o arquivo de ambiente:
   ```bash
   cp .env.example .env
   ```
3. Compile:
   ```bash
   npm run compile
   ```
4. Faça deploy na Sepolia:
   ```bash
   npm run deploy:sepolia
   ```
5. Rode a demonstração:
   ```bash
   npm run demo
   ```

## Endereços e explorer
Após o deploy, os endereços serão salvos em `docs/deployment.json`. Você pode usar esses endereços para montar os links do Sepolia Etherscan.

## Observações
- O `demo.js` assume que a carteira de deploy tem permissão de mint do NFT.
- A DAO implementa uma governança básica para fins didáticos.
- Antes da entrega final, execute Slither, Mythril e crie um PDF técnico com prints do deploy/testnet.
