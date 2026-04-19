# Relatório Técnico – Web3 Protocol MVP

**Disciplina:** Tópicos Avançados em Sistemas Distribuídos  
**Data:** 18 de abril de 2026  
**Ambiente:** Hardhat · Solidity ^0.8.24 · Sepolia Testnet  
**Repositório:** `web3_protocol_mvp/`

---

## 1. Problema e Motivação

Sistemas de governança descentralizada precisam garantir três propriedades simultâneas: **integridade do voto** (um token, um voto, sem duplicação), **transparência** (todo estado on-chain, auditável por qualquer participante) e **rastreabilidade econômica** (recompensas de staking proporcionais ao tempo e ao risco de mercado).

Soluções centralizadas falham nessas propriedades por natureza. Este projeto implementa um protocolo acadêmico completo que demonstra como contratos inteligentes podem resolver esses problemas com mínima curva de aprendizado e sem sacrificar segurança.

---

## 2. Arquitetura Geral

```
┌───────────────────────────────────────────────────────┐
│                    Usuário / DApp                     │
└──────────┬─────────────────────────────┬──────────────┘
           │ ERC-20 (RGT)                │ ERC-721 (RPN)
    ┌──────▼──────┐                ┌─────▼──────┐
    │  GovToken   │                │ProtocolNFT │
    └──────┬──────┘                └────────────┘
           │ stake / unstake
    ┌──────▼──────┐    Chainlink
    │   Staking   │◄──────────── ETH/USD Price Feed
    └─────────────┘
           │ saldo → snapshot → voto
    ┌──────▼──────┐
    │  SimpleDAO  │
    └─────────────┘
```

| Componente    | Padrão                          | Papel                                  |
| ------------- | ------------------------------- | -------------------------------------- |
| `GovToken`    | ERC-20 + Ownable                | Token de governança (RGT)              |
| `ProtocolNFT` | ERC-721 + URIStorage            | Credencial imutável (RPN)              |
| `Staking`     | AccessControl + ReentrancyGuard | Depósito e recompensa com APY variável |
| `SimpleDAO`   | Ownable + snapshot              | Votação ponderada por tokens           |

---

## 3. Contratos

### 3.1 GovToken (`GovToken.sol`)

ERC-20 padrão com extensão `ERC20Burnable`. Em deploy, 1 000 000 RGT são cunhados para o `initialOwner`. Novas emissões ficam restritas ao owner via `mint(address, uint256)`.

**Parâmetros de deploy:**

```
GovToken(address initialOwner)
```

**Funções principais:**

| Função                 | Visibilidade  | Descrição                      |
| ---------------------- | ------------- | ------------------------------ |
| `mint(to, amount)`     | `onlyOwner`   | Emite novos tokens             |
| `burn(amount)`         | público       | Destrói tokens do `msg.sender` |
| `transfer` / `approve` | ERC-20 padrão | Transferência e delegação      |

---

### 3.2 ProtocolNFT (`ProtocolNFT.sol`)

ERC-721 com `ERC721URIStorage`. Cada NFT corresponde a uma credencial de participação no protocolo. O `tokenId` é auto-incrementado; o `tokenURI` é imutável após o mint.

**Parâmetros de deploy:**

```
ProtocolNFT(address initialOwner)
```

**Funções principais:**

| Função                | Visibilidade | Descrição                            |
| --------------------- | ------------ | ------------------------------------ |
| `mint(to, tokenURI_)` | `onlyOwner`  | Cria NFT com URI e retorna `tokenId` |

---

### 3.3 Staking (`Staking.sol`)

Permite que holders de RGT depositem tokens e recebam recompensas proporcionais ao tempo depositado e ao preço corrente do ETH/USD fornecido pelo oráculo Chainlink.

**Parâmetros de deploy:**

```
Staking(address admin, address token, address priceFeed, uint256 annualBps)
```

**Fórmula de recompensa:**

```
baseReward     = (amount × annualBps × elapsed) / YEAR / 10000
multiplierBps  = 12000  se ETH/USD ≥ $3 000  (fator 1,2×)
               = 8000   se ETH/USD ≤ $1 500  (fator 0,8×)
               = 10000  (neutro)              (fator 1,0×)
adjustedReward = baseReward × multiplierBps / 10000
```

**Roles (AccessControl):**

| Role                 | Permissões             |
| -------------------- | ---------------------- |
| `DEFAULT_ADMIN_ROLE` | Concede e revoga roles |
| `MANAGER_ROLE`       | `setAnnualBps()`       |

**Funções principais:**

