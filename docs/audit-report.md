# Relatório simples de auditoria

## Ferramentas previstas
- Slither
- Mythril
- Hardhat test/compile

## Controles implementados
- Uso de Solidity ^0.8.24 com checagens nativas de overflow.
- `ReentrancyGuard` no contrato de staking.
- `AccessControl` para funções administrativas no staking.
- `Ownable` nos contratos de token, NFT e DAO.
- Validação básica de endereços e quantidades.

## Pontos a validar antes do deploy real
- Criar suíte de testes cobrindo stake parcial, múltiplos depósitos e ciclo completo de votação.
- Revisar modelo de governança para snapshot de votos, evitando mudanças por saldo após criação da proposta.
- Revisar a lógica econômica do reward pool em cenários de grande volatilidade.
- Executar Slither e Mythril em ambiente local e anexar evidências ao relatório final.

## Comandos sugeridos
```bash
npm install
npx hardhat compile
npx hardhat test
slither .
myth analyze contracts/Staking.sol
```
