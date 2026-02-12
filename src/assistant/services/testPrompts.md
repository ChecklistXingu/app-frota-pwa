# Prompts de teste para a Naya (versão com mapa de intenções)

## Saudação
1. `bom dia`
2. `oi Naya`

## Abastecimento (fuel_spending)
3. `qual veículo mais gastou com abastecimento nos últimos 30 dias?`
4. `qual carro da filial Água Boa mais gastou com combustível nos últimos 90 dias?`

## Manutenção — top spending (maintenance_top_spending)
5. `qual veículo mais gastou com manutenção nos últimos 30 dias?`
6. `qual carro da filial Querência teve o maior custo com revisão nos últimos 60 dias?`

## Manutenção — totais (maintenance_totals)
7. `qual o total gasto com manutenção nos últimos 30 dias?`
8. `qual o custo médio de manutenção na filial Canarana nos últimos 90 dias?`
9. `quantas manutenções foram feitas nos últimos 7 dias?`
10. `qual o custo total e previsto de manutenção na filial Confresa nos últimos 30 dias?`

## Fallback (não implementado)
11. `qual veículo mais rodou km?` (deve cair no fallback genérico)

---

### Como validar
- Abra `/admin` e a Naya.
- Envie cada prompt.
- Verifique:
  - Resposta faz sentido.
  - Filial é detectada quando mencionada.
  - Período é respeitado (7, 30, 60, 90 dias).
  - Valores (R$) e quantidades aparecem corretamente.
  - Em caso de dados vazios, mensagem é clara.

### Exemplos de respostas esperadas
- Saudação: `Olá, Carlos! Eu sou a Naya, assistente da frota Xingu. Como posso te ajudar hoje?`
- Abastecimento: `Neste período, o veículo ABC-1234 • Modelo X foi o que mais gastou com abastecimento na filial Água Boa, somando R$ 9.253,78 em 6 abastecimentos, com um total de 1.394,93 litros.`
- Manutenção top: `Nos últimos 30 dias, o veículo DEF-5678 • Modelo Y teve o maior custo com manutenção considerando todas as filiais: R$ 4.200,00 em 2 manutenções (custo previsto R$ 4.500,00).`
- Manutenção totais: `Nos últimos 30 dias, foram 5 manutenções na filial Canarana, com custo total de R$ 12.300,00 (custo previsto R$ 13.000,00) e média de R$ 2.460,00 por manutenção.`