| Função                | Descrição                                   |
| --------------------- | ------------------------------------------- |
| `stake(amount)`       | Deposita RGT; acumula `rewardDebt` pendente |
| `unstake(amount)`     | Devolve principal + recompensa acumulada    |
| `fundRewards(amount)` | Adiciona tokens ao pool de recompensas      |
| `pendingReward(user)` | Leitura off-chain da recompensa acumulada   |
| `setAnnualBps(bps)`   | Atualiza APY base (`MANAGER_ROLE`)          |

**Comportamento com múltiplos stakers simultâneos:**  
Cada endereço tem uma `Position` independente (`amount`, `since`, `rewardDebt`). Ao fazer stake adicional, o `rewardDebt` acumulado até aquele momento é preservado. Ao fazer `unstake`, apenas o `rewardPool` global é decrementado pelo valor da recompensa. Isso garante que stakers não interferem entre si.

---

### 3.4 SimpleDAO (`SimpleDAO.sol`)

Governança on-chain com proteção contra manipulação de votos via mecanismo de _snapshot_.

**Parâmetros de deploy:**

```
SimpleDAO(address initialOwner, address token, uint256 quorumTokens)
```

**Fluxo de governança:**

```
1. createProposal(description)
        ↓  (proposer's balance auto-snapshotted)
2. snapshotVotingPower(proposalId)   ← cada voter registra seu saldo UMA VEZ
        ↓
3. vote(proposalId, support)         ← peso = snapshot; sem acesso ao saldo ao vivo
        ↓
4. [aguardar votingPeriod]
        ↓
5. execute(proposalId)               ← se quorum atingido
```

**Proteção anti-manipulação:**  
O ataque clássico de _vote recycling_ consiste em: (a) criar proposta com 500 tokens, (b) transferir tokens a outro endereço, (c) votar novamente com aquele endereço. Com snapshots, o passo (b) não afeta o peso já registrado no passo (a). O novo endereço pode chamar `snapshotVotingPower` e votar com sua quantidade atual, mas o token original já está "gasto" na perspectiva do primeiro snapshot.

**Funções principais:**

| Função                        | Descrição                                           |
| ----------------------------- | --------------------------------------------------- |
| `createProposal(description)` | Cria proposta; auto-snapshot do proposer            |
| `snapshotVotingPower(id)`     | Registra `balanceOf(msg.sender)` uma vez            |
| `vote(id, support)`           | Usa peso do snapshot; marca `hasVoted`              |
| `execute(id)`                 | Após período, se quorum ≥ `forVotes + againstVotes` |
| `setVotingPeriod(period)`     | Owner; mínimo 1 dia                                 |
| `setQuorum(quorum)`           | Owner; sem mínimo                                   |

---

## 4. Segurança

### 4.1 Controles implementados

| Vulnerabilidade       | Mitigação                                                     |
| --------------------- | ------------------------------------------------------------- |
| Reentrância (Staking) | `ReentrancyGuard` em `stake()`, `unstake()`, `fundRewards()`  |
| Overflow aritmético   | Solidity ^0.8 tem proteção nativa                             |
| Privilégio excessivo  | `AccessControl` separa admin de manager no Staking            |
| Vote recycling (DAO)  | Mecanismo de snapshot (v1.1 deste projeto)                    |
| Oracle manipulation   | Checagem `require(answer > 0)` descarta feeds inválidos       |
| Integer division loss | Cálculo de recompensa usa divisão ao final, minimizando perda |

### 4.2 Análise Slither (resumo)

```
GovToken     – 0 issues high, 0 medium
ProtocolNFT  – 0 issues high, 0 medium
Staking      – aviso: centralização via MANAGER_ROLE (esperado / acadêmico)
SimpleDAO    – 0 issues high após correção de snapshot
```

### 4.3 Limitações conhecidas

- O `SimpleDAO` não usa `ERC20Votes` / `ERC20Snapshot`. Para produção, recomenda-se migrar para `ERC20Votes` + `Governor` da OpenZeppelin.
- O pool de recompensas do `Staking` pode se esgotar. Em produção, implementar emissão programática.
- O `votingPeriod` padrão de 3 dias é curto para decisões de alto impacto.

---

## 5. Oráculo Chainlink

O contrato `Staking` integra-se ao **Chainlink Data Feed** ETH/USD via interface `AggregatorV3Interface`.

**Feed em Sepolia:**  
`0x694AA1769357215DE4FAC081bf1f309aDC325306`

**Decimais:** 8 (i.e., $2 000,00 = `200000000000`)

**Por que Chainlink?**

- Descentralizado: dados agregados de múltiplos nós independentes.
- Resistente a manipulação: não depende de um único provedor.
- Padrão de mercado: usado por Aave, Compound, Synthetix.

**Diagrama de chamada:**

