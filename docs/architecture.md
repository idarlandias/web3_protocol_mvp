# Arquitetura do MVP

## Problema resolvido
O protocolo demonstra um ecossistema Web3 educacional em que o usuário recebe um token fungível para governança e staking, um NFT para representar participação/credencial e uma DAO simples para votar em mudanças de parâmetros.

## Componentes
- **GovToken (ERC-20):** token de governança e recompensa.
- **ProtocolNFT (ERC-721):** NFT para mint de credenciais/colecionáveis.
- **Staking:** permite stake do ERC-20 e usa oracle Chainlink ETH/USD para ajustar recompensa.
- **SimpleDAO:** cria propostas, registra votos ponderados por saldo e executa o resultado lógico.
- **Backend Web3:** script em ethers.js para demonstrar mint, stake e votação.

## Fluxo
1. Deploy dos contratos.
2. Token é distribuído aos participantes.
3. Usuário aprova e faz stake do token.
4. Contrato consulta o preço do ETH/USD no oráculo para ajustar o multiplicador da recompensa.
5. Usuário recebe NFT mintado pelo administrador.
6. Usuário cria proposta e vota usando saldo de token.