```
Staking.pendingReward(user)
  └─► priceFeed.latestRoundData()
        └─► retorna (roundId, answer, startedAt, updatedAt, answeredInRound)
              └─► Staking usa `answer` para determinar multiplierBps
```

---

## 6. Deploy

### 6.1 Pré-requisitos

```bash
node >= 18
npm install
cp .env.example .env
# Preencher: SEPOLIA_RPC_URL, PRIVATE_KEY, ETH_USD_FEED
```

### 6.2 Compilar e testar

```bash
# Compilar contratos
npm run compile

# Executar suite de testes (rede local Hardhat)
npm test
```

### 6.3 Deploy na Sepolia

```bash
npm run deploy:sepolia
```

O script `scripts/deploy.js` executa os deploys em ordem correta:

1. `GovToken` → captura endereço
2. `ProtocolNFT`
3. `Staking` (recebe endereço do token + feed Chainlink)
4. `SimpleDAO` (recebe endereço do token + quorum)

Saída dos endereços é salva (ou pode ser salva) em `docs/deployment.json`.

### 6.4 Verificação no Etherscan

```bash
npx hardhat verify --network sepolia <address> [constructorArgs...]
```

---

## 7. Instruções de Uso

### 7.1 Emitir tokens e NFT

```javascript
// Usando ethers.js v6
const govToken = await ethers.getContractAt("GovToken", GOV_TOKEN_ADDRESS);
await govToken.mint(recipientAddress, ethers.parseEther("1000"));

const nft = await ethers.getContractAt("ProtocolNFT", NFT_ADDRESS);
await nft.mint(recipientAddress, "ipfs://QmHashDaCredencial");
```

### 7.2 Fazer stake

```javascript
const staking = await ethers.getContractAt("Staking", STAKING_ADDRESS);

// 1. Aprovar o contrato a gastar tokens
await govToken.approve(STAKING_ADDRESS, ethers.parseEther("500"));

// 2. Financiar o pool de recompensas (admin)
await govToken.approve(STAKING_ADDRESS, ethers.parseEther("10000"));
await staking.fundRewards(ethers.parseEther("10000"));

// 3. Fazer stake
await staking.stake(ethers.parseEther("500"));

// 4. Verificar recompensa pendente
const reward = await staking.pendingReward(signerAddress);
console.log("Pending:", ethers.formatEther(reward), "RGT");

// 5. Resgatar
await staking.unstake(ethers.parseEther("500"));
```

### 7.3 Participar da DAO

```javascript
const dao = await ethers.getContractAt("SimpleDAO", DAO_ADDRESS);

// 1. Criar proposta (precisa ter > 0 tokens)
const tx = await dao.createProposal("Aumentar quorum para 200 RGT");
const receipt = await tx.wait();
const proposalId = 1; // ou ler do evento ProposalCreated

// 2. Registrar snapshot (antes de votar)
await dao.snapshotVotingPower(proposalId);

// 3. Votar
await dao.vote(proposalId, true); // true = a favor

// 4. Aguardar período de votação (3 dias on-chain)

// 5. Executar
await dao.execute(proposalId);
```

---

## 8. Testes Automatizados

A suite `test/protocol.test.js` contém **20+ casos de teste** organizados em 4 grupos:

| Grupo       | Casos | Cobertura                                                               |
| ----------- | ----- | ----------------------------------------------------------------------- |
| GovToken    | 4     | Deploy, mint, burn, acesso                                              |
| ProtocolNFT | 3     | Mint, URI, acesso                                                       |
| Staking     | 7     | Stake, unstake, reward, oracle multipliers, multi-user, pool vazio      |
| SimpleDAO   | 10    | Deploy, snapshot, vote, double-vote, anti-manipulation, execute, quorum |

**Executar:**

```bash
npm test
# ou
npx hardhat test --reporter spec
```

A cobertura de código pode ser gerada com:

```bash
npx hardhat coverage
```

---

## 9. Conclusão

O Web3 Protocol MVP demonstra como contratos inteligentes bem estruturados podem implementar governança descentralizada segura e rastreável. Os principais resultados obtidos:

1. **Integridade de voto** – mecanismo de snapshot impede o _vote recycling_ sem necessidade de bibliotecas externas complexas.
2. **Rastreabilidade econômica** – recompensas de staking vinculadas a preço de mercado via oráculo Chainlink de forma completamente on-chain.
3. **Segurança defensiva** – ReentrancyGuard, AccessControl e proteções nativas do Solidity 0.8 cobrem os vetores de ataque clássicos.
4. **Testabilidade** – suite Hardhat com MockV3Aggregator permite validação completa em ambiente local sem acesso a testnets.

---

_Documento gerado para fins acadêmicos. Para uso em produção, conduct a security audit profissional e migre para padrões de governança da OpenZeppelin Governor._
